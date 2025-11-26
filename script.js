document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("download-form");
  const input = document.getElementById("tiktok-url");
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");
  const videoEl = document.getElementById("preview");
  const downloadNowBtn = document.getElementById("download-now");

  // helper: filename dari url
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

  async function downloadVideoFromUrl(url, suggestedFilename) {
    try {
      if (statusEl) statusEl.textContent = "Mengunduh...";
      downloadNowBtn.disabled = true;

      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Gagal mengunduh (status " + res.status + ")");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = suggestedFilename || filenameFromUrl(url);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        if (statusEl) statusEl.textContent = "";
        downloadNowBtn.disabled = false;
      }, 500);
    } catch (err) {
      console.warn("Fetch download gagal:", err);
      if (statusEl) statusEl.textContent = "Gagal download langsung — membuka tab baru...";
      window.open(url, "_blank");
      downloadNowBtn.disabled = false;

      setTimeout(() => (statusEl.textContent = ""), 1500);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tiktokUrl = input.value.trim();
    if (!tiktokUrl) return;

    // reset UI
    resultEl.classList.add("hidden");
    downloadNowBtn.style.display = "none";
    downloadNowBtn.disabled = true;
    statusEl.textContent = "Sedang mengambil video...";

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tiktokUrl })
      });

      if (!res.ok) throw new Error("Gagal terhubung ke server.");

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Gagal memproses link.");

      const videoUrl = data.downloadUrl;
      if (!videoUrl) throw new Error("URL video tidak ditemukan.");

      videoEl.src = videoUrl;
      videoEl.load();

      // tampilkan tombol unduh
      downloadNowBtn.dataset.src = videoUrl;
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

  downloadNowBtn.addEventListener("click", async () => {
    const url = downloadNowBtn.dataset.src || videoEl.src;
    if (!url) return;
    const filename = downloadNowBtn.dataset.filename || filenameFromUrl(url);
    await downloadVideoFromUrl(url, filename);
  });
});
