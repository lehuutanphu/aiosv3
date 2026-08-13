// Công tắc sáng/tối — dùng chung cho index.html, dashboard.html, knowledge.html.
// QUAN TRỌNG: file này được nạp bằng <script> THƯỜNG (không defer/async) và đặt sớm trong <head>,
// TRƯỚC khi trang vẽ (paint) — để set data-theme trên <html> ngay lập tức, tránh hiện tượng
// "chớp tone" (FOUC): nếu chờ tới DOMContentLoaded mới đổi theme thì trình duyệt đã kịp vẽ 1 khung
// hình theo tone mặc định (tối) rồi mới nhảy sang tone đã lưu, gây giật hình khi tải trang.
(function () {
  var KEY = "aios-theme";
  var saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (e) {
    // Safari riêng tư / cookie bị chặn — bỏ qua, chỉ theo mặc định hệ thống cho phiên này
  }
  var prefersLight =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  var theme = saved === "light" || saved === "dark" ? saved : prefersLight ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", theme);

  function setTheme(next) {
    theme = next;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(next === "light"));
    });
  }
  window.__aiosSetTheme = setTheme;

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(theme === "light"));
      btn.addEventListener("click", function () {
        setTheme(theme === "light" ? "dark" : "light");
      });
    });
  });
})();
