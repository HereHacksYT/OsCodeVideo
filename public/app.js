/* ==================== SEKMELER ==================== */
const tabs      = document.querySelectorAll(".tab");
const pageVideo = document.getElementById("pageVideo");
const pageConv  = document.getElementById("pageConverter");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    pageVideo.hidden = target !== "video";
    pageConv.hidden  = target !== "converter";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* ==================== VİDEO ÜRETİCİ ==================== */
const FPS = 30;
const W = 1280;
const H = 720;
const MAX_SURE = 30;
const TIMEOUT_MS = 45000;

const codeInput    = document.getElementById("codeInput");
const generateBtn  = document.getElementById("generateBtn");
const canvas       = document.getElementById("renderCanvas");
const previewVideo = document.getElementById("previewVideo");
const resultSec    = document.getElementById("resultSection");
const downloadBtn  = document.getElementById("downloadBtn");
const chatLog      = document.getElementById("chatLog");
const welcomeMsg   = document.getElementById("welcomeMsg");
const progressBar  = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");

canvas.width  = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
);

/* === ESKİ MESAJLARI TEMİZLE (yeni!) === */
function clearVideoChat() {
  chatLog.querySelectorAll(".bot-msg").forEach(el => {
    if (el !== welcomeMsg) el.remove();
  });
}

function addBotMessage(html, type = "") {
  const div = document.createElement("div");
  div.className = "bot-msg";
  div.innerHTML = `<div class="avatar">🤖</div><div class="bubble ${type}">${html}</div>`;
  chatLog.appendChild(div);
  return div;
}

function updateMessage(el, html, type = "") {
  const b = el.querySelector(".bubble");
  b.innerHTML = html;
  if (type) b.className = `bubble ${type}`;
}

/* ---------------- Örnekler ---------------- */
const ORNEKLER = [
  { kod: `@5s
// Top soldan sağa gidiyor
const x = 100 + t * 900;
daire(x, 360, 50, "#ff6b35");` },

  { kod: `@4s
arkaplan("#0f1117");
dikdortgen(0, 620, 1280, 100, "#232838");
const zipla = Math.abs(Math.sin(t * Math.PI * 4)) * 300;
daire(640, 570 - zipla, 50, "#ff6b35");` },

  { kod: `@3s
arkaplan("#0f1117");
const metin = "OsCodeVideo";
const n = Math.floor(t * metin.length * 1.5);
yazi(metin.slice(0, n), 640, 360, 90, "#6c8cff");` },

  { kod: `@4s
const r = Math.floor(255 * (1 - t));
const b = Math.floor(255 * t);
arkaplan(\`rgb(\${r}, 60, \${b})\`);
yazi("OsCodeVideo", 640, 360, 80, "#ffffff");` },

  { kod: `@5s
arkaplan("#0f1117");
ctx.save();
ctx.translate(640, 360);
ctx.rotate(t * Math.PI * 2);
ctx.fillStyle = "#ff6b35";
ctx.fillRect(-80, -80, 160, 160);
ctx.restore();` }
];

document.querySelectorAll("[data-ex]").forEach(btn => {
  btn.addEventListener("click", () => {
    codeInput.value = ORNEKLER[+btn.dataset.ex].kod;
  });
});

/* ---------------- Derleyici ---------------- */
function parseCode(raw) {
  let duration = 5;
  const m = raw.match(/@(\d+(?:[.,]\d+)?)s?\b/);
  if (m) {
    duration = parseFloat(m[1].replace(",", "."));
    raw = raw.replace(m[0], "");
  }
  return { duration, code: raw.trim() };
}

