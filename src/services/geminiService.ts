export const getEmergencyAdvice = async (query: string, location?: { lat: number; lng: number }) => {
  try {
    const response = await fetch("/api/gemini/advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, location }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Advice API error:", response.status, errorData);

      if (response.status === 429 || errorData.error === "quota") {
        return "Maaf, sistem sedang sibuk karena banyaknya permintaan. Mohon tunggu sebentar atau ikuti prosedur keselamatan standar.";
      }
      if (response.status === 403 || errorData.error === "permission_denied") {
        return "Maaf, terjadi masalah otentikasi dengan layanan AI. Mohon hubungi administrator.";
      }
      if (response.status === 404 || errorData.error === "model_not_found") {
        return "Maaf, layanan AI sedang dalam pemeliharaan. Mohon ikuti prosedur keselamatan standar.";
      }

      throw new Error(errorData.error || "Server error");
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Error calling advice API:", error.message);
    return "Maaf, terjadi kesalahan saat menghubungi pusat bantuan AI. Tetap tenang dan ikuti prosedur evakuasi standar di daerah Anda.";
  }
};
