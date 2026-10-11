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
  var FPS = 30, W = 1280, H = 720, MAX_SURE = 30, TIMEOUT_MS = 60000;

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
      if (msgsName[i] !== welcomeMsg) msgs[i].remove();
    = }
  }

  function addBotMessage "(html, type)bot {
    if (!chatLog) return null;
    var div = document.createElement("div");
    div.class-msg";
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

  /* -------- MIME seçimi (iOS uyumlu) -------- */
  function secMime() {
    if (typeof MediaRecorder === "undefined") return null;
    var list = [
      "video/mp4;codecs=h264",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp8",
      "video/webm;codecs=vp9",
      "video/webm"
    ];
    for (var i = 0; i < list.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(list[i])) return list[i];
      } catch (e) {}
    }
    return "";
  }

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

    if (typeof MediaRecorder === "undefined") {
      addBotMessage("❌ Tarayıcın video kaydını desteklemiyor (iOS 14.3+ gerekli).", "err");
      return;
    }

    var mime = secMime();
    if (mime === null) {
      addBotMessage("❌ Tarayıcın MediaRecorder desteklemiyor.", "err");
      return;
    }
    var ext = (mime.indexOf("mp4") >= 0) ? "mp4" : "webm";

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

    /* -------- Stream & Recorder -------- */
    var stream, rec;
    try {
      // iOS için otomatik FPS (manuel requestFrame yerine)
      stream = canvas.captureStream(FPS);

      var opts = { videoBitsPerSecond: 2500000 };
      if (mime) opts.mimeType = mime;
      rec = new MediaRecorder(stream, opts);
    } catch (err) {
      updateMessage(m3, "❌ MediaRecorder başlatılamadı: <code>" + escapeHtml(err.message) + "</code>", "err");
      generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true; return;
    }

    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    var blobPromise = new Promise(function (resolve, reject) {
      var killer = setTimeout(function () {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        reject(new Error("Zaman aşımı (" + (TIMEOUT_MS/1000) + " sn)."));
      }, TIMEOUT_MS);
      rec.onstop = function () {
        clearTimeout(killer);
        if (!chunks.length) { reject(new Error("Kayıt boş döndü. Tekrar dene.")); return; }
        resolve(new Blob(chunks, { type: mime || "video/webm" }));
      };
      rec.onerror = function () { clearTimeout(killer); reject(new Error("Kayıt hatası")); };
    });

    // iOS'ta ilk kareyi alması için kısa gecikme
    await sleep(150);
    rec.start(100); // her 100 ms'de veri

    var startTime = performance.now();
    var durationMs = duration * 1000;
    var helpers = makeHelpers();
    var frameNo = 0;
    var bitisGonderildi = false;

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

      var pct = Math.round(t * 100);
      progressFill.style.width = pct + "%";
      if (miniFill) miniFill.style.width = pct + "%";
      var kalan = Math.max(0, Math.ceil(duration - elapsed / 1000));
      updateMessage(m3,
        "🏃 Animasyon oynatılıyor... %" + pct + " <small>(~" + kalan + " sn)</small>" +
        '<div class="mini-bar"><div style="width:' + pct + '%"></div></div>'
      );
      generateBtn.textContent = "⚡ Üretiliyor... %" + pct;

      if (elapsed < durationMs) {
        requestAnimationFrame(tick);
      } else if (!bitisGonderildi) {
        bitisGonderildi = true;
        // Son kareyi sabitle + kayıt durdur
        setTimeout(function () {
          try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        }, 400);
      }
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
    downloadBtn.download = "oscodevideo-" + Date.now() + "." + ext;
    resultSec.hidden = false;

    updateMessage(m4, "✅ Video hazır! <small>(" + duration + " sn • " + (blob.size / 1024 / 1024).toFixed(2) + " MB • ." + ext + ")</small>", "ok");
    addBotMessage("İndirmek için alttaki ⬇️ butonuna bas.", "ok");

    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
  }

  if (generateBtn) generateBtn.addEventListener("click", uret);

  /* ==================== DÖNÜŞTÜRÜCÜ (SUNUCU) ==================== */
  var MAX_MB = 50;
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

  function setFile(file) {
    if (!file) return;
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

    var m1 = addConvBot('<span class="spinner"></span> 📥 Dosya sunucuya yükleniyor...<div class="big-bar"><div style="width:0%"></div></div>');
    var bigFill = m1 ? m1.querySelector(".big-bar > div") : null;

    var formData = new FormData();
    formData.append("file", selectedFile);

    var mp4Blob = await new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/convert");
      xhr.responseType = "blob";

      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var pct = Math.round(e.loaded / e.total * 100);
          if (bigFill) bigFill.style.width = pct + "%";
          updateConvBot(m1,
            "📥 Dosya sunucuya yükleniyor... %" + pct +
            '<div class="big-bar"><div style="width:' + pct + '%"></div></div>'
          );
          convertBtn.textContent = "🎬 Yükleniyor... %" + pct;
        }
      };

      xhr.onload = function () {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          // Hata mesajı JSON olabilir
          var reader = new FileReader();
          reader.onload = function () {
            var msg = "Sunucu hatası (" + xhr.status + ")";
            try {
              var j = JSON.parse(reader.result);
              if (j.error) msg += ": " + j.error;
            } catch (e) {}
            reject(new Error(msg));
          };
          reader.readAsText(xhr.response);
        }
      };

      xhr.onerror = function () { reject(new Error("Bağlantı hatası")); };
      xhr.ontimeout = function () { reject(new Error("Zaman aşımı")); };

      xhr.send(formData);
    }).catch(function (e) {
      updateConvBot(m1, "❌ " + escapeHtml(e.message), "err");
      convertBtn.disabled = false;
      convertBtn.textContent = "🎬 MP4'e Dönüştür";
      return null;
    });

    if (!mp4Blob) return;

    updateConvBot(m1, "📥 Yükleme tamam ✓");

    var m2 = addConvBot('<span class="spinner"></span> 💾 MP4 hazırlanıyor...');
    await sleep(250);

    // Yanıtın gerçekten mp4 olup olmadığını kontrol et
    if (mp4Blob.type && mp4Blob.type.indexOf("json") >= 0) {
      var text = await mp4Blob.text();
      updateConvBot(m2, "❌ Sunucu: <code>" + escapeHtml(text) + "</code>", "err");
      convertBtn.disabled = false;
      convertBtn.textContent = "🎬 MP4'e Dönüştür";
      return;
    }

    var mb = (mp4Blob.size / 1024 / 1024).toFixed(2);
    updateConvBot(m2, "✅ MP4 hazır! <small>(" + mb + " MB)</small>", "ok");

    var url = URL.createObjectURL(mp4Blob);
    var baseName = selectedFile.name.replace(/\.[^.]+$/, "");
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
