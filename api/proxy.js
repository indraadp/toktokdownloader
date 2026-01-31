// /api/proxy.js
import { Readable } from "stream";

function makeTimestampFilename() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `Toktokdownloader_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.mp4`;
}

async function tryFetch(url, extraHeaders = {}) {
  return fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: Object.assign(
      {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36",
        Accept: "*/*",
      },
      extraHeaders
    ),
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let url = req.method === "GET" ? req.query.url : req.body?.url;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    if (/%3A|%2F/i.test(url)) {
      const dec = decodeURIComponent(url);
      if (dec !== url) url = dec;
    }
  } catch {}

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  try {
    let upstream = await tryFetch(url);

    if (upstream.status === 403) {
      upstream = await tryFetch(url, {
        Referer: "https://www.tiktok.com/",
        Range: "bytes=0-",
      });
    }

    if (!upstream.ok) {
      const msg = `Upstream returned ${upstream.status}`;
      res.status(upstream.status).json({ error: msg });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    const filename = makeTimestampFilename();

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("Cache-Control", "private, max-age=0, no-transform");

    if (upstream.body && typeof upstream.body.getReader === "function") {
      const nodeStream = Readable.fromWeb ? Readable.fromWeb(upstream.body) : Readable.from(upstream.body);
      nodeStream.pipe(res);
    } else if (upstream.body && typeof upstream.body.pipe === "function") {
      upstream.body.pipe(res);
    } else {
      const ab = await upstream.arrayBuffer();
      res.end(Buffer.from(ab));
    }
  } catch (err) {
    console.error("Proxy error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Proxy error" });
  }
}
