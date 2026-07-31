/* ============================================================
   AI OS Dashboard — dữ liệu đội Agent + logic điều phối Orches
   Bám theo mô hình KWSR & khuyến nghị model trong tài liệu
   "Xây dựng AI Workforce trên Antigravity"
   ============================================================ */

// ---------- HERMES INTEGRATION ----------
// false (mặc định) = Dashboard chạy độc lập, agentReply() mô phỏng trả lời — không cần
//   Backend Proxy hay Hermes thật đang chạy.
// true = khung chat gọi thật tới Hermes Agent qua Backend Proxy (project/aios/server/),
//   và "Thêm tài liệu" (Knowledge) đồng bộ sang Mem0. Xem HERMES_INTEGRATION.md.
const USE_REAL_HERMES = false;
const HERMES_PROXY_BASE = "http://localhost:8787";

// ---------- DATA ----------
const DEPARTMENTS = [
  { id: "sales",   name: "Phòng Kinh doanh",       icon: "💼", desc: "Chăm sóc khách hàng, đề xuất bán hàng" },
  { id: "mkt",     name: "Phòng Marketing",         icon: "🎨", desc: "Nội dung, social, chiến dịch" },
  { id: "hr",      name: "Phòng Nhân sự",           icon: "🧑‍🤝‍🧑", desc: "Tuyển dụng, đào tạo, JD" },
  { id: "fin",     name: "Phòng Kế toán – Tài chính", icon: "📊", desc: "Báo cáo, công nợ, audit" },
  { id: "legal",   name: "Phòng Pháp lý",           icon: "⚖️", desc: "Hợp đồng, tuân thủ" },
  { id: "cskh",    name: "Phòng CSKH",              icon: "🎧", desc: "Hỗ trợ, khiếu nại, FAQ" },
];

const AGENTS = [
  {
    id: "sales-1", dept: "sales", icon: "💼", name: "Sales Agent",
    role: "Chuyên viên chăm sóc & đề xuất bán hàng",
    model: "Claude Sonnet 4.5", mode: "Fast",
    modelWhy: "Văn phong tự nhiên, cá nhân hóa cao — email không có cảm giác 'mẫu có sẵn' (0% tỷ lệ lỗi bài đo viết lách).",
    maturity: 86, stage: "Thạo việc",
    status: "working",
    task: "Soạn email theo dõi sau cuộc họp với 3 khách hàng tiềm năng",
    keywords: ["email", "khách hàng", "báo giá", "đề xuất", "chốt", "bán hàng", "cảm ơn", "sau bán", "hợp đồng đã ký", "follow", "chăm sóc"],
    knowledge: ["Hồ sơ 28 khách hàng lớn (tính cách, lịch sử giao dịch)", "Giọng văn thương hiệu: chuyên nghiệp – thân thiện", "Chu kỳ mua hàng theo mùa của ngành"],
    workflows: ["/email-cham-soc — chuỗi email sau bán 3 chạm", "/de-xuat-ban-hang — tạo proposal từ brief"],
    skills: ["viet-email-ca-nhan-hoa", "tao-de-xuat-ban-hang"],
    rules: ["Cấm gửi bảng giá gốc ra ngoài domain công ty", "Mọi email gửi khách phải qua bước duyệt của trưởng phòng"],
  },
  {
    id: "mkt-1", dept: "mkt", icon: "✍️", name: "Content Agent",
    role: "Chuyên viên nội dung dài (blog, email campaign, landing page)",
    model: "Claude Sonnet 4.5", mode: "Planning",
    modelWhy: "Văn phong hấp dẫn, kể chuyện tự nhiên — phù hợp blog, email cần tỷ lệ chuyển đổi cao.",
    maturity: 78, stage: "Thạo việc",
    status: "working",
    task: "Viết landing page cho chương trình khuyến mãi tháng 7",
    keywords: ["blog", "landing", "bài viết", "content", "email campaign", "khuyến mãi", "chiến dịch"],
    knowledge: ["Brand guideline & tone of voice", "Chân dung 3 nhóm khách hàng mục tiêu", "Từ khóa SEO ngành đang theo đuổi"],
    workflows: ["/bai-blog-chuan-seo — dàn ý → bản nháp → tối ưu", "/email-campaign — chuỗi email 5 bức theo phễu"],
    skills: ["viet-content-chuan-thuong-hieu"],
    rules: ["Không cam kết số liệu hiệu quả chưa kiểm chứng", "Nội dung y tế/tài chính phải gắn disclaimer"],
  },
  {
    id: "mkt-2", dept: "mkt", icon: "📱", name: "Social Agent",
    role: "Chuyên viên social post số lượng lớn",
    model: "Gemini 3 Flash", mode: "Fast",
    modelWhy: "Nhanh và rẻ — tốt cho việc tạo nhiều biến thể bài đăng để A/B test hiệu quả.",
    maturity: 91, stage: "Chuyên gia",
    status: "idle",
    task: "Chờ lệnh — vừa hoàn thành 12 bài đăng tuần này",
    keywords: ["fanpage", "social", "facebook", "tiktok", "bài đăng", "post", "caption"],
    knowledge: ["Lịch đăng bài & khung giờ vàng", "Kho hashtag hiệu quả theo chủ đề"],
    workflows: ["/social-tuan — 7 bài đăng theo lịch nội dung"],
    skills: ["tao-bien-the-social-post"],
    rules: ["Không đăng trực tiếp — luôn xuất bản nháp chờ duyệt"],
  },
  {
    id: "hr-1", dept: "hr", icon: "🧑‍💼", name: "HR Agent",
    role: "Chuyên viên tuyển dụng & hồ sơ nhân sự",
    hrIntake: true, // có pipeline tuyển dụng THẬT (project/aios/hr) — xem hr/README.md
    model: "DeepSeek V4 Flash", mode: "Planning",
    modelWhy: "Văn phong tự nhiên khi viết JD/email ứng viên; đọc CV, tóm tắt chính xác, đánh giá kỹ năng mềm qua văn bản. B2-B10 thực thi thật qua DeepSeek V4 Flash (OpenRouter).",
    maturity: 72, stage: "Thạo việc",
    status: "review",
    task: "Shortlist 40 CV kế toán → chờ bạn duyệt 5 hồ sơ đề xuất",
    keywords: ["cv", "tuyển", "tuyển dụng", "phỏng vấn", "ứng viên", "jd", "job description", "nhân sự", "shortlist", "offer", "onboard", "thử việc", "đăng tin", "requisition"],
    knowledge: ["Khung năng lực từng vị trí", "Văn hóa công ty & tiêu chí phù hợp", "Thang lương tham chiếu thị trường", "Mẫu offer letter chuẩn công ty (hr/data/mau-cong-ty/)", "Quy trình tuyển dụng 10 bước — hr/README.md"],
    workflows: [
      "/tuyen-dung — điều phối toàn pipeline, báo bước hiện tại & bước kế tiếp",
      "/nhu-cau-tuyen-dung — B1: chốt vị trí, số lượng, ngày onboard → tạo requisition",
      "/jd-va-tin-tuyen-dung — B2+B3: cập nhật JD, viết bài đăng đa kênh, sổ link theo dõi",
      "/thu-nhan-sang-loc-cv — B4: gom CV từ Gmail, chấm điểm, shortlist",
      "/lich-phong-van — B5+B6: draft email hẹn, lịch Calendar, follow kết quả trên Google Sheets",
      "/offer-va-luu-ho-so — B7–B10: chốt điều khoản, điền mẫu offer, trình duyệt, lưu hồ sơ",
    ],
    skills: ["tuyen-dung", "nhu-cau-tuyen-dung", "jd-va-tin-tuyen-dung", "thu-nhan-sang-loc-cv", "lich-phong-van", "offer-va-luu-ho-so"],
    subagents: ["cham-diem-cv — chấm CV song song khi >15 hồ sơ/đợt"],
    rules: [
      "Chỉ trả lời trong phạm vi tuyển dụng & hồ sơ nhân sự — câu hỏi thuộc phòng ban khác (marketing, kế toán, pháp lý, kỹ thuật, CSKH...) phải từ chối rõ ràng và định hướng sang đúng Agent phụ trách, không tự ý trả lời một phần hay \"hỗ trợ thêm\" ngoài phạm vi",
      "Ẩn thông tin cá nhân (PII) ứng viên trong báo cáo tổng hợp",
      "Không tự gửi email từ chối — phải có người duyệt",
      "🔴 Không tự điền con số lương — mọi mức lương phải do người xác nhận bằng chữ (Cổng B7)",
      "🔴 Offer letter chỉ điền vào mẫu có sẵn của công ty — không tự soạn mẫu mới, không sửa câu chữ của mẫu",
      "🔴 Không auto-send email ứng viên — chỉ tạo draft Gmail, người bấm Gửi (Cổng B9)",
      "Không chấm điểm CV theo giới tính, tuổi, tình trạng hôn nhân, quê quán, ngoại hình",
    ],
  },
  {
    id: "fin-1", dept: "fin", icon: "📊", name: "Finance Agent",
    role: "Chuyên viên phân tích báo cáo & đối chiếu số liệu",
    model: "Gemini 3 Pro", mode: "Planning",
    modelWhy: "Đa phương thức 81,2% — đọc biểu đồ, bảng số liệu từ PDF/Excel; ngữ cảnh 2M+ token đọc báo cáo nhiều năm cùng lúc.",
    maturity: 68, stage: "Học việc",
    status: "working",
    task: "Đối chiếu công nợ tháng 6 — đã phát hiện 2 chênh lệch cần xác minh",
    keywords: ["công nợ", "hóa đơn", "báo cáo tài chính", "thuế", "chi phí", "doanh thu", "đối chiếu", "quý", "ngân sách", "audit"],
    knowledge: ["Sơ đồ tài khoản & quy ước hạch toán nội bộ", "Mẫu báo cáo quản trị hàng tháng"],
    workflows: ["/doi-chieu-cong-no — đối chiếu sổ phụ với công nợ", "/bao-cao-thang — tổng hợp P&L quản trị"],
    skills: ["phat-hien-bat-thuong-so-lieu"],
    rules: ["Cấm sửa/ghi đè file sổ sách gốc — luôn tạo bản sao", "Ghi nhật ký mọi thao tác truy xuất dữ liệu tài chính", "Số liệu bất thường phải gắn cờ, không tự kết luận"],
  },
  {
    id: "fin-2", dept: "fin", icon: "🔍", name: "Audit Agent",
    role: "Chuyên viên soát xét logic số liệu",
    model: "Claude Opus 4.5 (Thinking)", mode: "Planning",
    modelWhy: "Suy luận 92% GPQA — phát hiện sai lệch logic trong số liệu, giải thích từng bước tại sao bất thường.",
    maturity: 74, stage: "Thạo việc",
    status: "idle",
    task: "Chờ lệnh — sẵn sàng audit khi Finance Agent gắn cờ",
    keywords: ["bất thường", "kiểm tra chéo", "soát xét", "sai lệch"],
    knowledge: ["Các mẫu sai sót thường gặp trong sổ sách SMEs"],
    workflows: ["/audit-logic — soát xét chéo số liệu được gắn cờ"],
    skills: ["audit-logic-so-lieu"],
    rules: ["Chỉ đọc — không có quyền ghi vào bất kỳ file dữ liệu nào"],
  },
  {
    id: "legal-1", dept: "legal", icon: "⚖️", name: "Legal Agent",
    role: "Chuyên viên rà soát hợp đồng & tuân thủ",
    model: "Claude Opus 4.5 (Thinking)", mode: "Planning",
    modelWhy: "Suy luận từng bước quan trọng khi phân tích logic pháp lý; kết hợp Gemini Pro (2M+ token) khi cần đọc hợp đồng 200 trang.",
    maturity: 81, stage: "Thạo việc",
    status: "working",
    task: "Rà soát điều khoản rủi ro trong hợp đồng phân phối miền Trung",
    keywords: ["hợp đồng", "điều khoản", "pháp lý", "phạt", "tuân thủ", "nda", "phụ lục", "tranh chấp"],
    knowledge: ["Thư viện điều khoản chuẩn của công ty", "Án lệ & quy định ngành liên quan"],
    workflows: ["/ra-soat-hop-dong — checklist 12 nhóm rủi ro", "/soan-dieu-khoan — draft điều khoản mới (giao Sonnet)"],
    skills: ["phan-tich-dieu-khoan-rui-ro"],
    rules: ["Kết luận pháp lý cuối cùng phải do luật sư con người phê duyệt", "Cấm chia sẻ nội dung hợp đồng ra ngoài workspace"],
  },
  {
    id: "cskh-1", dept: "cskh", icon: "🎧", name: "Support Agent",
    role: "Chuyên viên trả lời FAQ số lượng lớn",
    model: "Gemini 3 Flash", mode: "Fast",
    modelWhy: "Nhanh, chi phí thấp — phù hợp trả lời hàng trăm yêu cầu mỗi ngày.",
    maturity: 93, stage: "Chuyên gia",
    status: "working",
    task: "Đang trực kênh FAQ — 47 lượt trả lời hôm nay",
    keywords: ["faq", "hỗ trợ", "bảo hành", "đổi trả", "hướng dẫn", "khách hỏi"],
    knowledge: ["Cơ sở kiến thức sản phẩm 120 bài", "Chính sách đổi trả & bảo hành hiện hành"],
    workflows: ["/cap-nhat-faq — bổ sung câu hỏi mới vào KB"],
    skills: ["tra-loi-theo-kb-chuan"],
    rules: ["Câu hỏi ngoài KB → chuyển người thật, không tự bịa", "Khiếu nại nghiêm trọng → chuyển Care Agent ngay"],
  },
  {
    id: "cskh-2", dept: "cskh", icon: "💝", name: "Care Agent",
    role: "Chuyên viên xử lý khiếu nại nhạy cảm",
    model: "Claude Sonnet 4.5", mode: "Planning",
    modelWhy: "Sự đồng cảm và giọng văn tốt cho khách hàng đang bức xúc.",
    maturity: 77, stage: "Thạo việc",
    status: "idle",
    task: "Chờ lệnh — không có khiếu nại tồn đọng 🎉",
    keywords: ["khiếu nại", "bức xúc", "hoàn tiền", "xin lỗi", "bồi thường"],
    knowledge: ["Kịch bản xoa dịu theo mức độ nghiêm trọng", "Thẩm quyền bồi thường theo cấp"],
    workflows: ["/xu-ly-khieu-nai — tiếp nhận → xoa dịu → đề xuất phương án"],
    skills: ["phan-hoi-dong-cam"],
    rules: ["Bồi thường vượt 2 triệu đồng phải có phê duyệt của quản lý"],
  },
];

