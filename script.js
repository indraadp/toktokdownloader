document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("download-form");
  const input = document.getElementById("tiktok-url");
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");
  const videoEl = document.getElementById("preview");
  const downloadNowBtn = document.getElementById("download-now");

  function filenameFromUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/");
      let name = parts.pop() || parts.pop() || "video";
      if (!/\.\w{2,5}$/.test(name)) name = name + ".mp4";
      return name;
    } catch (e) {
      return "video.mp4";
    }
  }

  function triggerProxyDownload(proxyUrl, suggestedFilename) {
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.setAttribute("download", suggestedFilename || "");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!form || !input) {
    console.error("Form atau input tidak ditemukan.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tiktokUrl = input.value.trim();
    if (!tiktokUrl) return;

    // reset UI
    resultEl.classList.add("hidden");
    downloadNowBtn.style.display = "none";
    statusEl.textContent = "Sedang mengambil video...";
    downloadNowBtn.disabled = true;

    try {
      const resp = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tiktokUrl }),
      });

      if (!resp.ok) throw new Error("Gagal menghubungi server.");

      const data = await resp.json();
      if (!data.success) throw new Error(data.message || "Gagal memproses link.");

      const videoUrl = data.downloadUrl;
      const proxyUrl = data.proxyUrl || ("/api/proxy?url=" + encodeURIComponent(videoUrl));

      if (!videoUrl) throw new Error("Server tidak mengembalikan video URL.");

      // set preview
      if (videoEl) {
        videoEl.src = videoUrl;
        videoEl.load();
      }

      // set proxy link for download
      downloadNowBtn.dataset.proxy = proxyUrl;
      downloadNowBtn.dataset.filename = filenameFromUrl(videoUrl);
      downloadNowBtn.style.display = "inline-block";
      downloadNowBtn.disabled = false;

      resultEl.classList.remove("hidden");
      statusEl.textContent = "";
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || "Terjadi error.";
    }
  });

  downloadNowBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const proxy = downloadNowBtn.dataset.proxy;
    const filename = downloadNowBtn.dataset.filename || "";
    if (!proxy) return;
    statusEl.textContent = "Menyiapkan download...";
    downloadNowBtn.disabled = true;

    try {
      triggerProxyDownload(proxy, filename);
    } finally {
      downloadNowBtn.disabled = false;
      statusEl.textContent = "";
    }
  });
});

const pasteBtn = document.getElementById("paste-btn");
const inputUrl = document.getElementById("tiktok-url");

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      inputUrl.value = text;
      inputUrl.focus();
    } else {
      alert("Clipboard kosong.");
    }
  } catch {
    alert("Gagal mengakses clipboard.");
  }
});
