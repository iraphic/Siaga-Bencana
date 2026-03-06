import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, MapPin, Navigation, Crosshair, Share2, Minimize2 } from 'lucide-react';
import { cn } from '../utils/cn';

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

const MapControls = ({ 
  userLocation, 
  events,
  onShare
}: { 
  userLocation: [number, number] | null;
  events: DisasterEvent[];
  onShare?: (event: DisasterEvent) => void;
}) => {
  const map = useMap();

  const goToUser = () => {
    if (userLocation) {
      map.flyTo(userLocation, 13);
    }
  };

  const goToLatestDisaster = () => {
    if (events.length > 0) {
      map.flyTo([events[0].lat, events[0].lng], 12);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={goToUser}
        disabled={!userLocation}
        className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-600 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Lokasi Saya"
      >
        <Navigation size={20} />
      </button>
      <button
        onClick={goToLatestDisaster}
        disabled={events.length === 0}
        className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-600 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Lokasi Bencana"
      >
        <Crosshair size={20} />
      </button>
    </div>
  );
};

export interface DisasterEvent {
  id: string;
  title: string;
  type: string;
  lat: number;
  lng: number;
  severity: string;
  time?: string;
  location?: string;
  source?: string;
}

export const EmergencyMap = ({ 
  userLocation, 
  events,
  onShare,
  className,
  isFullscreen,
  onToggleFullscreen
}: { 
  userLocation: [number, number] | null;
  events: DisasterEvent[];
  onShare?: (event: DisasterEvent) => void;
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
    <div className={cn(
      "w-full h-[300px] md:h-[400px] relative rounded-2xl overflow-hidden shadow-inner border border-slate-200",
      className
    )}>
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
              <div className="p-2 min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-red-100 p-1.5 rounded-lg text-red-600">
                    <AlertTriangle size={16} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{event.title}</h3>
                </div>
                
                <div className="space-y-1.5 border-t border-slate-100 pt-2">
                  <div className="flex items-start gap-2">
                    <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Lokasi</p>
                      <p className="text-xs text-slate-700 font-medium">{event.location || 'Tidak diketahui'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 flex items-center justify-center mt-0.5 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Waktu Kejadian</p>
                      <p className="text-xs text-slate-700 font-medium">{event.time || 'Baru saja'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      event.severity === 'High' ? "bg-red-100 text-red-600" : 
                      event.severity === 'Medium' ? "bg-orange-100 text-orange-600" : 
                      "bg-blue-100 text-blue-600"
                    )}>
                      {event.severity} Risk
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium italic">
                      {event.type}
                    </span>
                  </div>

                  {onShare && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare(event);
                      }}
                      className="w-full mt-3 py-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                    >
                      <Share2 size={12} />
                      BAGIKAN INFO
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        <MapControls userLocation={userLocation} events={events} onShare={onShare} />
        {isFullscreen && onToggleFullscreen && (
          <div className="absolute top-4 left-4 z-[1000]">
            <button
              onClick={onToggleFullscreen}
              className="px-4 py-2 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 flex items-center gap-2 text-slate-900 font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all"
            >
              <Minimize2 size={16} />
              Keluar Fullscreen
            </button>
          </div>
        )}
      </MapContainer>
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur p-2 rounded-lg shadow-md border border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500 pointer-events-none">
        Live Disaster Map
      </div>
    </div>
  );
};
