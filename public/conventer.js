import { FFmpeg } from "https://esm.sh/@ffmpeg/ffmpeg@0.12.10";
import { fetchFile, toBlobURL } from "https://esm.sh/@ffmpeg/util@0.12.1";

const MAX_MB = 100;

const dropZone     = document.getElementById("dropZone");
const dropTitle    = document.getElementById("dropTitle");
const dropSub      = document.getElementById("dropSub");
const fileInput    = document.getElementById("fileInput");
const convFileInfo = document.getElementById("convFileInfo");
const convertBtn   = document.getElementById("convertBtn");
const convChatLog  = document.getElementById("convChatLog");
const convWelcome  = document.getElementById("convWelcome");
const convResult   = document.getElementById("convResultSection");
const convDlBtn    = document.getElementById("convDownloadBtn");

let selectedFile = null;
let ffmpeg = null;
let ffmpegReady = false;
let ffmpegLoading = false;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
);

/* ---------- Sohbet yardımcıları ---------- */
function clearConvChat() {
  convChatLog.querySelectorAll(".bot-msg").forEach(el => {
    if (el !== convWelcome) el.remove();
  });
}
function addBot(html, type = "") {
  const div = document.createElement("div");
  div.className = "bot-msg";
  div.innerHTML = `<div class="avatar">🤖</div><div class="bubble ${type}">${html}</div>`;
  convChatLog.appendChild(div);
  return div;
}
function updateBot(el, html, type = "") {
  const b = el.querySelector(".bubble");
  b.innerHTML = html;
  if (type) b.className = `bubble ${type}`;
}

/* ---------- ffmpeg motoru (lazy) ---------- */
async function ensureFFmpeg(onStatus) {
  if (ffmpegReady) return ffmpeg;
  if (ffmpegLoading) {
    while (ffmpegLoading) await sleep(100);
    return ffmpeg;
  }
  ffmpegLoading = true;
  onStatus && onStatus("motor indiriliyor");
  ffmpeg = new FFmpeg();

  await ffmpeg.load({
    coreURL: await toBlobURL(
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
      "text/javascript"
    ),
    wasmURL: await toBlobURL(
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
      "application/wasm"
    )
  });

  ffmpegReady = true;
  ffmpegLoading = false;
  return ffmpeg;
}

/* ---------- Dosya seçimi ---------- */
function setFile(file) {
  if (!file) return;

  if (!/\.webm$/i.test(file.name) && file.type !== "video/webm") {
    clearConvChat();
    addBot(`❌ Sadece <b>.webm</b> dosyası kabul edilir.`, "err");
    return;
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    clearConvChat();
    addBot(`❌ Dosya çok büyük. Max: ${MAX_MB} MB`, "err");
    return;
  }

  selectedFile = file;
  const mb = (file.size / 1024 / 1024).toFixed(2);
  convFileInfo.innerHTML =
    `📎 <b>${escapeHtml(file.name)}</b>
     <span class="meta">${mb} MB</span>`;
  dropTitle.textContent = "✅ Dosya hazır";
  dropSub.textContent   = "Değiştirmek için tıkla";
  convertBtn.disabled   = false;
  convResult.hidden     = true;
}

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => setFile(e.target.files[0]));

["dragenter", "dragover"].forEach(ev =>
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach(ev =>
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  })
);
dropZone.addEventListener("drop", e => {
  const f = e.dataTransfer?.files?.[0];
 (f);
});

/* ---------- Dönüştür ---------- */
convertBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  clearConvChat();
  convertBtn.disabled = true;
  convertBtn.textContent = "🎬 Dönüştürülüyor...";
  convResult.hidden = true;

  /* 1. Dosya alındı */
  const m1 = addBot('<span class="spinner"></span> 📥 Dosya alındı, hazırlanıyor...');
  await sleep(250);
  updateBot(m1, `📥 Dosya alındı ✓ <small>(${escapeHtml(selectedFile.name)})</small>`);

  /* 2. Motor */
  const m2 = addBot(
    '<span class="spinner"></span> 🧠 <b>ffmpeg motoru hazırlanıyor...</b><br>' +
    '<small>İlk seferde ~25 MB indirilir, sabret.</small>'
  );

  const t0 = performance.now();
  try {
    await ensureFFmpeg();
  } catch (e) {
    updateBot(m2, `❌ Motor yüklenemedi: <code>${escapeHtml(e.message)}</code>`, "err");
    convertBtn.disabled = false;
    convertBtn.textContent = "🎬 MP4'e Dönüştür";
    return;
  }
  const motorSn = ((performance.now() - t0) / 1000).toFixed(1);
  updateBot(m2, `🧠 Motor hazır ✓ <small>(${motorSn} sn)</small>`);

  /* 3. Dönüştürme */
  const m3 = addBot(
    '<span class="spinner"></span> 🔄 <b>MP4\'e dönüştürülüyor...</b>' +
    '<div class="big-bar"><div style="width:0%"></div></div>'
  );
  const bigFill = m3.querySelector(".big-bar > div");

  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.min(100, Math.max(0, Math.round((progress || 0) * 100)));
    bigFill.style.width = pct + "%";
    updateBot(m3,
      `🔄 <b>MP4'e dönüştürülüyor...</b> %${pct}
       <div class="big-bar"><div style="width:${pct}%"></div></div>`
    );
    convertBtn.textContent = `🎬 Dönüştürülüyor... %${pct}`;
  });

  let mp4Blob;
  try {
    const inputName = "input.webm";
    const outputName = "output.mp4";

    await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
    await ffmpeg.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    mp4Blob = new Blob([data.buffer], { type: "video/mp4" });

    /* temizlik */
    try { await ffmpeg.deleteFile(inputName); } catch (_) {}
    try { await ffmpeg.deleteFile(outputName); } catch (_) {}
  } catch (e) {
    updateBot(m3, `❌ Dönüşüm hatası: <code>${escapeHtml(e.message)}</code>`, "err");
    convertBtn.disabled = false;
    convertBtn.textContent = "🎬 MP4'e Dönüştür";
    return;
  }

  updateBot(m3, "🔄 Dönüştürme tamamlandı ✓");

  /* 4. Hazır */
  const m4 = addBot('<span class="spinner"></span> 💾 MP4 hazırlanıyor...');
  await sleep(250);
  const mb = (mp4Blob.size / 1024 / 1024).toFixed(2);
  updateBot(m4, `✅ <b>MP4 hazır!</b> <small>(${mb} MB)</small>`, "ok");

  const url = URL.createObjectURL(mp4Blob);
  const baseName = selectedFile.name.replace(/\.webm$/i, "");
  convDlBtn.href     = url;
  convDlBtn.download = `${baseName}.mp4`;
  convResult.hidden  = false;

  addBot("İndirmek için alttaki <b>⬇️ MP4'ü İndir</b> butonuna bas.", "ok");

  convertBtn.disabled = false;
  convertBtn.textContent = "🎬 MP4'e Dönüştür";
});
