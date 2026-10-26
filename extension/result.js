const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

(async function main() {
  const status = $("status");
  const { last } = await api.storage.local.get("last");
  if (!last || !last.text) { $("title").textContent = "ไม่มีเนื้อหาให้แปล"; return; }

  // ---------- หัวข้อ / ลิงก์ต้นฉบับ (ใช้ textContent เท่านั้น) ----------
  $("title").textContent = (last.title || "แปลหน้าเว็บ") + (last.fromSelection ? " (ข้อความที่เลือก)" : "");
  if (/^https?:\/\//i.test(last.url || "")) { $("src").href = last.url; $("src").hidden = false; }

  const direction = detectDirection(last.text);
  const apiUrl = direction === "th-en" ? CONFIG.API_URL_TH_EN : CONFIG.API_URL_EN_TH;
  const dirLabel = direction === "th-en" ? "ไทย → อังกฤษ" : "อังกฤษ → ไทย";
  const maxLen = direction === "th-en" ? 120 : 280;

  // ---------- แบ่งท่อน ----------
  const paragraphs = last.text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [], owner = []; // owner[i] = ย่อหน้าที่ท่อน i อยู่
  const blocks = paragraphs.map(() => ({ parts: [], total: 0 }));
  paragraphs.forEach((p, pi) => {
    splitParagraph(p, maxLen).forEach((c) => {
      if (chunks.length < CONFIG.MAX_CHUNKS) { chunks.push(c); owner.push(pi); blocks[pi].total++; }
    });
  });
  const capped = paragraphs.reduce((n, p) => n + splitParagraph(p, maxLen).length, 0) > chunks.length;

  // ---------- วาด UI ----------
  const body = $("body");
  const trEls = blocks.map((b, pi) => {
    if (!b.total) return null;
    const div = document.createElement("div");
    div.className = "block";
    const orig = document.createElement("div");
    orig.className = "orig";
    orig.textContent = chunks.filter((_, i) => owner[i] === pi).join(" ");
    const tr = document.createElement("div");
    tr.className = "tr";
    div.append(orig, tr);
    body.appendChild(div);
    return tr;
  });

  $("copy").onclick = async () => {
    const text = trEls.filter(Boolean).map((el) => el.textContent).join("\n\n");
    try { await navigator.clipboard.writeText(text); $("copy").textContent = "คัดลอกแล้ว"; }
    catch { $("copy").textContent = "คัดลอกไม่ได้"; }
    setTimeout(() => ($("copy").textContent = "คัดลอกคำแปลทั้งหมด"), 1500);
  };
  $("clear").onclick = async () => {
    const n = await clearCache(api.storage.local);
    $("clear").textContent = `ล้างแล้ว ${n} รายการ`;
    setTimeout(() => ($("clear").textContent = "ล้างแคชคำแปลในเครื่อง"), 2000);
  };

  // ---------- แปล ----------
  await pruneCache(api.storage.local, CONFIG.CACHE_MAX_ENTRIES);
  let done = 0;
  status.textContent = `${dirLabel} | กำลังแปล 0/${chunks.length} (ครั้งแรกอาจช้าถ้าเซิร์ฟเวอร์เพิ่งตื่น)`;
  try {
    const r = await translateAll(chunks, {
      direction, apiUrl, storage: api.storage.local, fetchFn: fetch.bind(globalThis),
      timeoutMs: CONFIG.REQUEST_TIMEOUT_MS,
      onResult: (i, t) => {
        blocks[owner[i]].parts.push(t === null ? "[แปลไม่สำเร็จ]" : t);
        trEls[owner[i]].textContent = blocks[owner[i]].parts.join(" ");
        status.textContent = `${dirLabel} | กำลังแปล ${++done}/${chunks.length}`;
      },
    });
    const notes = [];
    if (r.fromCache) notes.push(`จากแคชในเครื่อง ${r.fromCache} ท่อน`);
    if (r.failed) notes.push(`แปลไม่สำเร็จ ${r.failed} ท่อน`);
    if (last.truncated) notes.push("ตัดเนื้อหาส่วนท้ายเพราะยาวเกินไป");
    if (capped) notes.push(`แปลเฉพาะ ${CONFIG.MAX_CHUNKS} ท่อนแรก`);
    status.textContent = `${dirLabel} | แปลเสร็จแล้ว` + (notes.length ? " (" + notes.join(", ") + ")" : "");
  } catch (e) {
    status.textContent = `${dirLabel} | ${e.message} ลองใหม่อีกครั้งภายหลัง (ที่แปลไปแล้วถูกเก็บไว้ในเครื่อง)`;
  }
})();
