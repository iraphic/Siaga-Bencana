import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("FATAL: GEMINI_API_KEY is not set in environment variables.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// POST /api/gemini/advice — Emergency advice endpoint
app.post("/api/gemini/advice", async (req, res) => {
  try {
    const { query, location } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing or invalid 'query' field." });
      return;
    }

    const systemInstruction = `
      Anda adalah asisten darurat ahli dalam kesiapsiagaan bencana (banjir, gempa, tanah longsor, erupsi, tsunami, kebakaran, dll).
      Tugas Anda adalah memberikan langkah-langkah taktis, terurut, dan menenangkan bagi warga yang menghadapi situasi darurat.

      Gunakan format:
      1. **Tindakan Segera (Prioritas Utama)**: Langkah paling kritis untuk keselamatan nyawa.
      2. **Langkah Teknis**: Apa yang harus dilakukan dengan utilitas (listrik, air, gas).
      3. **Persiapan Evakuasi**: Apa yang harus dibawa dan ke mana harus pergi.
      4. **Pesan Penenang**: Kalimat singkat untuk menjaga ketenangan.

      Gunakan Bahasa Indonesia yang jelas dan mudah dimengerti dalam kondisi panik.
      ${location ? `Lokasi pengguna saat ini: Latitude ${location.lat}, Longitude ${location.lng}. Berikan saran yang relevan dengan lokasi ini jika memungkinkan.` : ""}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: query }] }],
      config: {
        systemInstruction,
        temperature: 0.4,
        topP: 0.8,
      },
    });

    if (!response.text) {
      res.status(500).json({ error: "Empty response from AI model." });
      return;
    }

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini advice API error:", error.message);

    if (error.message?.includes("429") || error.message?.includes("quota")) {
      res.status(429).json({ error: "quota" });
      return;
    }
    if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED")) {
      res.status(403).json({ error: "permission_denied", detail: error.message });
      return;
    }
    if (error.message?.includes("404")) {
      res.status(404).json({ error: "model_not_found" });
      return;
    }

    res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/gemini/contacts — Emergency contacts lookup endpoint
app.post("/api/gemini/contacts", async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json({ error: "Missing or invalid 'lat'/'lng' fields." });
      return;
    }

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

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Gemini contacts API error:", error.message);
    res.status(500).json({ error: "internal_error", detail: error.message });
  }
});

// Serve static files in production
const distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.resolve(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
