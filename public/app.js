(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ==================== AYARLAR ==================== */
  var FPS = 30, W = 1280, H = 720, MAX_SURE = 30;

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

  /* ==================== SOHBET ==================== */
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

  /* ==================== ÖRNEKLER ==================== */
  var ORNEKLER = [
    "@5s\nconst x = 100 + t * 900;\nda里(x, 360, 50, '#ff6b35');",
    "@4s\narkaplan('#0f1117');\ndikdortgen(0, 620, 1280, 100, '#232838');\nconst zipla = Math.abs(Math.sin(t * Math.PI * 4)) * 300;\nda里(640, 570 - zipla, 50, '#ff6b35');",
    "@3s\narkaplan('#0f1117');\nconst metin = 'OsCodeVideo';\nconst n = Math.floor(t * metin.length * 1.5);\nyazi(metin.slice(0, n), 640, 360, 90, '#6c8cff');",
    "@4s\nconst r = Math.floor(255 * (1 - t));\nconst b = Math.floor(255 * t);\narkaplan('rgb(' + r + ', 60, ' + b + ')');\nyazi('OsCodeVideo', 640, 360, 80, '#ffffff');",
    "@5s\narkaplan('#0f1117');\nctx.save();\nctx.translate(640, 360);\nctx.rotate(t * Math.PI * 2);\nctx.fillStyle = '#ff6b35';\nctx.fillRect(-80, -80, 160, 160);\nctx.restore();"
  ];

  // DİKKAT: da里 yazım hatası var ama JS içinde string, çalışma etkilemez.
  // Ancak kullanıcı örneği seçince hata verir. Düzeltiyorum:
  for (var fix = 0; fix < ORNEKLER.length; fix++) {
    ORNEKLER[fix] = ORNEKLER[fix].split("da里").join("daire");
  }

  var exBtns = document.querySelectorAll("[data-ex]");
  for (var k = 0; k < exBtns.length; k++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-ex"), 10);
        if (codeInput && ORNEKLER[idx] !== undefined) {
          codeInput.value = ORNEKLER[idx];
        }
      });
    })(exBtns[k]);
  }

  /* ==================== DERLEYİCİ ==================== */
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
      arkaplan: function (renk) {
        ctx.fillStyle = renk || "#000";
        ctx.fillRect(0, 0, W, H);
      },
      daire: function (x, y, r, renk) {
        ctx.fillStyle = renk || "#fff";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      },
      dikdortgen: function (x, y, w, h, renk) {
        ctx.fillStyle = renk || "#fff";
        ctx.fillRect(x, y, w, h);
      },
      yazi: function (metin, x, y, boyut, renk) {
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + (boyut || 32) + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(metin, x, y);
      },
      cizgi: function (x1, y1, x2, y2, renk, kalinlik) {
        ctx.strokeStyle = renk || "#fff";
        ctx.lineWidth = kalinlik || 2;
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
      '"use strict";' +
      'var arkaplan=yardimci.arkaplan,daire=yardimci.daire,' +
      'dikdortgen=yardimci.dikdortgen,yazi=yardimci.yazi,cizgi=yardimci.cizgi;' +
      code
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

  /* ==================== iOS KONTROL ==================== */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function pickMime() {
    var iOS = isIOS();
    var list = iOS
      ? ["video/mp4", "video/mp4;codecs=avc1", "video/mp4;codecs=h264",
         "video/webm;codecs=vp8", "video/webm"]
      : ["video/webm;codecs=vp8", "video/webm;codecs=vp9",
         "video/webm", "video/mp4"];

    for (var i = 0; i < list.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(list[i])) return list[i];
      } catch (e) {}
    }
    return "";
  }

  /* ==================== ÜRETİM ==================== */
  async function uret() {
    if (!codeInput || !canvas || !ctx) return;

    var raw = codeInput.value.trim();
    if (!raw) { addBotMessage("⚠️ Kod boş.", "err"); return; }

    var p = parseCode(raw);
    var duration = p.duration, code = p.code;

    if (duration < 1 || duration > MAX_SURE) {
      addBotMessage("⚠️ Süre 1-" + MAX_SURE + " sn olmalı.", "err");
      return;
    }

    var userFn;
    try { userFn = compile(code); }
    catch (e) {
      addBotMessage("❌ Kod hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      addBotMessage("❌ Tarayıcın video kaydını desteklemiyor (iOS 14.5+ gerekli).", "err");
      return;
    }
    if (!canvas.captureStream) {
      addBotMessage("❌ Tarayıcın canvas kaydını desteklemiyor.", "err");
      return;
    }

    var mime = pickMime();
    if (!mime) {
      addBotMessage("❌ Uygun video formatı bulunamadı.", "err");
      return;
    }
    var ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";

    /* UI kilitle */
    clearVideoChat();
    generateBtn.disabled = true;
    previewVideo.hidden = true;
    resultSec.hidden = true;
    canvas.style.display = "block";
    progressBar.hidden = false;
    progressFill.style.width = "0%";
    generateBtn.textContent = "⚡ Üretiliyor...";

    var m1 = addBotMessage('<span class="spinner"></span> 📥 Kod analiz ediliyor...');
    await sleep(300);
    updateMessage(m1, "📥 Kod analiz edildi ✓");

    var m2 = addBotMessage('<span class="spinner"></span> 🎨 Sahne kuruluyor...');
    await sleep(250);
    updateMessage(m2, "🎨 Sahne hazır ✓");

    var m3 = addBotMessage('<span class="spinner"></span> 🏃 Animasyon oynatılıyor...<div class="mini-bar"><div></div></div>');
    var miniFill = m3 ? m3.querySelector(".mini-bar > div") : null;

    /* ---- iOS için kritik: İLK KAREYİ ÇİZ ---- */
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    try {
      userFn(ctx, 0, 0, duration, W, H, makeHelpers());
    } catch (e) {
      updateMessage(m3, "❌ Çalışma hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      generateBtn.disabled = false;
      generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true;
      return;
    }

    /* iOS'un canvas'ı görmesi için bekle */
    await sleep(200);

    /* ---- Stream + Recorder ---- */
    var stream, rec;
    try {
      stream = canvas.captureStream(FPS);   // otomatik FPS — iOS uyumlu
      var opts = { mimeType: mime };
      rec = new MediaRecorder(stream, opts);
    } catch (e) {
      updateMessage(m3, "❌ MediaRecorder hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      generateBtn.disabled = false;
      generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true;
      return;
    }

    var chunks = [];
    rec.ondataavailable = function (e) {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    var stopped = false;
    var blobPromise = new Promise(function (resolve, reject) {
      var killer = setTimeout(function () {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        reject(new Error("Zaman aşımı. Tekrar dene."));
      }, duration * 1000 + 15000);

      rec.onstop = function () {
        clearTimeout(killer);
        stopped = true;
        if (!chunks.length) {
          reject(new Error("Kayıt boş döndü. iOS'ta Safari ayarlarından 'Kamera/Mikrofon' izni gerekebilir."));
          return;
        }
        resolve(new Blob(chunks, { type: mime }));
      };
      rec.onerror = function (e) {
        clearTimeout(killer);
        reject(new Error("Kayıt hatası: " + (e.error && e.error.name ? e.error.name : "bilinmeyen")));
      };
    });

    /* Kaydı başlat */
    rec.start();

    /* iOS'un recorder'ı ısıtması için bekle */
    await sleep(200);

    /* Animasyon döngüsü */
    var startTime = performance.now();
    var durationMs = duration * 1000;
    var helpers = makeHelpers();
    var frameNo = 0;

    function tick() {
      var elapsed = performance.now() - startTime;
      var t = Math.min(1, elapsed / durationMs);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      try {
        userFn(ctx, t, frameNo++, duration, W, H, helpers);
      } catch (e) {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        updateMessage(m3, "❌ Çalışma hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
        generateBtn.disabled = false;
        generateBtn.textContent = "⚡ Videoyu Oluştur";
        progressBar.hidden = true;
        return;
      }

      var pct = Math.round(t * 100);
      progressFill.style.width = pct + "%";
      if (miniFill) miniFill.style.width = pct + "%";
      var kalan = Math.max(0, Math.ceil(duration - elapsed / 1000));

      updateMessage(m3,
        "🏃 Animasyon oynatılıyor... %" + pct +
        " <small>(~" + kalan + " sn)</small>" +
        '<div class="mini-bar"><div style="width:' + pct + '%"></div></div>'
      );
      generateBtn.textContent = "⚡ Üretiliyor... %" + pct;

      if (elapsed < durationMs) {
        requestAnimationFrame(tick);
      } else if (!stopped) {
        /* Bitince recorder'a biraz daha süre ver, sonra durdur */
        setTimeout(function () {
          try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        }, 800);
      }
    }
    requestAnimationFrame(tick);

    /* Blob'u bekle */
    var blob;
    try {
      blob = await blobPromise;
    } catch (e) {
      updateMessage(m3, "❌ " + escapeHtml(e.message), "err");
      generateBtn.disabled = false;
      generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true;
      return;
    }

    updateMessage(m3, "🏃 Animasyon tamamlandı ✓");

    var m4 = addBotMessage('<span class="spinner"></span> 💾 Video işleniyor...');
    await sleep(300);

    var url = URL.createObjectURL(blob);
    previewVideo.src = url;
    previewVideo.hidden = false;
    canvas.style.display = "none";
    progressBar.hidden = true;
    downloadBtn.href = url;
    downloadBtn.download = "oscodevideo-" + Date.now() + "." + ext;
    resultSec.hidden = false;

    updateMessage(m4,
      "✅ Video hazır! <small>(" + duration + " sn • " +
      (blob.size / 1024 / 1024).toFixed(2) + " MB • ." + ext + ")</small>",
      "ok"
    );
    addBotMessage("İndirmek için alttaki ⬇️ butonuna bas.", "ok");

    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
  }

  if (generateBtn) generateBtn.addEventListener("click", uret);

  console.log("✅ OsCodeVideo hazır");
})();
