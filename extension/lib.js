// ฟังก์ชันที่ไม่ผูกกับหน้าเว็บ: ตรวจทิศทาง, แบ่งท่อน, แคชในเครื่อง, เรียก API

function detectDirection(s) {
  const thai = (s.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return thai > 0 && thai / (thai + latin) >= 0.3 ? "th-en" : "en-th";
}

// โมเดลรับไม่เกิน ~128 token ต่อครั้ง จึงแบ่งเป็นท่อนสั้นๆ
function splitLong(piece, maxLen) {
  const out = [];
  let rest = piece.trim();
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(" ", maxLen);
    if (cut < maxLen * 0.4) cut = maxLen; // ไม่มีช่องว่างให้ตัด (เช่นไทยติดกัน) ตัดตรงๆ
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
function splitParagraph(par, maxLen) {
  const sentences = par.match(/[^.!?。！？…]+[.!?。！？…]*\s*/g) || [par];
  return sentences.flatMap((s) => splitLong(s, maxLen)).filter((s) => s.trim());
}

// แฮชสั้นๆ (cyrb53) ไว้ทำคีย์แคช
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function cacheKey(direction, text) { return "tr:" + direction + ":" + hash(text); }

// ลบคำแปลเก่าสุดเมื่อแคชเกินจำนวนที่กำหนด (storage = chrome.storage.local / browser.storage.local)
async function pruneCache(storage, maxEntries) {
  const all = await storage.get(null);
  const entries = Object.entries(all).filter(([k]) => k.startsWith("tr:"));
  if (entries.length <= maxEntries) return 0;
  entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  const removeCount = entries.length - Math.floor(maxEntries * 0.8);
  await storage.remove(entries.slice(0, removeCount).map(([k]) => k));
  return removeCount;
}

async function clearCache(storage) {
  const all = await storage.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("tr:"));
  if (keys.length) await storage.remove(keys);
  return keys.length;
}

// เรียก API แปลหนึ่งท่อน (POST {text, direction}) ลองซ้ำ 1 ครั้งถ้าพลาด
async function translateChunk(apiUrl, text, direction, fetchFn, timeoutMs) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetchFn(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, direction }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return data.translated_text || "";
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}

// แปลทุกท่อน: ใช้แคชในเครื่องก่อน ที่ไม่มีค่อยยิง API (ทีละท่อน ไม่ยิงพร้อมกัน)
async function translateAll(chunks, opts) {
  const { direction, apiUrl, storage, fetchFn, onResult, timeoutMs = 90000 } = opts;
  const keys = chunks.map((c) => cacheKey(direction, c));
  const cached = await storage.get(keys);
  let failStreak = 0, fromCache = 0, failed = 0;
  for (let i = 0; i < chunks.length; i++) {
    const hit = cached[keys[i]];
    if (hit && hit.s === chunks[i]) { fromCache++; onResult(i, hit.t, true); continue; }
    let t;
    try {
      t = await translateChunk(apiUrl, chunks[i], direction, fetchFn, timeoutMs);
      failStreak = 0;
    } catch (e) {
      failed++;
      onResult(i, null, false, e);
      if (++failStreak >= 3) throw new Error("เชื่อมต่อ API แปลไม่ได้");
      continue;
    }
    await storage.set({ [keys[i]]: { s: chunks[i], t, ts: Date.now() } });
    onResult(i, t, false);
  }
  return { fromCache, failed };
}

if (typeof module !== "undefined") {
  module.exports = { detectDirection, splitLong, splitParagraph, hash, cacheKey, pruneCache, clearCache, translateChunk, translateAll };
}