// ---------- SKILL LIBRARY (view chi tiết từng skill) ----------
const SKILLS = {
  "viet-email-ca-nhan-hoa": {
    desc: "Viết email chăm sóc khách hàng được cá nhân hóa theo hồ sơ và lịch sử giao dịch.",
    trigger: "Tự động kích hoạt khi Agent nhận diện yêu cầu soạn email gửi khách hàng cụ thể (Progressive Disclosure — chỉ nạp toàn bộ hướng dẫn khi khớp pattern).",
    standards: ["Mở đầu nhắc đúng ngữ cảnh tương tác gần nhất", "Không quá 180 từ, 1 lời kêu gọi hành động duy nhất", "Giọng văn chuyên nghiệp – thân thiện theo brand guideline", "Ký tên đúng định dạng chữ ký công ty"],
    md: `---
name: viet-email-ca-nhan-hoa
description: Soạn email chăm sóc cá nhân hóa theo
  hồ sơ khách hàng. Kích hoạt khi có yêu cầu viết
  email gửi khách hàng cụ thể.
---

## Quy trình
1. Đọc hồ sơ khách tại database/khach-hang/{ten}.md
2. Xác định ngữ cảnh: sau họp / sau mua / tái kích hoạt
3. Viết theo khung: Nhắc ngữ cảnh → Giá trị → 1 CTA

## Tài nguyên
- resources/mau-email/  (12 mẫu theo tình huống)
- resources/tone-guide.md`,
  },
  "tao-de-xuat-ban-hang": {
    desc: "Tạo bản đề xuất bán hàng (proposal) thuyết phục từ brief ngắn.",
    trigger: "Kích hoạt khi yêu cầu chứa 'đề xuất', 'proposal', 'báo giá kèm giải pháp'.",
    standards: ["Cấu trúc: Vấn đề → Giải pháp → Gói dịch vụ → Bước tiếp theo", "Số liệu lấy từ bảng giá đã duyệt, không tự chế", "Xuất file .docx theo template công ty"],
    md: `---
name: tao-de-xuat-ban-hang
description: Dựng proposal từ brief, đúng template
  và bảng giá đã duyệt.
---

## Quy trình
1. Đọc brief + hồ sơ khách
2. Chọn gói phù hợp từ database/bang-gia-2026.xlsx
3. Render theo templates/proposal.docx`,
  },
  "viet-content-chuan-thuong-hieu": {
    desc: "Đảm bảo mọi nội dung dài đúng tone of voice và cấu trúc chuẩn SEO của thương hiệu.",
    trigger: "Tự kích hoạt với mọi tác vụ viết nội dung trên 300 từ.",
    standards: ["Tuân thủ tone of voice trong brand-guideline.md", "H2/H3 chứa từ khóa phụ, mật độ từ khóa 1–1,5%", "Đoạn văn tối đa 4 dòng, có ví dụ thực tế Việt Nam"],
    md: `---
name: viet-content-chuan-thuong-hieu
description: Chuẩn chất lượng cho nội dung dài
  (blog, landing, email) theo brand guideline.
---

## Checklist chất lượng
- [ ] Tone đúng brand-guideline.md
- [ ] Cấu trúc SEO: title < 60 ký tự, meta < 155
- [ ] CTA rõ ràng cuối bài`,
  },
  "tao-bien-the-social-post": {
    desc: "Sinh nhanh nhiều biến thể bài đăng cho A/B test trên từng nền tảng.",
    trigger: "Kích hoạt khi yêu cầu tạo bài đăng mạng xã hội.",
    standards: ["Mỗi ý tưởng ≥ 3 biến thể (hook khác nhau)", "Đúng giới hạn ký tự từng nền tảng", "Kèm đề xuất khung giờ đăng từ dữ liệu lịch sử"],
    md: `---
name: tao-bien-the-social-post
description: Sinh biến thể bài đăng đa nền tảng
  phục vụ A/B test.
---

## Quy tắc
- FB: 80-120 từ + 3-5 hashtag
- TikTok caption: < 100 ký tự, hook 3 giây đầu`,
  },
  "danh-gia-cv-theo-khung-nang-luc": {
    desc: "Chấm điểm CV khách quan theo khung năng lực từng vị trí, xuất shortlist kèm lý do.",
    trigger: "Kích hoạt khi có yêu cầu lọc/đánh giá CV hoặc tạo shortlist.",
    standards: ["Chấm theo 5 tiêu chí trọng số trong khung năng lực", "Mỗi ứng viên có 2 dòng nhận xét bằng chứng cụ thể", "Ẩn PII (SĐT, địa chỉ) trong bảng tổng hợp"],
    md: `---
name: danh-gia-cv-theo-khung-nang-luc
description: Chấm CV theo khung năng lực, xuất
  shortlist kèm lý do minh bạch.
---

## Quy trình
1. Nạp khung năng lực vị trí từ database/hr/khung-nang-luc/
2. Chấm 5 tiêu chí × trọng số → điểm 100
3. Xuất bảng xếp hạng (đã ẩn PII)`,
  },
  "phat-hien-bat-thuong-so-lieu": {
    desc: "Quét dữ liệu tài chính tìm chênh lệch, trùng lặp, sai quy luật — gắn cờ chứ không kết luận.",
    trigger: "Tự kích hoạt trong mọi tác vụ đối chiếu/tổng hợp số liệu tài chính.",
    standards: ["So sánh chéo tối thiểu 2 nguồn dữ liệu", "Mọi bất thường gắn cờ 🚩 kèm vị trí ô/file cụ thể", "Không tự sửa số liệu — chỉ báo cáo"],
    md: `---
name: phat-hien-bat-thuong-so-lieu
description: Gắn cờ chênh lệch & sai quy luật trong
  dữ liệu kế toán. Chỉ báo cáo, không sửa.
---

## Các mẫu bất thường
- Hóa đơn trùng số / trùng số tiền cùng ngày
- Chênh lệch sổ phụ ngân hàng vs sổ kế toán
- Chi phí lệch > 20% trung bình 6 tháng`,
  },
  "audit-logic-so-lieu": {
    desc: "Soát xét chuỗi logic của số liệu được gắn cờ, giải thích từng bước nguyên nhân khả dĩ.",
    trigger: "Kích hoạt khi nhận bàn giao mục 🚩 từ Finance Agent.",
    standards: ["Mỗi kết luận kèm chuỗi suy luận minh bạch (Thinking)", "Phân loại: lỗi nhập liệu / lệch thời điểm / cần điều tra", "Đầu ra chỉ ở chế độ đọc, không ghi file"],
    md: `---
name: audit-logic-so-lieu
description: Suy luận từng bước trên mục được gắn
  cờ, phân loại nguyên nhân khả dĩ.
---

## Khung suy luận
Giả thuyết → Bằng chứng trong sổ → Kiểm tra chéo
→ Phân loại mức tin cậy (cao/vừa/thấp)`,
  },
  "phan-tich-dieu-khoan-rui-ro": {
    desc: "Nhận diện và xếp hạng điều khoản bất lợi trong hợp đồng theo thư viện rủi ro của công ty.",
    trigger: "Tự kích hoạt khi tác vụ liên quan đọc/rà soát hợp đồng.",
    standards: ["Đối chiếu 12 nhóm rủi ro chuẩn (phạt, chấm dứt, bảo mật…)", "Trích dẫn nguyên văn điều khoản + vị trí trang", "Xếp hạng rủi ro Cao/Trung/Thấp kèm lý giải", "Luôn ghi chú: cần luật sư phê duyệt kết luận cuối"],
    md: `---
name: phan-tich-dieu-khoan-rui-ro
description: Rà soát hợp đồng theo 12 nhóm rủi ro,
  trích dẫn nguyên văn + xếp hạng.
---

## 12 nhóm rủi ro
Phạt vi phạm · Đơn phương chấm dứt · Bảo mật
· Sở hữu trí tuệ · Thanh toán · Bồi thường …

## Đầu ra
Bảng: Điều khoản | Trang | Rủi ro | Đề xuất sửa`,
  },
  "tra-loi-theo-kb-chuan": {
    desc: "Trả lời khách hàng chỉ dựa trên cơ sở kiến thức đã duyệt — tuyệt đối không suy diễn.",
    trigger: "Thường trực trên kênh FAQ.",
    standards: ["Chỉ trích nguồn từ KB, kèm link bài gốc", "Không tìm thấy trong KB → chuyển người thật", "Thời gian phản hồi mục tiêu < 1 phút"],
    md: `---
name: tra-loi-theo-kb-chuan
description: Trả lời FAQ đúng cơ sở kiến thức,
  không suy diễn ngoài phạm vi.
---

## Luồng xử lý
Câu hỏi → Tìm KB (top 3) → Trả lời + trích nguồn
→ Không khớp? escalate người thật`,
  },
  "phan-hoi-dong-cam": {
    desc: "Khung phản hồi khách hàng bức xúc: ghi nhận cảm xúc trước, giải pháp sau.",
    trigger: "Kích hoạt khi phát hiện tín hiệu tiêu cực mạnh trong tin nhắn khách.",
    standards: ["Câu đầu tiên luôn ghi nhận cảm xúc, không phòng thủ", "Đưa mốc thời gian xử lý cụ thể", "Đề xuất bồi thường đúng thẩm quyền theo cấp"],
    md: `---
name: phan-hoi-dong-cam
description: Xoa dịu khách bức xúc theo khung
  Cảm xúc → Sự thật → Giải pháp → Cam kết.
---

## Khung 4 bước
1. Ghi nhận cảm xúc (không phòng thủ)
2. Xác nhận sự thật đã xảy ra
3. Phương án cụ thể + mốc thời gian
4. Cam kết theo dõi đến khi đóng case`,
  },
};

// ---------- WORKFLOW LIBRARY (xem chi tiết WORKFLOW.md của quy trình tự tạo) ----------
const WFLOWS = {}; // "/lenh" -> {desc, trigger, standards, md, custom}

// ---------- GLOBAL RULES ("hiến pháp" GEMINI.md — áp dụng mọi Agent, mục 2.2) ----------
let GLOBAL_RULES = [
  "Giao tiếp bằng tiếng Việt, giọng chuyên nghiệp – thân thiện trong mọi ngữ cảnh",
  "Cấm gửi bất kỳ dữ liệu nội bộ nào ra ngoài domain công ty",
  "Cấm xóa hoặc ghi đè file gốc — luôn tạo bản sao trước khi chỉnh sửa",
  "Ẩn thông tin cá nhân (PII) trong mọi báo cáo xuất ra bên ngoài",
  "Số liệu chưa kiểm chứng phải ghi rõ nguồn và mức độ tin cậy",
];

// ---------- STATE ----------
const chatHistory = {};   // agentId -> [{from, text}]
let currentAgent = null;

// ---------- PERSISTENCE (tri thức ở lại doanh nghiệp) ----------
const STORAGE_KEY = "aios-kwsr-v1";

function saveState() {
  const agents = {};
  AGENTS.forEach(a => {
    agents[a.id] = {
      knowledge: a.knowledge, workflows: a.workflows,
      skills: a.skills, rules: a.rules,
      maturity: a.maturity, stage: a.stage,
    };
  });
  const customSkills = {};
  Object.keys(SKILLS).forEach(k => { if (SKILLS[k].custom) customSkills[k] = SKILLS[k]; });
  const customWorkflows = {};
  Object.keys(WFLOWS).forEach(k => { if (WFLOWS[k].custom) customWorkflows[k] = WFLOWS[k]; });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ agents, customSkills, customWorkflows, globalRules: GLOBAL_RULES })); } catch (e) { /* private mode */ }
}

function loadState() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return; }
  if (!saved) return;
  Object.assign(SKILLS, saved.customSkills || {});
  Object.assign(WFLOWS, saved.customWorkflows || {});
  if (Array.isArray(saved.globalRules)) GLOBAL_RULES = saved.globalRules;
  AGENTS.forEach(a => {
    const s = saved.agents && saved.agents[a.id];
    if (s) Object.assign(a, s);
  });
}

// Meta cho 4 tầng KWSR trong drawer
const SECTION_META = {
  knowledge: {
    title: "🟡 Knowledge — tri thức tích lũy", tag: "K", addLabel: "Thêm tài liệu",
    placeholder: "VD: Bảng giá 2026 cập nhật tháng 7 / Kinh nghiệm đàm phán của anh Minh…",
    feedVerb: "tài liệu Knowledge",
  },
  workflows: {
    title: "🔵 Workflow — quy trình kích hoạt thủ công", tag: "W", addLabel: "Thêm quy trình",
    placeholder: "VD: /bao-cao-thang — tổng hợp số liệu rồi xuất PDF…",
    feedVerb: "Workflow",
  },
  skills: {
    title: "🟢 Skill — năng lực tự kích hoạt", tag: "S", addLabel: "Thêm skill",
    placeholder: "VD: dam-phan-gia — kỹ năng thương lượng theo khung 3 bước…",
    feedVerb: "Skill",
  },
  rules: {
    title: "🔴 Workspace Rule — chốt chặn riêng Agent này", tag: "R", addLabel: "Thêm rule",
    placeholder: "VD: Cấm cam kết thời gian giao hàng khi chưa check tồn kho…",
    feedVerb: "Workspace Rule",
  },
};

// ---------- HELPERS ----------
const $ = (s) => document.querySelector(s);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const timeNow = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const stageClass = (s) => s === "Chuyên gia" ? "stage-chuyengia" : s === "Thạo việc" ? "stage-thaoviec" : "stage-hocviec";
const statusLabel = { working: "Đang thực thi", idle: "Sẵn sàng", review: "Chờ duyệt" };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 3200);
}

function addFeed(html, cls = "") {
  const item = el(`<div class="feed-item ${cls}"><span class="f-time">${timeNow()}</span><p>${html}</p></div>`);
  const list = $("#feedList");
  list.prepend(item);
  while (list.children.length > 30) list.lastElementChild.remove();
}

