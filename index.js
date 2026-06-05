/**
 * yt-resolver — Railway deployment
 * GET /stream?url=YOUTUBE_URL  → returns { stream_url }
 * GET /health                  → returns { ok: true }
 */

const express = require("express");
const { execFile } = require("child_process");
const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory cache: videoId → { url, expires }
const cache = new Map();
const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  next();
});

app.options("*", (req, res) => res.sendStatus(204));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "yt-resolver v1" });
});

app.get("/stream", async (req, res) => {
  const ytUrl = req.query.url;
  if (!ytUrl) {
    return res.status(400).json({ error: "url param required" });
  }

  const videoId = extractVideoId(ytUrl);
  if (!videoId) {
    return res.status(400).json({ error: "Could not parse YouTube video ID" });
  }

  // Cache check
  const cached = cache.get(videoId);
  if (cached && cached.expires > Date.now()) {
    return res.json({ stream_url: cached.url, cached: true });
  }

  try {
    const streamUrl = await resolveWithYtDlp(ytUrl);
    cache.set(videoId, { url: streamUrl, expires: Date.now() + CACHE_TTL });
    return res.json({ stream_url: streamUrl, cached: false });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

function resolveWithYtDlp(ytUrl) {
  return new Promise((resolve, reject) => {
    // -g = print URL, --no-warnings, best HLS format for live
    const args = [
      "--no-warnings",
      "-g",
      "-f", "best[ext=mp4]/best",
      "--hls-prefer-native",
      ytUrl,
    ];

    execFile("yt-dlp", args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr?.trim() || err.message));
      }
      const url = stdout.trim().split("\n")[0];
      if (!url) return reject(new Error("yt-dlp returned empty output"));
      resolve(url);
    });
  });
}

function extractVideoId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/live\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

app.listen(PORT, () => {
  console.log(`yt-resolver listening on port ${PORT}`);
});
