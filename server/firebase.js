// Khởi tạo Firebase Admin SDK — một lần cho cả tiến trình proxy.
//
// VÌ SAO ADMIN SDK PHÍA SERVER, KHÔNG PHẢI WEB SDK Ở TRÌNH DUYỆT:
// Dashboard AI OS không có màn đăng nhập. Nếu gọi Firebase thẳng từ trình duyệt thì
// security rules buộc phải mở cho khách vãng lai — nghĩa là bất kỳ ai biết URL cũng
// đọc được hồ sơ ứng viên và kho lead (PII, Nghị định 13/2023). Đi qua proxy thì
// service account key nằm trong .env trên máy người vận hành, còn rules Firestore/Storage
// khoá sạch mọi truy cập từ client (xem firestore.rules) — Admin SDK đi vòng qua rules
// nên khoá chặt không ảnh hưởng gì tới proxy.
//
// Toàn bộ tầng này thiết kế để KHÔNG BAO GIỜ làm sập proxy: thiếu key, sai key, chưa cài
// gói — đều trả về null và để db.js rơi về ghi đĩa local. Server phải boot được kể cả khi
// người dùng chưa tạo project Firebase.

const fs = require("fs");
const path = require("path");

// undefined = chưa thử khởi tạo; null = đã thử và không dùng được
let cached;
let initError = null;

function resolveServiceAccountPath() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.join(__dirname, raw);
}

function init() {
  if (String(process.env.FIREBASE_ENABLED || "false").toLowerCase() !== "true") {
    initError = "FIREBASE_ENABLED chưa bật (đang lưu xuống đĩa local).";
    return null;
  }

  const keyPath = resolveServiceAccountPath();
  if (!keyPath) {
    initError = "Thiếu FIREBASE_SERVICE_ACCOUNT trong .env — trỏ tới file JSON service account tải từ Firebase Console.";
    return null;
  }
  if (!fs.existsSync(keyPath)) {
    initError = `Không thấy file service account tại "${keyPath}".`;
    return null;
  }

  // firebase-admin v13+ đã BỎ HẲN API namespace kiểu cũ (admin.credential.cert,
  // admin.firestore(), admin.apps). Giờ phải nạp theo từng subpath modular; viết theo
  // lối cũ sẽ chết bằng "Cannot read properties of undefined" rất khó lần.
  let appMod, firestoreMod, storageMod;
  try {
    appMod = require("firebase-admin/app");
    firestoreMod = require("firebase-admin/firestore");
    storageMod = require("firebase-admin/storage");
  } catch (e) {
    initError = `Không nạp được firebase-admin (${e.message}) — chạy "npm install" trong thư mục server/.`;
    return null;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } catch (e) {
    initError = `File service account không phải JSON hợp lệ (${keyPath}): ${e.message}`;
    return null;
  }
  if (!serviceAccount.project_id || !serviceAccount.private_key) {
    initError = `File "${keyPath}" thiếu project_id/private_key — nhiều khả năng đây là file cấu hình web app chứ không phải service account key.`;
    return null;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
  // Bucket là tuỳ chọn: Cloud Storage cho project mới yêu cầu bật gói Blaze, nên phải
  // cho phép dùng riêng Firestore mà không có Storage.
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "";

  const APP_NAME = "aios";
  let app;
  try {
    const daCo = appMod.getApps().find((a) => a.name === APP_NAME);
    app = daCo || appMod.initializeApp({
      credential: appMod.cert(serviceAccount),
      projectId,
      ...(storageBucket ? { storageBucket } : {}),
    }, APP_NAME);
  } catch (e) {
    initError = `Không khởi tạo được Firebase Admin: ${e.message}`;
    return null;
  }

  let db;
  try {
    // Dữ liệu AI OS có nhiều trường tuỳ chọn để trống (vd ticket: null, ghi_chu: "").
    // Không bật cờ này thì mỗi undefined lọt vào là Firestore ném lỗi giữa chừng batch.
    db = firestoreMod.getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // settings() chỉ nhận một lần cho mỗi instance — gọi lại sẽ ném lỗi, bỏ qua an toàn
    if (!db) {
      initError = `Không mở được Firestore: ${e.message}`;
      return null;
    }
  }

  let bucket = null;
  if (storageBucket) {
    try {
      bucket = storageMod.getStorage(app).bucket(storageBucket);
    } catch (e) {
      // Storage hỏng KHÔNG được kéo Firestore chết theo — hai dịch vụ độc lập,
      // và Cloud Storage cho project mới còn cần bật gói Blaze riêng.
      console.warn("[firebase] Không mở được Cloud Storage:", e.message);
    }
  }

  initError = null;
  return { app, db, projectId, storageBucket, bucket, FieldValue: firestoreMod.FieldValue };
}

// Trả về { admin, db, bucket, projectId, storageBucket } hoặc null nếu chưa dùng được.
function getFirebase() {
  if (cached === undefined) cached = init();
  return cached;
}

// Chẩn đoán cho /api/db/status — KHÔNG kèm bất kỳ phần nào của private key.
function firebaseStatus() {
  const fb = getFirebase();
  return {
    enabled: !!fb,
    projectId: fb ? fb.projectId : null,
    storageBucket: fb ? fb.storageBucket || null : null,
    storageSanSang: !!(fb && fb.bucket),
    lyDo: fb ? null : initError,
  };
}

module.exports = { getFirebase, firebaseStatus };
