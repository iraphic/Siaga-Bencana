
export interface EmergencyContact {
  name: string;
  number: string;
  type: 'hospital' | 'police' | 'fire' | 'general';
  address?: string;
  distance?: number;
}

export async function getNearbyEmergencyContacts(lat: number, lng: number): Promise<{
  contacts: EmergencyContact[];
  locationName: string;
}> {
  try {
    // 1. Get Location Name (Reverse Geocoding)
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`);
    const geoData = await geoRes.json();
    const address = geoData.address;
    const locationName = address.village || address.suburb || address.city_district || address.municipality || "Area Anda";

    // 2. Search for nearby hospitals using Overpass API
    // This query finds hospitals and clinics within 5km
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](around:5000, ${lat}, ${lng});
        way["amenity"="hospital"](around:5000, ${lat}, ${lng});
        node["amenity"="clinic"](around:5000, ${lat}, ${lng});
        way["amenity"="clinic"](around:5000, ${lat}, ${lng});
        node["amenity"="police"](around:5000, ${lat}, ${lng});
        node["amenity"="fire_station"](around:5000, ${lat}, ${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: query
    });
    const data = await response.json();

    const contacts: EmergencyContact[] = data.elements
      .filter((el: any) => el.tags && (el.tags.name || el.tags.phone || el.tags['contact:phone']))
      .map((el: any) => {
        const phone = el.tags.phone || el.tags['contact:phone'] || "112";
        let type: 'hospital' | 'police' | 'fire' | 'general' = 'general';
        if (el.tags.amenity === 'hospital' || el.tags.amenity === 'clinic') type = 'hospital';
        if (el.tags.amenity === 'police') type = 'police';
        if (el.tags.amenity === 'fire_station') type = 'fire';

        return {
          name: el.tags.name || (type === 'hospital' ? 'Rumah Sakit Terdekat' : 'Layanan Darurat'),
          number: phone.replace(/[^0-9+]/g, ''),
          type,
          address: el.tags['addr:street'] || '',
        };
      })
      // Filter out those without a real phone number if possible, or keep 112 as fallback
      .slice(0, 6);

    // Add general numbers if not enough local ones
    if (contacts.length < 3) {
      contacts.push({ name: 'Panggilan Darurat (Umum)', number: '112', type: 'general' });
      contacts.push({ name: 'Ambulans (Nasional)', number: '118', type: 'hospital' });
      contacts.push({ name: 'Polisi (Nasional)', number: '110', type: 'police' });
    }

    return { contacts, locationName };
  } catch (error) {
    console.error("Error fetching nearby contacts:", error);
    return {
      contacts: [
        { name: 'Panggilan Darurat', number: '112', type: 'general' },
        { name: 'Ambulans', number: '118', type: 'hospital' },
        { name: 'Polisi', number: '110', type: 'police' },
        { name: 'Pemadam Kebakaran', number: '113', type: 'fire' },
      ],
      locationName: "Area Anda"
    };
  }
}
