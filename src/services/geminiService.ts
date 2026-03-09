
export const getEmergencyAdvice = async (query: string, location?: { lat: number; lng: number }) => {
  try {
    const response = await fetch("/api/ai/advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, location }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch advice from AI");
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    
    // Handle common API errors
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return "Maaf, sistem sedang sibuk karena banyaknya permintaan. Mohon tunggu sebentar atau ikuti prosedur keselamatan standar.";
    }
    
    if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED")) {
      return "Maaf, terjadi masalah otentikasi dengan layanan AI. Mohon hubungi administrator.";
    }

    if (error.message?.includes("404")) {
      return "Maaf, layanan AI sedang dalam pemeliharaan. Mohon ikuti prosedur keselamatan standar.";
    }
    
    return "Maaf, terjadi kesalahan saat menghubungi pusat bantuan AI. Tetap tenang dan ikuti prosedur evakuasi standar di daerah Anda.";
  }
};
