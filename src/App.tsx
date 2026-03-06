import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Map as MapIcon, MessageSquare, AlertCircle, Info, ChevronRight, Zap, Navigation } from 'lucide-react';
import { EmergencyMap, DisasterEvent } from './components/EmergencyMap';
import { EmergencyInput } from './components/EmergencyInput';
import { ResponseDisplay } from './components/ResponseDisplay';
import { QuickGuides } from './components/QuickGuides';
import { getEmergencyAdvice } from './services/geminiService';
import { cn } from './utils/cn';

// Haversine formula to calculate distance in km
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function App() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'map'>('chat');
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [bmkgGempa, setBmkgGempa] = useState<any>(null);
  const [nearbyEvents, setNearbyEvents] = useState<DisasterEvent[]>([]);
  const [showGempaModal, setShowGempaModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }

    const fetchDisasters = async () => {
      try {
        let allEvents: DisasterEvent[] = [];
        
        // 1. Fetch BMKG Earthquake
        try {
          const bmkgResponse = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', { cache: 'no-store' });
          if (bmkgResponse.ok) {
            const text = await bmkgResponse.text();
            try {
              const bmkgData = JSON.parse(text);
              const gempa = bmkgData?.Infogempa?.gempa;
              if (gempa) {
                setBmkgGempa(gempa);
                const [lat, lng] = gempa.Coordinates.split(',').map(Number);
                allEvents.push({
                  id: 'bmkg-auto',
                  title: `Gempa M ${gempa.Magnitude} - ${gempa.Wilayah}`,
                  type: 'Earthquake',
                  lat: lat,
                  lng: lng,
                  severity: parseFloat(gempa.Magnitude) >= 5 ? 'High' : 'Medium'
                });
              }
            } catch (parseError) {
              console.warn("BMKG JSON parse failed");
            }
          }
        } catch (e) {
          console.error("Error fetching BMKG data:", e);
        }

        // 2. Fetch GDACS for global/other events
        try {
          const response = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/json');
          if (response.ok) {
            const text = await response.text();
            try {
              const data = JSON.parse(text);
              if (data && data.features) {
                const realEvents = data.features.slice(0, 10).map((f: any) => ({
                  id: f.properties.eventid || Math.random().toString(),
                  title: f.properties.eventname || 'Bencana Global',
                  type: f.properties.eventtype || 'Unknown',
                  lat: f.geometry.coordinates[1],
                  lng: f.geometry.coordinates[0],
                  severity: f.properties.severitydata?.severity || 'Unknown'
                }));
                allEvents = [...allEvents, ...realEvents];
              }
            } catch (parseError) {
              console.warn("GDACS JSON parse failed");
            }
          }
        } catch (e) {
          console.error("Error fetching GDACS data:", e);
        }

        // 3. Fallback mock if empty
        if (allEvents.length === 0) {
          allEvents = [
            { id: '1', title: 'Banjir Luapan Sungai (Simulasi)', type: 'Flood', lat: -6.2, lng: 106.8, severity: 'High' },
            { id: '2', title: 'Peringatan Dini Longsor (Simulasi)', type: 'Landslide', lat: -6.3, lng: 106.9, severity: 'Medium' },
          ];
        }

        setEvents(allEvents);
      } catch (error) {
        console.error("Error fetching disasters:", error);
      }
    };

    fetchDisasters();
    const interval = setInterval(fetchDisasters, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter nearby events when location or events change
  useEffect(() => {
    if (userLocation && events.length > 0) {
      const nearby = events.filter(event => {
        const dist = getDistance(userLocation[0], userLocation[1], event.lat, event.lng);
        return dist <= 5; // 5km radius
      });
      setNearbyEvents(nearby);
    }
  }, [userLocation, events]);

  const handleSend = async (text: string) => {
    setIsLoading(true);
    setResponse(null);
    setActiveTab('chat');
    
    const locationObj = userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined;
    const advice = await getEmergencyAdvice(text, locationObj);
    
    setResponse(advice);
    setIsLoading(false);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent("Saran & Masukan App SiagaBencana");
    const body = encodeURIComponent(feedbackText);
    window.location.href = `mailto:rafii.naufal.213@gmail.com?subject=${subject}&body=${body}`;
    setShowFeedbackModal(false);
    setFeedbackText('');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 md:pb-8">
      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl">
                    <MessageSquare size={20} />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-sm">Saran & Masukan</h3>
                </div>
                <button onClick={() => setShowFeedbackModal(false)} className="text-white/40 hover:text-white">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleFeedbackSubmit} className="p-8 space-y-6">
                <p className="text-sm text-slate-500 font-medium">
                  Bantu kami meningkatkan layanan SiagaBencana. Masukan Anda akan dikirim langsung ke tim pengembang.
                </p>
                <textarea
                  required
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tulis saran atau masukan Anda di sini..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none"
                />
                <button 
                  type="submit"
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Kirim Masukan
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Feedback Button */}
      <button
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all group"
        title="Kirim Saran"
      >
        <MessageSquare size={24} className="group-hover:rotate-12 transition-transform" />
        <div className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Saran & Masukan
        </div>
      </button>
      {/* Earthquake Detail Modal */}
      <AnimatePresence>
        {showGempaModal && bmkgGempa && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-red-600 p-6 text-white">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Zap size={24} className="fill-white" />
                  </div>
                  <button 
                    onClick={() => setShowGempaModal(false)}
                    className="text-white/60 hover:text-white"
                  >
                    <AlertCircle size={24} className="rotate-45" />
                  </button>
                </div>
                <h3 className="text-2xl font-black leading-tight">Detail Gempa Terkini</h3>
                <p className="text-white/80 text-sm font-bold uppercase tracking-widest mt-1">Sumber: BMKG Indonesia</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Magnitudo</p>
                    <p className="text-2xl font-black text-red-600">{bmkgGempa.Magnitude} SR</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kedalaman</p>
                    <p className="text-2xl font-black text-slate-900">{bmkgGempa.Kedalaman}</p>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="mt-1 text-red-500"><Navigation size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lokasi & Wilayah</p>
                      <p className="text-sm font-bold text-slate-800 leading-snug">{bmkgGempa.Wilayah}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Koordinat: {bmkgGempa.Coordinates}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 text-blue-500"><Info size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Waktu Kejadian</p>
                      <p className="text-sm font-bold text-slate-800">{bmkgGempa.Tanggal}, {bmkgGempa.Jam}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 text-orange-500"><Shield size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Potensi</p>
                      <p className="text-sm font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded-lg inline-block">{bmkgGempa.Potensi}</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowGempaModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors"
                >
                  Mengerti & Tetap Waspada
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BMKG Banner */}
      <AnimatePresence>
        {bmkgGempa && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-red-600 text-white overflow-hidden cursor-pointer hover:bg-red-700 transition-colors"
            onClick={() => setShowGempaModal(true)}
          >
            <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold">
                <Zap size={16} className="animate-pulse fill-white" />
                <span id="gempa-banner">
                  📍 <b>Gempa Terkini (BMKG):</b> Mag {bmkgGempa.Magnitude}, {bmkgGempa.Wilayah}. <span className="underline decoration-white/40 underline-offset-2 ml-1">Klik untuk detail</span>
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setBmkgGempa(null);
                }}
                className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-1.5 rounded-lg text-white">
              <Shield size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight leading-none">SIAGABENCANA</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Emergency Assistant</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('chat')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-colors",
                activeTab === 'chat' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Asisten AI
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-colors",
                activeTab === 'map' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Peta Bahaya
            </button>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Sistem Aktif</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden bg-white p-1 rounded-2xl border border-slate-200 mb-8 shadow-sm">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              activeTab === 'chat' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-500"
            )}
          >
            <MessageSquare size={18} />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              activeTab === 'map' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-500"
            )}
          >
            <MapIcon size={18} />
            Peta
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className={cn(
            "lg:col-span-7 space-y-8",
            activeTab === 'map' && "hidden lg:block"
          )}>
            <section>
              <div className="mb-6">
                <h2 className="text-3xl font-black tracking-tight text-slate-900">Butuh Bantuan Segera?</h2>
                <p className="text-slate-500 font-medium">Jelaskan situasi Anda, AI kami akan memberikan panduan taktis.</p>
              </div>
              <EmergencyInput onSend={handleSend} isLoading={isLoading} />
            </section>

            <ResponseDisplay response={response} isLoading={isLoading} />
            
            {!response && !isLoading && (
              <>
                <QuickGuides />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                      <AlertCircle size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Siaga Banjir</h3>
                    <ul className="text-xs text-slate-500 space-y-2">
                      <li className="flex gap-2"><span>•</span> Matikan aliran listrik dari saklar utama.</li>
                      <li className="flex gap-2"><span>•</span> Amankan dokumen penting dalam wadah kedap air.</li>
                      <li className="flex gap-2"><span>•</span> Pindahkan barang elektronik ke tempat tinggi.</li>
                      <li className="flex gap-2"><span>•</span> Pantau informasi debit air dari sumber resmi.</li>
                    </ul>
                  </div>
                  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4">
                      <Info size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Tas Darurat (72 Jam)</h3>
                    <ul className="text-xs text-slate-500 space-y-2">
                      <li className="flex gap-2"><span>•</span> Air minum & makanan siap saji (3 hari).</li>
                      <li className="flex gap-2"><span>•</span> Kotak P3K & obat-obatan pribadi.</li>
                      <li className="flex gap-2"><span>•</span> Senter, baterai cadangan & powerbank.</li>
                      <li className="flex gap-2"><span>•</span> Uang tunai, pakaian ganti & masker.</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sidebar / Map Area */}
          <div className={cn(
            "lg:col-span-5 space-y-6",
            activeTab === 'chat' && "hidden lg:block"
          )}>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-xs">Peta Peringatan Dini</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Live Updates</span>
                </div>
              </div>
              <EmergencyMap userLocation={userLocation} events={events} />
              <div className="mt-4 space-y-3">
                <div className={cn(
                  "flex items-start gap-3 p-3 rounded-2xl border transition-colors",
                  nearbyEvents.length > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
                )}>
                  {nearbyEvents.length > 0 ? <AlertCircle size={16} className="text-red-600 mt-0.5" /> : <Navigation size={16} className="text-emerald-600 mt-0.5" />}
                  <div>
                    <p className={cn("text-xs font-bold", nearbyEvents.length > 0 ? "text-red-900" : "text-emerald-900")}>
                      {nearbyEvents.length > 0 ? "Bahaya Terdekat (Radius 5km)" : "Area Sekitar Aman"}
                    </p>
                    <p className={cn("text-[10px] font-medium", nearbyEvents.length > 0 ? "text-red-700" : "text-emerald-700")}>
                      {nearbyEvents.length > 0 
                        ? `Ditemukan ${nearbyEvents.length} ancaman dalam radius 5km.` 
                        : "Tidak ada ancaman bencana terdeteksi di radius 5km."}
                    </p>
                  </div>
                </div>
                
                {/* List of disasters */}
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {events.map((event) => {
                    const dist = userLocation ? getDistance(userLocation[0], userLocation[1], event.lat, event.lng) : null;
                    const isNearby = dist !== null && dist <= 5;

                    return (
                      <div key={event.id} className={cn(
                        "p-3 rounded-xl border flex items-center justify-between group transition-colors",
                        isNearby ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-100 hover:border-red-200"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            event.severity === 'High' ? "bg-red-500" : "bg-orange-500"
                          )} />
                          <div>
                            <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{event.title}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">{event.type}</p>
                              {dist !== null && (
                                <p className="text-[9px] text-slate-500 font-bold">
                                  • {dist.toFixed(1)} km
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-slate-900/20">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-red-500" />
                Nomor Darurat (Indonesia)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ambulans</p>
                  <p className="text-xl font-black">118 / 119</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Polisi</p>
                  <p className="text-xl font-black">110</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pemadam</p>
                  <p className="text-xl font-black">113</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Basarnas</p>
                  <p className="text-xl font-black">115</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Disclaimer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Shield size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">SiagaBencana © 2026</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Idea Apps by</span>
            <span className="text-xs font-black text-slate-900 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">Raf</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
