/* ============================================================
   OsCodeVideo — app.js
   ============================================================ */
(function () {
  "use strict";

  /* ==================== YARDIMCILAR ==================== */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

  /* ==================== SEKMELER ==================== */
  const tabs      = document.querySelectorAll(".tab");
  const pageVideo = $("pageVideo");
  const pageConv  = $("pageConverter");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      if (pageVideo) pageVideo.hidden = target !== "video";
      if (pageConv)  pageConv.hidden  = target !== "converter";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ============================================================
     BÖLÜM 1: VİDEO ÜRETİCİ
     ============================================================ */
  const FPS = 30;
  const W = 1280;
  const H = 720;
  const MAX_SURE = 30;
  const TIMEOUT_MS = 45000;

  const codeInput    = $("codeInput");
  const generateBtn  = $("generateBtn");
  const canvas       = $("renderCanvas");
  const previewVideo = $("previewVideo");
  const resultSec    = $("resultSection");
  const downloadBtn  = $("downloadBtn");
  const chatLog      = $("chatLog");
  const welcomeMsg   = $("welcomeMsg");
  const progressBar  = $("progressBar");
  const progressFill = $("progressFill");

  if (canvas) {
    canvas.width  = W;
    canvas.height = H;
  }
  const ctx = canvas ? canvas.getContext("2d") : null;

  /* -------- Sohbet yardımcıları -------- */
  function clearVideoChat() {
    if (!chatLog) return;
    chatLog.querySelectorAll(".bot-msg").forEach(el => {
      if (el !== welcomeMsg) el.remove();
    });
  }
  function addBotMessage(html, type = "") {
    if (!chatLog) return null;
    const div = document.createElement("div");
    div.className = "bot-msg";
    div.innerHTML = `<div class="avatar">🤖</div><div class="bubble ${type}">${html}</div>`;
    chatLog.appendChild(div);
    return div;
  }
  function updateMessage(el, html, type = "") {
    if (!el) return;
    const b = el.querySelector(".bubble");
    if (!b) return;
    b.innerHTML = html;
    if (type) b.className = `bubble ${type}`;
  }

  /* -------- Örnekler -------- */
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
      if (codeInput) codeInput.value = ORNEKLER[+btn.dataset.ex].kod;
    });
  });

  /* -------- Derleyici -------- */
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
    if (!ctx) return;
    ctx.fillStyle = "#0a0c12";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#232838";
    ctx.font = "bold 42px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎬 Önizleme", W / 2, H / 2);
  }
  drawIdle();

  /* -------- Üretim -------- */
  async function uret() {
    if (!codeInput || !canvas || !ctx) return;
    const raw = codeInput.value.trim();
    if (!raw) return addBotMessage("⚠️ Kod boş. Bir şeyler yaz.", "err");

    const { duration, code } = parseCode(raw);
    if (duration < 1 || duration > MAX_SURE) {
      return addBotMessage(`⚠️ Süre 1–${MAX_SURE} saniye arasında olmalı.`, "err");
    }

    let userFn;
    try { userFn = compile(code); }
    catch (e) {
      return add>BotMessage(`❌ <b>Kod hatası:</b><br><code>${escapeHtml(e.message)}</code>`, "err");
Anim    }

    clearVideoChat();

    generateBtn.disabled = true;
    previewVideo.hidden   = true;
    resultSec.hiddenasyon      = true;
    canvas.style.display  = "block";
    progressBar.hidden    = false;
    progressFill.style.width = "0%";
 o    generateBtn.textContent = "⚡ Üretiliyor...";

    const m1 = addBotMessage('<span class="spinner"></span> 📥 Kodunu aldynım, <b>analiz ediyorum...</b>');
    await sleep(350);
    updateMessage(m1, "📥 Kod analiz edildi ✓");

    constat m2 = addBotMessage('<span class="spinner"></span> 🎨 <b>Sahne kuruluyor...</b>');
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
        if (!chunks.length) return reject(new Error("Kayıt boş döndü."));
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
      if (miniFill) miniFill.style.width = pct + "%";
      const kalan = Math.max(0, Math.ceil(duration - elapsed / 1000));
      updateMessage(m3,
        `🏃 <bılıyor...</b> %${pct} <small>(~${kalan} sn)</small>
         <div class="mini-bar"><div style="width:${pct}%"></div></div>`
      );
      generateBtn.textContent = `⚡ Üretiliyor... %${pct}`;

      if (elapsed < durationMs) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          try { rec.state !== "inactive" && rec.stop(); } catch (_) {}
        }, 250);
      }
    }

    requestAnimationFrame(tick);

    let blob;
    try {
      blob = await blobPromise;
    } catch (e) {
      updateMessage(m3, `❌ ${escapeHtml(e.message)}`, "err");
      generateBtn.disabled = false;
      generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true;
      return;
    }

    updateMessage(m3, "🏃 Animasyon tamamlandı ✓");

    const m4 = addBotMessage('<span class="spinner"></span> 💾 <b>Video işleniyor...</b>');
    await sleep(250);

    const url = URL.createObjectURL(blob);
    previewVideo.src     = url;
    previewVideo.hidden  = false;
    canvas.style.display = "none";
    progressBar.hidden   = true;
    downloadBtn.href     = url;
    downloadBtn.download = `oscodevideo-${Date.now()}.webm`;
    resultSec.hidden     = false;

    updateMessage(m4, `✅ <b>Video hazır!</b> <small>(${duration} sn • ${(blob.size / 1024 / 1024).toFixed(2)} MB)</small>`, "ok");
    addBotMessage('İndirmek için alttaki <b>⬇️ Videoyu İndir</b> butonuna bas.', "ok");

    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
  }

  if (generateBtn) generateBtn.addEventListener("click", uret);

  /* ============================================================
     BÖLÜM 2: DÖNÜŞTÜRÜCÜ (WebM → MP4)
     ============================================================ */
  const MAX_MB = 100;

  const dropZone     = $("dropZone");
  const dropTitle    = $("dropTitle");
  const dropSub      = $("dropSub");
  const fileInput    = $("fileInput");
  const convFileInfo = $("convFileInfo");
  const convertBtn   = $("convertBtn");
  const convChatLog  = $("convChatLog");
  const convWelcome  = $("convWelcome");
  const convResult   = $("convResultSection");
  const convDlBtn    = $("convDownloadBtn");

  let selectedFile = null;
  let ffmpegInstance = null;

  function clearConvChat() {
    if (!convChatLog) return;
    convChatLog.querySelectorAll(".bot-msg").forEach(el => {
      if (el !== convWelcome) el.remove();
    });
  }
  function addConvBot(html, type = "") {
    if (!convChatLog) return null;
    const div = document.createElement("div");
    div.className = "bot-msg";
    div.innerHTML = `<div class="avatar">🤖</div><div class="bubble ${type}">${html}</div>`;
    convChatLog.appendChild(div);
    return div;
  }
  function updateConvBot(el, html, type = "") {
    if (!el) return;
    const b = el.querySelector(".bubble");
    if (!b) return;
    b.innerHTML = html;
    if (type) b.className = `bubble ${type}`;
  }

  /* -------- ffmpeg'i dinamik yükle (sadece gerektiğinde) -------- */
  async function getFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;

    // Dinamik import — sadece bu an çağrılır, sayfa açılışını etkilemez
    const ffmpegMod = await import("https://esm.sh/@ffmpeg/ffmpeg@0.12.10");
    const utilMod   = await import("https://esm.sh/@ffmpeg/util@0.12.1");

    const { FFmpeg } = ffmpegMod;
    const { toBlobURL } = utilMod;

    const ff = new FFmpeg();

    await ff.load({
      coreURL: await toBlobURL(
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
        "application/wasm"
      )
    });

    ffmpegInstance = ff;
    // fetchFile'ı sonradan kullanmak için sakla
    ff.__fetchFile = utilMod.fetchFile;

    return ff;
  }

  /* -------- Dosya seçimi -------- */
  function setFile(file) {
    if (!file) return;

    if (!/\.webm$/i.test(file.name) && file.type !== "video/webm") {
      clearConvChat();
      addConvBot(`❌ Sadece <b>.webm</b> dosyası kabul edilir.`, "err");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      clearConvChat();
      addConvBot(`❌ Dosya çok büyük. Max: ${MAX_MB} MB`, "err");
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

  if (dropZone && fileInput) {
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
      if (f) setFile(f);
    });
  }

  /* -------- Dönüştür -------- */
  async function donustur() {
    if (!selectedFile) return;

    clearConvChat();
    convertBtn.disabled = true;
    convertBtn.textContent = "🎬 Dönüştürülüyor...";
    convResult.hidden = true;

    const m1 = addConvBot('<span class="spinner"></span> 📥 Dosya alındı, hazırlanıyor...');
    await sleep(250);
    updateConvBot(m1, `📥 Dosya alındı ✓ <small>(${escapeHtml(selectedFile.name)})</small>`);

    const m2 = addConvBot(
      '<span class="spinner"></span> 🧠 <b>ffmpeg motoru hazırlanıyor...</b><br>' +
      '<small>İlk seferde ~25 MB indirilir, sabret.</small>'
    );

    const t0 = performance.now();
    let ff;
    try {
      ff = await getFFmpeg();
    } catch (e) {
      console.error(e);
      updateConvBot(m2, `❌ Motor yüklenemedi: <code>${escapeHtml(e.message || e)}</code>`, "err");
      convertBtn.disabled = false;
      convertBtn.textContent = "🎬 MP4'e Dönüştür";
      return;
    }
    const motorSn = ((performance.now() - t0) / 1000).toFixed(1);
    updateConvBot(m2, `🧠 Motor hazır ✓ <small>(${motorSn} sn)</small>`);

    const m3 = addConvBot(
      '<span class="spinner"></span> 🔄 <b>MP4\'e dönüştürülüyor...</b>' +
      '<div class="big-bar"><div style="width:0%"></div></div>'
    );
    const bigFill = m3.querySelector(".big-bar > div");

    const onProgress = ({ progress }) => {
      const pct = Math.min(100, Math.max(0, Math.round((progress || 0) * 100)));
      if (bigFill) bigFill.style.width = pct + "%";
      updateConvBot(m3,
        `🔄 <b>MP4'e dönüştürülüyor...</b> %${pct}
         <div class="big-bar"><div style="width:${pct}%"></div></div>`
      );
      convertBtn.textContent = `🎬 Dönüştürülüyor... %${pct}`;
    };
    ff.on("progress", onProgress);

    let mp4Blob;
    try {
      const { fetchFile } = await import("https://esm.sh/@ffmpeg/util@0.12.1");
      const inputName  = "input.webm";
      const outputName = "output.mp4";

      await ff.writeFile(inputName, await fetchFile(selectedFile));
      await ff.exec([
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

      const data = await ff.readFile(outputName);
      mp4Blob = new Blob([data.buffer], { type: "video/mp4" });

      try { await ff.deleteFile(inputName); } catch (_) {}
      try { await ff.deleteFile(outputName); } catch (_) {}
    } catch (e) {
      console.error(e);
      updateConvBot(m3, `❌ Dönüşüm hatası: <code>${escapeHtml(e.message || e)}</code>`, "err");
      convertBtn.disabled = false;
      convertBtn.textContent = "🎬 MP4'e Dönüştür";
      return;
    } finally {
      try { ff.off("progress", onProgress); } catch (_) {}
    }

    updateConvBot(m3, "🔄 Dönüştürme tamamlandı ✓");

    const m4 = addConvBot('<span class="spinner"></span> 💾 MP4 hazırlanıyor...');
    await sleep(250);
    const mb = (mp4Blob.size / 1024 / 1024).toFixed(2);
    updateConvBot(m4, `✅ <b>MP4 hazır!</b> <small>(${mb} MB)</small>`, "ok");

    const url = URL.createObjectURL(mp4Blob);
    const baseName = selectedFile.name.replace(/\.webm$/i, "");
    convDlBtn.href     = url;
    convDlBtn.download = `${baseName}.mp4`;
    convResult.hidden  = false;

    addConvBot("İndirmek için alttaki <b>⬇️ MP4'ü İndir</b> butonuna bas.", "ok");

    convertBtn.disabled = false;
    convertBtn.textContent = "🎬 MP4'e Dönüştür";
  }

  if (convertBtn) convertBtn.addEventListener("click", donustur);

  console.log("🎬 OsCodeVideo hazır — v3");
})();