// ---------- RENDER: SIDEBAR ----------
function renderSidebar() {
  const sb = $("#sidebar");
  const slot = $("#deptLinks") || sb;
  DEPARTMENTS.forEach(d => {
    const cnt = AGENTS.filter(a => a.dept === d.id).length;
    const b = el(`<button class="side-link" data-dept="${d.id}"><span class="sic">${d.icon}</span> ${d.name}<span class="cnt">${cnt}</span></button>`);
    slot.appendChild(b);
  });
  sb.addEventListener("click", (e) => {
    const btn = e.target.closest(".side-link");
    if (!btn || !btn.dataset.dept) return;
    sb.querySelectorAll(".side-link").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    const dept = btn.dataset.dept;
    document.querySelectorAll(".dept-section").forEach(sec => {
      sec.style.display = (dept === "all" || sec.dataset.dept === dept) ? "" : "none";
    });
    const org = $("#orgChart");
    if (org) org.style.display = dept === "all" ? "" : "none";
    if (dept !== "all") {
      const sec = document.querySelector(`.dept-section[data-dept="${dept}"]`);
      sec && sec.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

// ---------- RENDER: STATS ----------
function renderStats() {
  const working = AGENTS.filter(a => a.status === "working").length;
  const avg = Math.round(AGENTS.reduce((s, a) => s + a.maturity, 0) / AGENTS.length);
  const skills = AGENTS.reduce((s, a) => s + a.skills.length, 0);
  const wsRules = AGENTS.reduce((s, a) => s + a.rules.length, 0);
  $("#statCards").innerHTML = `
    <div class="stat-card"><span class="lbl">Agent đang hoạt động</span><div class="val">${working}/${AGENTS.length}</div><span class="sub">▲ Orches điều phối realtime</span></div>
    <div class="stat-card"><span class="lbl">Độ trưởng thành TB</span><div class="val">${avg}%</div><span class="sub">Mục tiêu quý: 90% (Chuyên gia)</span></div>
    <div class="stat-card"><span class="lbl">Skill đã đóng gói</span><div class="val">${skills}</div><span class="sub">Tài sản tri thức tái sử dụng</span></div>
    <div class="stat-card"><span class="lbl">Rule bảo vệ</span><div class="val">${GLOBAL_RULES.length + wsRules}</div><span class="sub">${GLOBAL_RULES.length} Global + ${wsRules} Workspace</span></div>`;
}

// ---------- HR INTAKE (THẬT) — B1 Xác định nhu cầu tuyển dụng ----------
// Ghi file requisition thật qua Backend Proxy (project/aios/server/hr.js), khớp đúng
// hr/skills/nhu-cau-tuyen-dung/SKILL.md. Không dùng USE_REAL_HERMES — B1 chạy được ngay
// cả khi chưa nối Hermes thật, miễn Backend Proxy đang chạy.
const BUOC_TEN_MAP = {
  1: "Xác định nhu cầu", 2: "Cập nhật JD", 3: "Đăng tin đa kênh", 4: "Thu nhận & sàng lọc CV",
  5: "Hẹn & lên lịch phỏng vấn", 6: "Follow kết quả phỏng vấn", 7: "Chốt điều khoản offer",
  8: "Trình duyệt offer letter", 9: "Gửi offer letter", 10: "Lưu hồ sơ & đóng job",
};

// Tóm tắt tác vụ THẬT của hr-1 từ pipeline requisitions thật (thay cho task demo cố định) —
// dùng cho cả badge trên thẻ agent lẫn câu chào mở đầu trong chat.
function hrTaskSummary(requisitions) {
  if (!requisitions || !requisitions.length) {
    return "Chưa có đợt tuyển dụng nào — sẵn sàng mở đợt mới khi cần.";
  }
  if (requisitions.length === 1) {
    const r = requisitions[0];
    const uv = r.so_ung_vien ? `, ${r.so_ung_vien} ứng viên` : "";
    return `${r.requisition_id} — ${r.vi_tri?.ten || "?"}: đang ở B${r.buoc_hien_tai} (${r.buoc_ten || BUOC_TEN_MAP[r.buoc_hien_tai] || "?"})${uv}.`;
  }
  return `Đang theo dõi ${requisitions.length} đợt tuyển dụng: ` +
    requisitions.map(r => `${r.requisition_id} (B${r.buoc_hien_tai})`).join(", ") + ".";
}

async function hrApi(path, opts) {
  const res = await fetch(`${HERMES_PROXY_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

// URL tải file thật đã tạo trong hồ sơ (offer letter...) — chỉ phục vụ file trong hr/data/ho-so/
function hrFileDownloadUrl(relPath) {
  return `${HERMES_PROXY_BASE}/api/hr/files?path=${encodeURIComponent(relPath)}`;
}

function openHrIntake(agent) {
  const modal = $("#hrIntakeModal");
  const form = $("#hrIntakeForm");
  form.reset();
  form.style.display = "";
  $("#hrIntakeResult").style.display = "none";
  $("#hrIntakeError").style.display = "none";
  modal.classList.add("open");
  modal.dataset.agentId = agent ? agent.id : "hr-1";
}
function closeHrIntake() {
  $("#hrIntakeModal").classList.remove("open");
}
function prefillHrIntake(fields) {
  openHrIntake(AGENTS.find(x => x.id === "hr-1"));
  const form = $("#hrIntakeForm");
  if (fields.ten) form.elements["ten"].value = fields.ten;
  if (fields.so_luong) form.elements["so_luong"].value = fields.so_luong;
}

// ---------- HR — Form đánh giá phỏng vấn (B5-B6) — agent có thể tự mở qua tool open_interview_form ----------
// Danh sách ứng viên trong dropdown lấy từ ung_vien[] thật của requisition (đã có từ B4 chấm CV) —
// không cho nhập tay để tránh sai mã/trùng tên/tạo nhầm ứng viên mới ngoài luồng.
async function openHrInterviewForm(reqId, maUv, ten) {
  const modal = $("#hrInterviewModal");
  const form = $("#hrInterviewForm");
  form.reset();
  $("#hrInterviewError").style.display = "none";
  form.elements["req_id"].value = reqId;
  const select = $("#hrInterviewMaUvSelect");
  select.innerHTML = `<option value="">Đang tải danh sách ứng viên…</option>`;
  modal.classList.add("open");
  try {
    const { requisition } = await hrApi(`/api/hr/requisitions/${encodeURIComponent(reqId)}`);
    const candidates = requisition.ung_vien || [];
    if (!candidates.length) {
      select.innerHTML = `<option value="">— Chưa có ứng viên nào, chấm CV ở B4 trước —</option>`;
      return;
    }
    select.innerHTML = `<option value="">— chọn ứng viên —</option>` +
      candidates.map(c => `<option value="${c.ma_uv}">${c.ma_uv} — ${c.ten || "(chưa có tên)"}</option>`).join("");
    const match = ten ? candidates.find(c => c.ten === ten) : null;
    const preselect = (maUv && candidates.some(c => c.ma_uv === maUv)) ? maUv : (match ? match.ma_uv : "");
    if (preselect) select.value = preselect;
  } catch (e) {
    select.innerHTML = `<option value="">⚠️ Không tải được danh sách ứng viên</option>`;
  }
}
function closeHrInterviewForm() {
  $("#hrInterviewModal").classList.remove("open");
}
$("#hrInterviewClose").addEventListener("click", closeHrInterviewForm);
$("#hrInterviewCancel").addEventListener("click", closeHrInterviewForm);
$("#hrInterviewFormBtn")?.addEventListener("click", () => {
  const sel = $("#hrChatReqSelect");
  const reqId = sel ? sel.value : "";
  if (!reqId || reqId === HR_GENERAL_VALUE) {
    toast("⚠️ Chọn 1 requisition cụ thể trong dropdown trước (không phải \"Hỏi chung\")");
    return;
  }
  openHrInterviewForm(reqId, "", "");
});
$("#hrInterviewModal").addEventListener("click", (e) => { if (e.target.id === "hrInterviewModal") closeHrInterviewForm(); });

$("#hrChatContextToggle")?.addEventListener("click", () => {
  const bar = $("#hrChatContext");
  const collapsed = bar.classList.toggle("collapsed");
  $("#hrChatContextToggle").title = collapsed ? "Mở rộng thanh này" : "Thu gọn thanh này";
  localStorage.setItem("hrChatContextCollapsed", collapsed ? "1" : "0");
});

$("#hrInterviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const errBox = $("#hrInterviewError");
  errBox.style.display = "none";
  const reqId = fd.get("req_id");
  const nguoiPv = String(fd.get("nguoi_pv") || "").split(",").map(s => s.trim()).filter(Boolean);
  const payload = {
    ma_uv: fd.get("ma_uv") || "",
    thoi_gian: fd.get("thoi_gian") || "",
    hinh_thuc: fd.get("hinh_thuc") || "",
    nguoi_pv: nguoiPv,
    diem_chuyen_mon: fd.get("diem_chuyen_mon"),
    diem_van_hoa: fd.get("diem_van_hoa"),
    diem_manh: fd.get("diem_manh") || "",
    diem_lo_ngai: fd.get("diem_lo_ngai") || "",
    luong_mong_muon: fd.get("luong_mong_muon") || "",
    co_the_onboard_tu: fd.get("co_the_onboard_tu") || "",
    ket_luan: fd.get("ket_luan"),
  };
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang lưu…";
  try {
    const result = await hrApi(`/api/hr/requisitions/${encodeURIComponent(reqId)}/interview-evaluation`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeHrInterviewForm();
    toast(result.advancedToB7
      ? `🎉 ${result.ma_uv} — Đồng ý tuyển! Đã chuyển sang B7 (chốt offer).`
      : `✅ Đã lưu đánh giá phỏng vấn cho ${result.ma_uv}${result.sheetSync?.ok ? " — đã đồng bộ Excel" : ""}`);
    const a = AGENTS.find(x => x.id === "hr-1");
    if (a) {
      loadHrPipeline(a);
      populateHrChatReqSelect();
      refreshOrgChart();
      const key = hrKey(a.id, reqId);
      if (chatHistory[key]) {
        const syncLine = result.sheetSync?.ok
          ? `\n   📊 Excel: đã ${result.sheetSync.action === "updated" ? "cập nhật" : "thêm"} dòng`
          : (result.sheetSync?.error ? `\n   ⚠️ Excel: ${result.sheetSync.error}` : "");
        chatHistory[key].push({ from: "tool", text: `✅ Đã lưu đánh giá phỏng vấn ${result.ma_uv} qua form${syncLine}` });
        if (result.advancedToB7) {
          chatHistory[key].push({
            from: "agent",
            text: `🎉 <b>${result.ma_uv}</b> được đánh giá <b>Đồng ý</b> — em đã chuyển requisition sang <b>B7 (chốt điều khoản offer)</b>.\n` +
              `Anh/chị nhắn cho em khi sẵn sàng chốt điều khoản (chức danh, ngày onboard, lương, phụ cấp...), em sẽ trình bảng 12 dòng để anh/chị xác nhận từng dòng — xong em tạo offer letter thật theo mẫu công ty.`,
          });
        }
        if (currentAgent && currentAgent.id === a.id) renderChat(a, key);
      }
    }
  } catch (err) {
    errBox.textContent = "⚠️ " + err.message;
    errBox.style.display = "";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "💾 Lưu đánh giá";
  }
});

async function loadHrPipeline(agent) {
  const box = $("#hrPipelineList");
  if (!box) return;
  try {
    const { requisitions } = await hrApi("/api/hr/requisitions");
    agent.task = hrTaskSummary(requisitions);
    refreshAgentCard(agent);
    if (!requisitions.length) {
      box.innerHTML = `<div class="kwsr-empty">Chưa có đợt tuyển nào — bấm "＋ Mở đợt tuyển mới" để tạo requisition thật đầu tiên.</div>`;
      return;
    }
    box.innerHTML = requisitions.map(r => `
      <div class="hr-req-card">
        <div class="hr-req-top"><b>📋 ${r.requisition_id} — ${r.vi_tri?.ten || "?"}</b><span class="badge">${r.vi_tri?.so_luong || "?"} người</span></div>
        <div class="hr-req-meta">Mở ngày ${r.ngay_mo} · ${r.so_ung_vien} ứng viên · Bước hiện tại: B${r.buoc_hien_tai} — ${r.buoc_ten}</div>
        <div class="hr-req-next">Bước kế tiếp: ${r.buoc_ke_tiep ? "/" + r.buoc_ke_tiep : "—"}</div>
        ${r.buoc_hien_tai === 4 ? `<div class="hr-req-next">📂 Copy CV (.pdf) vào <code>hr/data/ho-so/${r.requisition_id}/cv/</code>, rồi nhắn tên file vào chat để chấm điểm</div>` : ""}
      </div>`).join("");
  } catch (e) {
    box.innerHTML = `<div class="kwsr-empty">⚠️ Không tải được pipeline — Backend Proxy (project/aios/server) có đang chạy trên ${HERMES_PROXY_BASE} không?</div>`;
  }
}

$("#hrIntakeClose").addEventListener("click", closeHrIntake);
$("#hrIntakeCancel").addEventListener("click", closeHrIntake);
$("#hrIntakeDone").addEventListener("click", () => {
  closeHrIntake();
  const a = AGENTS.find(x => x.id === "hr-1");
  if (a) loadHrPipeline(a);
  refreshOrgChart();
});
$("#hrIntakeModal").addEventListener("click", (e) => { if (e.target.id === "hrIntakeModal") closeHrIntake(); });

$("#hrIntakeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const errBox = $("#hrIntakeError");
  errBox.style.display = "none";

  const baViec = [fd.get("viec_1"), fd.get("viec_2"), fd.get("viec_3")].filter(v => v && v.trim());
  const payload = {
    vi_tri: {
      ten: fd.get("ten"), phong_ban: fd.get("phong_ban"), cap_bac: fd.get("cap_bac"),
      bao_cao_cho: fd.get("bao_cao_cho"), so_luong: Number(fd.get("so_luong")),
      hinh_thuc: fd.get("hinh_thuc"), dia_diem: fd.get("dia_diem") || "",
      ly_do_tuyen: fd.get("ly_do_tuyen"),
      onboard_mong_muon: fd.get("onboard_mong_muon"), onboard_muon_nhat: fd.get("onboard_muon_nhat"),
    },
    boi_canh: {
      thay_doi_doanh_nghiep: fd.get("thay_doi_doanh_nghiep"),
      ba_viec_chinh_3_thang: baViec,
      tieu_chi_thanh_cong_6_thang: fd.get("tieu_chi_thanh_cong_6_thang"),
    },
    ngan_sach: {
      luong_min: fd.get("luong_min") || "", luong_max: fd.get("luong_max") || "",
      cong_bo_luong_tren_tin_dang: fd.get("cong_bo_luong") === "on",
    },
    jd_cu: {
      noi_dung: fd.get("jd_cu_noi_dung") || "",
      duong_dan: fd.get("jd_cu_duong_dan") || "",
    },
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang tạo…";
  try {
    const result = await hrApi("/api/hr/requisitions", { method: "POST", body: JSON.stringify(payload) });
    form.style.display = "none";
    const resBox = $("#hrIntakeResult");
    resBox.style.display = "";
    $("#hrResultPath").textContent = `hr/data/requisitions/${result.requisition.requisition_id}.json`;
    $("#hrResultSummary").textContent = result.summary;
    $("#hrResultWarnings").innerHTML = (result.canhBao || []).map(w => `<div class="warn-line">${w}</div>`).join("");

    const a = AGENTS.find(x => x.id === "hr-1");
    a.task = `${result.requisition.requisition_id} — ${result.requisition.vi_tri.ten}: bước B${result.requisition.buoc_hien_tai} ${BUOC_TEN_MAP[result.requisition.buoc_hien_tai]}`;
    a.status = "working";
    refreshAgentCard(a);
    if (!chatHistory[a.id]) renderChatSeed(a);
    chatHistory[a.id].push({ from: "agent", text: `📋 Đã tạo ${result.requisition.requisition_id} thật (ghi file trên đĩa).\n\n${result.summary}` });
    if (currentAgent && currentAgent.id === "hr-1") renderChat(a);
    addFeed(`<b>HR Agent</b> tạo requisition thật <b>${result.requisition.requisition_id}</b> — ${result.requisition.vi_tri.ten} (${result.requisition.vi_tri.so_luong} người).`, "f-done");
    toast(`✅ Đã tạo ${result.requisition.requisition_id} — file thật trong hr/data/requisitions/`);
  } catch (err) {
    errBox.textContent = "⚠️ " + err.message;
    errBox.style.display = "";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "📋 Tạo requisition";
  }
});

// ---------- GLOBAL RULES MODAL (mở từ nút CEO trên sơ đồ tổ chức) ----------
function openGlobalModal() {
  $("#globalModal").classList.add("open");
}
function closeGlobalModal() {
  $("#globalModal").classList.remove("open");
}

function renderGlobalRules() {
  const box = $("#globalRules");
  if (!box) return;
  box.innerHTML = `
    <div class="gr-head">
      <span style="font-size:1.3rem">🌐</span>
      <h2>Global Rule — "hiến pháp" toàn công ty</h2>
      <button class="add-btn" id="grAdd">＋ Thêm Global Rule</button>
      <button class="drawer-close" id="grClose" aria-label="Đóng" style="margin-left:.2rem">✕</button>
      <p>Áp dụng cho <b>mọi Agent, mọi phòng ban</b> (tương đương file GEMINI.md — mục 2.2). Khi xung đột với Workspace Rule của từng Agent: <b>Workspace thắng, Global là mặc định chung</b>.</p>
    </div>
    <div class="kwsr-list">
      ${GLOBAL_RULES.length ? GLOBAL_RULES.map((r, i) => `
      <div class="kwsr-item">
        <span class="k-tag G">G</span>
        <span class="item-text">${r}</span>
        <span class="item-actions">
          <button class="icon-btn" data-gr-edit="${i}" title="Sửa">✎</button>
          <button class="icon-btn danger" data-gr-del="${i}" title="Xóa">🗑</button>
        </span>
      </div>`).join("") : `<div class="kwsr-empty">Chưa có Global Rule — hãy soạn "hiến pháp" đầu tiên cho đội Agent.</div>`}
    </div>
    <form class="inline-form" id="grForm" style="display:none">
      <input type="text" placeholder="VD: Mọi cam kết tài chính với bên ngoài phải có phê duyệt của CEO…" />
      <button class="btn btn-primary btn-sm" type="submit">Lưu</button>
      <button class="btn btn-ghost btn-sm" type="button" id="grCancel">Hủy</button>
    </form>`;

  const form = $("#grForm");
  const input = form.querySelector("input");

  function afterGlobalChange(action, value) {
    saveState();
    renderGlobalRules();
    refreshOrgChart();
    renderStats();
    if (currentAgent && $("#agentDrawer").classList.contains("open")) renderAgentInfo(currentAgent);
    const verbs = { add: "bổ sung", edit: "cập nhật", del: "gỡ bỏ" };
    toast(`🌐 Đã ${verbs[action]} Global Rule — áp dụng ngay cho toàn bộ ${AGENTS.length} Agent.`);
    addFeed(`Bạn ${verbs[action]} <b>Global Rule</b>: "${String(value).slice(0, 60)}${String(value).length > 60 ? "…" : ""}" — mọi Agent tuân thủ ngay lập tức.`, "f-rule");
  }

  $("#grClose").addEventListener("click", closeGlobalModal);
  $("#grAdd").addEventListener("click", () => {
    delete form.dataset.editIndex;
    form.style.display = "flex";
    input.value = "";
    input.focus();
  });
  $("#grCancel").addEventListener("click", () => { form.style.display = "none"; delete form.dataset.editIndex; });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    const idx = form.dataset.editIndex;
    if (idx !== undefined) { GLOBAL_RULES[+idx] = val; afterGlobalChange("edit", val); }
    else { GLOBAL_RULES.push(val); afterGlobalChange("add", val); }
  });
  box.querySelectorAll("[data-gr-edit]").forEach(b => b.addEventListener("click", () => {
    form.dataset.editIndex = b.dataset.grEdit;
    form.style.display = "flex";
    input.value = GLOBAL_RULES[+b.dataset.grEdit];
    input.focus();
  }));
  box.querySelectorAll("[data-gr-del]").forEach(b => b.addEventListener("click", () => {
    const old = GLOBAL_RULES[+b.dataset.grDel];
    if (!confirm(`Gỡ Global Rule khỏi toàn bộ đội Agent?\n\n"${old}"`)) return;
    GLOBAL_RULES.splice(+b.dataset.grDel, 1);
    afterGlobalChange("del", old);
  }));
}

// ---------- RENDER: DEPARTMENTS & AGENTS ----------
function agentCardHTML(a) {
  return `
  <article class="agent-card" id="card-${a.id}">
    <div class="agent-top">
      <div class="avatar">${a.icon}</div>
      <div class="agent-name-row">
        <h3>${a.name} <span class="status-dot ${a.status}" title="${statusLabel[a.status]}"></span></h3>
        <span class="role">${a.role}</span>
      </div>
    </div>
    <div class="badge-row">
      <span class="badge model">🧠 ${a.model}</span>
      <span class="badge mode">${a.mode === "Planning" ? "🗺️ Planning" : "⚡ Fast"}</span>
      <span class="badge ${stageClass(a.stage)}">${a.stage}</span>
    </div>
    <div class="task-line">
      <span class="t-lbl">Task hiện tại <span class="t-status ${a.status}">● ${statusLabel[a.status]}</span></span>
      <span class="t-text">${a.task}</span>
    </div>
    <div class="maturity">
      <span>Trưởng thành</span>
      <div class="bar"><i style="width:${a.maturity}%"></i></div>
      <b style="color:var(--text)">${a.maturity}%</b>
    </div>
    <div class="skill-chips">
      ${a.skills.map(s => `<button class="skill-chip" data-skill="${s}" title="Xem chi tiết skill">🧩 ${s}</button>`).join("")}
      ${(a.subagents || []).map(s => `<button class="skill-chip" data-skill="${s.split(" — ")[0]}" title="Subagent — chạy song song trong context riêng">🤖 ${s.split(" — ")[0]}</button>`).join("")}
    </div>
    <div class="agent-actions">
      <button class="btn btn-primary btn-sm" data-chat="${a.id}">💬 Chat</button>
      <button class="btn btn-ghost btn-sm" data-detail="${a.id}">Hồ sơ & KWSR</button>
      ${a.hrIntake ? `<button class="btn btn-ghost btn-sm" data-hr-open-intake title="Tạo requisition thật (B1)">📋 Mở đợt tuyển</button>` : ""}
    </div>
  </article>`;
}

// ---------- ORG CHART (sơ đồ cơ cấu tổ chức — góc nhìn CEO) ----------
function orgChartHTML() {
  const deptCols = DEPARTMENTS.map(d => {
    const agents = AGENTS.filter(a => a.dept === d.id);
    return `
    <div class="org-dept">
      <div class="org-dept-head">${d.icon} ${d.name.replace("Phòng ", "")}<span class="cnt">${agents.length} agent</span></div>
      ${agents.map(a => `
      <button class="org-agent" data-detail="${a.id}" title="Mở hồ sơ ${a.name}">
        <span class="oa-ico">${a.icon}</span>
        <span class="oa-info">
          <span class="oa-name">${a.name} <span class="status-dot ${a.status}"></span></span>
          <span class="oa-model">🧠 ${a.model}</span>
          <span class="oa-mat"><span class="oa-bar"><i style="width:${a.maturity}%"></i></span>${a.maturity}%</span>
        </span>
        <span class="oa-stage ${stageClass(a.stage)}">${a.stage}</span>
      </button>`).join("")}
    </div>`;
  }).join("");

  return `
  <section class="org-section" id="orgChart">
    <div class="dept-head">
      <span class="dic">🏢</span>
      <div><h2>Sơ đồ cơ cấu tổ chức AI Workforce</h2><span>Góc nhìn tổng quan cho CEO — bấm vào từng Agent để mở Hồ sơ KWSR & Chat</span></div>
    </div>
    <div class="org-chart">
      <div class="org-node ceo" id="orgCEO" title="Xem & bổ sung Global Rule toàn công ty"><b>👤 CEO / Chủ doanh nghiệp</b><span>Ra lệnh · Duyệt · Giám sát ngoại lệ · 🌐 ${GLOBAL_RULES.length} Global Rule</span></div>
      <div class="org-line"></div>
      <div class="org-node orches" id="orgOrches"><b>🧭 Orches Agent</b><span>Gemini 3 Pro (High) · Điều phối &amp; phân việc toàn đội</span></div>
      <div class="org-line"></div>
      <div class="org-branch"></div>
      <div class="org-depts">${deptCols}</div>
    </div>
  </section>`;
}

function refreshOrgChart() {
  const old = $("#orgChart");
  if (!old) return;
  const tpl = document.createElement("template");
  tpl.innerHTML = orgChartHTML().trim();
  const fresh = tpl.content.firstElementChild;
  fresh.style.display = old.style.display;
  old.replaceWith(fresh);
  bindOrgOrches();
}

function bindOrgOrches() {
  const n = $("#orgOrches");
  if (n) n.addEventListener("click", () => {
    $("#orchesPanel").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#orchesInput").focus();
  });
  const ceo = $("#orgCEO");
  if (ceo) ceo.addEventListener("click", openGlobalModal);
}

function renderDepartments() {
  const c = $("#deptContainer");
  c.innerHTML = orgChartHTML() + DEPARTMENTS.map(d => {
    const agents = AGENTS.filter(a => a.dept === d.id);
    return `
    <section class="dept-section" data-dept="${d.id}" id="dept-${d.id}">
      <div class="dept-head">
        <span class="dic">${d.icon}</span>
        <div><h2>${d.name}</h2><span>${d.desc} · ${agents.length} agent</span></div>
      </div>
      <div class="agent-grid">${agents.map(agentCardHTML).join("")}</div>
    </section>`;
  }).join("");

  c.addEventListener("click", (e) => {
    const sk = e.target.closest("[data-skill]");
    if (sk) return openSkill(sk.dataset.skill);
    const ch = e.target.closest("[data-chat]");
    if (ch) return openDrawer(ch.dataset.chat, "chat");
    const dt = e.target.closest("[data-detail]");
    if (dt) return openDrawer(dt.dataset.detail, "info");
    const hi = e.target.closest("[data-hr-open-intake]");
    if (hi) return openHrIntake(AGENTS.find(x => x.id === "hr-1"));
  });
}

// ---------- PACK MODAL (xem chi tiết Skill / Workflow) ----------
// Skill/subagent THẬT của HR (project/aios/hr) — nội dung fetch trực tiếp từ ổ đĩa qua Proxy
const HR_REAL_SKILL_IDS = new Set([
  "tuyen-dung", "nhu-cau-tuyen-dung", "jd-va-tin-tuyen-dung",
  "thu-nhan-sang-loc-cv", "lich-phong-van", "offer-va-luu-ho-so", "cham-diem-cv",
]);

function parseSkillFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { description: "" };
  const desc = m[1].match(/description:\s*([\s\S]*?)(?=\n\w+:|$)/);
  return { description: desc ? desc[1].replace(/\n\s+/g, " ").trim() : "" };
}

async function openRealHrSkill(id) {
  $("#skIcon").textContent = "📄";
  $("#skName").textContent = id;
  $("#skDesc").textContent = "Đang tải nội dung thật từ hr/skills/…";
  $("#skH1").textContent = "SKILL.md thật (project/aios/hr) — không phải bản mô phỏng";
  $("#skCode").textContent = "Đang tải…";
  $("#skH2").textContent = "";
  $("#skStd").innerHTML = "";
  $("#skH3").textContent = "Nguồn";
  $("#skTrigger").textContent = "";
  $("#skillModal").classList.add("open");
  try {
    const data = await hrApi(`/api/hr/skills/${encodeURIComponent(id)}`);
    const { description } = parseSkillFrontmatter(data.md);
    $("#skDesc").textContent = description || "(không có mô tả trong frontmatter)";
    $("#skCode").textContent = data.md;
    $("#skTrigger").textContent = `${data.path} — đọc trực tiếp từ ổ đĩa qua Backend Proxy, đúng nội dung Hermes hr-1 sẽ dùng khi kích hoạt skill này thật.`;
  } catch (e) {
    $("#skCode").textContent = `⚠️ Không tải được nội dung thật.\n${e.message}\n\nBackend Proxy (project/aios/server) có đang chạy trên ${HERMES_PROXY_BASE} không?`;
  }
}

function showPack(name, entry, labels) {
  $("#skIcon").textContent = labels.icon;
  $("#skName").textContent = name;
  $("#skDesc").textContent = entry.desc;
  $("#skH1").textContent = labels.h1;
  $("#skCode").textContent = entry.md;
  $("#skH2").textContent = labels.h2;
  $("#skStd").innerHTML = entry.standards.map(x => `<li>${x}</li>`).join("");
  $("#skH3").textContent = labels.h3;
  $("#skTrigger").textContent = entry.trigger;
  $("#skillModal").classList.add("open");
}

function openSkill(id) {
  if (HR_REAL_SKILL_IDS.has(id)) return openRealHrSkill(id);
  const s = SKILLS[id];
  if (!s) return;
  showPack(id, s, {
    icon: "🧩",
    h1: "Cấu trúc SKILL.md (Progressive Disclosure)",
    h2: "Tiêu chuẩn chất lượng đầu ra",
    h3: "Cơ chế kích hoạt",
  });
}

function openWorkflowView(cmd) {
  const w = WFLOWS[cmd];
  if (!w) return;
  showPack(cmd, w, {
    icon: "🧱",
    h1: "Cấu trúc WORKFLOW.md (các bước tuần tự)",
    h2: "Điểm kiểm soát trong quy trình",
    h3: "Cách kích hoạt (thủ công — bạn giữ quyền kiểm soát)",
  });
}
$("#skillClose").addEventListener("click", () => $("#skillModal").classList.remove("open"));
$("#skillModal").addEventListener("click", (e) => { if (e.target.id === "skillModal") e.target.classList.remove("open"); });

// ---------- DRAWER (agent detail + chat) ----------
function openDrawer(agentId, tab = "info") {
  const a = AGENTS.find(x => x.id === agentId);
  if (!a) return;
  currentAgent = a;
  $("#dAvatar").textContent = a.icon;
  $("#dName").textContent = a.name;
  $("#dRole").textContent = `${DEPARTMENTS.find(d => d.id === a.dept).name} · ${a.role}`;

  renderAgentInfo(a);

  switchTab(tab);
  renderChat(a);
  $("#agentDrawer").classList.add("open");
  $("#drawerBackdrop").classList.add("open");
}

// ---------- KWSR EDITOR (thêm / sửa / xóa tri thức cho Agent) ----------
function recomputeStage(a) {
  a.stage = a.maturity > 90 ? "Chuyên gia" : a.maturity >= 70 ? "Thạo việc" : "Học việc";
}

function refreshAgentCard(a) {
  const card = $("#card-" + a.id);
  if (card) card.outerHTML = agentCardHTML(a);
}

function ensureSkillEntry(name, desc) {
  if (SKILLS[name]) return;
  SKILLS[name] = {
    custom: true,
    desc: desc || "Skill do doanh nghiệp tự bổ sung — đóng gói kinh nghiệm chuyên gia thành năng lực tái sử dụng.",
    trigger: "Tự động kích hoạt khi Agent nhận diện yêu cầu khớp với mô tả của skill.",
    standards: ["Tuân thủ tiêu chuẩn chất lượng nội bộ", "Kết quả nhất quán dù ai ra lệnh", "Ghi nguồn tri thức khi áp dụng"],
    md: `---
name: ${name}
description: ${desc || "Skill do doanh nghiệp tự đóng gói từ kinh nghiệm chuyên gia."}
---

## Ghi chú
Skill được bổ sung thủ công qua AI OS Dashboard.
Hoàn thiện quy trình chi tiết tại thư mục skills/${name}/`,
  };
}

function afterKwsrChange(a, key, action, value) {
  if (action === "add") {
    a.maturity = Math.min(97, a.maturity + 1);
    recomputeStage(a);
  }
  saveState();
  renderAgentInfo(a);
  refreshAgentCard(a);
  refreshOrgChart();
  renderStats();
  const meta = SECTION_META[key];
  const verbs = { add: "bổ sung", edit: "cập nhật", del: "gỡ bỏ" };
  toast(`✅ Đã ${verbs[action]} ${meta.feedVerb} — ${a.name} được cập nhật ngay.`);
  addFeed(`Bạn ${verbs[action]} ${meta.feedVerb} cho <b>${a.name}</b>: "${String(value).slice(0, 60)}${String(value).length > 60 ? "…" : ""}" — Agent áp dụng ngay lập tức.`, "f-done");
  if (!chatHistory[a.id]) renderChatSeed(a);
  chatHistory[a.id].push({
    from: "agent",
    text: action === "del"
      ? `🗑️ Em đã gỡ ${meta.feedVerb}: "${value}". Từ giờ em không dùng nội dung này nữa ạ.`
      : `📚 Em vừa được ${verbs[action]} ${meta.feedVerb}: "${value}".\nEm đã nạp vào bộ nhớ và áp dụng ngay cho các tác vụ tiếp theo. Tri thức này sẽ ở lại doanh nghiệp dù nhân sự thay đổi ạ.`,
  });
  if (currentAgent && currentAgent.id === a.id) renderChat(a);

  // Đồng bộ tài liệu Knowledge sang Hermes/Mem0 (chạy nền — không chặn UI, xem HERMES_INTEGRATION.md)
  if (key === "knowledge" && (action === "add" || action === "edit")) {
    syncKnowledgeToHermes(a, value);
  }
}

function renderAgentInfo(a) {
  const secHTML = (key) => {
    const m = SECTION_META[key];
    const items = a[key];
    const textFormHTML = (display) => `
          <form class="inline-form" data-form="${key}" style="display:${display}">
            <input type="text" placeholder="${m.placeholder}" />
            <button class="btn btn-primary btn-sm" type="submit">Lưu</button>
            <button class="btn btn-ghost btn-sm" type="button" data-cancel>Hủy</button>
          </form>`;

    let addUI;
    if (key === "knowledge") {
      // Knowledge: nhập tay / upload file / kết nối MCP RAG
      addUI = `
      <div class="add-doc-panel" data-panel="knowledge" style="display:none">
        <div class="method-tabs">
          <button type="button" class="method-tab active" data-method="text">✍️ Nhập tay</button>
          <button type="button" class="method-tab" data-method="file">📎 Upload file</button>
          <button type="button" class="method-tab" data-method="mcp">🔌 Kho RAG (MCP)</button>
        </div>
        <div class="method-body" data-mbody="text">${textFormHTML("flex")}</div>
        <div class="method-body" data-mbody="file" style="display:none">
          <label class="upload-zone">
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.md" multiple hidden />
            <span class="uz-icon">📎</span>
            <span>Kéo thả file vào đây hoặc bấm để chọn</span>
            <span class="uz-sub">Hỗ trợ <b>PDF · DOC · XLS · MD</b> — theo năng lực xử lý file của Agent (mục 2.5) · tối đa 20MB/file</span>
          </label>
        </div>
        <div class="method-body" data-mbody="mcp" style="display:none">
          <div class="mcp-connect">
            <select>
              <option value="Kho RAG nội bộ (Qdrant + embeddings)">🏢 Kho RAG nội bộ (Qdrant + embeddings)</option>
              <option value="Google Drive MCP">📁 Google Drive MCP — thư mục 04_Kho_Tri_Thuc</option>
              <option value="Notion MCP">📝 Notion MCP — workspace tài liệu công ty</option>
              <option value="SharePoint MCP">🗄️ SharePoint MCP — site phòng ban</option>
            </select>
            <button type="button" class="btn btn-primary btn-sm" data-mcp-connect>Kết nối</button>
          </div>
          <p class="mcp-hint"><b>MCP (Model Context Protocol)</b>: Agent truy vấn trực tiếp kho tài liệu đã vector hóa —
          tài liệu mới trong kho được tự đồng bộ hàng ngày, không cần upload lại từng file.</p>
          <div class="mcp-connecting" style="display:none"><span class="spinner"></span><span class="mcp-msg">Đang kết nối…</span></div>
        </div>
      </div>`;
    } else if (key === "workflows") {
      // Workflow: nhập tay / trình tạo theo bước / upload SOP có sẵn
      addUI = `
      <div class="add-doc-panel" data-panel="workflows" style="display:none">
        <div class="method-tabs">
          <button type="button" class="method-tab active" data-method="text">✍️ Nhập tay</button>
          <button type="button" class="method-tab" data-method="builder">🧱 Trình tạo quy trình</button>
          <button type="button" class="method-tab" data-method="file">📎 Upload SOP</button>
        </div>
        <div class="method-body" data-mbody="text">${textFormHTML("flex")}</div>
        <div class="method-body" data-mbody="builder" style="display:none">
          <div class="builder-form">
            <input data-bf="cmd" type="text" placeholder="Tên lệnh — vd: bao-cao-tuan" />
            <input data-bf="desc" type="text" placeholder="Mô tả ngắn — vd: tổng hợp số liệu tuần và xuất PDF" />
            <textarea data-bf="steps" placeholder="Các bước tuần tự, mỗi dòng một bước:
Lấy dữ liệu doanh thu từ 06_Du_Lieu/Raw
Tổng hợp theo mẫu trong 01_Bieu_Mau
Xuất PDF vào 05_Bao_Cao/01_Tuan"></textarea>
            <p class="bf-hint">Workflow là <b>quy trình thủ công</b> (mục 3.2) — kích hoạt bằng lệnh <b>/</b>, bạn giữ quyền kiểm soát và có thể bỏ qua/đổi bước khi chạy.</p>
            <div class="bf-actions"><button type="button" class="btn btn-primary btn-sm" data-wf-build>🧱 Tạo Workflow</button></div>
          </div>
        </div>
        <div class="method-body" data-mbody="file" style="display:none">
          <label class="upload-zone">
            <input type="file" accept=".pdf,.doc,.docx,.md" multiple hidden />
            <span class="uz-icon">📋</span>
            <span>Upload SOP có sẵn của công ty</span>
            <span class="uz-sub">Hỗ trợ <b>PDF · DOC · MD</b> — Agent sẽ đọc SOP và tự chuẩn hóa thành Workflow kích hoạt bằng lệnh /</span>
          </label>
        </div>
      </div>`;
    } else if (key === "skills") {
      // Skill: nhập tay / trình đóng gói chuẩn SKILL.md / nâng cấp từ Workflow (mục 2.4.4)
      const wfOptions = a.workflows.map(w => `<option value="${w.replace(/"/g, "&quot;")}">${w}</option>`).join("");
      addUI = `
      <div class="add-doc-panel" data-panel="skills" style="display:none">
        <div class="method-tabs">
          <button type="button" class="method-tab active" data-method="text">✍️ Nhập tay</button>
          <button type="button" class="method-tab" data-method="builder">🧩 Đóng gói skill</button>
          <button type="button" class="method-tab" data-method="upgrade">⬆️ Nâng cấp từ Workflow</button>
        </div>
        <div class="method-body" data-mbody="text">${textFormHTML("flex")}</div>
        <div class="method-body" data-mbody="builder" style="display:none">
          <div class="builder-form">
            <input data-bf="name" type="text" placeholder="Tên skill — vd: dam-phan-gia" />
            <input data-bf="desc" type="text" placeholder="Mô tả & tình huống kích hoạt — vd: thương lượng giá với khách B2B" />
            <textarea data-bf="standards" placeholder="Tiêu chuẩn chất lượng, mỗi dòng một tiêu chuẩn:
Không giảm quá 8% nếu chưa có phê duyệt
Luôn đưa 2 phương án cho khách chọn
Chốt bằng email xác nhận trong 24h"></textarea>
            <p class="bf-hint">Skill dạy Agent <b>"làm tốt như chuyên gia"</b> (mục 3.3) — tự động kích hoạt khi nhận diện đúng tình huống, đảm bảo chuẩn đầu ra dù ai ra lệnh.</p>
            <div class="bf-actions"><button type="button" class="btn btn-primary btn-sm" data-skill-build>🧩 Đóng gói Skill</button></div>
          </div>
        </div>
        <div class="method-body" data-mbody="upgrade" style="display:none">
          ${a.workflows.length ? `
          <div class="upgrade-row">
            <select data-upgrade-select>${wfOptions}</select>
            <button type="button" class="btn btn-primary btn-sm" data-skill-upgrade>⬆️ Đóng gói</button>
          </div>
          <p class="bf-hint" style="margin-top:.55rem">Theo mô hình tiến hóa (mục 2.4.4): khi Workflow đã <b>ổn định, ít thay đổi bước</b> và cần chuẩn chất lượng khắt khe — hãy nâng cấp thành Skill để tự động kích hoạt và tái sử dụng cho toàn tổ chức.</p>`
          : `<p class="bf-hint">Agent này chưa có Workflow nào để nâng cấp — hãy tạo Workflow trước, chạy ổn định rồi quay lại đóng gói thành Skill.</p>`}
        </div>
      </div>`;
    } else {
      addUI = textFormHTML("none");
    }
    return `
    <div class="d-section" data-sec="${key}">
      <div class="d-section-head">
        <h4>${m.title}</h4>
        <button class="add-btn" data-add="${key}">＋ ${m.addLabel}</button>
      </div>
      <div class="kwsr-list">
        ${items.length ? items.map((item, i) => `
        <div class="kwsr-item">
          <span class="k-tag ${m.tag}">${m.tag}</span>
          <span class="item-text">${item}</span>
          <span class="item-actions">
            ${key === "skills" ? `<button class="view-link" data-skill="${item}">Xem</button>` : ""}
            ${key === "workflows" && WFLOWS[item.split(" ")[0]] ? `<button class="view-link" data-wf="${item.split(" ")[0]}">Xem</button>` : ""}
            <button class="icon-btn" data-edit="${key}:${i}" title="Sửa nội dung">✎</button>
            <button class="icon-btn danger" data-del="${key}:${i}" title="Xóa">🗑</button>
          </span>
        </div>`).join("") : `<div class="kwsr-empty">Chưa có mục nào — bấm "＋" để bổ sung tri thức đầu tiên.</div>`}
      </div>
      ${addUI}
    </div>`;
  };

  $("#tabInfo").innerHTML = `
    <div class="d-section">
      <h4>Cấu hình Agent</h4>
      <dl class="kv">
        <dt>Model (bộ não)</dt><dd><span class="badge model">${a.model}</span></dd>
        <dt>Chế độ làm việc</dt><dd><span class="badge mode">${a.mode === "Planning" ? "🗺️ Planning — lập kế hoạch trước khi làm" : "⚡ Fast — thực thi nhanh"}</span></dd>
        <dt>Vì sao chọn model này</dt><dd style="color:var(--muted);font-size:.85rem">${a.modelWhy}</dd>
        <dt>Giai đoạn</dt><dd><span class="badge ${stageClass(a.stage)}">${a.stage} · ${a.maturity}%</span></dd>
        <dt>Task hiện tại</dt><dd>${a.task}</dd>
      </dl>
    </div>
    ${a.hrIntake ? `
    <div class="d-section">
      <div class="d-section-head">
        <h4>📋 Pipeline tuyển dụng — dữ liệu THẬT</h4>
        <button class="add-btn" data-hr-open-intake>＋ Mở đợt tuyển mới</button>
      </div>
      <div class="hr-req-list" id="hrPipelineList"><div class="kwsr-empty">Đang tải…</div></div>
      <div class="hr-gap-banner">
        <b>⚠️ Khoảng trống connector (theo hr/README.md mục 3):</b>
        Gmail ✅ · Google Calendar ✅ · Đăng bài FB/Zalo ❌ chưa có MCP (đăng tay) ·
        Tạo hình ảnh ❌ chưa có công cụ (xuất brief cho Canva) ·
        Google Drive/OneDrive ❌ chưa có connector (đồng bộ qua thư mục desktop) ·
        Ghi trực tiếp Google Sheets ❌ (xuất .csv rồi dán tay). B1 (form này) chạy hoàn toàn thật —
        B2–B10 cần Hermes hr-1 thật hoặc các connector trên.
      </div>
    </div>` : ""}
    ${secHTML("knowledge")}${secHTML("workflows")}${secHTML("skills")}
    <div class="d-section">
      <div class="d-section-head">
        <h4>🌐 Global Rule — toàn công ty</h4>
        <button class="add-btn" data-go-global>Quản lý ở Dashboard</button>
      </div>
      <div class="kwsr-list">
        ${GLOBAL_RULES.map(r => `<div class="kwsr-item"><span class="k-tag G">G</span><span class="item-text">${r}</span></div>`).join("")}
      </div>
      <p class="bf-hint" style="margin-top:.5rem">Áp dụng cho mọi Agent. Khi xung đột: <b>Workspace Rule bên dưới thắng Global</b> — Global chỉ là mặc định chung (mục 2.2.4).</p>
    </div>
    ${secHTML("rules")}
    <div class="inherit-note">
      <span style="font-size:1.1rem">🏛️</span>
      <span><b>Tính kế thừa:</b> mọi tri thức bổ sung tại đây được lưu vĩnh viễn trong Song Sinh Số của doanh nghiệp.
      Nhân sự giỏi nghỉ việc — kinh nghiệm của họ vẫn ở lại, Agent vẫn tiếp tục vận hành và mỗi ngày một thông minh hơn.</span>
    </div>`;

  const root = $("#tabInfo");

  // Xem skill
  root.querySelectorAll("[data-skill]").forEach(b =>
    b.addEventListener("click", () => openSkill(b.dataset.skill)));

  // Nút quản lý Global Rule → mở modal Global Rule (như bấm nút CEO trên sơ đồ)
  const goGlobal = root.querySelector("[data-go-global]");
  if (goGlobal) goGlobal.addEventListener("click", openGlobalModal);

  // Pipeline tuyển dụng thật (chỉ hr-1)
  if (a.hrIntake) {
    root.querySelectorAll("[data-hr-open-intake]").forEach(b => b.addEventListener("click", () => openHrIntake(a)));
    loadHrPipeline(a);
  }

  // ---- Panel 3 phương thức: dùng chung cho Knowledge / Workflow / Skill ----
  const panels = {};
  root.querySelectorAll(".add-doc-panel").forEach(p => { panels[p.dataset.panel] = p; });

  function switchMethod(panel, method) {
    panel.querySelectorAll(".method-tab").forEach(t => t.classList.toggle("active", t.dataset.method === method));
    panel.querySelectorAll(".method-body").forEach(b => b.style.display = b.dataset.mbody === method ? "" : "none");
  }
  root.querySelectorAll(".add-doc-panel .method-tab").forEach(t =>
    t.addEventListener("click", () => switchMethod(t.closest(".add-doc-panel"), t.dataset.method)));

  // Mở form/panel thêm mới
  root.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => {
    const key = b.dataset.add;
    const panel = panels[key];
    if (panel) {
      panel.style.display = panel.style.display === "none" ? "" : "none";
      if (panel.style.display !== "none") {
        switchMethod(panel, "text");
        const form = panel.querySelector(".inline-form");
        delete form.dataset.editIndex;
        form.querySelector("input").value = "";
        form.querySelector("input").focus();
      }
      return;
    }
    const form = root.querySelector(`.inline-form[data-form="${key}"]`);
    delete form.dataset.editIndex;
    form.style.display = "flex";
    form.querySelector("input").value = "";
    form.querySelector("input").focus();
  }));

  // Sửa
  root.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
    const [key, idx] = b.dataset.edit.split(":");
    const form = root.querySelector(`.inline-form[data-form="${key}"]`);
    const panel = panels[key];
    if (panel) { panel.style.display = ""; switchMethod(panel, "text"); }
    else form.style.display = "flex";
    form.dataset.editIndex = idx;
    const input = form.querySelector("input");
    input.value = a[key][+idx];
    input.focus();
  }));

  // Xem WORKFLOW.md
  root.querySelectorAll("[data-wf]").forEach(b =>
    b.addEventListener("click", () => openWorkflowView(b.dataset.wf)));

  // ---- Upload: dùng chung cho Knowledge (tài liệu) & Workflow (SOP) ----
  const fmtSize = (bytes) => bytes >= 1048576 ? (bytes / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  const FILE_ICONS = { pdf: "📕", doc: "📘", docx: "📘", xls: "📗", xlsx: "📗", md: "📄" };
  const kebab = (s) => s.trim().toLowerCase().replace(/\.[^.]+$/, "").replace(/[_\s]+/g, "-").replace(/^\/+/, "");

  function validFiles(fileList, allowed) {
    return [...fileList].filter(f => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!allowed.includes(ext)) { toast(`⚠️ "${f.name}" bị từ chối — chỉ hỗ trợ ${allowed.join(", ").toUpperCase()}.`); return false; }
      if (f.size > 20 * 1048576) { toast(`⚠️ "${f.name}" vượt quá 20MB.`); return false; }
      return true;
    });
  }

  function bindUploadZone(panel, onFiles) {
    const zone = panel.querySelector(".upload-zone");
    if (!zone) return;
    const input = zone.querySelector('input[type="file"]');
    input.addEventListener("change", () => { if (input.files.length) onFiles(input.files); });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault(); zone.classList.remove("drag");
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    });
  }

  // Knowledge: nạp tài liệu vào Knowledge Base
  bindUploadZone(panels.knowledge, (fileList) => {
    validFiles(fileList, ["pdf", "doc", "docx", "xls", "xlsx", "md"]).forEach(f => {
      const ext = f.name.split(".").pop().toLowerCase();
      a.knowledge.push(`${FILE_ICONS[ext]} ${f.name} (${fmtSize(f.size)}) · đã nạp & vector hóa vào Knowledge Base`);
      afterKwsrChange(a, "knowledge", "add", f.name);
    });
  });

  // Workflow: Agent đọc SOP và chuẩn hóa thành lệnh /
  bindUploadZone(panels.workflows, (fileList) => {
    const files = validFiles(fileList, ["pdf", "doc", "docx", "md"]);
    if (!files.length) return;
    toast(`🤖 ${a.name} đang đọc SOP và chuẩn hóa thành Workflow…`);
    setTimeout(() => {
      files.forEach(f => {
        const cmd = "/" + kebab(f.name);
        WFLOWS[cmd] = {
          custom: true,
          desc: `Chuẩn hóa tự động từ SOP "${f.name}" (${fmtSize(f.size)}).`,
          trigger: `Kích hoạt thủ công bằng lệnh ${cmd} — có thể yêu cầu bỏ qua hoặc thay đổi bước khi chạy.`,
          standards: ["Giữ đúng trình tự các bước trong SOP gốc", "Dừng lại hỏi khi gặp tình huống ngoài SOP", "Ghi nhận điểm bất cập để đề xuất cải tiến quy trình"],
          md: `---
name: ${cmd}
description: Workflow chuẩn hóa từ SOP "${f.name}".
---

## Nguồn gốc
SOP gốc: ${f.name} (đã lưu vào 03_Van_Hanh/)

## Các bước (Agent trích xuất từ SOP)
1. [Bước 1 trích từ SOP — xem file gốc]
2. [Bước 2 trích từ SOP — xem file gốc]
3. Đối chiếu kết quả với checklist trong SOP
4. Báo cáo kết quả & ghi chú ngoại lệ`,
        };
        a.workflows.push(`${cmd} — chuẩn hóa từ SOP "${f.name}"`);
        afterKwsrChange(a, "workflows", "add", `${cmd} (từ ${f.name})`);
      });
    }, 1100);
  });

  // ---- Trình tạo Workflow theo bước ----
  const wfBuildBtn = panels.workflows && panels.workflows.querySelector("[data-wf-build]");
  if (wfBuildBtn) wfBuildBtn.addEventListener("click", () => {
    const p = panels.workflows;
    const cmdRaw = p.querySelector('[data-bf="cmd"]').value.trim();
    const desc = p.querySelector('[data-bf="desc"]').value.trim();
    const steps = p.querySelector('[data-bf="steps"]').value.split("\n").map(s => s.trim().replace(/^\d+[.)]\s*/, "")).filter(Boolean);
    if (!cmdRaw || !desc || !steps.length) { toast("⚠️ Cần đủ: tên lệnh, mô tả và ít nhất 1 bước."); return; }
    const cmd = "/" + kebab(cmdRaw);
    if (a.workflows.some(w => w.split(" ")[0] === cmd)) { toast(`⚠️ ${a.name} đã có workflow ${cmd}.`); return; }
    WFLOWS[cmd] = {
      custom: true,
      desc,
      trigger: `Kích hoạt thủ công bằng lệnh ${cmd} — bạn giữ quyền kiểm soát, có thể bỏ qua hoặc thay đổi bước khi chạy.`,
      standards: steps.map((s, i) => `Bước ${i + 1} hoàn thành: ${s}`),
      md: `---
name: ${cmd}
description: ${desc}
---

## Các bước tuần tự
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Lưu ý
- Workflow là sườn bài, không phải khuôn đúc (mục 3.2)
- Có thể kết hợp với workflow khác khi cần`,
    };
    a.workflows.push(`${cmd} — ${desc}`);
    afterKwsrChange(a, "workflows", "add", `${cmd} — ${desc}`);
  });

  // ---- Trình đóng gói Skill chuẩn SKILL.md ----
  const skBuildBtn = panels.skills && panels.skills.querySelector("[data-skill-build]");
  if (skBuildBtn) skBuildBtn.addEventListener("click", () => {
    const p = panels.skills;
    const nameRaw = p.querySelector('[data-bf="name"]').value.trim();
    const desc = p.querySelector('[data-bf="desc"]').value.trim();
    const standards = p.querySelector('[data-bf="standards"]').value.split("\n").map(s => s.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
    if (!nameRaw || !desc) { toast("⚠️ Cần đủ: tên skill và mô tả tình huống kích hoạt."); return; }
    const name = kebab(nameRaw);
    if (a.skills.includes(name)) { toast(`⚠️ ${a.name} đã có skill ${name}.`); return; }
    SKILLS[name] = {
      custom: true,
      desc,
      trigger: `Tự động kích hoạt (Progressive Disclosure) khi Agent nhận diện yêu cầu khớp: ${desc}`,
      standards: standards.length ? standards : ["Tuân thủ tiêu chuẩn chất lượng nội bộ", "Kết quả nhất quán dù ai ra lệnh"],
      md: `---
name: ${name}
description: ${desc}
---

## Tiêu chuẩn chất lượng
${(standards.length ? standards : ["Bổ sung tiêu chuẩn chi tiết tại skills/" + name + "/"]).map(s => `- [ ] ${s}`).join("\n")}

## Tài nguyên
- skills/${name}/resources/ (mẫu, checklist, ví dụ chuẩn)`,
    };
    a.skills.push(name);
    afterKwsrChange(a, "skills", "add", name);
  });

  // ---- Nâng cấp Workflow → Skill (mô hình tiến hóa, mục 2.4.4) ----
  const upBtn = panels.skills && panels.skills.querySelector("[data-skill-upgrade]");
  if (upBtn) upBtn.addEventListener("click", () => {
    const sel = panels.skills.querySelector("[data-upgrade-select]");
    const wfItem = sel.value;
    const cmd = wfItem.split(" ")[0];
    const wfDesc = wfItem.includes("—") ? wfItem.split("—").slice(1).join("—").trim() : wfItem;
    const name = kebab(cmd);
    if (a.skills.includes(name)) { toast(`⚠️ Workflow ${cmd} đã được đóng gói thành skill ${name} rồi.`); return; }
    const src = WFLOWS[cmd];
    SKILLS[name] = {
      custom: true,
      desc: `Đóng gói từ workflow ${cmd}: ${wfDesc}`,
      trigger: `Tự động kích hoạt khi Agent nhận diện tác vụ khớp "${wfDesc}" — không cần gọi lệnh ${cmd} thủ công nữa.`,
      standards: src ? src.standards : ["Giữ nguyên trình tự đã chuẩn hóa của workflow gốc", "Đầu ra đồng nhất về định dạng và chất lượng", "Tái sử dụng được cho mọi thành viên trong tổ chức"],
      md: `---
name: ${name}
description: ${wfDesc} (nâng cấp từ workflow ${cmd})
---

## Nguồn gốc tiến hóa
Workflow ${cmd} đã chạy ổn định → đóng gói thành Skill (mục 2.4.4).
Workflow gốc vẫn giữ để kích hoạt thủ công khi cần kiểm soát từng bước.

## Quy trình lõi
${src ? src.md.split("## Các bước")[1] ? "Xem các bước trong " + cmd : "Kế thừa từ " + cmd : "Kế thừa toàn bộ các bước từ " + cmd}

## Tiêu chuẩn chất lượng
- [ ] Kết quả nhất quán dù ai ra lệnh
- [ ] Đúng định dạng đầu ra chuẩn của phòng`,
    };
    a.skills.push(name);
    afterKwsrChange(a, "skills", "add", `${name} (nâng cấp từ ${cmd})`);
    addFeed(`<b>${a.name}</b> tiến hóa: workflow <b>${cmd}</b> được đóng gói thành skill <b>${name}</b> — tự động kích hoạt từ giờ.`, "f-orches");
  });

  // ---- Kết nối MCP đến kho RAG (Knowledge) ----
  const mcpBtn = panels.knowledge.querySelector("[data-mcp-connect]");
  mcpBtn.addEventListener("click", () => {
    const kPanel = panels.knowledge;
    const sel = kPanel.querySelector(".mcp-connect select");
    const name = sel.value;
    const status = kPanel.querySelector(".mcp-connecting");
    const msg = status.querySelector(".mcp-msg");
    mcpBtn.disabled = true;
    status.style.display = "flex";
    msg.textContent = `Đang bắt tay MCP với "${name}"…`;
    setTimeout(() => { msg.textContent = "Xác thực & kiểm tra index vector…"; }, 800);
    setTimeout(() => {
      const docs = 60 + Math.floor(Math.random() * 240);
      a.knowledge.push(`🔌 MCP RAG: ${name} — đã đồng bộ ${docs} tài liệu, tự cập nhật hàng ngày`);
      afterKwsrChange(a, "knowledge", "add", `Kết nối MCP: ${name}`);
      addFeed(`<b>${a.name}</b> kết nối kho RAG qua MCP: <b>${name}</b> (${docs} tài liệu được index).`, "f-orches");
    }, 1700);
  });

  // Xóa
  root.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
    const [key, idx] = b.dataset.del.split(":");
    const old = a[key][+idx];
    if (!confirm(`Xóa khỏi ${a.name}?\n\n"${old}"`)) return;
    a[key].splice(+idx, 1);
    afterKwsrChange(a, key, "del", old);
  }));

  // Lưu (thêm hoặc sửa)
  root.querySelectorAll(".inline-form").forEach(form => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const key = form.dataset.form;
      let val = form.querySelector("input").value.trim();
      if (!val) return;
      if (key === "skills") {
        // "ten-skill — mô tả" → chuẩn hóa tên kebab-case
        const [rawName, ...rest] = val.split(/\s*[—–-]\s+/);
        const name = rawName.trim().toLowerCase().replace(/\s+/g, "-");
        ensureSkillEntry(name, rest.join(" — "));
        val = name;
      }
      const editIdx = form.dataset.editIndex;
      if (editIdx !== undefined) {
        a[key][+editIdx] = val;
        afterKwsrChange(a, key, "edit", val);
      } else {
        a[key].push(val);
        afterKwsrChange(a, key, "add", val);
      }
    });
    form.querySelector("[data-cancel]").addEventListener("click", () => {
      const panel = panels[form.dataset.form];
      if (panel) panel.style.display = "none";
      else form.style.display = "none";
      delete form.dataset.editIndex;
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll(".drawer-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  $("#tabInfo").style.display = tab === "info" ? "" : "none";
  $("#tabChat").style.display = tab === "chat" ? "flex" : "none";
  if (tab === "chat") {
    setTimeout(() => $("#chatInput").focus(), 250);
    if (currentAgent && currentAgent.id === "hr-1") {
      $("#hrChatContext").style.display = "flex";
      $("#hrChatContext").classList.toggle("collapsed", localStorage.getItem("hrChatContextCollapsed") === "1");
      populateHrChatReqSelect().then(() => {
        const sel = $("#hrChatReqSelect");
        if (!sel || !sel.value) return;
        if (sel.value === HR_GENERAL_VALUE) hydrateGeneralChat(currentAgent);
        else kickoffHrChat(currentAgent, sel.value, selectedHrBuoc());
      });
    } else {
      $("#hrChatContext").style.display = "none";
    }
  }
}
document.querySelectorAll(".drawer-tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));

$("#hrChatReqSelect")?.addEventListener("change", (e) => {
  if (!currentAgent || currentAgent.id !== "hr-1" || !e.target.value) return;
  if (e.target.value === HR_GENERAL_VALUE) hydrateGeneralChat(currentAgent);
  else kickoffHrChat(currentAgent, e.target.value, selectedHrBuoc());
});

function closeDrawer() {
  $("#agentDrawer").classList.remove("open");
  $("#drawerBackdrop").classList.remove("open");
}
$("#drawerClose").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);

// ---------- CHAT ----------
// hr-1 có 1 thread riêng cho từng requisition (key "hr-1:<reqId>") thay vì gộp chung — mỗi
// requisition có 1 chat-log.json thật trên server nên không thể dùng chung 1 key cho tất cả.
function hrKey(agentId, reqId) {
  return agentId === "hr-1" && reqId ? `${agentId}:${reqId}` : agentId;
}

function renderChat(a, key = a.id) {
  if (!chatHistory[key]) {
    chatHistory[key] = [{
      from: "agent",
      text: `Chào anh/chị! Em là ${a.name} (${a.model}).\nEm đang phụ trách: "${a.task}".\nAnh/chị cần em hỗ trợ gì ạ?`,
    }];
  }
  const box = $("#chatMessages");
  box.innerHTML = chatHistory[key].map(m =>
    m.from === "user" ? `<div class="msg user">${m.text}</div>`
    : m.from === "tool" ? `<div class="msg tool-log">🛠️ ${m.text}</div>`
    : `<div class="msg agent"><div class="m-from">${a.icon} ${a.name}</div>${m.text}</div>`
  ).join("");
  box.scrollTop = box.scrollHeight;
}

// ---------- HR CHAT (DeepSeek thật cho B2-B10, bỏ qua Hermes) ----------
// "__general__" = chat chung, không gắn với 1 requisition cụ thể — vẫn là DeepSeek thật, chỉ
// không có tool/state của riêng requisition nào (xem hr.chatGeneral ở backend).
const HR_GENERAL_VALUE = "__general__";
const HR_GENERAL_LABEL = "💬 Hỏi chung — không gắn REQ nào";

async function populateHrChatReqSelect() {
  const sel = $("#hrChatReqSelect");
  if (!sel) return;
  const prevValue = sel.value;
  sel.innerHTML = `<option value="">Đang tải…</option>`;
  try {
    const { requisitions } = await hrApi("/api/hr/requisitions");
    const a = AGENTS.find(x => x.id === "hr-1");
    if (a) { a.task = hrTaskSummary(requisitions); refreshAgentCard(a); }
    const generalOption = `<option value="${HR_GENERAL_VALUE}">${HR_GENERAL_LABEL}</option>`;
    if (!requisitions.length) {
      sel.innerHTML = generalOption;
      sel.value = HR_GENERAL_VALUE;
      return;
    }
    sel.innerHTML = generalOption + requisitions
      .map(r => `<option value="${r.requisition_id}" data-buoc="${r.buoc_hien_tai}">${r.requisition_id} — ${r.vi_tri?.ten || "?"} (B${r.buoc_hien_tai} · ${r.buoc_ten})</option>`)
      .join("");
    if (prevValue && (prevValue === HR_GENERAL_VALUE || requisitions.some(r => r.requisition_id === prevValue))) {
      sel.value = prevValue;
    } else {
      sel.value = requisitions[0].requisition_id; // mặc định vẫn chọn requisition gần nhất, giống hành vi cũ
    }
  } catch (e) {
    sel.innerHTML = `<option value="">⚠️ Không tải được — Backend Proxy có đang chạy không?</option>`;
  }
}

function selectedHrBuoc() {
  const sel = $("#hrChatReqSelect");
  const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
  return opt ? opt.dataset.buoc : "";
}

// Tự hỏi câu mở đầu bằng Sonnet thật khi user mở/chuyển sang 1 requisition ở bước hiện tại
// lần đầu trong phiên — tránh việc user phải tự đoán nên gõ gì để bắt đầu bước.
//
// Hội thoại với từng requisition được lưu thật trên server (hr/data/ho-so/<reqId>/chat-log.json —
// xem fetchHrSonnetReply/hrApi bên dưới), sống sót qua restart server hoặc F5 trang. Trước khi hỏi
// lại từ đầu, hàm này luôn thử khôi phục lịch sử đã lưu trước — nếu có, hiển thị lại nguyên hội
// thoại cũ thay vì bắt user làm lại từ đầu bước.
const hrKickoffDone = new Set();
async function kickoffHrChat(a, reqId, buoc) {
  if (!reqId) return;
  const key = hrKey(a.id, reqId);
  const isOpen = () => currentAgent && currentAgent.id === a.id;

  if (!chatHistory[key]) {
    let persisted = [];
    try {
      const { log } = await hrApi(`/api/hr/requisitions/${encodeURIComponent(reqId)}/chat`);
      persisted = Array.isArray(log) ? log : [];
    } catch (e) {
      // Không tải được (server chưa chạy…) — im lặng, để rơi xuống nhánh hỏi kickoff bên dưới.
    }
    if (persisted.length) {
      chatHistory[key] = persisted.map(h => ({ from: h.role === "agent" ? "agent" : "user", text: h.text }));
      hrKickoffDone.add(`${reqId}:B${buoc}`);
      if (isOpen()) renderChat(a, key);
      return; // đã khôi phục hội thoại cũ thật — không hỏi lại từ đầu
    }
  }

  const doneKey = `${reqId}:B${buoc}`;
  if (hrKickoffDone.has(doneKey)) {
    if (isOpen()) renderChat(a, key);
    return;
  }
  hrKickoffDone.add(doneKey);
  if (!chatHistory[key]) renderChatSeed(a, key);
  let typing;
  if (isOpen()) {
    renderChat(a, key);
    const box = $("#chatMessages");
    typing = el(`<div class="msg agent typing">${a.name} đang xem hồ sơ…</div>`);
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
  }
  const kickoffPrompt = "[Hệ thống — không phải tin nhắn của user, đừng nhắc lại câu này trong câu trả lời] " +
    "Bạn vừa mở requisition này ở bước hiện tại. Đọc kỹ SKILL.md của bước hiện tại và trạng thái requisition " +
    "thật, rồi chủ động hỏi user câu hỏi đầu tiên cần thiết theo đúng thứ tự SKILL.md để có thể bắt đầu bước " +
    "này (ví dụ: có JD cũ không, hoặc thông tin nào đang thiếu trong requisition). Đừng gọi tool nào ở lượt " +
    "này, chỉ hỏi.";
  const replyText = await fetchHrSonnetReply(a, reqId, kickoffPrompt, { silent: true });
  if (typing) typing.remove();
  chatHistory[key].push({ from: "agent", text: replyText });
  if (isOpen()) renderChat(a, key);
}

// Chat chung của hr-1 (HR_GENERAL_VALUE) — cũng gọi DeepSeek thật (hr.chatGeneral ở backend),
// nhưng không gắn tool/state của riêng requisition nào. Khôi phục lịch sử đã lưu (nếu có) khi mở,
// giống hệt cơ chế kickoffHrChat làm cho từng requisition.
const hrGeneralHydrated = new Set();
async function hydrateGeneralChat(a) {
  const key = hrKey(a.id, HR_GENERAL_VALUE);
  if (hrGeneralHydrated.has(a.id) || chatHistory[key]) {
    if (currentAgent && currentAgent.id === a.id) renderChat(a, key);
    return;
  }
  hrGeneralHydrated.add(a.id);
  try {
    const { log } = await hrApi("/api/hr/chat");
    if (Array.isArray(log) && log.length) {
      chatHistory[key] = log.map(h => ({ from: h.role === "agent" ? "agent" : "user", text: h.text }));
    }
  } catch (e) {
    // im lặng — chưa tải được, sẽ dùng lời chào mặc định khi renderChat seed
  }
  if (currentAgent && currentAgent.id === a.id) renderChat(a, key);
}

async function fetchHrGeneralReply(a, text, opts = {}) {
  const key = hrKey(a.id, HR_GENERAL_VALUE);
  try {
    const data = await hrApi("/api/hr/chat", {
      method: "POST",
      body: JSON.stringify({ message: text, silent: !!opts.silent, rules: a.rules || [], globalRules: GLOBAL_RULES || [] }),
    });
    return data.reply;
  } catch (e) {
    return `⚠️ Không gọi được mô hình (DeepSeek V4 Flash): ${e.message}\n\nKiểm tra OPENROUTER_API_KEY trong server/.env và Backend Proxy (project/aios/server) có đang chạy trên ${HERMES_PROXY_BASE} không.`;
  }
}

async function fetchHrSonnetReply(a, reqId, text, opts = {}) {
  const key = hrKey(a.id, reqId);
  try {
    const data = await hrApi(`/api/hr/requisitions/${encodeURIComponent(reqId)}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: text, silent: !!opts.silent, rules: a.rules || [], globalRules: GLOBAL_RULES || [] }),
    });
    if (data.toolLog && data.toolLog.length) {
      const lines = data.toolLog.map(t => {
        if (t.error) return `❌ ${t.tool}: ${t.error}`;
        if (t.tool === "open_interview_form") return `📝 Đang mở form đánh giá phỏng vấn…`;
        if (t.tool === "generate_offer_letter") {
          const missing = t.result?.missingTemplateFields?.length ? `\n   ⚠️ Mẫu còn thiếu placeholder cho: ${t.result.missingTemplateFields.join(", ")} — kiểm tra lại trước khi gửi` : "";
          const dl = t.result?.path
            ? `\n   <a href="${hrFileDownloadUrl(t.result.path)}" download class="btn btn-primary btn-sm" style="display:inline-block;margin-top:.3rem">⬇️ Tải Offer Letter (v${t.result.version}) để xem trước & gửi mail</a>`
            : "";
          return `✅ Đã tạo Offer Letter — ${t.result?.path}${missing}${dl}`;
        }
        const base = `✅ ${t.tool}(${t.input?.hanh_dong_nhat_ky || t.input?.relative_path || t.input?.ma_uv || ""})`;
        const sync = t.result?.sheetSync;
        if (!sync) return base;
        return base + (sync.ok ? `\n   📊 Excel (Tuyen-dung-2026-Pipeline.xlsx): đã ${sync.action === "updated" ? "cập nhật" : "thêm"} dòng ${t.input?.ma_uv || ""}` : `\n   ⚠️ Excel: chưa đồng bộ được — ${sync.error}`);
      }).join("\n");
      chatHistory[key].push({ from: "tool", text: lines });

      const openFormCall = data.toolLog.find(t => t.tool === "open_interview_form" && !t.error);
      if (openFormCall && currentAgent && currentAgent.id === a.id) {
        openHrInterviewForm(reqId, openFormCall.input?.ma_uv || "", openFormCall.input?.ten || "");
      }
    }
    if (data.requisition) {
      a.task = `${data.requisition.requisition_id} — ${data.requisition.vi_tri.ten}: bước B${data.requisition.buoc_hien_tai} ${BUOC_TEN_MAP[data.requisition.buoc_hien_tai] || ""}`;
      refreshAgentCard(a);
      loadHrPipeline(a);
      refreshOrgChart();
      populateHrChatReqSelect();
    }
    return data.reply;
  } catch (e) {
    return `⚠️ Không gọi được mô hình (DeepSeek V4 Flash): ${e.message}\n\nKiểm tra OPENROUTER_API_KEY trong server/.env và Backend Proxy (project/aios/server) có đang chạy trên ${HERMES_PROXY_BASE} không.`;
  }
}

function agentReply(a, userText) {
  const t = userText.toLowerCase();
  if (/(model|mô hình|bộ não)/.test(t))
    return `Em đang chạy trên ${a.model}, chế độ ${a.mode}. Lý do đội tư vấn chọn model này: ${a.modelWhy}`;
  if (/(skill|kỹ năng|năng lực)/.test(t))
    return `Em hiện có ${a.skills.length} skill đã đóng gói: ${a.skills.join(", ")}. Anh/chị bấm vào chip 🧩 trên thẻ của em để xem cấu trúc SKILL.md chi tiết nhé.`;
  if (/(task|việc|đang làm|tiến độ)/.test(t))
    return `Tiến độ hiện tại: "${a.task}" — trạng thái ${statusLabel[a.status]}. Em sẽ báo lại vào Nhật ký hoạt động ngay khi xong ạ.`;
  if (/(workflow|quy trình)/.test(t))
    return `Các workflow em được thiết lập:\n${a.workflows.map(w => "• " + w).join("\n")}\nAnh/chị gọi lệnh / tương ứng để kích hoạt thủ công nhé.`;
  if (/(rule|an toàn|bảo mật)/.test(t))
    return `Em tuân thủ ${GLOBAL_RULES.length} Global Rule của toàn công ty (hiến pháp chung), cộng thêm Workspace Rule riêng của em:\n${a.rules.map(r => "• " + r).join("\n")}\nKhi xung đột, Workspace Rule được ưu tiên. Dù ai ra lệnh, vi phạm Rule là em từ chối ạ.`;
  const skillNote = a.skills.length ? `Em sẽ áp dụng skill ${a.skills[0]} để đảm bảo chuẩn chất lượng, và tuân thủ` : `Em sẽ tuân thủ`;
  return `Em đã ghi nhận yêu cầu: "${userText}".\n${skillNote} ${a.rules.length} rule an toàn của phòng. Kết quả sẽ được cập nhật vào Nhật ký hoạt động ạ.`;
}

// Gọi Hermes Agent thật qua Backend Proxy — trả về null nếu lỗi (khi đó fallback về agentReply mô phỏng)
async function fetchHermesReply(a, text) {
  try {
    const res = await fetch(`${HERMES_PROXY_BASE}/api/agents/${a.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: chatHistory[a.id].slice(-10).map(m => ({ role: m.from, text: m.text })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Proxy trả lỗi ${res.status}`);
    }
    const data = await res.json();
    return data.mock ? `${data.reply}` : data.reply;
  } catch (e) {
    return null;
  }
}

// Ghi tài liệu Knowledge lên Hermes/Mem0 qua Proxy — chạy nền, không chặn UI (fire-and-forget có cảnh báo)
async function syncKnowledgeToHermes(a, text) {
  if (!USE_REAL_HERMES) return;
  try {
    const res = await fetch(`${HERMES_PROXY_BASE}/api/agents/${a.id}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("Proxy lỗi " + res.status);
    const data = await res.json();
    if (data.mock) toast(`ℹ️ ${data.note}`);
  } catch (e) {
    toast(`⚠️ Không đồng bộ được lên Hermes/Mem0 (${a.name}) — Backend Proxy có đang chạy không? Dữ liệu vẫn được lưu trong AI OS.`);
  }
}

$("#chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chatInput");
  const text = input.value.trim();
  if (!text || !currentAgent) return;
  const a = currentAgent;

  const hrReqSelect = $("#hrChatReqSelect");
  const hrReqId = a.id === "hr-1" && hrReqSelect ? hrReqSelect.value : "";
  const key = hrKey(a.id, hrReqId);

  if (!chatHistory[key]) renderChatSeed(a, key);
  chatHistory[key].push({ from: "user", text });
  input.value = "";
  input.style.height = "auto";
  renderChat(a, key);

  const box = $("#chatMessages");
  const typing = el(`<div class="msg agent typing">${a.name} đang soạn…</div>`);
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;

  let replyPromise;
  if (hrReqId === HR_GENERAL_VALUE) {
    // Chat chung của hr-1 — DeepSeek thật, không gắn tool/state của requisition nào
    replyPromise = fetchHrGeneralReply(a, text);
  } else if (hrReqId) {
    // B2-B10 thật qua DeepSeek V4 Flash (OpenRouter) tại local — bỏ qua Hermes hoàn toàn cho hr-1
    replyPromise = fetchHrSonnetReply(a, hrReqId, text);
  } else if (USE_REAL_HERMES) {
    replyPromise = fetchHermesReply(a, text).then(r => r !== null ? r : agentReply(a, text));
  } else {
    replyPromise = Promise.resolve(agentReply(a, text)).then(r => new Promise(res => setTimeout(() => res(r), 900 + Math.random() * 700)));
  }

  replyPromise.then((replyText) => {
    typing.remove();
    chatHistory[key].push({ from: "agent", text: replyText });
    renderChat(a, key);
    addFeed(`<b>${a.name}</b> phản hồi tin nhắn của bạn trong khung chat.`, "");
  });
});

// Enter gửi tin nhắn, Shift+Enter xuống hàng (mặc định textarea) — và tự giãn chiều cao theo nội dung.
$("#chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#chatForm").requestSubmit();
  }
});
$("#chatInput").addEventListener("input", (e) => {
  e.target.style.height = "auto";
  e.target.style.height = `${e.target.scrollHeight}px`;
});

