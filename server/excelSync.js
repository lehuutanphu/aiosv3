// Ghi thật vào file Excel local hr/templates/Tuyen-dung-2026-Pipeline.xlsx (sheet "Pipeline")
// mỗi khi 1 ứng viên được chấm/cập nhật — thay cho Google Sheets (đã bỏ theo yêu cầu).
// .xlsx là ZIP+XML, không an toàn để tự viết tay bằng fs/zlib thuần — dùng exceljs (đã được
// đồng ý thêm làm dependency riêng cho tác vụ này) để giữ nguyên định dạng/data validation
// đã thiết lập sẵn trong file, chỉ sửa đúng ô cần sửa.

const path = require("path");
const ExcelJS = require("exceljs");

const XLSX_PATH = path.join(__dirname, "..", "hr", "templates", "Tuyen-dung-2026-Pipeline.xlsx");
const SHEET_NAME = "Pipeline";

let queue = Promise.resolve(); // serialize ghi — tránh 2 lượt chat cùng lúc đọc/ghi đè nhau lên cùng 1 file

function withQueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// values: mảng 31 phần tử theo ĐÚNG thứ tự cột A..AE trong hr/templates/pipeline-sheet-schema.md.
// values[0] = Ma_UV, values[1] = REQ_ID — khóa ghép 2 cột này để tránh đè nhầm UV-01 của REQ khác
// (Ma_UV chỉ duy nhất TRONG PHẠM VI 1 requisition, không duy nhất toàn bộ sheet).
async function upsertRow(values) {
  return withQueue(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(XLSX_PATH);
    const sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) throw new Error(`Không tìm thấy sheet "${SHEET_NAME}" trong ${XLSX_PATH}`);

    const maUv = String(values[0] ?? "");
    const reqId = String(values[1] ?? "");
    let targetRowNumber = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || targetRowNumber) return; // bỏ header, dừng khi đã tìm thấy
      const a = String(row.getCell(1).value ?? "");
      const b = String(row.getCell(2).value ?? "");
      if (a === maUv && b === reqId) targetRowNumber = rowNumber;
    });

    let action;
    if (targetRowNumber) {
      const row = sheet.getRow(targetRowNumber);
      values.forEach((v, i) => {
        row.getCell(i + 1).value = v === "" ? null : v;
      });
      row.commit();
      action = "updated";
    } else {
      const row = sheet.addRow(values.map((v) => (v === "" ? null : v)));
      row.commit();
      action = "appended";
    }
    await workbook.xlsx.writeFile(XLSX_PATH);
    return { action, row: targetRowNumber || sheet.rowCount };
  });
}

module.exports = { upsertRow, XLSX_PATH };
