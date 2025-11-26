export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, message: "URL TikTok tidak valid." });
  }

  try {
    // Contoh pakai tikwm.com API publik
    const apiUrl = "https://www.tikwm.com/api/?url=" + encodeURIComponent(url);

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/119.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error("Gagal ambil data dari API pihak ketiga.");
    }

    const json = await response.json();

    if (json.code !== 0 || !json.data || !json.data.play) {
      throw new Error("API tidak mengembalikan link video yang valid.");
    }

    const downloadUrl = json.data.play; // direct link video (tanpa watermark)

    return res.status(200).json({
      success: true,
      downloadUrl,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error, coba lagi nanti.",
    });
  }
}
