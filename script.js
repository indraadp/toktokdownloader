const form = document.getElementById("download-form");
const input = document.getElementById("tiktok-url");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const videoEl = document.getElementById("preview");
const downloadLink = document.getElementById("download-link");
const button = document.getElementById("download-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = input.value.trim();
  if (!url) return;

  // reset tampilan
  resultEl.classList.add("hidden");
  statusEl.textContent = "Sedang mengambil video, tunggu sebentar...";
  button.disabled = true;

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      throw new Error("Gagal terhubung dengan server.");
    }

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "Gagal memproses link.");
    }

    const videoUrl = data.downloadUrl;

    // tampilkan hasil
    videoEl.src = videoUrl;
    downloadLink.href = videoUrl;

    resultEl.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Terjadi error.";
  } finally {
    button.disabled = false;
  }
});
