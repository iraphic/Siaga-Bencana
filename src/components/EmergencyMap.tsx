import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, MapPin } from 'lucide-react';

// Fix Leaflet marker icon issue
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const UserLocationMarker = ({ position }: { position: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 13);
  }, [position, map]);

  return (
    <Marker position={position}>
      <Popup>Lokasi Anda Sekarang</Popup>
    </Marker>
  );
};

export interface DisasterEvent {
  id: string;
  title: string;
  type: string;
  lat: number;
  lng: number;
  severity: string;
}

export const EmergencyMap = ({ 
  userLocation, 
  events 
}: { 
  userLocation: [number, number] | null;
  events: DisasterEvent[];
}) => {
  const getIcon = (type: string) => {
    return L.divIcon({
      html: `<div class="p-2 bg-red-500 rounded-full text-white shadow-lg animate-pulse">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
             </div>`,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  return (
    <div className="w-full h-[300px] md:h-[400px] relative rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      <MapContainer center={userLocation || [-6.2088, 106.8456]} zoom={10} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation && <UserLocationMarker position={userLocation} />}
        {events.map((event) => (
          <Marker 
            key={event.id} 
            position={[event.lat, event.lng]} 
            icon={getIcon(event.type)}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-red-600">{event.title}</h3>
                <p className="text-xs text-slate-600">Tipe: {event.type}</p>
                <p className="text-xs font-semibold">Tingkat Bahaya: {event.severity}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur p-2 rounded-lg shadow-md border border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500">
        Live Disaster Map
      </div>
    </div>
  );
};