// ---------- ORCHESTRATOR ROUTING ----------
// Nhận diện lệnh mở đợt tuyển dụng — vd "Note vị trí tuyển dụng: Kế toán nội bộ, số lượng: 2"
// Kích hoạt skill /tuyen-dung → /nhu-cau-tuyen-dung (B1) thật cho hr-1, đúng README.md.
function parseRecruitmentIntent(cmd) {
  const t = cmd.toLowerCase();
  if (!(t.includes("vị trí") && t.includes("số lượng"))) return null;
  const viTriMatch = cmd.match(/vị trí(?:\s*tuyển\s*dụng)?\s*[:là]*\s*([^,\n]+?)(?=,|\s+số lượng|$)/i);
  const soLuongMatch = cmd.match(/số lượng\s*[:là]*\s*(\d+)/i);
  return {
    ten: viTriMatch ? viTriMatch[1].trim().replace(/^là\s+/i, "") : "",
    so_luong: soLuongMatch ? soLuongMatch[1] : "",
  };
}

function routeCommand(cmd) {
  const t = cmd.toLowerCase();
  let best = null, bestScore = 0;
  AGENTS.forEach(a => {
    const score = a.keywords.reduce((s, k) => s + (t.includes(k) ? k.length : 0), 0);
    if (score > bestScore) { bestScore = score; best = a; }
  });
  return { agent: best, matched: bestScore > 0 };
}

