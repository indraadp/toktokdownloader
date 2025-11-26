// /api/proxy.js
import { Readable } from "stream";

/*
  UNIVERSAL proxy (NO WHITELIST).
  - Accepts GET ?url=...  or POST { url: "..." }.
  - Retries with Referer/Range on 403.
  - Streams response and sets Content-Disposition to force download.
  - WARNING: Open proxy - secure this if deploying publicly.
*/

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    let name = parts.pop() || "video";
    name = name.replace(/[^a-zA-Z0-9._-]/g, "-");
    if (!/\.\w{2,5}$/.test(name)) name = name + ".mp4";
    return name;
  } catch {
    return "download.mp4";
  }
}

async function tryFetch(url, extraHeaders = {}) {
  return fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: Object.assign({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36",
      "Accept": "*/*",
    }, extraHeaders),
  });
}

export default async function handler(req, res) {
  try {
    const method = req.method;
    if (method !== "GET" && method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // ambil param url (bisa sudah di-encode)
    let url = method === "GET" ? req.query.url : req.body?.url;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }

    // jika perlu decode (aman)
    try {
      if (/%3A|%2F/i.test(url)) {
        const dec = decodeURIComponent(url);
        if (dec !== url) url = dec;
      }
    } catch (e) { /* ignore */ }

    // validasi dasar
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid url" });
      return;
    }

    // 1) try plain fetch
    let upstream = await tryFetch(url);

    // 2) if 403, retry with Referer + Range (helps many CDN)
    if (upstream.status === 403) {
      upstream = await tryFetch(url, {
        "Referer": "https://www.tiktok.com/",
        "Range": "bytes=0-",
      });
    }

    if (!upstream.ok) {
      // forward upstream status and small message
      const msg = `Upstream returned ${upstream.status}`;
      console.warn(msg, "for", url);
      // return JSON (so browser won't attempt to download invalid HTML)
      res.status(upstream.status).json({ error: msg });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    const filename = filenameFromUrl(url);

    // set headers to force download
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("Cache-Control", "private, max-age=0, no-transform");

    // stream body (prefer Web -> Node conversion)
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
