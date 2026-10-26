// ใช้ได้ทั้ง Chrome / Edge / Brave / Opera (chrome.*) และ Firefox (browser.*)
const api = globalThis.browser ?? globalThis.chrome;
const msg = document.getElementById("msg");
function showError(text) { msg.textContent = text; msg.className = "err"; }

// ฟังก์ชันนี้ถูกฉีดเข้าไปรันในหน้าเว็บของผู้ใช้ (ห้ามอ้างตัวแปรภายนอกฟังก์ชัน)
function extractPage(maxChars) {
  const sel = String(window.getSelection() || "").trim();
  let text = sel;
  if (!text) {
    const candidates = [document.querySelector("article"), document.querySelector("main"), document.body];
    for (const el of candidates) {
      if (el && el.innerText && el.innerText.length > 500) { text = el.innerText; break; }
    }
    if (!text) text = document.body ? document.body.innerText : "";
  }
  text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    url: location.href,
    title: document.title || "",
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    fromSelection: Boolean(sel),
  };
}

(async () => {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:\/\//i.test(tab.url || "")) {
      showError("หน้านี้แปลไม่ได้ (รองรับเฉพาะหน้าเว็บ http/https)");
      return;
    }
    const results = await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPage,
      args: [CONFIG.MAX_CHARS],
    });
    const info = results && results[0] && results[0].result;
    if (!info || !info.text) {
      showError("ไม่พบข้อความในหน้านี้ที่จะแปลได้");
      return;
    }
    // เก็บเนื้อหาไว้ในเครื่อง แล้วเปิดหน้าผลลัพธ์ของส่วนขยายเอง (ไม่ต้องแก้เว็บหลัก)
    await api.storage.local.set({ last: info });
    await api.tabs.create({ url: api.runtime.getURL("result.html") });
    window.close();
  } catch (e) {
    showError("อ่านหน้านี้ไม่ได้: " + e.message);
  }
})();