function runOrches(cmd) {
  const flow = $("#routingFlow");
  const steps = ["rs1", "rs2", "rs3", "rs4"].map(id => $("#" + id));
  steps.forEach(s => s.classList.remove("on"));
  flow.classList.add("show");

  const { agent, matched } = routeCommand(cmd);

  $("#rs1txt").textContent = `"${cmd.length > 60 ? cmd.slice(0, 60) + "…" : cmd}"`;
  addFeed(`<b>Orches Agent</b> nhận lệnh mới: "${cmd}"`, "f-orches");

  setTimeout(() => steps[0].classList.add("on"), 100);

  setTimeout(() => {
    steps[1].classList.add("on");
    if (matched) {
      const dept = DEPARTMENTS.find(d => d.id === agent.dept);
      $("#rs2txt").textContent = `Nghiệp vụ thuộc ${dept.name}`;
    } else {
      $("#rs2txt").textContent = "Chưa nhận diện được nghiệp vụ — cần làm rõ";
    }
  }, 700);

  setTimeout(() => {
    steps[2].classList.add("on");
    if (matched) {
      $("#rs3txt").textContent = `→ ${agent.name} (${agent.model})`;
      addFeed(`<b>Orches</b> phân tích ý định → giao cho <b>${agent.name}</b>${agent.skills.length ? ` · kích hoạt skill <b>${agent.skills[0]}</b>` : ""}.`, "f-orches");
    } else {
      $("#rs3txt").textContent = "Orches hỏi lại để làm rõ yêu cầu";
      addFeed(`<b>Orches</b> chưa xác định được Agent phụ trách — đã gửi câu hỏi làm rõ vào khung chat.`, "f-rule");
    }
  }, 1500);

  setTimeout(() => {
    steps[3].classList.add("on");
    if (matched) {
      $("#rs4txt").textContent = `${agent.name} bắt đầu thực thi · trạng thái cập nhật trên thẻ`;
      // update agent card state
      agent.status = "working";
      agent.task = cmd;
      const card = $("#card-" + agent.id);
      if (card) {
        card.querySelector(".t-text").textContent = cmd;
        const dotEl = card.querySelector(".status-dot");
        dotEl.className = "status-dot working";
        const st = card.querySelector(".t-status");
        st.className = "t-status working";
        st.innerHTML = "● Đang thực thi";
        card.classList.add("flash");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => card.classList.remove("flash"), 3500);
      }
      refreshOrgChart();
      renderStats();
      // push a briefing message into agent chat
      if (!chatHistory[agent.id]) renderChatSeed(agent);
      chatHistory[agent.id] = chatHistory[agent.id] || [];

      const recruit = agent.id === "hr-1" ? parseRecruitmentIntent(cmd) : null;
      if (recruit) {
        chatHistory[agent.id].push({
          from: "agent",
          text: `📥 Em vừa nhận tác vụ từ Orches Agent:\n"${cmd}"\n🧩 Kích hoạt skill /tuyen-dung → gọi /nhu-cau-tuyen-dung (B1) — mở sẵn form xác định nhu cầu để anh/chị điền nốt các mục còn thiếu ạ.`,
        });
        addFeed(`<b>${agent.name}</b> kích hoạt skill <b>tuyen-dung</b> (B1 — nhu-cau-tuyen-dung) từ lệnh Orches.`, "f-done");
        toast(`✅ Orches giao HR Agent — đã mở form xác định nhu cầu tuyển dụng, điền nốt và bấm "Tạo requisition".`);
        prefillHrIntake(recruit);
      } else {
        chatHistory[agent.id].push({
          from: "agent",
          text: `📥 Em vừa nhận tác vụ từ Orches Agent:\n"${cmd}"\n${agent.workflows.length ? `Em sẽ chạy theo workflow ${agent.workflows[0].split(" — ")[0]}` : "Em sẽ xử lý theo kinh nghiệm tích lũy"}${agent.skills.length ? ` và áp chuẩn skill ${agent.skills[0]}` : ""}. Có gì cần lưu ý thêm anh/chị nhắn em nhé!`,
        });
        toast(`✅ Orches đã giao việc cho ${agent.name} — mở chat để trao đổi trực tiếp.`);
        addFeed(`<b>${agent.name}</b> bắt đầu thực thi task mới. Trạng thái: Đang thực thi.`, "f-done");
      }
    } else {
      $("#rs4txt").textContent = "Chờ bạn bổ sung thông tin";
      toast(`🤔 Orches cần thêm ngữ cảnh: hãy nêu rõ nghiệp vụ (khách hàng, hợp đồng, CV, công nợ, nội dung…)`);
    }
  }, 2400);
}