function makeHelpers() {
  return {
    arkaplan(renk = "#000") {
      ctx.fillStyle = renk;
      ctx.fillRect(0, 0, W, H);
    },
    daire(x, y, r, renk = "#fff") {
      ctx.fillStyle = renk;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
    dikdortgen(x, y, w, h, renk = "#fff") {
      ctx.fillStyle = renk;
      ctx.fillRect(x, y, w, h);
    },
    yazi(metin, x, y, boyut = 32, renk = "#fff") {
      ctx.fillStyle = renk;
      ctx.font = `bold ${boyut}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(metin, x, y);
    },
    cizgi(x1, y1, x2, y2, renk = "#fff", kalinlik = 2) {
      ctx.strokeStyle = renk;
      ctx.lineWidth = kalinlik;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };
}

function compile(code) {
  return new Function(
    "ctx", "t", "kare", "sure", "W", "H", "yardimci",
    `"use strict";
     const { arkaplan, daire, dikdortgen, yazi, cizgi } = yardimci;
     ${code}`
  );
}

function drawIdle() {
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#232838";
  ctx.font = "bold 42px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎬 Önizleme", W / 2, H / 2);
}
drawIdle();

/* ---------------- Üretim ---------------- */
async function uret() {
  const raw = codeInput.value.trim();
  if (!raw) return addBotMessage("⚠️ Kod boş. Bir şeyler yaz.", "err");

  const { duration, code } = parseCode(raw);
  if (duration < 1 || duration > MAX_SURE) {
    return addBotMessage(`⚠️ Süre 1–${MAX_SURE} saniye arasında olmalı.`, "err");
  }

  let userFn;
  try { userFn = compile(code); }
  catch (e) {
    return addBotMessage(`❌ <b>Kod hatası:</b><br><code>${escapeHtml(e.message)}</code>`, "err");
  }

  /* === YENİ ÜRETİM BAŞLARKEN ESKİ LOGLARI TEMİZLE === */
  clearVideoChat();

  generateBtn.disabled = true;
  previewVideo.hidden   = true;
  resultSec.hidden      = true;
  canvas.style.display  = "block";
  progressBar.hidden    = false;
  progressFill.style.width = "0%";
  generateBtn.textContent = "⚡ Üretiliyor...";

  const m1 = addBotMessage('<span class="spinner"></span> 📥 Kodunu aldım, <b>analiz ediyorum...</b>');
  await sleep(350);
  updateMessage(m1, "📥 Kod analiz edildi ✓");

  const m2 = addBotMessage('<span class="spinner"></span> 🎨 <b>Sahne kuruluyor...</b>');
  await sleep(300);
  updateMessage(m2, "🎨 Sahne hazır ✓");

  const m3 = addBotMessage('<span class="spinner"></span> 🏃 <b>Animasyon oynatılıyor...</b><div class="mini-bar"><div></div></div>');
  const miniFill = m3.querySelector(".mini-bar > div");

  const stream = canvas.captureStream(0);
  const track  = stream.getVideoTracks()[0];

  const mime = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"]
    .find(t => MediaRecorder.isTypeSupported(t));

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 2_500_000
  });

  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  const blobPromise = new Promise((resolve, reject) => {
    const killer = setTimeout(() => {
      try { rec.state !== "inactive" && rec.stop(); } catch (_) {}
      reject(new Error("Video üretimi zaman aşımına uğradı (45 sn)."));
    }, TIMEOUT_MS);

    rec.onstop = () => {
      clearTimeout(killer);
      if (!chunks.length) return reject(new Error("Kayıt boş döndü. Tarayıcıyı yenile."));
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
    rec.onerror = e => {
      clearTimeout(killer);
      reject(new Error("Kayıt hatası: " + (e.error?.message || "bilinmeyen")));
    };
  });

  rec.start();

  const startTime  = performance.now();
  const durationMs = duration * 1000;
  const helpers    = makeHelpers();
  let frameNo      = 0;

  function tick() {
    const elapsed = performance.now() - startTime;
    const t       = Math.min(1, elapsed / durationMs);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    try {
      userFn(ctx, t, frameNo++, duration, W, H, helpers);
    } catch (e) {
      try { rec.state !== "inactive" && rec.stop(); } catch (_) {}
      updateMessage(m3, `❌ <b>Çalışma hatası:</b><br><code>${escapeHtml(e.message)}</code>`, "err");
      generateBtn.disabled = false;
      generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true;
      return;
    }

    if (track.requestFrame) track.requestFrame();

    const pct = Math.round(t * 100);
    progressFill.style.width = pct + "%";
    miniFill.style.width     = pct + "%";
    const kalan = Math.max(0, Math.ceil(duration - elapsed / 1000));
    updateMessage(m3,
      `🏃 <b>Animasyon oynatılıyor...</b> %${pct} <small>(~${kalan} sn)</small>
       <div class="mini-bar"><div style="width:${pct}%"></div></div>`
    );
    generateBtn.textContent = `⚡ Üretiliyor... %${pct}`;

    if (elapsed < durationMs) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(() => {
        try { rec.state !== "inactive" && rec.stop(); } catch (_) {}
      }, 250);
    if }
  }

  requestAnimationFrame(tick);

  let blob;
  try {
    blob = await blobPromise;
  } catch (e) {
    updateMessage(m3 (, `❌ ${escapeHtml(e.message)}`, "err");
    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluşturf";
    progressBar.hidden = true;
    return;
  }

  updateMessage(m3, "🏃 Animasyon tamamlandı ✓");

  const m4 = add)BotMessage('<span class="spinner"></span> 💾 <b>Video işleniyor...</b>');
  await sleep(250);

 set  const url = URL.createObjectURL(blob);
  previewVideo.src     = url;
  previewVideo.hidden  = false;
  canvas.style.display = "none";
  progressFileBar.hidden   = true;
  downloadBtn.href     = url;
  downloadBtn.download = `oscodevideo-${Date.now()}.webm`;
  resultSec.hidden     = false;

  updateMessage(m4, `✅ <b>Video hazır!</b> <small>(${duration} sn • ${(blob.size / 1024 / 1024).toFixed(2)} MB)</small>`, "ok");
  addBotMessage('İndirmek için alttaki <b>⬇️ Videoyu İndir</b> butonuna bas.', "ok");

  generateBtn.disabled = false;
  generateBtn.textContent = "⚡ Videoyu Oluştur";
}

generateBtn.addEventListener("click", uret);
