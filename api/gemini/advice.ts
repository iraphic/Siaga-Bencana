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
    const { query, location } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing or invalid 'query' field." });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

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

    res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini advice API error:", error.message);

    if (error.message?.includes("429") || error.message?.includes("quota")) {
      res.status(429).json({ error: "quota" });
      return;
    }
    if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED")) {
      res.status(403).json({ error: "permission_denied" });
      return;
    }
    if (error.message?.includes("404")) {
      res.status(404).json({ error: "model_not_found" });
      return;
    }

    res.status(500).json({ error: "internal_error" });
  }
}
