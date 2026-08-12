// Tầng lưu trữ dùng chung cho AI OS — ghi song song Firestore + đĩa local.
//
// NGUYÊN TẮC: đĩa local luôn được ghi trước và không bao giờ bị bỏ qua. Firestore là bản
// đồng bộ để không mất dữ liệu khi đổi máy/xoá cache. Nếu Firestore lỗi (mất mạng, hết
// quota, sai key) thì hàm vẫn trả về thành công kèm cờ `firestore.ok=false` + lý do —
// KHÔNG ném lỗi ra ngoài, vì mất kết nối cloud không được phép làm hỏng luồng làm việc.
//
// Trước đây dữ liệu nằm rải ba nơi: localStorage của trình duyệt (dự án/phiếu/công việc —
// đã mất một lần khi xoá cache), đĩa local (hr/, sales/), và KHÔNG Ở ĐÂU CẢ (bài viết
// Content Cluster). File này gom cả ba về một chỗ.

const fs = require("fs");
const path = require("path");
const { getFirebase, firebaseStatus } = require("./firebase");

const AIOS_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(AIOS_ROOT, "data");            // bản sao "công việc" + roster agent
const MKT_DATA = path.join(AIOS_ROOT, "marketing", "data");
const WORK_MIRROR = path.join(DATA_DIR, "work.json");
const AGENTS_MIRROR = path.join(DATA_DIR, "agents.json");

const MAX_DOC_BYTES = 900 * 1024; // Firestore chặn ở 1 MiB — chừa biên để báo lỗi rõ ràng
const BATCH_LIMIT = 450;          // Firestore cho tối đa 500 thao tác/batch

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.warn(`[db] File bản sao hỏng, bỏ qua: ${filePath} — ${e.message}`);
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Chuẩn hoá dữ liệu cho Firestore

   Firestore có ba ràng buộc mà dữ liệu AI OS dễ vi phạm:
   1. KHÔNG cho mảng lồng mảng ([[1,2]]) — mảng chứa object thì được.
   2. Document ID không được rỗng, không chứa "/", không dạng __x__.
   3. Một document tối đa 1 MiB (task.run.output chứa cả bài viết nên phải canh).

   Mã hoá mảng lồng thành { __arr: [...] } và giải mã đối xứng lúc đọc, để dữ liệu
   quay về đúng hình dạng cũ mà tầng trên không cần biết gì.
--------------------------------------------------------------------------- */

// Tên trường Firestore coi dấu chấm là dấu phân tách đường dẫn, và dạng __x__ là tên dành
// riêng. Đổi tên trường (a.b -> a_b) là mất mát KHÔNG hồi phục được, nên khi gặp key xấu thì
// gói cả object thành danh sách cặp k/v. Object có key sạch vẫn giữ nguyên hình dạng tự nhiên
// để còn truy vấn được trên Firestore.
function needsMapEscape(obj) {
  return Object.keys(obj).some((k) => k === "" || k.includes(".") || /^__.*__$/.test(k));
}

function encodeForFirestore(v) {
  if (Array.isArray(v)) {
    return v.map((item) => (Array.isArray(item) ? { __arr: encodeForFirestore(item) } : encodeForFirestore(item)));
  }
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const entries = Object.entries(v).filter(([, val]) => val !== undefined);
    if (needsMapEscape(v)) {
      return { __map: entries.map(([k, val]) => ({ k, v: encodeForFirestore(val) })) };
    }
    const out = {};
    for (const [k, val] of entries) out[k] = encodeForFirestore(val);
    return out;
  }
  return v;
}

function isWrapper(x, key) {
  return x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 1 && key in x;
}

function decodeFromFirestore(v) {
  if (Array.isArray(v)) {
    return v.map((item) => (isWrapper(item, "__arr") ? decodeFromFirestore(item.__arr) : decodeFromFirestore(item)));
  }
  if (v && typeof v === "object") {
    if (typeof v.toDate === "function") return v.toDate().toISOString(); // Timestamp -> ISO
    if (isWrapper(v, "__map") && Array.isArray(v.__map)) {
      const out = {};
      for (const pair of v.__map) out[pair.k] = decodeFromFirestore(pair.v);
      return out;
    }
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = decodeFromFirestore(val);
    return out;
  }
  return v;
}

