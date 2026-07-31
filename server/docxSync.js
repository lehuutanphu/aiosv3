// Điền THẬT vào mẫu offer letter công ty (hr/data/mau-cong-ty/offer-letter.docx) bằng
// docxtemplater + pizzip (đã được đồng ý thêm làm dependency riêng cho tác vụ này) — .docx thật
// hay bị Word tách 1 placeholder thành nhiều run XML khác định dạng (vd {{EMAIL_UNG_VIEN}} tách
// thành "{{" và "EMAIL_UNG_VIEN}}" ở 2 <w:r> khác nhau), tự viết tay tìm–thay dễ bỏ sót/sai —
// docxtemplater xử lý đúng vấn đề này theo thiết kế.

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const HR_ROOT = path.join(__dirname, "..", "hr");
const TEMPLATE_PATH = path.join(HR_ROOT, "data", "mau-cong-ty", "offer-letter.docx");

function stripDiacritics(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "");
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// Đúng bảng field ở hr/templates/offer-field-map.md — nguồn giá trị duy nhất là ung_vien[].offer
// (đã chốt qua Cổng 1/B7) + vi_tri + ten/email/sdt ứng viên. KHÔNG lấy lương từ nguồn nào khác.
function buildTemplateData(requisition, uv, extra = {}) {
  const offer = uv.offer || {};
  return {
    TEN_UNG_VIEN: uv.ten || "",
    EMAIL_UNG_VIEN: uv.email || "",
    SDT_UNG_VIEN: uv.sdt || "",
    CHUC_DANH: offer.chuc_danh || "",
    PHONG_BAN: requisition?.vi_tri?.phong_ban || "",
    BAO_CAO_CHO: offer.bao_cao_cho || "",
    NGAY_ONBOARD: offer.ngay_onboard || "",
    THU_VIEC_THANG: offer.thu_viec_thang ?? "",
    LUONG_THU_VIEC: offer.luong_thu_viec ?? "",
    LUONG_CHINH_THUC: offer.luong_chinh_thuc ?? "",
    PHU_CAP: offer.phu_cap ?? "",
    THUONG: offer.thuong ?? "",
    HINH_THUC_LAM_VIEC: offer.hinh_thuc_lam_viec || "",
    DIA_DIEM_LAM_VIEC: requisition?.vi_tri?.dia_diem || "",
    LOAI_HOP_DONG: offer.loai_hop_dong || "",
    HAN_PHAN_HOI: offer.han_phan_hoi || "",
    NGUOI_KY: offer.nguoi_ky || "",
    CHUC_DANH_NGUOI_KY: extra.chuc_danh_nguoi_ky || "",
    NGAY_PHAT_HANH: todayISODate(),
  };
}

function nextVersion(outDir, baseName) {
  if (!fs.existsSync(outDir)) return 1;
  const existing = fs.readdirSync(outDir).filter((f) => f.startsWith(baseName) && f.endsWith(".docx"));
  let max = 0;
  for (const f of existing) {
    const m = f.match(/-v(\d+)\.docx$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

// requisition: object đầy đủ; uv: 1 phần tử ung_vien[] (đã có offer.* đầy đủ); extra.chuc_danh_nguoi_ky optional
// -> { path, version, missingFields } — missingFields là các field template cần nhưng data đang trống,
// vẫn tạo file (đúng dấu [ ] cho user tự điền tay) nhưng báo rõ để user biết trước khi gửi.
function generateOfferLetter(requisitionId, requisition, uv, extra = {}) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw Object.assign(
      new Error(`Chưa có mẫu offer letter tại "hr/data/mau-cong-ty/offer-letter.docx" — đặt file mẫu vào đó trước.`),
      { status: 400 }
    );
  }
  const data = buildTemplateData(requisition, uv, extra);
  const missingFields = Object.entries(data)
    .filter(([k, v]) => v === "" && k !== "PHU_CAP" && k !== "THUONG" && k !== "CHUC_DANH_NGUOI_KY")
    .map(([k]) => k);

  const content = fs.readFileSync(TEMPLATE_PATH, "binary");
  const zip = new PizZip(content);
  let doc;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      nullGetter: () => "", // field không có trong data (vd mẫu thiếu điều khoản) -> để trống, không throw
    });
    doc.render(data);
  } catch (e) {
    const detail = e.properties?.errors?.map((er) => er.properties?.explanation).filter(Boolean).join("; ");
    throw Object.assign(new Error(`Điền mẫu offer letter thất bại: ${detail || e.message}`), { status: 500 });
  }

  const baseName = `Offer-${uv.ma_uv}-${stripDiacritics(uv.ten)}`;
  const outDir = path.join(HR_ROOT, "data", "ho-so", requisitionId, "offer");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const version = nextVersion(outDir, baseName);
  const fileName = `${baseName}-v${version}.docx`;
  const outPath = path.join(outDir, fileName);

  const buf = doc.getZip().generate({ type: "nodebuffer" });
  fs.writeFileSync(outPath, buf);

  return {
    path: path.relative(path.join(HR_ROOT, ".."), outPath).replace(/\\/g, "/"),
    version,
    missingFields,
  };
}

module.exports = { generateOfferLetter, TEMPLATE_PATH };
