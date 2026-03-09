

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
    let locationName = "Area Anda";
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
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
        // alert(`Gagal Fetch Geocoding: ${error.message || "Error tidak diketahui"}`);
        console.warn("BigDataCloud geocoding failed, falling back to Gemini");
      }
    }

    // 2. Use Gemini with Google Maps to find specific contacts via Backend
    let text = "";
    try {
      const response = await fetch("/api/ai/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lat, lng }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch contacts from AI");
      }

      const data = await response.json();
      text = data.text || "";
      console.log("Raw Response Gemini (via Backend):", text);
    } catch (error: any) {
      console.error("Pesan Error Gemini (via Backend):", error.message);
      console.error("Nama Error Gemini (via Backend):", error.name);
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