function safeDocId(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  const cleaned = s.replace(/\//g, "_");
  if (cleaned === "." || cleaned === ".." || /^__.*__$/.test(cleaned)) return `id_${cleaned}`;
  return cleaned.slice(0, 1500);
}

function assertDocSize(id, obj) {
  const bytes = Buffer.byteLength(JSON.stringify(obj), "utf8");
  if (bytes > MAX_DOC_BYTES) {
    throw err(413, `Bản ghi "${id}" nặng ${Math.round(bytes / 1024)} KB, vượt trần 1 MiB của Firestore. Tách nội dung dài ra collection riêng (vd bài viết) thay vì nhét vào một document.`);
  }
}

// Firestore chỉ cho 500 thao tác mỗi batch — chia nhỏ, không thì batch lớn ném lỗi câm.
async function commitInChunks(db, ops) {
  let written = 0;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.type === "set") batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
    written += Math.min(BATCH_LIMIT, ops.length - i);
  }
  return written;
}

function slugify(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt sau khi tách tổ hợp
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "khong-ten";
}

/* =========================================================================
   1. CÔNG VIỆC — thay thế localStorage "aios-work-v1"
   ========================================================================= */

// Mỗi nhóm thành một collection riêng để sau này truy vấn được (vd: mọi task quá hạn),
// thay vì nhét cả khối state vào một document duy nhất.
const WORK_COLLECTIONS = {
  staff: "staff",
  customers: "customers",
  projects: "projects",
  tickets: "tickets",
  tasks: "tasks",
  leads: "work_leads", // tách khỏi kho lead của sales — hai nguồn khác nhau
};
const META_COLLECTION = "aios_meta";

/* Bộ nhớ đệm để chỉ ghi những document THỰC SỰ đổi.
   Nếu mỗi lần lưu đều ghi đè cả ~300 document thì hạn mức 20.000 lượt ghi/ngày của gói
   miễn phí cháy chỉ sau khoảng 60 lần bấm. Diff theo chuỗi JSON đưa con số đó về 1-3
   document mỗi lần lưu. */
let workCache = null; // { [collection]: Map(id -> jsonString) }

function buildWorkMap(state) {
  const map = {};
  for (const [key, col] of Object.entries(WORK_COLLECTIONS)) {
    const rows = Array.isArray(state[key]) ? state[key] : [];
    const m = new Map();
    for (const row of rows) {
      const id = safeDocId(row && row.id);
      if (!id) continue;
      m.set(id, JSON.stringify(row));
    }
    map[col] = m;
  }
  return map;
}

async function primeWorkCache(db) {
  const cache = {};
  for (const col of Object.values(WORK_COLLECTIONS)) {
    const snap = await db.collection(col).get();
    const m = new Map();
    snap.forEach((doc) => m.set(doc.id, JSON.stringify(decodeFromFirestore(doc.data()))));
    cache[col] = m;
  }
  workCache = cache;
}

async function loadWork() {
  const fb = getFirebase();
  if (fb) {
    try {
      const state = { version: 1 };
      let total = 0;
      const cache = {};
      for (const [key, col] of Object.entries(WORK_COLLECTIONS)) {
        const snap = await fb.db.collection(col).get();
        const rows = [];
        const m = new Map();
        snap.forEach((doc) => {
          const data = decodeFromFirestore(doc.data());
          rows.push(data);
          m.set(doc.id, JSON.stringify(data));
        });
        cache[col] = m;
        state[key] = rows;
        total += rows.length;
      }
      const metaOwners = await fb.db.collection(META_COLLECTION).doc("agentOwners").get();
      state.agentOwners = metaOwners.exists ? decodeFromFirestore(metaOwners.data()).map || {} : {};
      const metaWork = await fb.db.collection(META_COLLECTION).doc("work").get();
      if (metaWork.exists) state.version = decodeFromFirestore(metaWork.data()).version || 1;

      if (total > 0) {
        workCache = cache;
        return { state, nguon: "firestore" };
      }
      // Firestore rỗng (lần chạy đầu) — rơi xuống bản sao local để nạp dữ liệu sẵn có
      workCache = cache;
    } catch (e) {
      console.warn("[db] Không đọc được Firestore, dùng bản sao local:", e.message);
    }
  }

  const local = readJson(WORK_MIRROR);
  if (local && Array.isArray(local.tasks)) return { state: local, nguon: "local" };
  return { state: null, nguon: "trong" };
}

