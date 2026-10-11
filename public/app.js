(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ==================== AYARLAR ==================== */
  var FPS = 30;
  var MAX_SURE = 60;
  var WATERMARK_MS = 5000;
  var BOYUTLAR = {
    "16:9": { w: 1280, h: 720 },
    "9:16": { w: 720,  h: 1280 },
    "1:1":  { w: 1080, h: 1080 }
  };
  var aktifBoyut = "16:9";
  var W = 1280, H = 720;
  var LS_KEY = "oscodevideo_kod_v1";

  /* ==================== ELEMENTLER ==================== */
  var codeInput    = $("codeInput");
  var generateBtn  = $("generateBtn");
  var clearBtn     = $("clearBtn");
  var howBtn       = $("howBtn");
  var canvas       = $("renderCanvas");
  var previewVideo = $("previewVideo");
  var resultSec    = $("resultSection");
  var downloadBtn  = $("downloadBtn");
  var chatLog      = $("chatLog");
  var welcomeMsg   = $("welcomeMsg");
  var progressBar  = $("progressBar");
  var progressFill = $("progressFill");
  var sureBilgi    = $("sureBilgi");
  var stage        = document.querySelector(".stage");

  var howModal     = $("howModal");
  var modalClose   = $("modalClose");
  var copyBtn      = $("copyBtn");
  var promptText   = $("promptText");

  var ctx = canvas ? canvas.getContext("2d") : null;

  /* ==================== MODAL (Nasıl yapılır) ==================== */
  function openModal() {
    if (!howModal) return;
    howModal.classList.add("show");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    if (!howModal) return;
    howModal.classList.remove("show");
    document.body.style.overflow = "";
    if (copyBtn) {
      copyBtn.classList.remove("ok");
      copyBtn.textContent = "📋 Kopyala";
    }
  }

  if (howBtn) howBtn.addEventListener("click", openModal);
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (howModal) {
    howModal.addEventListener("click", function (e) {
      if (e.target === howModal) closeModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  if (copyBtn && promptText) {
    copyBtn.addEventListener("click", async function () {
      var text = promptText.textContent || promptText.innerText;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // iOS Safari fallback
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        copyBtn.classList.add("ok");
        copyBtn.textContent = "✅ Kopyalandı!";
        setTimeout(function () {
          copyBtn.classList.remove("ok");
          copyBtn.textContent = "📋 Kopyala";
        }, 2000);
      } catch (e) {
        copyBtn.textContent = "❌ Kopyalanamadı";
        setTimeout(function () {
          copyBtn.textContent = "📋 Kopyala";
        }, 2000);
      }
    });
  }

  /* ==================== BOYUT SEÇİCİ ==================== */
  function boyutUygula() {
    var b = BOYUTLAR[aktifBoyut];
    W = b.w; H = b.h;
    if (canvas) { canvas.width = W; canvas.height = H; }
    if (stage) stage.style.aspectRatio = W + " / " + H;
    drawIdle();
  }

  var boyutBtns = $$("[data-size]");
  for (var bi = 0; bi < boyutBtns.length; bi++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        for (var j = 0; j < boyutBtns.length; j++) boyutBtns[j].classList.remove("active");
        btn.classList.add("active");
        aktifBoyut = btn.getAttribute("data-size");
        boyutUygula();
      });
    })(boyutBtns[bi]);
  }

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
    "@4s\narkaplan('#0f1117');\ndikdortgen(0, H - 100, W, 100, '#232838');\nconst zipla = Math.abs(Math.sin(t * Math.PI * 4)) * 300;\nda里(W/2, H - 150 - zipla, 50, '#ff6b35');",
    "@3s\narkaplan('#0f1117');\nyazi('OsCodeVideo', W/2, H/2, 80, '#6c8cff');",
    "@5s\narkaplan('#0f1117');\nconst x = 100 + t * (W - 200);\nemoji('🚀', x, H/2, 120);",
    "@4s\narkaplan('#0f1117');\nconst s = 1 + Math.sin(t * Math.PI * 4) * 0.15;\nkalp(W/2, H/2 - 50, 150 * s, '#ff3b6b');",
    "@2s\narkaplan('#ff6b35');\nyazi('Merhaba!', W/2, H/2, 90, '#fff');\n---\n@2s\narkaplan('#6c8cff');\nyazi('OsCodeVideo', W/2, H/2, 90, '#fff');\n---\n@2s\narkaplan('#22c55e');\nyazi('Hoş geldin!', W/2, H/2, 90, '#fff');",
    "@4s\narkaplan('#0f1117');\ndaktilo('OsCodeVideo', W/2, H/2, 80, '#6c8cff');"
  ];

  for (var ofx = 0; ofx < ORNEKLER.length; ofx++) {
    ORNEKLER[ofx] = ORNEKLER[ofx].split("da里").join("daire");
  }

  var exBtns = $$("[data-ex]");
  for (var ei = 0; ei < exBtns.length; ei++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-ex"), 10);
        if (codeInput && ORNEKLER[idx] !== undefined) {
          codeInput.value = ORNEKLER[idx];
          kodKaydet();
          sureGuncelle();
        }
      });
    })(exBtns[ei]);
  }

  /* ==================== KOD KAYDETME ==================== */
  function kodKaydet() {
    try { localStorage.setItem(LS_KEY, codeInput.value); } catch (e) {}
  }
  function kodYukle() {
    try {
      var k = localStorage.getItem(LS_KEY);
      if (k) codeInput.value = k;
    } catch (e) {}
  }

  if (codeInput) {
    var inputTimer = null;
    codeInput.addEventListener("input", function () {
      if (inputTimer) clearTimeout(inputTimer);
      inputTimer = setTimeout(function () {
        kodKaydet();
        sureGuncelle();
      }, 300);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!confirm("Kodu temizlemek istediğine emin misin?")) return;
      codeInput.value = "@5s\n";
      kodKaydet();
      sureGuncelle();
    });
  }

  /* ==================== PARSE & SÜRE ==================== */
  function parseCode(raw) {
    var duration = 5;
    var m = raw.match(/@(\d+(?:[.,]\d+)?)s?\b/);
    if (m) {
      duration = parseFloat(m[1].replace(",", "."));
      raw = raw.replace(m[0], "");
    }
    return { duration: duration, code: raw.trim() };
  }

  function parseSahneler(raw) {
    var parcalar = raw.split(/^---\s*$/m);
    var sahneler = [];
    var toplamSure = 0;
    for (var i = 0; i < parcalar.length; i++) {
      var p = parcalar[i].trim();
      if (!p) continue;
      var parsed = parseCode(p);
      if (parsed.code === "") continue;
      sahneler.push(parsed);
      toplamSure += parsed.duration;
    }
    return { sahneler: sahneler, toplamSure: toplamSure };
  }

  function sureGuncelle() {
    if (!sureBilgi || !codeInput) return;
    var r = parseSahneler(codeInput.value);
    sureBilgi.textContent = "~" + r.toplamSure.toFixed(1) + " sn";
    if (r.toplamSure > MAX_SURE) sureBilgi.style.color = "#ef4444";
    else sureBilgi.style.color = "";
  }

  /* ==================== HELPERS ==================== */
  var imgCache = {};
  var state = { t: 0 };

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
      },
      yildiz: function (x, y, r, nokta, renk) {
        nokta = nokta || 5; r = r || 40;
        ctx.fillStyle = renk || "#ffd700";
        ctx.beginPath();
        for (var i = 0; i < nokta * 2; i++) {
          var rr = i % 2 === 0 ? r : r * 0.4;
          var a = (Math.PI / nokta) * i - Math.PI / 2;
          var px = x + Math.cos(a) * rr;
          var py = y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      },
      kalp: function (x, y, boyut, renk) {
        var s = (boyut || 100) / 100;
        ctx.fillStyle = renk || "#ff3b6b";
        ctx.beginPath();
        ctx.moveTo(x, y + 30 * s);
        ctx.bezierCurveTo(x, y - 10 * s, x - 60 * s, y - 10 * s, x - 60 * s, y + 30 * s);
        ctx.bezierCurveTo(x - 60 * s, y + 70 * s, x, y + 90 * s, x, y + 110 * s);
        ctx.bezierCurveTo(x, y + 90 * s, x + 60 * s, y + 70 * s, x + 60 * s, y + 30 * s);
        ctx.bezierCurveTo(x + 60 * s, y - 10 * s, x, y - 10 * s, x, y + 30 * s);
        ctx.fill();
      },
      ucgen: function (x1, y1, x2, y2, x3, y3, renk) {
        ctx.fillStyle = renk || "#fff";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
      },
      ok: function (x1, y1, x2, y2, renk, kalinlik) {
        var angle = Math.atan2(y2 - y1, x2 - x1);
        var len = Math.hypot(x2 - x1, y2 - y1);
        var headLen = Math.min(40, len * 0.35);
        kalinlik = kalinlik || 5;
        ctx.strokeStyle = renk || "#fff";
        ctx.fillStyle = renk || "#fff";
        ctx.lineWidth = kalinlik;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        var bx = x2 - Math.cos(angle) * headLen * 0.85;
        var by = y2 - Math.sin(angle) * headLen * 0.85;
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - Math.cos(angle - 0.4) * headLen, y2 - Math.sin(angle - 0.4) * headLen);
        ctx.lineTo(x2 - Math.cos(angle + 0.4) * headLen, y2 - Math.sin(angle + 0.4) * headLen);
        ctx.closePath();
        ctx.fill();
      },
      cokgen: function (x, y, r, kenar, renk) {
        kenar = kenar || 6; r = r || 50;
        ctx.fillStyle = renk || "#fff";
        ctx.beginPath();
        for (var i = 0; i < kenar; i++) {
          var a = (Math.PI * 2 / kenar) * i - Math.PI / 2;
          var px = x + Math.cos(a) * r;
          var py = y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      },
      emoji: function (karakter, x, y, boyut) {
        boyut = boyut || 64;
        ctx.font = boyut + "px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(karakter, x, y);
      },
      resim: function (url, x, y, w, h) {
        var img = imgCache[url];
        if (!img) {
          img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
          imgCache[url] = img;
          return;
        }
        if (!img.complete || img.naturalWidth === 0) return;
        ctx.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight);
      },
      daktilo: function (metin, x, y, boyut, renk) {
        boyut = boyut || 32;
        var n = Math.floor(state.t * metin.length);
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + boyut + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(metin.slice(0, n), x, y);
      },
      kaydir: function (metin, x, y, boyut, renk) {
        boyut = boyut || 32;
        var kaydirma = (1 - state.t) * (W * 0.8);
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + boyut + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(metin, x - kaydirma, y);
      },
      yukariCik: function (metin, x, y, boyut, renk) {
        boyut = boyut || 32;
        var kaydirma = (1 - state.t) * (H * 0.4);
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + boyut + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(metin, x, y + kaydirma);
      }
    };
  }

  function compile(code) {
    return new Function(
      "ctx", "t", "kare", "sure", "W", "H", "yardimci",
      '"use strict";' +
      'var arkaplan=yardimci.arkaplan,daire=yardimci.daire,' +
      'dikdortgen=yardimci.dikdortgen,yazi=yardimci.yazi,cizgi=yardimci.cizgi,' +
      'yildiz=yardimci.yildiz,kalp=yardimci.kalp,ucgen=yardimci.ucgen,' +
      'ok=yardimci.ok,cokgen=yardimci.cokgen,emoji=yardimci.emoji,' +
      'resim=yardimci.resim,daktilo=yardimci.daktilo,kaydir=yardimci.kaydir,' +
      'yukariCik=yardimci.yukariCik;' +
      code
    );
  }

  /* ==================== WATERMARK ==================== */
  function watermarkCiz(globalElapsedMs, toplamMs) {
    var kalanMs = toplamMs - globalElapsedMs;
    if (kalanMs > WATERMARK_MS) return;
    if (kalanMs < 0) return;

    var elapsedSn = globalElapsedMs / 1000;
    var alpha = 0.25 + Math.sin(elapsedSn * 10) * 0.1;

    var boyut = Math.round(Math.min(W, H) * 0.11);
    if (boyut < 30) boyut = 30;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#00d9ff";
    ctx.shadowBlur = Math.round(boyut * 0.5);
    ctx.fillStyle = "#00d9ff";
    ctx.font = "bold " + boyut + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OsCodeVideo", W / 2, H / 2);
    ctx.restore();
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

  /* ==================== iOS ==================== */
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
      try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
    }
    return "";
  }

  /* ==================== ÜRETİM ==================== */
  async function uret() {
    if (!codeInput || !canvas || !ctx) return;

    var raw = codeInput.value.trim();
    if (!raw) { addBotMessage("⚠️ Kod boş.", "err"); return; }

    var analiz = parseSahneler(raw);
    if (analiz.sahneler.length === 0) {
      addBotMessage("⚠️ Geçerli sahne bulunamadı.", "err"); return;
    }
    if (analiz.toplamSure < 1) {
      addBotMessage("⚠️ Toplam süre en az 1 saniye olmalı.", "err"); return;
    }
    if (analiz.toplamSure > MAX_SURE) {
      addBotMessage("⚠️ Toplam süre " + MAX_SURE + " saniyeyi geçemez (şu an: " + analiz.toplamSure.toFixed(1) + " sn).", "err");
      return;
    }

    var derlenmis = [];
    for (var i = 0; i < analiz.sahneler.length; i++) {
      try {
        derlenmis.push({
          fn: compile(analiz.sahneler[i].code),
          duration: analiz.sahneler[i].duration
        });
      } catch (e) {
        addBotMessage("❌ Sahne " + (i+1) + " kod hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
        return;
      }
    }

    if (typeof MediaRecorder === "undefined") {
      addBotMessage("❌ Tarayıcın video kaydını desteklemiyor.", "err"); return;
    }
    if (!canvas.captureStream) {
      addBotMessage("❌ Tarayıcın canvas kaydını desteklemiyor.", "err"); return;
    }

    var mime = pickMime();
    if (!mime) { addBotMessage("❌ Uygun format bulunamadı.", "err"); return; }
    var ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";

    clearVideoChat();
    generateBtn.disabled = true;
    previewVideo.hidden = true;
    resultSec.hidden = true;
    canvas.style.display = "block";
    progressBar.hidden = false;
    progressFill.style.width = "0%";
    generateBtn.textContent = "⚡ Üretiliyor...";

    var sahneSayisi = derlenmis.length;
    var m1 = addBotMessage('<span class="spinner"></span> 📥 ' + sahneSayisi + ' sahne analiz ediliyor...');
    await sleep(300);
    updateMessage(m1, "📥 " + sahneSayisi + " sahne analiz edildi ✓");

    var m2 = addBotMessage('<span class="spinner"></span> 🎨 Sahne hazırlanıyor...');
    await sleep(250);
    updateMessage(m2, "🎨 Sahne hazır ✓");

    var m3 = addBotMessage('<span class="spinner"></span> 🏃 Animasyon oynatılıyor...<div class="mini-bar"><div></div></div>');
    var miniFill = m3 ? m3.querySelector(".mini-bar > div") : null;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    state.t = 0;
    try {
      derlenmis[0].fn(ctx, 0, 0, derlenmis[0].duration, W, H, makeHelpers());
    } catch (e) {
      updateMessage(m3, "❌ Çalışma hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true; return;
    }

    await sleep(200);

    var stream, rec;
    try {
      stream = canvas.captureStream(FPS);
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch (e) {
      updateMessage(m3, "❌ MediaRecorder hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
      progressBar.hidden = true; return;
    }

    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    var stopped = false;
    var toplamMs = analiz.toplamSure * 1000;
    var blobPromise = new Promise(function (resolve, reject) {
      var killer = setTimeout(function () {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        reject(new Error("Zaman aşımı."));
      }, toplamMs + 20000);

      rec.onstop = function () {
        clearTimeout(killer);
        stopped = true;
        if (!chunks.length) { reject(new Error("Kayıt boş döndü. Tekrar dene.")); return; }
        resolve(new Blob(chunks, { type: mime }));
      };
      rec.onerror = function (e) {
        clearTimeout(killer);
        reject(new Error("Kayıt hatası: " + (e.error && e.error.name ? e.error.name : "?")));
      };
    });

    rec.start();
    await sleep(200);

    var startTime = performance.now();
    var helpers = makeHelpers();
    var frameNo = 0;

    function hangiSahne(elapsedMs) {
      var acc = 0;
      for (var i = 0; i < derlenmis.length; i++) {
        var sMs = derlenmis[i].duration * 1000;
        if (elapsedMs < acc + sMs) {
          return { idx: i, localT: (elapsedMs - acc) / sMs };
        }
        acc += sMs;
      }
      return { idx: derlenmis.length - 1, localT: 1 };
    }

    function tick() {
      var elapsed = performance.now() - startTime;
      var globalT = Math.min(1, elapsed / toplamMs);

      var hs = hangiSahne(elapsed);
      state.t = Math.max(0, Math.min(1, hs.localT));

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      try {
        derlenmis[hs.idx].fn(ctx, state.t, frameNo++, derlenmis[hs.idx].duration, W, H, helpers);
      } catch (e) {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        updateMessage(m3, "❌ Sahne " + (hs.idx+1) + " hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
        generateBtn.disabled = false; generateBtn.textContent = "⚡ Videoyu Oluştur";
        progressBar.hidden = true; return;
      }

      watermarkCiz(elapsed, toplamMs);

      var pct = Math.round(globalT * 100);
      progressFill.style.width = pct + "%";
      if (miniFill) miniFill.style.width = pct + "%";
      var kalan = Math.max(0, Math.ceil(analiz.toplamSure - elapsed / 1000));

      var sahneEtiket = sahneSayisi > 1 ? " [Sahne " + (hs.idx+1) + "/" + sahneSayisi + "]" : "";
      var wmEtiket = (toplamMs - elapsed) <= WATERMARK_MS ? " <small>🔷</small>" : "";
      updateMessage(m3,
        "🏃 Animasyon oynatılıyor" + sahneEtiket + "... %" + pct +
        " <small>(~" + kalan + " sn)</small>" + wmEtiket +
        '<div class="mini-bar"><div style="width:' + pct + '%"></div></div>'
      );
      generateBtn.textContent = "⚡ Üretiliyor... %" + pct;

      if (elapsed < toplamMs) {
        requestAnimationFrame(tick);
      } else if (!stopped) {
        setTimeout(function () {
          try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        }, 800);
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
      "✅ Video hazır! <small>(" + analiz.toplamSure.toFixed(1) + " sn • " +
      (blob.size / 1024 / 1024).toFixed(2) + " MB • ." + ext + ")</small>",
      "ok"
    );
    addBotMessage("🔷 Son 5 saniyeye <b>OsCodeVideo</b> imzası otomatik gömüldü.", "ok");
    addBotMessage("İndirmek için alttaki ⬇️ butonuna bas.", "ok");

    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
  }

  if (generateBtn) generateBtn.addEventListener("click", uret);

  /* ==================== BAŞLAT ==================== */
  boyutUygula();
  kodYukle();
  sureGuncelle();

  console.log("✅ OsCodeVideo hazır (v11 - nasıl yapılır?)");
})();
