import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Weather Proxy
  app.get("/api/weather", async (req, res) => {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    try {
      const apiUrl = `https://cuacakita.vercel.app/api/weather/forecast?lat=${lat}&long=${lon}`;
      const response = await axios.get(apiUrl);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching weather from provider:", error);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // API Route for Gemini Advice
  app.post("/api/ai/advice", async (req, res) => {
    const { query, location } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3.1-pro-preview";
      
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
        model,
        contents: [{ role: 'user', parts: [{ text: query }] }],
        config: {
          systemInstruction,
          temperature: 0.4,
          topP: 0.8,
        },
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Advice Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route for Gemini Contacts (with Maps Grounding)
  app.post("/api/ai/contacts", async (req, res) => {
    const { lat, lng } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server" });
    }

    try {
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
                longitude: lng
              }
            }
          }
        },
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Contacts Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
