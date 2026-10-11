const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const multer = require("multer");
const ffmpegPath = require("ffmpeg-static");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// Max 50 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post("/api/convert", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Dosya yok" });
  }

  const stamp = Date.now();
  const inputPath = path.join(os.tmpdir(), "in-" + stamp + ".webm");
  const outputPath = path.join(os.tmpdir(), "out-" + stamp + ".mp4");

  try {
    fs.writeFileSync(inputPath, req.file.buffer);
  } catch (e) {
    return res.status(500).json({ error: "Dosya yazılamadı: " + e.message });
  }

  const ff = spawn(ffmpegPath, [
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    outputPath
  ]);

  let errBuf = "";
  ff.stderr.on("data", d => { errBuf += d.toString(); });

  ff.on("close", (code) => {
    if (code !== 0) {
      try { fs.unlinkSync(inputPath); } catch (e) {}
      try { fs.unlinkSync(outputPath); } catch (e) {}
      return res.status(500).json({ error: "ffmpeg: " + errBuf.slice(-300) });
    }
    try {
      const buf = fs.readFileSync(outputPath);
      try { fs.unlinkSync(inputPath); } catch (e) {}
      try { fs.unlinkSync(outputPath); } catch (e) {}
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", 'attachment; filename="output.mp4"');
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  ff.on("error", (err) => {
    try { fs.unlinkSync(inputPath); } catch (e) {}
    res.status(500).json({ error: err.message });
  });
});

app.get("/healthz", (req, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log("🎬 OsCodeVideo " + PORT + " portunda çalışıyor");
});