async function saveWork(state) {
  if (!state || !Array.isArray(state.tasks)) {
    throw err(400, "Dữ liệu công việc không hợp lệ — thiếu mảng 'tasks'.");
  }

  // Bản sao local ghi trước và luôn ghi: đây là lưới an toàn khi cloud hỏng.
  writeJson(WORK_MIRROR, { ...state, cap_nhat_luc: new Date().toISOString() });

  const fb = getFirebase();
  if (!fb) return { local: true, firestore: { ok: false, lyDo: firebaseStatus().lyDo }, ghi: 0, xoa: 0 };

  try {
    if (!workCache) await primeWorkCache(fb.db);

    const next = buildWorkMap(state);
    const ops = [];
    let ghi = 0;
    let xoa = 0;

    for (const col of Object.values(WORK_COLLECTIONS)) {
      const prev = workCache[col] || new Map();
      const cur = next[col] || new Map();

      for (const [id, json] of cur) {
        if (prev.get(id) === json) continue; // không đổi -> không tốn lượt ghi
        const row = JSON.parse(json);
        assertDocSize(`${col}/${id}`, row);
        ops.push({ type: "set", ref: fb.db.collection(col).doc(id), data: encodeForFirestore(row) });
        ghi++;
      }
      for (const id of prev.keys()) {
        if (cur.has(id)) continue;
        ops.push({ type: "delete", ref: fb.db.collection(col).doc(id) });
        xoa++;
      }
    }

    const ownersJson = JSON.stringify(state.agentOwners || {});
    if (workCache.__owners !== ownersJson) {
      ops.push({
        type: "set",
        ref: fb.db.collection(META_COLLECTION).doc("agentOwners"),
        data: encodeForFirestore({ map: state.agentOwners || {}, cap_nhat_luc: new Date().toISOString() }),
      });
    }

    if (ops.length) {
      ops.push({
        type: "set",
        ref: fb.db.collection(META_COLLECTION).doc("work"),
        data: encodeForFirestore({ version: state.version || 1, cap_nhat_luc: new Date().toISOString() }),
      });
      await commitInChunks(fb.db, ops);
    }

    workCache = next;
    workCache.__owners = ownersJson;
    return { local: true, firestore: { ok: true }, ghi, xoa };
  } catch (e) {
    // Cloud hỏng KHÔNG được làm hỏng luồng làm việc — local đã ghi xong ở trên.
    console.warn("[db] Ghi Firestore thất bại (bản sao local vẫn an toàn):", e.message);
    workCache = null; // buộc đọc lại lần sau, tránh diff lệch
    return { local: true, firestore: { ok: false, lyDo: e.message }, ghi: 0, xoa: 0 };
  }
}

/* =========================================================================
   2. BÀI VIẾT CONTENT CLUSTER
   Vá đúng lỗ hổng đã phát hiện: engine chạy trong trình duyệt không ghi được đĩa,
   nên 11 bài của lần chạy trước chỉ nằm trong localStorage rồi mất sạch.
   ========================================================================= */

function articleFilename(article) {
  const ma = safeDocId(article.ma_bai) || "BAI";
  return `${ma}-${slugify(article.tieu_de || article.slug)}.md`;
}

