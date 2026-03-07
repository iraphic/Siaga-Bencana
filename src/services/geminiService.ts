import { GoogleGenAI } from "@google/genai";

export const getEmergencyAdvice = async (query: string, location?: { lat: number; lng: number }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in environment");
    return "Maaf, sistem asisten AI sedang tidak tersedia karena konfigurasi kunci API belum lengkap. Mohon ikuti prosedur evakuasi standar di daerah Anda.";
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
    
    if (!response.text) {
      console.error("Gemini API returned empty text", response);
      throw new Error("Empty response text");
    }
    
    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    
    // Handle common API errors
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return "Maaf, sistem sedang sibuk karena banyaknya permintaan. Mohon tunggu sebentar atau ikuti prosedur keselamatan standar.";
    }
    
    if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED")) {
      if (error.message?.includes("referer") || error.message?.includes("blocked")) {
        return "Maaf, kunci API yang digunakan memiliki batasan (HTTP Referrer) yang memblokir akses dari lingkungan ini. Silakan klik tombol 'Pilih API Key' di bagian bawah jika tersedia, atau hubungi administrator untuk menggunakan kunci tanpa batasan domain.";
      }
      return "Maaf, terjadi masalah otentikasi dengan layanan AI. Mohon hubungi administrator.";
    }

    if (error.message?.includes("404")) {
      return "Maaf, layanan AI sedang dalam pemeliharaan. Mohon ikuti prosedur keselamatan standar.";
    }
    
    return "Maaf, terjadi kesalahan saat menghubungi pusat bantuan AI. Tetap tenang dan ikuti prosedur evakuasi standar di daerah Anda.";
  }
};
