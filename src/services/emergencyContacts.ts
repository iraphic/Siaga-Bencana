
import { GoogleGenAI } from "@google/genai";

export interface EmergencyContact {
  name: string;
  number: string;
  type: 'hospital' | 'police' | 'fire' | 'sar' | 'pln' | 'general';
  address?: string;
  distance?: number;
}

export async function getNearbyEmergencyContacts(lat: number, lng: number): Promise<{
  contacts: EmergencyContact[];
  locationName: string;
}> {
  try {
    // 1. Get Location Name (Reverse Geocoding)
    let locationName = "Area Anda";
    try {
      const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        console.log("Data Geocoding BigDataCloud:", geoData);
        locationName = geoData.locality || geoData.city || geoData.principalSubdivision || "Area Anda";
      } else {
        throw new Error(`HTTP Error: ${geoRes.status}`);
      }
    } catch (error: any) {
      console.error("Pesan Error Geocoding:", error.message);
      console.error("Nama Error Geocoding:", error.name);
      alert(`Gagal Fetch Geocoding: ${error.message || "Error tidak diketahui"}`);
      console.warn("BigDataCloud geocoding failed, falling back to Gemini");
    }

    // 2. Use Gemini with Google Maps to find specific contacts
    if (!process.env.GEMINI_API_KEY) {
      console.error("CRITICAL: GEMINI_API_KEY is missing in getNearbyEmergencyContacts");
      alert("API Key Gemini tidak ditemukan di Vercel! Pastikan Anda sudah menambahkan GEMINI_API_KEY di Environment Variables Vercel, lalu lakukan REDEPLOY.");
      throw new Error("GEMINI_API_KEY is missing");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Cari daftar Rumah Sakit (RS), Polsek (Kantor Polisi), Pemadam Kebakaran (Damkar), Basarnas (Kantor SAR), dan PLN (Gangguan Listrik) terdekat di sekitar koordinat ${lat}, ${lng}. 
    HANYA kembalikan 5 tipe ini. Jangan sertakan tipe lain.
    
    Tentukan juga nama area (kecamatan atau kelurahan) dari koordinat tersebut dan tulis di baris pertama dengan format: AREA: [Nama Area]
    
    Berikan daftar dalam format baris per baris seperti ini:
    [Tipe] Nama Tempat | Nomor Telepon | Alamat
    
    Contoh format:
    AREA: Pancoran
    [RS] RS Medika | 0211234567 | Jl. Merdeka No. 1
    [Polisi] Polsek Kebayoran | 0217654321 | Jl. Polisi No. 2
    [Damkar] Damkar Sektor X | 0219876543 | Jl. Api No. 3
    [SAR] Basarnas Jakarta | 0215501512 | Jl. SAR No. 4
    [PLN] PLN Area X | 021123 | Jl. Listrik No. 5
    
    Pastikan nomor telepon adalah nomor telepon lokal (misalnya berawalan 021 untuk Jakarta, atau kode area lokal lainnya sesuai koordinat).
    Hanya berikan daftar tersebut, maksimal 12 entri (berikan minimal 3 Polsek/Kantor Polisi jika tersedia).`;

    let text = "";
    try {
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
      text = response.text || "";
      console.log("Raw Response Gemini:", text);
    } catch (error: any) {
      console.error("Pesan Error Gemini:", error.message);
      console.error("Nama Error Gemini:", error.name);
      
      if (error.message?.includes("403") && (error.message?.includes("referer") || error.message?.includes("blocked"))) {
        alert("Kunci API Gemini diblokir oleh batasan domain (HTTP Referrer). Silakan gunakan kunci API tanpa batasan atau pilih kunci baru melalui menu pengaturan jika tersedia.");
      } else {
        alert(`Gagal Fetch Gemini: ${error.message || "Error tidak diketahui"}`);
      }
    }

    const contacts: EmergencyContact[] = [];
    let geminiLocationName = "";

    // Simple parsing of the response text
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('AREA:')) {
        geminiLocationName = line.replace('AREA:', '').trim();
        continue;
      }
      
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          const typePart = parts[0].toLowerCase();
          let type: 'hospital' | 'police' | 'fire' | 'sar' | 'pln' | 'general' = 'general';
          
          if (typePart.includes('[rs]') || typePart.includes('rumah sakit')) type = 'hospital';
          else if (typePart.includes('[polisi]') || typePart.includes('polsek')) type = 'police';
          else if (typePart.includes('[damkar]') || typePart.includes('pemadam')) type = 'fire';
          else if (typePart.includes('[sar]') || typePart.includes('basarnas') || typePart.includes('search and rescue')) type = 'sar';
          else if (typePart.includes('[pln]') || typePart.includes('listrik')) type = 'pln';

          // Only add if it's one of the requested types
          if (type !== 'general') {
            const name = parts[0].replace(/^\[.*?\]/, '').trim();
            const number = parts[1].replace(/[^0-9]/g, '');
            const address = parts[2] || '';

            if (name && number) {
              contacts.push({ name, number, type, address });
            }
          }
        }
      }
    }

    // Use Gemini's location name if Nominatim failed or returned "Area Anda"
    const finalLocationName = (locationName === "Area Anda" && geminiLocationName) ? geminiLocationName : locationName;

    // Fallback if Gemini didn't return useful data
    if (contacts.length === 0) {
      return {
        contacts: [
          { name: 'Ambulans (Nasional)', number: '118', type: 'hospital' },
          { name: 'Polisi (Nasional)', number: '110', type: 'police' },
          { name: 'Pemadam Kebakaran (Nasional)', number: '113', type: 'fire' },
          { name: 'Basarnas (Nasional)', number: '115', type: 'sar' },
        ],
        locationName: finalLocationName
      };
    }

    return { contacts, locationName: finalLocationName };
  } catch (error: any) {
    console.error("Error fetching nearby contacts (Outer Catch):", error);
    alert(`Error Sistem: ${error.message || "Terjadi kesalahan tidak terduga saat memuat kontak darurat."}`);
    return {
      contacts: [
        { name: 'Ambulans (Nasional)', number: '118', type: 'hospital' },
        { name: 'Polisi (Nasional)', number: '110', type: 'police' },
        { name: 'Pemadam Kebakaran (Nasional)', number: '113', type: 'fire' },
        { name: 'Basarnas (Nasional)', number: '115', type: 'sar' },
      ],
      locationName: "Area Anda"
    };
  }
}
