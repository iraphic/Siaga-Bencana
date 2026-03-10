import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "API key not configured on server." });
    return;
  }

  try {
    const { lat, lng } = req.body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json({ error: "Missing or invalid 'lat'/'lng' fields." });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Cari daftar Rumah Sakit (RS), Polsek (Kantor Polisi), Pemadam Kebakaran (Damkar), dan Basarnas (Kantor SAR) terdekat di sekitar koordinat ${lat}, ${lng}.
    HANYA kembalikan 4 tipe ini. Pastikan untuk menemukan Polsek/Kantor Polisi terdekat.

    Tentukan juga nama area (kecamatan atau kelurahan) dari koordinat tersebut dan tulis di baris pertama dengan format: AREA: [Nama Area]

    Berikan daftar dalam format baris per baris seperti ini:
    [Tipe] Nama Tempat | Nomor Telepon | Alamat

    Contoh format:
    AREA: Pancoran
    [RS] RS Medika | 0211234567 | Jl. Merdeka No. 1
    [Polisi] Polsek Kebayoran | 0217654321 | Jl. Polisi No. 2
    [Damkar] Damkar Sektor X | 0219876543 | Jl. Api No. 3
    [SAR] Basarnas Jakarta | 0215501512 | Jl. SAR No. 4

    Pastikan nomor telepon adalah nomor telepon lokal (misalnya berawalan 021 untuk Jakarta, atau kode area lokal lainnya sesuai koordinat).
    Hanya berikan daftar tersebut, maksimal 8 entri (2 per tipe jika tersedia).`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng,
            },
          },
        },
      },
    });

    res.status(200).json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Gemini contacts API error:", error.message);
    res.status(500).json({ error: "internal_error" });
  }
}
