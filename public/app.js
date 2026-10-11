(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ==================== SEKMELER ==================== */
  var tabs = document.querySelectorAll(".tab");
  var pageVideo = $("pageVideo");
  var pageConv = $("pageConverter");

  for (var i = 0; i < tabs.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove("active");
        btn.classList.add("active");
        var target = btn.getAttribute("data-tab");
        if (pageVideo) pageVideo.hidden = (target !== "video");
        if (pageConv) pageConv.hidden = (target !== "converter");
      });
    })(tabs[i]);
  }

  /* ==================== VİDEO ÜRETİCİ ==================== */
  var FPS = 30, W = 1280, H = 720, MAX_SURE = 30, TIMEOUT_MS = 45000;

  var codeInput = $("codeInput");
  var generateBtn = $("generateBtn");
  var canvas = $("renderCanvas");
  var previewVideo = $("previewVideo");
  var resultSec = $("resultSection");
  var downloadBtn = $("downloadBtn");
  var chatLog = $("chatLog");
  var welcomeMsg = $("welcomeMsg");
  var progressBar = $("progressBar");
  var progressFill = $("progressFill");

  if (canvas) { canvas.width = W; canvas.height = H; }
  var ctx = canvas ? canvas.getContext("2d") : null;

  function clearVideoChat() {
    if (!chatLog) return;
    var msgs = chatLog.querySelectorAll(".bot-msg");
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i] !== welcomeMsg) msgs[i].remove();
    }
  }

  function addBotMessage(html, type) {
    if (!chatLog) return null;
    var div = document.createElement("div");
    div.className = "bot-msg";
    div.innerHTML = '<div class="avatar">🤖</div><div class="bubble ' + (type||"") + '">' + html + "</div>";
    chatLog.appendChild(div);
    return div;
  }

  function updateMessage(el, html, type) {
    if (!el) return;
    var b = el.querySelector(".bubble");
    if (!b) return;
    b.innerHTML = html;
    if (type) b.className = "bubble " + type;
  }

  var ORNEKLER = [
    '@5s\nconst x = 100 + t * 900;\nda里(x, 360, 50, "#ff6b35");',
    '@4s\narkaplan("#0f1117");\ndikdortgen(0, 620, 1280, 100, "#232838");\nvar zipla = Math.abs(Math.sin(t * Math.PI * 4)) * 300;\nda里(640, 570 - zipla, 50, "#ff6b35");',
    '@3s\narkaplan("#0f1117");\nvar metin = "OsCodeVideo";\nvar n = Math.floor(t * metin.length * 1.5);\nyazi(metin.slice(0, n), 640, 360, 90, "#6c8cff");',
    '@4s\nvar r = Math.floor(255 * (1 - t));\nvar b = Math.floor(255 * t);\narkaplan("rgb(" + r + ", 60, " + b + ")");\nyazi("OsCodeVideo", 640, 360, 80, "#ffffff");',
    '@5s\narkaplan("#0f1117");\nctx.save();\nctx.translate(640, 360);\nctx.rotate(t * Math.PI * 2);\nctx.fillStyle = "#ff6b35";\nctx.fillRect(-80, -80, 160, 160);\nctx.restore();'
  ];

  var exBtns = document.querySelectorAll("[data-ex]");
  for (var k = 0; k < exBtns.length; k++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-ex"), 10);
        if (codeInput && ORNEKLER[idx] !== undefined) codeInput.value = ORNEKLER[idx];
      });
    })(exBtns[k]);
  }

  function parseCode(raw) {
    var duration = 5;
    var m = raw.match(/@(\d+(?:[.,]\d+)?)s?\b/);
    if (m) {
      duration = parseFloat(m[1].replace(",", "."));
      raw = raw.replace(m[0], "");
    }
    return { duration: duration, code: raw.trim() };
  }

  function makeHelpers() {
    return {
      arkaplan: function (renk) { ctx.fillStyle = renk || "#000"; ctx.fillRect(0, 0, W, H); },
      daire: function (x, y, r, renk) {
        ctx.fillStyle = renk || "#fff";
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      },
      dikdortgen: function (x, y, w, h, renk) { ctx.fillStyle = renk || "#fff"; ctx.fillRect(x, y, w, h); },
      yazi: function (metin, x, y, boyut, renk) {
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + (boyut || 32) + "px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(metin, x, y);
      },
      cizgi: function (x1, y1, x2, y2, renk, kalinlik) {
        ctx.strokeStyle = renk || "#fff";
        ctx.lineWidth = kalinlik || 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    };
  }

  function compile(code) {
    return new Function(
      "ctx", "t", "kare", "sure", "W", "H", "yardimci",
      '"use strict";var arkaplan=yardimci.arkaplan,daire=yardimci.daire,dikdortgen=yardimci.dikdortgen,yazi=yardimci.yazi,cizgi=yardimci.cizgi;' + code
    );
  }

  function drawIdle() {
    if (!ctx) return;
    ctx.fillStyle = "#0a0c12"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#232838"; ctx.font = "bold 42px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎬 Önizleme", W / 2, H / 2);
  }
  drawIdle();

  async function uret() {
    if (!codeInput || !canvas || !ctx) return;

    var raw = codeInput.value.trim();
    if (!raw) { addBotMessage("⚠️ Kod boş.", "err"); return; }

    var p = parseCode(raw);
    var duration = p.duration, code = p.code;

    if (duration < 1 || duration > MAX_SURE) {
      addBotMessage("⚠️ Süre 1-" + MAX_SURE + " sn olmalı.", "err"); return;
    }

    var userFn;
    try { userFn = compile(code); }
    catch (e) { addBotMessage("❌ Kod hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err"); return; }

    clearVideoChat();
    generateBtn.disabled = true;
    previewVideo.hidden = true;
    resultSec.hidden = true;
    canvas.style.display = "block";
    progressBar.hidden = false;
    progressFill.style.width = "0%";
    generateBtn.textContent = "⚡ Üretiliyor...";

    var m1 = addBotMessage('<span class="spinner"></span> 📥 Kod analiz ediliyor...');
    await sleep(350);
    updateMessage(m1, "📥 Kod analiz edildi ✓");

    var m2 = addBotMessage('<span class="spinner"></span> 🎨 Sahne kuruluyor...');
    await sleep(300);
    updateMessage(m2, "🎨 Sahne hazır ✓");

    var m3 = addBotMessage('<span class="spinner"></span> 🏃 Animasyon oynatılıyor...<div class="mini-bar"><div></div></div>');
    var miniFill = m3 ? m3.querySelector(".mini-bar > div") : null;

    var stream, track, rec;
    try {
      stream = canvas.captureStream(0);
      track = stream.getVideoTracks()[0];
      var options = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];
      var mime;
      for (var mi = 0; mi < options.length; mi++) {
        if (MediaRecorder.isTypeSupported(options[mi])) { mime = options[mi]; break; }
      }
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    } catch (err) {
      updateMessage(m3, "❌ MediaRecorder başlatılamadı.", "err");
      generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true; return;
    }

    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };

    var blobPromise = new Promise(function (resolve, reject) {
      var killer = setTimeout(function () {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        reject(new Error("Zaman aşımı (45 sn)."));
      }, TIMEOUT_MS);
      rec.onstop = function () {
        clearTimeout(killer);
        if (!chunks.length) { reject(new Error("Kayıt boş.")); return; }
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
      rec.onerror = function () { clearTimeout(killer); reject(new Error("Kayıt hatası")); };
    });

    rec.start();

    var startTime = performance.now();
    var durationMs = duration * 1000;
    var helpers = makeHelpers();
    var frameNo = 0;

    function tick() {
      var elapsed = performance.now() - startTime;
      var t = Math.min(1, elapsed / durationMs);

      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);

      try { userFn(ctx, t, frameNo++, duration, W, H, helpers); }
      catch (e) {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        updateMessage(m3, "❌ Çalışma hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
        generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
        progressBar.hidden = true; return;
      }

      if (track.requestFrame) track.requestFrame();

      var pct = Math.round(t * 100);
      progressFill.style.width = pct + "%";
      if (miniFill) miniFill.style.width = pct + "%";
      var kalan = Math.max(0, Math.ceil(duration - elapsed / 1000));
      updateMessage(m3,
        "🏃 Animasyon oynatılıyor... %" + pct + " <small>(~" + kalan + " sn)</small>" +
        '<div class="mini-bar"><div style="width:' + pct + '%"></div></div>'
      );
      generateBtn.textContent = "⚡ Üretiliyor... %" + pct;

      if (elapsed < durationMs) requestAnimationFrame(tick);
      else setTimeout(function () {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
      }, 250);
    }
    requestAnimationFrame(tick);

    var blob;
    try { blob = await blobPromise; }
    catch (e) {
      updateMessage(m3, "❌ " + escapeHtml(e.message), "err");
      generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true; return;
    }

    updateMessage(m3, "🏃 Animasyon tamamlandı ✓");

    var m4 = addBotMessage('<span class="spinner"></span> 💾 Video işleniyor...');
    await sleep(250);

    var url = URL.createObjectURL(blob);
    previewVideo.src = url;
    previewVideo.hidden = false;
    canvas.style.display = "none";
    progressBar.hidden = true;
    downloadBtn.href = url;
    downloadBtn.download = "oscodevideo-" + Date.now() + ".webm";
    resultSec.hidden = false;

    updateMessage(m4, "✅ Video hazır! <small>(" + duration + " sn • " + (blob.size / 1024 / 1024).toFixed(2) + " MB)</small>", "ok");
    addBotMessage("İndirmek için alttaki ⬇️ butonuna bas.", "ok");

    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
  }

  if (generateBtn) generateBtn.addEventListener("click", uret);

  /* ==================== DÖNÜŞTÜRÜCÜ ==================== */
  var MAX_MB = 100;
  var dropZone = $("dropZone");
  var dropTitle = $("dropTitle");
  var dropSub = $("dropSub");
  var fileInput = $("fileInput");
  var convFileInfo = $("convFileInfo");
  var convertBtn = $("convertBtn");
  var convChatLog = $("convChatLog");
  var convWelcome = $("convWelcome");
  var convResult = $("convResultSection");
  var convDlBtn = $("convDownloadBtn");

  var selectedFile = null;
  var ffmpegInstance = null;

  function clearConvChat() {
    if (!convChatLog) return;
    var msgs = convChatLog.querySelectorAll(".bot-msg");
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i] !== convWelcome) msgs[i].remove();
    }
  }
  function addConvBot(html, type) {
    if (!convChatLog) return null;
    var div = document.createElement("div");
    div.className = "bot-msg";
    div.innerHTML = '<div class="avatar">🤖</div><div class="bubble ' + (type||"") + '">' + html + "</div>";
    convChatLog.appendChild(div);
    return div;
  }
  function updateConvBot(el, html, type) {
    if (!el) return;
    var b = el.querySelector(".bubble");
    if (!b) return;
    b.innerHTML = html;
    if (type) b.className = "bubble " + type;
  }

  async function getFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    var ffmpegMod = await import("https://esm.sh/@ffmpeg/ffmpeg@0.12.10");
    var utilMod = await import("https://esm.sh/@ffmpeg/util@0.12.1");
    var ff = new ffmpegMod.FFmpeg();
    await ff.load({
      coreURL: await utilMod.toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js", "text/javascript"),
      wasmURL: await utilMod.toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm", "application/wasm")
    });
    ffmpegInstance = ff;
    return ff;
  }

  function setFile(file) {
    if (!file) return;
    if (!/\.webm$/i.test(file.name) && file.type !== "video/webm") {
      clearConvChat(); addConvBot("❌ Sadece .webm kabul edilir.", "err"); return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      clearConvChat(); addConvBot("❌ Dosya çok büyük. Max " + MAX_MB + " MB.", "err"); return;
    }
    selectedFile = file;
    var mb = (file.size / 1024 / 1024).toFixed(2);
    convFileInfo.innerHTML = "📎 <b>" + escapeHtml(file.name) + '</b><span class="meta">' + mb + " MB</span>";
    dropTitle.textContent = "✅ Dosya hazır";
    dropSub.textContent = "Değiştirmek için tıkla";
    convertBtn.disabled = false;
    convResult.hidden = true;
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function (e) { setFile(e.target.files[0]); });
    dropZone.addEventListener("dragover", function (e) { e.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", function (e) { e.preventDefault(); dropZone.classList.remove("dragover"); });
    dropZone.addEventListener("drop", function (e) {
      e.preventDefault(); dropZone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    });
  }

  async function donustur() {
    if (!selectedFile) return;

    clearConvChat();
    convertBtn.disabled = true;
    convertBtn.textContent = "🎬 Dönüştürülüyor...";
    convResult.hidden = true;

    var m1 = addConvBot('<span class="spinner"></span> 📥 Dosya alındı...');
    await sleep(250);
    updateConvBot(m1, "📥 Dosya alındı ✓ <small>(" + escapeHtml(selectedFile.name) + ")</small>");

    var m2 = addConvBot('<span class="spinner"></span> 🧠 ffmpeg motoru yükleniyor...<br><small>İlk seferde ~25 MB.</small>');

    var t0 = performance.now();
    var ff;
    try { ff = await getFFmpeg(); }
    catch (e) {
      updateConvBot(m2, "❌ Motor yüklenemedi: <code>" + escapeHtml(e.message || e) + "</code>", "err");
      convertBtn.disabled = false; convertBtn.textContent = "🎬 MP4'e Dönüştür"; return;
    }
    var motorSn = ((performance.now() - t0) / 1000).toFixed(1);
    updateConvBot(m2, "🧠 Motor hazır ✓ <small>(" + motorSn + " sn)</small>");

    var m3 = addConvBot('<span class="spinner"></span> 🔄 MP4\'e dönüştürülüyor...<div class="big-bar"><div style="width:0%"></div></div>');
    var bigFill = m3 ? m3.querySelector(".big-bar > div") : null;

    var onProgress = function (data) {
      var pct = Math.min(100, Math.max(0, Math.round((data.progress || 0) * 100)));
      if (bigFill) bigFill.style.width = pct + "%";
      updateConvBot(m3, "🔄 MP4'e dönüştürülüyor... %" + pct + '<div class="big-bar"><div style="width:' + pct + '%"></div></div>');
      convertBtn.textContent = "🎬 Dönüştürülüyor... %" + pct;
    };
    ff.on("progress", onProgress);

    var mp4Blob;
    try {
      var utilMod = await import("https://esm.sh/@ffmpeg/util@0.12.1");
      await ff.writeFile("input.webm", await utilMod.fetchFile(selectedFile));
      await ff.exec([
        "-i", "input.webm",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        "output.mp4"
      ]);
      var data = await ff.readFile("output.mp4");
      mp4Blob = new Blob([data.buffer], { type: "video/mp4" });
      try { await ff.deleteFile("input.webm"); } catch (x) {}
      try { await ff.deleteFile("output.mp4"); } catch (x) {}
    } catch (e) {
      updateConvBot(m3, "❌ Dönüşüm hatası: <code>" + escapeHtml(e.message || e) + "</code>", "err");
      convertBtn.disabled = false; convertBtn.textContent = "🎬 MP4'e Dönüştür"; return;
    } finally {
      try { ff.off("progress", onProgress); } catch (x) {}
    }

    updateConvBot(m3, "🔄 Dönüştürme tamamlandı ✓");

    var m4 = addConvBot('<span class="spinner"></span> 💾 MP4 hazırlanıyor...');
    await sleep(250);
    var mb = (mp4Blob.size / 1024 / 1024).toFixed(2);
    updateConvBot(m4, "✅ MP4 hazır! <small>(" + mb + " MB)</small>", "ok");

    var url = URL.createObjectURL(mp4Blob);
    var baseName = selectedFile.name.replace(/\.webm$/i, "");
    convDlBtn.href = url;
    convDlBtn.download = baseName + ".mp4";
    convResult.hidden = false;

    addConvBot("İndirmek için alttaki ⬇️ butonuna bas.", "ok");
    convertBtn.disabled = false;
    convertBtn.textContent = "🎬 MP4'e Dönüştür";
  }

  if (convertBtn) convertBtn.addEventListener("click", donustur);

  console.log("✅ OsCodeVideo hazır");

})();
