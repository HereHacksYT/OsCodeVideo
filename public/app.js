const FPS = 30;
const W = 1280;
const H = 720;

const codeInput    = document.getElementById("codeInput");
const generateBtn  = document.getElementById("generateBtn");
const canvas       = document.getElementById("renderCanvas");
const previewVideo = document.getElementById("previewVideo");
const resultSec    = document.getElementById("resultSection");
const downloadBtn  = document.getElementById("downloadBtn");
const botBubble    = document.querySelector("#botMsg .bubble");

canvas.width  = W;
canvas.height = H;

/* ---------- Örnekler ---------- */
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

/* ---------- Yardımcılar ---------- */
function botSay(html) { botBubble.innerHTML = html; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function parseCode(raw) {
  let duration = 5;
  const m = raw.match(/@(\d+(?:[.,]\d+)?)s?\b/);
  if (m) {
    duration = parseFloat(m[1].replace(",", "."));
    raw = raw.replace(m[0], "");
  }
  return { duration, code: raw.trim() };
}

function makeHelpers(ctx) {
  return {
    arkaplan(renk = "#000") {
      ctx.fillStyle = renk;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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

/* ---------- Başlangıç çizimi ---------- */
(function drawIdle() {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#232838";
  ctx.font = "bold 42px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎬 Önizleme", W / 2, H / 2);
})();

/* ---------- Video üret ---------- */
async function uret() {
  const raw = codeInput.value.trim();
  if (!raw) return botSay("⚠️ Kod boş. Bir şeyler yaz.");

  const { duration, code } = parseCode(raw);
  if (duration < 1 || duration > 30) {
    return botSay("⚠️ Süre 1–30 saniye arasında olmalı.");
  }

  let userFn;
  try { userFn = compile(code); }
  catch (e) {
    return botSay(`❌ <b>Kod hatası:</b><br><code>${escapeHtml(e.message)}</code>`);
  }

  const totalFrames = Math.round(duration * FPS);
  const tahmini     = Math.ceil(duration + 1);

  generateBtn.disabled = true;
  previewVideo.hidden  = true;
  resultSec.hidden     = true;
  canvas.style.display = "block";
  botSay(`⚡ <b>Videoyu oluşturuyorum...</b><br><small>Tahmini süre: ~${tahmini} sn</small>`);

  const ctx     = canvas.getContext("2d");
  const helpers = makeHelpers(ctx);

  /* Kayıt */
  const stream = canvas.captureStream(FPS);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find(t => MediaRecorder.isTypeSupported(t)) || "video/webm";

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(res => {
    rec.onstop = () => res(new Blob(chunks, { type: "video/webm" }));
  });
  rec.start();

  try {
    const t0 = performance.now();
    const frameMs = 1000 / FPS;

    for (let i = 0; i < totalFrames; i++) {
      const target = t0 + i * frameMs;
      const now = performance.now();
      if (now < target) await new Promise(r => setTimeout(r, target - now));

      const t = totalFrames > 1 ? i / (totalFrames - 1) : 0;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      userFn(ctx, t, i, duration, W, H, helpers);

      const gecen = Math.round((performance.now() - t0) / 1000);
      const kalan = Math.max(0, tahmini - gecen);
      const pct   = Math.round(((i + 1) / totalFrames) * 100);
      generateBtn.textContent = `⚡ Oluşturuluyor... %${pct} (~${kalan} sn)`;
    }

    await new Promise(r => setTimeout(r, 150)); // son kare garantisi
  } catch (e) {
    rec.stop();
    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
    return botSay(`❌ <b>Çalışma hatası:</b><br><code>${escapeHtml(e.message)}</code>`);
  }

  rec.stop();
  const blob = await stopped;

  /* Sonuç */
  const url = URL.createObjectURL(blob);
  previewVideo.src   = url;
  previewVideo.hidden = false;
  canvas.style.display = "none";
  downloadBtn.href     = url;
  downloadBtn.download = `oscodevideo-${Date.now()}.webm`;
  resultSec.hidden = false;

  botSay(`✅ <b>Video hazır!</b><br><small>${duration} sn • ${(blob.size / 1024 / 1024).toFixed(2)} MB</small>`);

  generateBtn.disabled = false;
  generateBtn.textContent = "⚡ Videoyu Oluştur";
}

generateBtn.addEventListener("click", uret);