function withFrontmatter(article) {
  const body = String(article.noi_dung || "");
  if (/^---\r?\n/.test(body)) return body; // agent đã trả kèm frontmatter theo template
  const fm = [
    "---",
    `ma_bai: ${article.ma_bai || ""}`,
    `tieu_de: "${String(article.tieu_de || "").replace(/"/g, "'")}"`,
    `loai: ${article.loai || "cluster"}`,
    `tu_khoa_chinh: "${String(article.tu_khoa_chinh || "").replace(/"/g, "'")}"`,
    `cluster: ${article.cluster || ""}`,
    `tao_luc: ${article.tao_luc || new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
  return fm + body;
}

/* Ghi MỘT bài ngay khi nó vừa xong, không đợi hết vòng lặp — chạy dở chừng thì phần
   đã viết vẫn còn nguyên trên đĩa. */
async function saveArticle(payload) {
  const clusterId = safeDocId(payload && payload.cluster);
  const maBai = safeDocId(payload && payload.ma_bai);
  if (!clusterId) throw err(400, "Thiếu 'cluster' (vd CLS-2026-001)");
  if (!maBai) throw err(400, "Thiếu 'ma_bai' (vd P-00, C-01)");
  if (!payload.noi_dung || !String(payload.noi_dung).trim()) throw err(400, "Thiếu 'noi_dung' — không lưu bài rỗng.");

  const article = {
    ma_bai: maBai,
    cluster: clusterId,
    tieu_de: payload.tieu_de || "",
    slug: payload.slug || slugify(payload.tieu_de),
    loai: payload.loai === "pillar" ? "pillar" : "cluster",
    tu_khoa_chinh: payload.tu_khoa_chinh || "",
    tu_khoa_lsi: Array.isArray(payload.tu_khoa_lsi) ? payload.tu_khoa_lsi : [],
    noi_dung: String(payload.noi_dung),
    so_tu: String(payload.noi_dung).trim().split(/\s+/).length,
    prompt_anh: Array.isArray(payload.prompt_anh) ? payload.prompt_anh : [],
    // Ảnh đã sinh thật: { vi_tri, prompt, url_tripx, file_local, id_base, credit }
    anh: Array.isArray(payload.anh) ? payload.anh : [],
    // Kết quả đăng lên TripX: { id, slug, url, published, dang_luc }
    tripx: payload.tripx || null,
    nguon: payload.nguon || "",
    task_id: payload.task_id || "",
    tao_luc: payload.tao_luc || new Date().toISOString(),
  };

  // --- Bản sao đĩa ---
  const dir = path.join(MKT_DATA, "bai-viet", clusterId);
  ensureDir(dir);
  const file = path.join(dir, articleFilename(article));
  fs.writeFileSync(file, withFrontmatter(article), "utf8");
  const relFile = path.relative(AIOS_ROOT, file).replace(/\\/g, "/");

  // Sổ theo dõi cluster trên đĩa
  const clusterFile = path.join(MKT_DATA, "clusters", `${clusterId}.json`);
  const sheet = readJson(clusterFile) || { cluster: clusterId, chu_de: payload.chu_de || "", nguon: article.nguon, tao_luc: article.tao_luc, bai_viet: [] };
  sheet.bai_viet = (sheet.bai_viet || []).filter((b) => b.ma_bai !== maBai);
  sheet.bai_viet.push({ ma_bai: maBai, tieu_de: article.tieu_de, loai: article.loai, so_tu: article.so_tu, file: relFile });
  sheet.bai_viet.sort((a, b) => String(a.ma_bai).localeCompare(String(b.ma_bai)));
  sheet.cap_nhat_luc = new Date().toISOString();
  if (payload.chu_de) sheet.chu_de = payload.chu_de;
  writeJson(clusterFile, sheet);

  // --- Firestore ---
  const fb = getFirebase();
  if (!fb) return { saved: true, file: relFile, firestore: { ok: false, lyDo: firebaseStatus().lyDo } };

  try {
    assertDocSize(`clusters/${clusterId}/articles/${maBai}`, article);
    await fb.db.collection("clusters").doc(clusterId).set(
      encodeForFirestore({
        cluster: clusterId,
        chu_de: sheet.chu_de || "",
        nguon: article.nguon,
        so_bai: sheet.bai_viet.length,
        cap_nhat_luc: sheet.cap_nhat_luc,
      }),
      { merge: true }
    );
    await fb.db.collection("clusters").doc(clusterId).collection("articles").doc(maBai).set(encodeForFirestore(article));
    return { saved: true, file: relFile, firestore: { ok: true } };
  } catch (e) {
    console.warn("[db] Ghi bài viết lên Firestore thất bại (file .md vẫn đã lưu):", e.message);
    return { saved: true, file: relFile, firestore: { ok: false, lyDo: e.message } };
  }
}

async function listArticles(clusterIdRaw) {
  const clusterId = safeDocId(clusterIdRaw);
  if (!clusterId) throw err(400, "Thiếu mã cluster");
  const fb = getFirebase();
  if (fb) {
    try {
      const snap = await fb.db.collection("clusters").doc(clusterId).collection("articles").get();
      if (!snap.empty) {
        const rows = [];
        snap.forEach((d) => rows.push(decodeFromFirestore(d.data())));
        rows.sort((a, b) => String(a.ma_bai).localeCompare(String(b.ma_bai)));
        return { cluster: clusterId, bai_viet: rows, nguon: "firestore" };
      }
    } catch (e) {
      console.warn("[db] Không đọc được bài viết từ Firestore:", e.message);
    }
  }
  const sheet = readJson(path.join(MKT_DATA, "clusters", `${clusterId}.json`));
  return { cluster: clusterId, bai_viet: sheet ? sheet.bai_viet || [] : [], nguon: "local" };
}

function listClusters() {
  const dir = path.join(MKT_DATA, "clusters");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const s = readJson(path.join(dir, f)) || {};
      return { cluster: s.cluster || f.replace(/\.json$/, ""), chu_de: s.chu_de || "", so_bai: (s.bai_viet || []).length, cap_nhat_luc: s.cap_nhat_luc || null };
    })
    .sort((a, b) => String(b.cluster).localeCompare(String(a.cluster)));
}

/* =========================================================================
   3. ẢNH & FILE — Cloud Storage
   ========================================================================= */

const MEDIA_MIME = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
  "application/pdf": ".pdf", "text/markdown": ".md",
};

// dataBase64 có thể là data URI đầy đủ ("data:image/png;base64,...") hoặc base64 trần.
async function saveMedia(payload) {
  const clusterId = safeDocId(payload && (payload.cluster || "chung")) || "chung";
  let raw = String((payload && payload.dataBase64) || "");
  let contentType = payload && payload.contentType;

  const m = raw.match(/^data:([^;,]+);base64,(.*)$/s);
  if (m) {
    contentType = contentType || m[1];
    raw = m[2];
  }
  if (!raw) throw err(400, "Thiếu 'dataBase64'");
  contentType = contentType || "image/png";
  if (!MEDIA_MIME[contentType]) {
    throw err(400, `Định dạng "${contentType}" không nằm trong danh sách cho phép: ${Object.keys(MEDIA_MIME).join(", ")}`);
  }

  const buf = Buffer.from(raw, "base64");
  if (!buf.length) throw err(400, "Nội dung base64 rỗng hoặc sai định dạng");
  const maxMb = Number(process.env.MEDIA_MAX_MB || 15);
  if (buf.length > maxMb * 1024 * 1024) throw err(413, `File ${Math.round(buf.length / 1024 / 1024)} MB vượt trần ${maxMb} MB`);

  const base = slugify(payload.ten || payload.ma_bai || "anh");
  const filename = `${base}-${Date.now()}${MEDIA_MIME[contentType]}`;
  const objectPath = `clusters/${clusterId}/images/${filename}`;

  // Bản sao đĩa — giữ được ảnh kể cả khi chưa bật Storage (gói Blaze)
  const localDir = path.join(MKT_DATA, "bai-viet", clusterId, "anh");
  ensureDir(localDir);
  const localFile = path.join(localDir, filename);
  fs.writeFileSync(localFile, buf);
  const relFile = path.relative(AIOS_ROOT, localFile).replace(/\\/g, "/");

  const meta = {
    id: filename,
    cluster: clusterId,
    ma_bai: payload.ma_bai || "",
    prompt: payload.prompt || "",
    contentType,
    bytes: buf.length,
    file_local: relFile,
    storage_path: null,
    url: null,
    tao_luc: new Date().toISOString(),
  };

  const fb = getFirebase();
  if (!fb) return { saved: true, file: relFile, firestore: { ok: false, lyDo: firebaseStatus().lyDo } };

  if (!fb.bucket) {
    // Firestore có nhưng Storage chưa bật — vẫn ghi metadata để không mất dấu vết
    try {
      await fb.db.collection("media").doc(filename).set(encodeForFirestore(meta));
    } catch (e) { /* đã có bản sao đĩa */ }
    return {
      saved: true, file: relFile,
      firestore: { ok: true },
      storage: { ok: false, lyDo: "Chưa cấu hình FIREBASE_STORAGE_BUCKET — Cloud Storage cho project mới cần bật gói Blaze." },
    };
  }

  /* Storage và Firestore là HAI dịch vụ độc lập — phải báo cáo tách bạch. Gộp chung
     một try sẽ nói dối rằng Firestore hỏng khi thực ra chỉ bucket chưa được tạo, và
     còn vứt luôn metadata đáng lẽ ghi được. Ảnh mất dấu vết vì một lỗi không liên quan. */
  let storage = { ok: false, lyDo: null };
  try {
    const fileRef = fb.bucket.file(objectPath);
    await fileRef.save(buf, { contentType, resumable: false, metadata: { contentType } });
    meta.storage_path = objectPath;
    // URL ký hạn dài để nhúng vào bài viết mà không phải mở công khai cả bucket
    try {
      const [url] = await fileRef.getSignedUrl({ action: "read", expires: "2099-12-31" });
      meta.url = url;
    } catch (e) { /* thiếu quyền iam.serviceAccounts.signBlob — bỏ qua, vẫn có storage_path */ }
    storage = { ok: true, path: objectPath, url: meta.url };
  } catch (e) {
    const thieuBucket = /bucket does not exist/i.test(e.message || "");
    storage.lyDo = thieuBucket
      ? `Bucket "${fb.storageBucket}" chưa tồn tại. Vào Firebase Console ▸ Build ▸ Storage ▸ Get started để tạo, rồi đối chiếu lại FIREBASE_STORAGE_BUCKET trong .env.`
      : e.message;
    console.warn("[db] Tải ảnh lên Storage thất bại (file local vẫn còn):", storage.lyDo);
  }

  // Ghi metadata bất kể Storage thành công hay không — có bản ghi vẫn hơn mất dấu ảnh
  let firestore = { ok: false, lyDo: null };
  try {
    await fb.db.collection("media").doc(filename).set(encodeForFirestore(meta));
    firestore.ok = true;
  } catch (e) {
    firestore.lyDo = e.message;
    console.warn("[db] Ghi metadata ảnh lên Firestore thất bại:", e.message);
  }

  return { saved: true, file: relFile, storage, firestore };
}

/* =========================================================================
   4. ROSTER AGENT (KWSR) — đang ở localStorage "aios-kwsr-v1" của app.js
   ========================================================================= */

async function saveAgents(payload) {
  const agents = (payload && payload.agents) || {};
  const doc = {
    agents,
    customSkills: (payload && payload.customSkills) || {},
    customWorkflows: (payload && payload.customWorkflows) || {},
    globalRules: Array.isArray(payload && payload.globalRules) ? payload.globalRules : [],
    cap_nhat_luc: new Date().toISOString(),
  };
  writeJson(AGENTS_MIRROR, doc);

  const fb = getFirebase();
  if (!fb) return { saved: true, firestore: { ok: false, lyDo: firebaseStatus().lyDo } };

  try {
    const ops = [];
    for (const [agentId, data] of Object.entries(agents)) {
      const id = safeDocId(agentId);
      if (!id) continue;
      ops.push({ type: "set", ref: fb.db.collection("agents").doc(id), data: encodeForFirestore({ id, ...data, cap_nhat_luc: doc.cap_nhat_luc }) });
    }
    ops.push({ type: "set", ref: fb.db.collection(META_COLLECTION).doc("kwsr"), data: encodeForFirestore({
      customSkills: doc.customSkills, customWorkflows: doc.customWorkflows, globalRules: doc.globalRules, cap_nhat_luc: doc.cap_nhat_luc,
    }) });
    await commitInChunks(fb.db, ops);
    return { saved: true, firestore: { ok: true }, so_agent: Object.keys(agents).length };
  } catch (e) {
    console.warn("[db] Ghi roster agent lên Firestore thất bại:", e.message);
    return { saved: true, firestore: { ok: false, lyDo: e.message } };
  }
}

async function loadAgents() {
  const fb = getFirebase();
  if (fb) {
    try {
      const snap = await fb.db.collection("agents").get();
      if (!snap.empty) {
        const agents = {};
        snap.forEach((d) => { agents[d.id] = decodeFromFirestore(d.data()); });
        const meta = await fb.db.collection(META_COLLECTION).doc("kwsr").get();
        const kwsr = meta.exists ? decodeFromFirestore(meta.data()) : {};
        return { agents, customSkills: kwsr.customSkills || {}, customWorkflows: kwsr.customWorkflows || {}, globalRules: kwsr.globalRules || [], nguon: "firestore" };
      }
    } catch (e) {
      console.warn("[db] Không đọc được roster agent từ Firestore:", e.message);
    }
  }
  const local = readJson(AGENTS_MIRROR);
  if (local) return { ...local, nguon: "local" };
  return { agents: {}, customSkills: {}, customWorkflows: {}, globalRules: [], nguon: "trong" };
}

/* =========================================================================
   5. ĐỒNG BỘ PHỤ — gọi từ sales.js và hr.js sau khi hai module đó đã ghi đĩa xong

   CẢNH BÁO DỮ LIỆU CÁ NHÂN: hai nhóm dưới đây chứa PII của người ngoài công ty
   (SĐT/email lead, CV ứng viên). Đưa lên Firebase là chuyển dữ liệu cá nhân sang
   hạ tầng đặt ngoài Việt Nam — thuộc phạm vi điều chỉnh của Nghị định 13/2023.
   Bật/tắt riêng bằng SYNC_PII trong .env; mặc định TẮT.
   ========================================================================= */

function piiSyncEnabled() {
  return String(process.env.SYNC_PII || "false").toLowerCase() === "true";
}

// Gọi sau khi sales.js đã ghi sales/data/leads/leads.json — không thay thế nó.
async function syncLeads(leads) {
  const fb = getFirebase();
  if (!fb) return { ok: false, lyDo: firebaseStatus().lyDo };
  if (!piiSyncEnabled()) return { ok: false, lyDo: "SYNC_PII=false — kho lead chứa PII nên không tự đẩy lên cloud." };
  try {
    const ops = (Array.isArray(leads) ? leads : []).map((lead) => {
      const id = safeDocId(lead.id || lead.sdt);
      return id ? { type: "set", ref: fb.db.collection("leads").doc(id), data: encodeForFirestore(lead) } : null;
    }).filter(Boolean);
    await commitInChunks(fb.db, ops);
    return { ok: true, so_luong: ops.length };
  } catch (e) {
    console.warn("[db] Đồng bộ lead lên Firestore thất bại:", e.message);
    return { ok: false, lyDo: e.message };
  }
}

// Gọi sau khi hr.js đã ghi hr/data/requisitions/<id>.json — không thay thế nó.
async function syncRequisition(reqId, data) {
  const fb = getFirebase();
  if (!fb) return { ok: false, lyDo: firebaseStatus().lyDo };
  if (!piiSyncEnabled()) return { ok: false, lyDo: "SYNC_PII=false — hồ sơ tuyển dụng chứa PII nên không tự đẩy lên cloud." };
  const id = safeDocId(reqId);
  if (!id) return { ok: false, lyDo: "Thiếu mã requisition" };
  try {
    assertDocSize(`hr_requisitions/${id}`, data);
    await fb.db.collection("hr_requisitions").doc(id).set(encodeForFirestore({ ...data, cap_nhat_luc: new Date().toISOString() }));
    return { ok: true };
  } catch (e) {
    console.warn("[db] Đồng bộ requisition lên Firestore thất bại:", e.message);
    return { ok: false, lyDo: e.message };
  }
}

// Đẩy một file đã có trên đĩa (CV, offer letter, JD) lên Storage.
async function uploadHrFile(reqId, absPath) {
  const fb = getFirebase();
  if (!fb || !fb.bucket) return { ok: false, lyDo: "Chưa bật Cloud Storage" };
  if (!piiSyncEnabled()) return { ok: false, lyDo: "SYNC_PII=false" };
  if (!fs.existsSync(absPath)) return { ok: false, lyDo: `Không thấy file ${absPath}` };
  try {
    const objectPath = `hr/${safeDocId(reqId)}/${path.basename(absPath)}`;
    await fb.bucket.upload(absPath, { destination: objectPath, resumable: false });
    return { ok: true, path: objectPath };
  } catch (e) {
    return { ok: false, lyDo: e.message };
  }
}

/* ========================================================================= */

function status() {
  const fb = firebaseStatus();
  return {
    firebase: fb,
    dongBoPII: piiSyncEnabled(),
    banSaoLocal: {
      congViec: fs.existsSync(WORK_MIRROR) ? path.relative(AIOS_ROOT, WORK_MIRROR).replace(/\\/g, "/") : null,
      agent: fs.existsSync(AGENTS_MIRROR) ? path.relative(AIOS_ROOT, AGENTS_MIRROR).replace(/\\/g, "/") : null,
      cluster: listClusters().length,
    },
  };
}

module.exports = {
  loadWork, saveWork,
  saveArticle, listArticles, listClusters,
  saveMedia,
  saveAgents, loadAgents,
  syncLeads, syncRequisition, uploadHrFile,
  status, slugify,
  // Xuất ra để kiểm thử vòng mã hoá/giải mã — sai ở đây là hỏng dữ liệu âm thầm
  _encodeForFirestore: encodeForFirestore, _decodeFromFirestore: decodeFromFirestore,
};
