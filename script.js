document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("download-form");
  const input = document.getElementById("tiktok-url");
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");
  const videoEl = document.getElementById("preview");
  const downloadNowBtn = document.getElementById("download-now");
  const pasteBtn = document.getElementById("paste-btn");

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

  function setPasteBtnMode(mode) {
    if (!pasteBtn) return;
    const icon = pasteBtn.querySelector("i");
    const label = pasteBtn.querySelector("span");
    if (mode === "clear") {
      pasteBtn.dataset.mode = "clear";
      pasteBtn.setAttribute("aria-label", "Hapus");
      if (icon) icon.className = "fa-solid fa-xmark";
      if (label) label.textContent = "Hapus";
    } else {
      pasteBtn.dataset.mode = "paste";
      pasteBtn.setAttribute("aria-label", "Tempel Link");
      if (icon) icon.className = "fa-solid fa-paste";
      if (label) label.textContent = "Tempel Link";
    }
  }

  function syncPasteBtn() {
    const filled = !!(input.value && input.value.trim());
    setPasteBtnMode(filled ? "clear" : "paste");
  }

  async function readClipboardText() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return (await navigator.clipboard.readText()) || "";
      }
    } catch (e) {}
    return "";
  }

  function resetUIAfterClear() {
    if (statusEl) statusEl.textContent = "";
    if (resultEl) resultEl.classList.add("hidden");
    if (downloadNowBtn) {
      downloadNowBtn.style.display = "none";
      downloadNowBtn.disabled = false;
      delete downloadNowBtn.dataset.proxy;
      delete downloadNowBtn.dataset.filename;
    }
    if (videoEl) {
      try {
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
      } catch (e) {}
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tiktokUrl = input.value.trim();
    if (!tiktokUrl) return;

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

      if (videoEl) {
        videoEl.src = videoUrl;
        videoEl.load();
      }

      downloadNowBtn.dataset.proxy = proxyUrl;
      downloadNowBtn.dataset.filename = filenameFromUrl(videoUrl);
      downloadNowBtn.style.display = "inline-block";
      downloadNowBtn.disabled = false;

      resultEl.classList.remove("hidden");
      statusEl.textContent = "";
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || "Terjadi error.";
      downloadNowBtn.disabled = false;
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

  if (pasteBtn) {
    pasteBtn.onclick = null;

    pasteBtn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        if (input.value && input.value.trim()) {
          input.value = "";
          input.focus();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          resetUIAfterClear();
          syncPasteBtn();
          return;
        }

        const text = (await readClipboardText()).trim();
        if (text) {
          input.value = text;
          input.focus();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          syncPasteBtn();
        } else {
          input.focus();
        }
      },
      true
    );
  }

  ["input", "change", "keyup", "paste", "cut"].forEach((ev) => {
    input.addEventListener(ev, () => setTimeout(syncPasteBtn, 0));
  });

  syncPasteBtn();
});
