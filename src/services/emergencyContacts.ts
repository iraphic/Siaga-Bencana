
import { GoogleGenAI } from "@google/genai";

export interface EmergencyContact {
  name: string;
  number: string;
  type: 'hospital' | 'police' | 'fire' | 'sar' | 'general';
  address?: string;
  distance?: number;
}

export async function getNearbyEmergencyContacts(lat: number, lng: number): Promise<{
  contacts: EmergencyContact[];
  locationName: string;
}> {
  try {
    // 1. Get Location Name (Reverse Geocoding)
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
      headers: {
        'User-Agent': 'EmergencyApp/1.0'
      }
    });
    const geoData = await geoRes.json();
    const address = geoData.address || {};
    
    // Improved location name extraction
    const locationName = address.village || 
                        address.suburb || 
                        address.city_district || 
                        address.neighbourhood || 
                        address.municipality || 
                        address.city || 
                        address.town || 
                        address.county ||
                        "Area Anda";

    // 2. Use Gemini with Google Maps to find specific contacts
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const prompt = `Cari daftar Rumah Sakit (RS), Polsek (Kantor Polisi), Pemadam Kebakaran (Damkar), dan Basarnas (Kantor SAR) terdekat di sekitar koordinat ${lat}, ${lng}. 
    HANYA kembalikan 4 tipe ini. Jangan sertakan tipe lain.
    
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

    const text = response.text || "";
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
          let type: 'hospital' | 'police' | 'fire' | 'sar' | 'general' = 'general';
          
          if (typePart.includes('[rs]') || typePart.includes('rumah sakit')) type = 'hospital';
          else if (typePart.includes('[polisi]') || typePart.includes('polsek')) type = 'police';
          else if (typePart.includes('[damkar]') || typePart.includes('pemadam')) type = 'fire';
          else if (typePart.includes('[sar]') || typePart.includes('basarnas') || typePart.includes('search and rescue')) type = 'sar';

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
  } catch (error) {
    console.error("Error fetching nearby contacts:", error);
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