function renderChatSeed(a, key = a.id) {
  chatHistory[key] = [{
    from: "agent",
    text: `Chào anh/chị! Em là ${a.name} (${a.model}).\nEm đang phụ trách: "${a.task}".\nAnh/chị cần em hỗ trợ gì ạ?`,
  }];
}

$("#orchesForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#orchesInput");
  const cmd = input.value.trim();
  if (!cmd) return;
  input.value = "";
  runOrches(cmd);
});

$("#orchesHints").addEventListener("click", (e) => {
  const chip = e.target.closest(".hint-chip");
  if (!chip) return;
  $("#orchesInput").value = chip.textContent;
  runOrches(chip.textContent);
});

// ---------- AMBIENT FEED (mô phỏng hoạt động nền) ----------
const AMBIENT = [
  ["<b>Support Agent</b> trả lời 3 câu hỏi FAQ mới về chính sách bảo hành.", "f-done"],
  ["<b>Finance Agent</b> gắn cờ 🚩 1 hóa đơn trùng số — bàn giao <b>Audit Agent</b> soát xét.", ""],
  ["<b>Rule</b> chặn 1 yêu cầu gửi file bảng giá gốc ra email ngoài domain.", "f-rule"],
  ["<b>Content Agent</b> hoàn thành bản nháp landing page — chờ bạn duyệt.", "f-done"],
  ["<b>Orches Agent</b> tổng hợp báo cáo hoạt động đội Agent cuối ngày.", "f-orches"],
  ["<b>HR Agent</b> cập nhật 5 CV mới vào pipeline tuyển dụng kế toán.", ""],
  ["<b>Legal Agent</b> phát hiện điều khoản phạt 8%/ngày bất lợi — xếp hạng rủi ro CAO.", "f-rule"],
  ["<b>Social Agent</b> tạo 6 biến thể caption cho chiến dịch tháng 7.", "f-done"],
];
let ambIdx = 0;
function ambientTick() {
  const [msg, cls] = AMBIENT[ambIdx % AMBIENT.length];
  addFeed(msg, cls);
  ambIdx++;
}

// ---------- NAV / INIT ----------
$("#navToggle").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
$("#navOverview").addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeDrawer(); $("#skillModal").classList.remove("open"); closeGlobalModal(); closeHrIntake(); closeHrInterviewForm(); }
});
$("#globalModal").addEventListener("click", (e) => { if (e.target.id === "globalModal") closeGlobalModal(); });

loadState();
renderSidebar();
renderStats();
renderGlobalRules();
renderDepartments();
bindOrgOrches();
addFeed("<b>AI OS</b> khởi động — đội 9 Agent + Orches sẵn sàng nhận lệnh.", "f-orches");
ambientTick();
setInterval(ambientTick, 9000);
