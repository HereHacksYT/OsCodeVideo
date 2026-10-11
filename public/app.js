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
  var LS_TEMA = "oscodevideo_tema";

  /* ==================== ELEMENTLER ==================== */
  var codeInput    = $("codeInput");
  var generateBtn  = $("generateBtn");
  var clearBtn     = $("clearBtn");
  var howBtn       = $("howBtn");
  var cancelBtn    = $("cancelBtn");
  var themeBtn     = $("themeBtn");
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
  var toast        = $("toast");
  var toastMsg     = $("toastMsg");
  var toastUndo    = $("toastUndo");

  var howModal     = $("howModal");
  var modalClose   = $("modalClose");
  var copyBtn      = $("copyBtn");
  var promptText   = $("promptText");

  var ctx = canvas ? canvas.getContext("2d") : null;

  /* ==================== TEMA ==================== */
  function temaUygula(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (themeBtn) themeBtn.textContent = t === "light" ? "☀️" : "🌙";
  }
  function temaYukle() {
    var t = "dark";
    try { t = localStorage.getItem(LS_TEMA) || "dark"; } catch (e) {}
    temaUygula(t);
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") || "dark";
      var yeni = cur === "dark" ? "light" : "dark";
      temaUygula(yeni);
      try { localStorage.setItem(LS_TEMA, yeni); } catch (e) {}
    });
  }

  /* ==================== TOAST ==================== */
  var toastTimer = null;
  function toastGoster(mesaj, undoFn) {
    if (!toast) return;
    toastMsg.textContent = mesaj;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);

    if (undoFn && toastUndo) {
      toastUndo.style.display = "";
      toastUndo.onclick = function () {
        undoFn();
        toastGizle();
      };
    } else if (toastUndo) {
      toastUndo.style.display = "none";
    }

    toastTimer = setTimeout(toastGizle, 5000);
  }
  function toastGizle() {
    if (toast) toast.classList.remove("show");
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  /* ==================== MODAL ==================== */
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
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus(); ta.select();
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
        setTimeout(function () { copyBtn.textContent = "📋 Kopyala"; }, 2000);
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
    "@5s\ngradient('#0a0a1a', '#1a0033', 'dikey');\nconst x = 100 + t * (W - 200);\nda里(x, H/2, 50, '#ff6b35');",
    "@4s\ngradient('#ff6b35', '#6c8cff', 'capraz');\nconst s = 1 + Math.sin(t * Math.PI * 4) * 0.15;\nkalp(W/2, H/2 - 50, 200 * s, '#fff');",
    "@4s\narkaplan('#0a0a1a');\nparcacik(W/2, H/2, 60, '#00d9ff', 4);\nparcacik(W/2, H/2, 30, '#ff6b35', 6);",
    "@4s\narkaplan('#0f1117');\ngolge('#00d9ff', 30, 0, 0);\nconst s = 1 + Math.sin(t * Math.PI * 4) * 0.15;\nyildiz(W/2, H/2, 150 * s, 5, '#00d9ff');\ngolgeKapat();",
    "@3s\ngradient('#ff6b35', '#6c8cff', 'capraz');\nyazi('Net', W/2, H/2 - 100, 60, '#fff');\nbulanikla(10);\nyazi('Bulanık', W/2, H/2 + 100, 60, '#fff');\nfiltreKapat();",
    "@4s\narkaplan('#0f1117');\nkonfeti(W/2, H/2, 60, 12);\nyildizPatlamasi(W/2, H/2, 200, '#ffd700');",
    "@2s\narkaplan('#0a0a1a');\nsimsek(200, 100, W - 200, H - 100, '#fff200', 6);\nyildizPatlamasi(W/2, H/2, 100, '#fff');",
    "@5s\narkaplan('#0f1117');\nconst b = Math.min(W, H) * 0.55;\nresim('https://i.ibb.co/JjPFLbcP/Os-Code-Video.png', W/2 - b/2, H/2 - b/2, b, b);",
    "@2s\ngradient('#ff6b35', '#ffd23f', 'dikey');\nyazi('Merhaba!', W/2, H/2, 90, '#fff');\n---\n@2s\ngradient('#6c8cff', '#a200ff', 'dikey');\nyazi('OsCodeVideo', W/2, H/2, 90, '#fff');\n---\n@2s\ngradient('#22c55e', '#16a34a', 'dikey');\nyazi('Hoş geldin!', W/2, H/2, 90, '#fff');",
    "@4s\ngradient('#0a0a1a', '#1a0033', 'capraz');\ndaktilo('OsCodeVideo', W/2, H/2, 80, '#00d9ff');"
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

  if (clearBtn && codeInput) {
    clearBtn.addEventListener("click", function () {
      var eskiKod = codeInput.value;
      if (!eskiKod || eskiKod.trim() === "@5s") {
        toastGoster("⚠️ Zaten boş");
        return;
      }
      codeInput.value = "@5s\n";
      kodKaydet();
      sureGuncelle();
      toastGoster("🗑️ Kod temizlendi", function () {
        codeInput.value = eskiKod;
        kodKaydet();
        sureGuncelle();
      });
    });
  }

  /* ==================== PARSE ==================== */
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

  /* ==================== TTS ==================== */
  var sesCtx = null;
  var sesDest = null;
  var sesCache = {};
  var sesKaynaklari = [];

  function sesKur() {
    if (sesCtx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      sesCtx = new AC();
      sesDest = sesCtx.createMediaStreamDestination();
      if (sesCtx.state === "suspended" && sesCtx.resume) sesCtx.resume();
    } catch (e) { sesCtx = null; sesDest = null; }
  }

  async function ttsGetir(metin, dil) {
    var key = metin + "|" + dil;
    if (sesCache[key]) return sesCache[key];
    if (!sesCtx) return null;
    var url = "https://translate.google.com/translate_tts?ie=UTF-8&q=" +
              encodeURIComponent(metin) + "&tl=" + encodeURIComponent(dil) +
              "&client=tw-ob&ttsspeed=1";
    try {
      var res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var buf = await res.arrayBuffer();
      var audioBuf = await new Promise(function (resolve, reject) {
        sesCtx.decodeAudioData(buf.slice(0),
          function (b) { resolve(b); },
          function (e) { reject(e); });
      });
      sesCache[key] = audioBuf;
      return audioBuf;
    } catch (e) {
      console.warn("TTS alınamadı:", metin, e);
      return null;
    }
  }

  async function sesleriOnYukle(code) {
    var re = /seslendir\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*(?:,\s*(['"])([^'"]*)\3\s*)?\)/g;
    var m;
    var list = [];
    while ((m = re.exec(code)) !== null) {
      var text = m[2].replace(/\\(.)/g, "$1");
      var dil = m[4] || "tr";
      var key = text + "|" + dil;
      if (!sesCache[key] && !list.some(function (x) { return x.key === key; })) {
        list.push({ text: text, dil: dil, key: key });
      }
    }
    for (var i = 0; i < list.length; i++) await ttsGetir(list[i].text, list[i].dil);
    return list.length;
  }

  function sesOynat(metin, dil) {
    if (!sesCtx || !sesDest) return;
    var audioBuf = sesCache[metin + "|" + dil];
    if (!audioBuf) return;
    try {
      var src = sesCtx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(sesDest);
      src.connect(sesCtx.destination);
      src.start(0);
      sesKaynaklari.push(src);
      src.onended = function () {
        var idx = sesKaynaklari.indexOf(src);
        if (idx >= 0) sesKaynaklari.splice(idx, 1);
      };
    } catch (e) {}
  }

  function sesleriDurdur() {
    for (var i = 0; i < sesKaynaklari.length; i++) {
      try { sesKaynaklari[i].stop(); } catch (e) {}
    }
    sesKaynaklari = [];
  }

  /* ==================== HELPERS ==================== */
  var imgCache = {};
  var state = { t: 0, seslendirilenler: {} };

  function makeHelpers() {
    return {
      arkaplan: function (renk) { ctx.fillStyle = renk || "#000"; ctx.fillRect(0, 0, W, H); },
      gradient: function (r1, r2, yon) {
        yon = yon || "dikey";
        var g;
        if (yon === "yatay") g = ctx.createLinearGradient(0, 0, W, 0);
        else if (yon === "capraz") g = ctx.createLinearGradient(0, 0, W, H);
        else g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, r1 || "#000");
        g.addColorStop(1, r2 || "#fff");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      },
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
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
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
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath(); ctx.fill();
      },
      ok: function (x1, y1, x2, y2, renk, kalinlik) {
        var angle = Math.atan2(y2 - y1, x2 - x1);
        var len = Math.hypot(x2 - x1, y2 - y1);
        var headLen = Math.min(40, len * 0.35);
        kalinlik = kalinlik || 5;
        ctx.strokeStyle = renk || "#fff"; ctx.fillStyle = renk || "#fff";
        ctx.lineWidth = kalinlik;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        var bx = x2 - Math.cos(angle) * headLen * 0.85;
        var by = y2 - Math.sin(angle) * headLen * 0.85;
        ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - Math.cos(angle - 0.4) * headLen, y2 - Math.sin(angle - 0.4) * headLen);
        ctx.lineTo(x2 - Math.cos(angle + 0.4) * headLen, y2 - Math.sin(angle + 0.4) * headLen);
        ctx.closePath(); ctx.fill();
      },
      cokgen: function (x, y, r, kenar, renk) {
        kenar = kenar || 6; r = r || 50;
        ctx.fillStyle = renk || "#fff";
        ctx.beginPath();
        for (var i = 0; i < kenar; i++) {
          var a = (Math.PI * 2 / kenar) * i - Math.PI / 2;
          var px = x + Math.cos(a) * r;
          var py = y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      },
      yildizPatlamasi: function (x, y, boyut, renk) {
        boyut = boyut || 80;
        ctx.strokeStyle = renk || "#fff"; ctx.lineWidth = 3; ctx.lineCap = "round";
        for (var i = 0; i < 12; i++) {
          var a = (Math.PI * 2 / 12) * i;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * boyut * 0.3, y + Math.sin(a) * boyut * 0.3);
          ctx.lineTo(x + Math.cos(a) * boyut, y + Math.sin(a) * boyut);
          ctx.stroke();
        }
      },
      konfeti: function (x, y, sayi, boyut) {
        sayi = sayi || 30; boyut = boyut || 10;
        var renkler = ["#ff6b35", "#f7931e", "#ffd23f", "#ee4266", "#6c8cff", "#22c55e"];
        for (var i = 0; i < sayi; i++) {
          var seed = i * 12.9898;
          var a = (Math.sin(seed) * 43758.5453 % 1) * Math.PI * 2;
          var r = Math.abs(Math.sin(seed * 2) * 43758.5453 % 1) * 200;
          var px = x + Math.cos(a) * r;
          var py = y + Math.sin(a) * r;
          ctx.fillStyle = renkler[i % renkler.length];
          ctx.save(); ctx.translate(px, py); ctx.rotate(a + t * 3);
          ctx.fillRect(-boyut / 2, -boyut / 4, boyut, boyut / 2);
          ctx.restore();
        }
      },
      simsek: function (x1, y1, x2, y2, renk, kalinlik) {
        kalinlik = kalinlik || 4;
        ctx.strokeStyle = renk || "#fff200"; ctx.lineWidth = kalinlik;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1);
        var segCount = 8;
        for (var i = 1; i < segCount; i++) {
          var p = i / segCount;
          var seed = i * 7.13 + t * 20;
          var mx = x1 + (x2 - x1) * p + (Math.sin(seed) * 43758.5453 % 1) * 40;
          var my = y1 + (y2 - y1) * p + (Math.sin(seed + 1) * 43758.5453 % 1) * 40;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(x2, y2); ctx.stroke();
      },
      bulut: function (x, y, boyut, renk) {
        boyut = boyut || 60;
        ctx.fillStyle = renk || "#fff";
        ctx.beginPath();
        ctx.arc(x, y, boyut, 0, Math.PI * 2);
        ctx.arc(x + boyut * 0.8, y + boyut * 0.2, boyut * 0.7, 0, Math.PI * 2);
        ctx.arc(x - boyut * 0.8, y + boyut * 0.2, boyut * 0.7, 0, Math.PI * 2);
        ctx.arc(x + boyut * 0.4, y - boyut * 0.5, boyut * 0.6, 0, Math.PI * 2);
        ctx.arc(x - boyut * 0.4, y - boyut * 0.5, boyut * 0.6, 0, Math.PI * 2);
        ctx.fill();
      },
      gunes: function (x, y, yaricap, renk) {
        yaricap = yaricap || 60; renk = renk || "#ffd700";
        ctx.fillStyle = renk;
        ctx.beginPath(); ctx.arc(x, y, yaricap, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = renk; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (var i = 0; i < 12; i++) {
          var a = (Math.PI * 2 / 12) * i;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * yaricap * 1.3, y + Math.sin(a) * yaricap * 1.3);
          ctx.lineTo(x + Math.cos(a) * yaricap * 1.8, y + Math.sin(a) * yaricap * 1.8);
          ctx.stroke();
        }
      },
      emoji: function (karakter, x, y, boyut) {
        boyut = boyut || 64;
        ctx.font = boyut + "px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(karakter, x, y);
      },
      resim: function (url, x, y, w, h) {
        var img = imgCache[url];
        if (!img) {
          img = new Image();
          img.crossOrigin = "anonymous";
          img.onerror = function () { img.__hata = true; };
          img.src = url; imgCache[url] = img; return;
        }
        if (img.__hata) {
          ctx.fillStyle = "#ff6b35"; ctx.fillRect(x, y, w || 200, h || 200);
          ctx.fillStyle = "#fff"; ctx.font = "bold 16px system-ui";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("Resim yüklenemedi", x + (w || 200) / 2, y + (h || 200) / 2);
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
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(metin.slice(0, n), x, y);
      },
      kaydir: function (metin, x, y, boyut, renk) {
        boyut = boyut || 32;
        var kaydirma = (1 - state.t) * (W * 0.8);
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + boyut + "px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(metin, x - kaydirma, y);
      },
      yukariCik: function (metin, x, y, boyut, renk) {
        boyut = boyut || 32;
        var kaydirma = (1 - state.t) * (H * 0.4);
        ctx.fillStyle = renk || "#fff";
        ctx.font = "bold " + boyut + "px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(metin, x, y + kaydirma);
      },
      golge: function (renk, blur, xo, yo) {
        ctx.shadowColor = renk || "#000"; ctx.shadowBlur = blur || 10;
        ctx.shadowOffsetX = xo || 0; ctx.shadowOffsetY = yo || 0;
      },
      golgeKapat: function () {
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      },
      bulanikla: function (miktar) { ctx.filter = "blur(" + (miktar || 5) + "px)"; },
      siyahBeyaz: function () { ctx.filter = "grayscale(1)"; },
      sepya: function () { ctx.filter = "sepia(1)"; },
      filtreKapat: function () { ctx.filter = "none"; },
      titre: function (miktar) {
        miktar = miktar || 3;
        ctx.translate((Math.random() - 0.5) * miktar, (Math.random() - 0.5) * miktar);
      },
      parcacik: function (x, y, sayi, renk, boyut) {
        sayi = sayi || 20; boyut = boyut || 3;
        ctx.fillStyle = renk || "#fff";
        for (var i = 0; i < sayi; i++) {
          var seed = i * 12.9898;
          var a = (Math.sin(seed) * 43758.5453 % 1) * Math.PI * 2;
          var r = Math.abs(Math.sin(seed * 2) * 43758.5453 % 1) * 120;
          var px = x + Math.cos(a) * r;
          var py = y + Math.sin(a) * r;
          var b = Math.abs(Math.sin(seed * 3) * 43758.5453 % 1) * boyut + 1;
          ctx.beginPath(); ctx.arc(px, py, b, 0, Math.PI * 2); ctx.fill();
        }
      },
      renk: function (isim) {
        var paletler = {
          neon: ["#00fff0", "#ff00e6", "#a200ff", "#00ff89", "#fff200"],
          gunbatimi: ["#ff6b35", "#f7931e", "#ffd23f", "#ee4266", "#3d1e6d"],
          okyanus: ["#001f3f", "#0074d9", "#39cccc", "#7fdbff", "#b5e7ff"],
          ates: ["#ff0000", "#ff4500", "#ff6b35", "#ffa500", "#ffd700"],
          orman: ["#1b4332", "#2d6a4f", "#40916c", "#52b788", "#95d5b2"],
          pastel: ["#ffd6e0", "#ffefcf", "#d4f1f4", "#e0d4f4", "#d4f4e4"],
          gece: ["#0a0c12", "#131722", "#1a1f2e", "#232838", "#6c8cff"],
          altin: ["#b8860b", "#daa520", "#ffd700", "#ffed4e", "#fff8dc"]
        };
        var p = paletler[(isim || "").toLowerCase()] || paletler.neon;
        return p.slice();
      },
      seslendir: function (metin, dil) {
        dil = dil || "tr";
        var key = metin + "|" + dil;
        if (state.seslendirilenler[key]) return;
        state.seslendirilenler[key] = true;
        sesOynat(metin, dil);
      }
    };
  }

  function compile(code) {
    return new Function(
      "ctx", "t", "kare", "sure", "W", "H", "yardimci",
      '"use strict";' +
      'var arkaplan=yardimci.arkaplan,gradient=yardimci.gradient,' +
      'daire=yardimci.daire,dikdortgen=yardimci.dikdortgen,' +
      'yazi=yardimci.yazi,cizgi=yardimci.cizgi,' +
      'yildiz=yardimci.yildiz,kalp=yardimci.kalp,ucgen=yardimci.ucgen,' +
      'ok=yardimci.ok,cokgen=yardimci.cokgen,' +
      'yildizPatlamasi=yardimci.yildizPatlamasi,konfeti=yardimci.konfeti,' +
      'simsek=yardimci.simsek,bulut=yardimci.bulut,gunes=yardimci.gunes,' +
      'emoji=yardimci.emoji,resim=yardimci.resim,' +
      'daktilo=yardimci.daktilo,kaydir=yardimci.kaydir,' +
      'yukariCik=yardimci.yukariCik,' +
      'golge=yardimci.golge,golgeKapat=yardimci.golgeKapat,' +
      'bulanikla=yardimci.bulanikla,siyahBeyaz=yardimci.siyahBeyaz,' +
      'sepya=yardimci.sepya,filtreKapat=yardimci.filtreKapat,' +
      'titre=yardimci.titre,parcacik=yardimci.parcacik,renk=yardimci.renk,' +
      'seslendir=yardimci.seslendir;' +
      code
    );
  }

  async function resimleriOnYukle(code) {
    var re = /resim\s*\(\s*['"]([^'"]+)['"]/g;
    var m;
    var promises = [];
    while ((m = re.exec(code)) !== null) {
      (function (url) {
        if (imgCache[url] && imgCache[url].complete) return;
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onerror = function () { img.__hata = true; };
        img.src = url; imgCache[url] = img;
        promises.push(new Promise(function (resolve) {
          img.onload = resolve; img.onerror = resolve;
          setTimeout(resolve, 5000);
        }));
      })(m[1]);
    }
    return Promise.all(promises);
  }

  function watermarkCiz(globalElapsedMs, toplamMs) {
    var kalanMs = toplamMs - globalElapsedMs;
    if (kalanMs < 0) return;
    var gostermeSuresi = Math.min(WATERMARK_MS, toplamMs);
    if (kalanMs > gostermeSuresi) return;
    var elapsedSn = globalElapsedMs / 1000;
    var alpha = 0.42 + Math.sin(elapsedSn * 5) * 0.08;
    var boyut = Math.round(Math.min(W, H) * 0.11);
    if (boyut < 32) boyut = 32;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = Math.round(boyut * 0.25);
    ctx.fillStyle = "#00d9ff";
    ctx.font = "bold " + boyut + "px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("OsCodeVideo", W / 2, H / 2);
    ctx.restore();
  }

  function drawIdle() {
    if (!ctx) return;
    ctx.fillStyle = "#0a0c12"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#232838"; ctx.font = "bold 42px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎬 Önizleme", W / 2, H / 2);
  }

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

  var iptalEdildi = false;
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () { iptalEdildi = true; });
  }

  async function uret() {
    if (!codeInput || !canvas || !ctx) return;
    var raw = codeInput.value.trim();
    if (!raw) { addBotMessage("⚠️ Kod boş.", "err"); return; }

    var analiz = parseSahneler(raw);
    if (analiz.sahneler.length === 0) { addBotMessage("⚠️ Geçerli sahne yok.", "err"); return; }
    if (analiz.toplamSure < 1) { addBotMessage("⚠️ Süre en az 1 sn olmalı.", "err"); return; }
    if (analiz.toplamSure > MAX_SURE) { addBotMessage("⚠️ Süre " + MAX_SURE + " sn'yi geçemez.", "err"); return; }

    var derlenmis = [];
    for (var i = 0; i < analiz.sahneler.length; i++) {
      try {
        derlenmis.push({ fn: compile(analiz.sahneler[i].code), duration: analiz.sahneler[i].duration });
      } catch (e) {
        addBotMessage("❌ Sahne " + (i+1) + " hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
        return;
      }
    }

    if (typeof MediaRecorder === "undefined") { addBotMessage("❌ Tarayıcın MediaRecorder desteklemiyor.", "err"); return; }
    if (!canvas.captureStream) { addBotMessage("❌ Tarayıcın canvas kaydını desteklemiyor.", "err"); return; }

    var mime = pickMime();
    if (!mime) { addBotMessage("❌ Uygun format yok.", "err"); return; }
    var ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";

    iptalEdildi = false;
    clearVideoChat();
    generateBtn.disabled = true;
    if (cancelBtn) cancelBtn.hidden = false;
    previewVideo.hidden = true;
    resultSec.hidden = true;
    canvas.style.display = "block";
    progressBar.hidden = false;
    progressFill.style.width = "0%";
    generateBtn.textContent = "⚡ Üretiliyor...";

    var sahneSayisi = derlenmis.length;
    sesKur();

    var m1;
    var resimVar = /resim\s*\(/.test(raw);
    var sesVar = /seslendir\s*\(/.test(raw);

    if (resimVar || sesVar) {
      m1 = addBotMessage('<span class="spinner"></span> ' +
        (resimVar ? '🖼️ Resimler ' : '') +
        (resimVar && sesVar ? 've ' : '') +
        (sesVar ? '🔊 ses dosyaları ' : '') +
        'yükleniyor...');

      if (resimVar) await resimleriOnYukle(raw);
      if (sesVar) await sesleriOnYukle(raw);
      updateMessage(m1, "Hazırlık tamam ✓");
    } else {
      m1 = addBotMessage('<span class="spinner"></span> 📥 Analiz ediliyor...');
      await sleep(250);
      updateMessage(m1, "📥 Analiz tamam ✓");
    }

    if (iptalEdildi) { uretimBitti(); return; }

    var m2 = addBotMessage('<span class="spinner"></span> 🎨 Sahne kuruluyor...');
    await sleep(250);
    updateMessage(m2, "🎨 Sahne hazır ✓");

    if (iptalEdildi) { uretimBitti(); return; }

    var m3 = addBotMessage('<span class="spinner"></span> 🏃 Animasyon...<div class="mini-bar"><div></div></div>');
    var miniFill = m3 ? m3.querySelector(".mini-bar > div") : null;

    state.seslendirilenler = {};
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    state.t = 0;
    try {
      derlenmis[0].fn(ctx, 0, 0, derlenmis[0].duration, W, H, makeHelpers());
    } catch (e) {
      updateMessage(m3, "❌ Çalışma hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      uretimBitti(); progressBar.hidden = true; return;
    }

    await sleep(200);

    var stream, rec;
    try {
      var canvasStream = canvas.captureStream(FPS);
      var tracks = [];
      canvasStream.getVideoTracks().forEach(function (t) { tracks.push(t); });
      if (sesDest) sesDest.stream.getAudioTracks().forEach(function (t) { tracks.push(t); });
      stream = new MediaStream(tracks);
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch (e) {
      updateMessage(m3, "❌ MediaRecorder hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
      uretimBitti(); progressBar.hidden = true; return;
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
        clearTimeout(killer); stopped = true;
        if (iptalEdildi) { reject(new Error("__IPTAL__")); return; }
        if (!chunks.length) { reject(new Error("Kayıt boş.")); return; }
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
        if (elapsedMs < acc + sMs) return { idx: i, localT: (elapsedMs - acc) / sMs };
        acc += sMs;
      }
      return { idx: derlenmis.length - 1, localT: 1 };
    }

    function tick() {
      if (iptalEdildi) {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        return;
      }
      var elapsed = performance.now() - startTime;
      var globalT = Math.min(1, elapsed / toplamMs);
      var hs = hangiSahne(elapsed);
      state.t = Math.max(0, Math.min(1, hs.localT));

      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      try {
        derlenmis[hs.idx].fn(ctx, state.t, frameNo++, derlenmis[hs.idx].duration, W, H, helpers);
      } catch (e) {
        try { if (rec.state !== "inactive") rec.stop(); } catch (x) {}
        updateMessage(m3, "❌ Sahne " + (hs.idx+1) + " hatası:<br><code>" + escapeHtml(e.message) + "</code>", "err");
        uretimBitti(); progressBar.hidden = true; return;
      }
      watermarkCiz(elapsed, toplamMs);

      var pct = Math.round(globalT * 100);
      progressFill.style.width = pct + "%";
      if (miniFill) miniFill.style.width = pct + "%";
      var kalan = Math.max(0, Math.ceil(analiz.toplamSure - elapsed / 1000));
      var sahneEtiket = sahneSayisi > 1 ? " [Sahne " + (hs.idx+1) + "/" + sahneSayisi + "]" : "";
      var sesEtiket = (sesKaynaklari.length > 0) ? " <small>🔊</small>" : "";
      updateMessage(m3,
        "🏃 Animasyon" + sahneEtiket + "... %" + pct + " <small>(~" + kalan + " sn)</small>" + sesEtiket +
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
      sesleriDurdur();
      if (e.message === "__IPTAL__") {
        updateMessage(m3, "🛑 Durduruldu.", "");
        toastGoster("🛑 Üretim durduruldu");
      } else {
        updateMessage(m3, "❌ " + escapeHtml(e.message), "err");
      }
      uretimBitti(); progressBar.hidden = true; return;
    }

    sesleriDurdur();
    updateMessage(m3, "🏃 Tamamlandı ✓");

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
      (blob.size / 1024 / 1024).toFixed(2) + " MB • ." + ext + ")</small>", "ok"
    );
    addBotMessage("İndirmek için alttaki ⬇️ butonuna bas.", "ok");
    uretimBitti();
  }

  function uretimBitti() {
    generateBtn.disabled = false;
    generateBtn.textContent = "⚡ Videoyu Oluştur";
    if (cancelBtn) cancelBtn.hidden = true;
  }

  if (generateBtn) generateBtn.addEventListener("click", uret);

  /* ==================== BAŞLAT ==================== */
  temaYukle();
  boyutUygula();
  kodYukle();
  sureGuncelle();

  console.log("✅ OsCodeVideo hazır (v21 - TTS)");
})();
