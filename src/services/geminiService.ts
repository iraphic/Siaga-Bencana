import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getEmergencyAdvice = async (query: string, location?: { lat: number; lng: number }) => {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `
    Anda adalah asisten darurat ahli dalam kesiapsiagaan bencana (banjir, gempa, tanah longsor, perang, dll).
    Tugas Anda adalah memberikan langkah-langkah taktis, terurut, dan menenangkan bagi warga yang menghadapi situasi darurat.
    
    Gunakan format:
    1. **Tindakan Segera (Prioritas Utama)**: Langkah paling kritis untuk keselamatan nyawa.
    2. **Langkah Teknis**: Apa yang harus dilakukan dengan utilitas (listrik, air, gas).
    3. **Persiapan Evakuasi**: Apa yang harus dibawa dan ke mana harus pergi.
    4. **Pesan Penenang**: Kalimat singkat untuk menjaga ketenangan.

    Gunakan Bahasa Indonesia yang jelas dan mudah dimengerti dalam kondisi panik.
    Jika lokasi diberikan (${location?.lat}, ${location?.lng}), pertimbangkan konteks geografis jika relevan.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: query,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Maaf, terjadi kesalahan saat menghubungi pusat bantuan AI. Tetap tenang dan ikuti prosedur evakuasi standar di daerah Anda.";
  }
};
