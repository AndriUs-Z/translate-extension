// ตั้งค่าส่วนขยาย (แก้เฉพาะไฟล์นี้)
const CONFIG = {
  // URL ของ API แปลของแต่ละทิศทาง (ลงท้าย /translate) ถ้าใช้ API เดียวที่รองรับสองทิศทาง ใส่ URL เดียวกันทั้งคู่
  API_URL_TH_EN: "https://YOUR-TH-EN-API.onrender.com/translate",
  API_URL_EN_TH: "https://YOUR-EN-TH-API.onrender.com/translate",

  MAX_CHARS: 8000,            // อ่านข้อความจากหน้าเว็บสูงสุดกี่ตัวอักษรต่อครั้ง
  MAX_CHUNKS: 120,            // แปลสูงสุดกี่ท่อนต่อครั้ง (โมเดลแปลทีละประโยค หน้ายาวจะช้า)
  CACHE_MAX_ENTRIES: 3000,    // เก็บคำแปลในเครื่องสูงสุดกี่ท่อน (เกินแล้วลบอันเก่าสุดก่อน)
  REQUEST_TIMEOUT_MS: 90000   // รอ API ต่อท่อนสูงสุดกี่มิลลิวินาที (ครั้งแรกอาจช้าเพราะเซิร์ฟเวอร์ Render เพิ่งตื่น)
};
if (typeof module !== "undefined") module.exports = CONFIG;
