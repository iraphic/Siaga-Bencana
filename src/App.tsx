import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Map as MapIcon, MessageSquare, AlertCircle, Info, ChevronRight, Zap, Navigation, Smartphone, Download, Share2, History, Filter, Maximize2, Minimize2, Key } from 'lucide-react';
import { EmergencyMap, DisasterEvent } from './components/EmergencyMap';
import { BMKGGisInfo } from './components/BMKGGisInfo';
import { EmergencyInput } from './components/EmergencyInput';
import { ResponseDisplay } from './components/ResponseDisplay';
import { QuickGuides } from './components/QuickGuides';
import { getEmergencyAdvice } from './services/geminiService';
import { LocalEmergencyContacts } from './components/LocalEmergencyContacts';
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'map'>('chat');
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [bmkgGempa, setBmkgGempa] = useState<any>(null);
  const [nearbyEvents, setNearbyEvents] = useState<DisasterEvent[]>([]);
  const [showGempaModal, setShowGempaModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [historyEvents, setHistoryEvents] = useState<DisasterEvent[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loadingTime, setLoadingTime] = useState(0);
  const [showQuickTips, setShowQuickTips] = useState(false);
  const seenEventIds = React.useRef<Set<string>>(new Set());
  const isFirstLoad = React.useRef<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchLocation = () => {
    if (navigator.geolocation) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setIsFetchingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsFetchingLocation(false);
          if (error.code === 1) {
            alert("Izin lokasi ditolak. Silakan aktifkan izin lokasi di browser Anda.");
          } else {
            alert("Gagal mendapatkan lokasi. Pastikan GPS Anda aktif.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert("Browser Anda tidak mendukung geolokasi.");
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const notifyUser = (event: DisasterEvent) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    
    const isSignificantEarthquake = event.type === 'Earthquake' && event.severity === 'High';
    const title = isSignificantEarthquake ? `🚨 GEMPA SIGNIFIKAN: ${event.title}` : `WASPADA: ${event.title}`;
    
    const notification = new Notification(title, {
      body: `${event.location}. Waktu: ${event.time}. Segera cari tempat aman jika Anda merasakan guncangan kuat.`,
      icon: 'https://cdn-icons-png.flaticon.com/512/595/595067.png', // Warning icon
      tag: event.id,
      requireInteraction: isSignificantEarthquake,
    });

    notification.onclick = () => {
      window.focus();
      setActiveTab('map');
      if (isSignificantEarthquake) {
        setShowGempaModal(true);
      }
    };
  };

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show banner after 5 seconds if not installed (fallback simulation)
    const timer = setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches && !deferredPrompt) {
        setShowInstallBanner(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      // Fallback for iOS or other browsers
      alert("Untuk menginstall di iPhone: Klik tombol 'Share' lalu pilih 'Add to Home Screen'.");
    }
    setShowInstallBanner(false);
  };

  useEffect(() => {
    fetchLocation();

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
                const eventId = `bmkg-${gempa.Tanggal}-${gempa.Jam}-${gempa.Magnitude}`;
                allEvents.push({
                  id: eventId,
                  title: `Gempa M ${gempa.Magnitude}`,
                  type: 'Earthquake',
                  lat: lat,
                  lng: lng,
                  severity: parseFloat(gempa.Magnitude) >= 5 ? 'High' : 'Medium',
                  time: `${gempa.Tanggal} ${gempa.Jam}`,
                  location: gempa.Wilayah,
                  source: 'BMKG'
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
                  severity: f.properties.severitydata?.severity || 'Unknown',
                  time: f.properties.fromdate ? new Date(f.properties.fromdate).toLocaleString('id-ID') : 'Tidak diketahui',
                  location: f.properties.country || 'Global',
                  source: 'GDACS'
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
            { 
              id: '1', 
              title: 'Banjir Luapan Sungai (Simulasi)', 
              type: 'Flood', 
              lat: -6.2, 
              lng: 106.8, 
              severity: 'High',
              time: new Date().toLocaleString('id-ID'),
              location: 'Jakarta Timur, DKI Jakarta'
            },
            { 
              id: '2', 
              title: 'Peringatan Dini Longsor (Simulasi)', 
              type: 'Landslide', 
              lat: -6.3, 
              lng: 106.9, 
              severity: 'Medium',
              time: new Date().toLocaleString('id-ID'),
              location: 'Bogor, Jawa Barat'
            },
          ];
        }

        setEvents(allEvents);
        setLastUpdated(new Date());

        // Notify for new events
        allEvents.forEach(event => {
          if (!seenEventIds.current.has(event.id)) {
            seenEventIds.current.add(event.id);
            // Only notify if it's not the first load
            if (!isFirstLoad.current) {
               notifyUser(event);
            }
          }
        });
        
        isFirstLoad.current = false;

        // 4. Fetch History (Simulated or from GDACS archives)
        // For now, let's take some older events or simulate
        const history = [
          {
            id: 'hist-1',
            title: 'Banjir Tahunan Jakarta',
            type: 'Flood',
            lat: -6.1751,
            lng: 106.8650,
            severity: 'High',
            time: 'Januari 2024',
            location: 'Jakarta Pusat'
          },
          {
            id: 'hist-2',
            title: 'Gempa Cianjur',
            type: 'Earthquake',
            lat: -6.8175,
            lng: 107.1427,
            severity: 'High',
            time: 'November 2022',
            location: 'Cianjur, Jawa Barat'
          }
        ];
        setHistoryEvents(history);
      } catch (error) {
        console.error("Error fetching disasters:", error);
      }
    };

    fetchDisasters();
    const interval = setInterval(fetchDisasters, 30000); // 30 seconds for real-time
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

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setLoadingTime(0);
      setShowQuickTips(false);
      interval = setInterval(() => {
        setLoadingTime(prev => {
          const next = prev + 1;
          if (next >= 5) {
            setShowQuickTips(true);
          }
          return next;
        });
      }, 1000);
    } else {
      setLoadingTime(0);
      setShowQuickTips(false);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const handleQuickAdvice = () => {
    const quickAdvice = `### 🚨 Panduan Darurat Dasar (Respon Cepat)

Sambil menunggu analisis mendalam dari AI, berikut adalah langkah keselamatan standar:

1. **Tetap Tenang**: Jangan panik, kepanikan akan menghambat pengambilan keputusan yang tepat.
2. **Cari Tempat Aman**: 
   - **Gempa**: Berlindung di bawah meja kuat atau lindungi kepala.
   - **Tsunami**: Segera jauhi pantai dan lari ke tempat yang lebih tinggi.
   - **Banjir**: Segera menuju ke tempat yang lebih tinggi.
   - **Kebakaran**: Keluar dari bangunan melalui jalur evakuasi, jangan gunakan lift.
3. **Hubungi Nomor Darurat**: Segera hubungi **112** (Layanan Darurat Terpadu) atau nomor spesifik lainnya di sidebar.
4. **Pantau Informasi Resmi**: Ikuti arahan dari petugas di lapangan atau radio/TV berita.

*AI masih memproses detail spesifik untuk situasi Anda...*`;

    setResponse(quickAdvice);
    setIsLoading(false);
    setShowQuickTips(false);
    
    const assistantMsg: ChatMessage = {
      id: `quick-${Date.now()}`,
      role: 'assistant',
      content: quickAdvice,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, assistantMsg]);
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    
    setChatHistory(prev => [...prev, userMsg]);
    setIsLoading(true);
    setResponse(null);
    setActiveTab('chat');
    
    const locationObj = userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined;
    const advice = await getEmergencyAdvice(text, locationObj);
    
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: advice,
      timestamp: new Date()
    };
    
    setChatHistory(prev => [...prev, assistantMsg]);
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

  const handleShare = async (event: DisasterEvent) => {
    const shareData = {
      title: `Waspada: ${event.title}`,
      text: `Peringatan Bencana ${event.type} di ${event.location}. Waktu: ${event.time}. Pantau terus di SiagaBencana.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Info bencana disalin ke clipboard!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    }
  };

  const disasterTypes = ['All', 'Gempa BMKG', ...Array.from(new Set(events.filter(e => e.source !== 'BMKG').map(e => e.type)))];
  const filteredEvents = selectedType === 'All' 
    ? events 
    : selectedType === 'Gempa BMKG'
      ? events.filter(e => e.source === 'BMKG')
      : events.filter(e => e.type === selectedType);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 md:pb-8">
      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 z-[100] md:bottom-8 md:left-auto md:right-8 md:w-80 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-600 p-2 rounded-xl">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Install App</p>
                <p className="text-[10px] text-slate-400 font-medium">Akses lebih cepat di smartphone</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1"
              >
                Nanti
              </button>
              <button 
                onClick={handleInstallClick}
                className="bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <Download size={12} />
                Install
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        onClick={() => {
          setShowFeedbackModal(true);
          setShowInstallBanner(true);
        }}
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
                <span className="text-[9px] opacity-60 ml-2 whitespace-nowrap">Update: {lastUpdated.toLocaleTimeString('id-ID')}</span>
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

      {/* Global Loading Progress Bar */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] h-1 bg-slate-100"
          >
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "90%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
            />
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
              onClick={() => {
                setActiveTab('chat');
                setShowInstallBanner(true);
              }}
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

          {/* Notification Toggle */}
          {("Notification" in window) && (
            <button 
              onClick={() => {
                if (Notification.permission === 'default') {
                  Notification.requestPermission();
                } else if (Notification.permission === 'denied') {
                  alert("Notifikasi diblokir. Silakan aktifkan di pengaturan browser Anda untuk menerima peringatan gempa.");
                }
              }}
              className={cn(
                "p-2 rounded-xl transition-all",
                Notification.permission === 'granted' 
                  ? "text-emerald-600 bg-emerald-50" 
                  : "text-slate-400 bg-slate-100 hover:text-red-600 hover:bg-red-50"
              )}
              title={Notification.permission === 'granted' ? "Notifikasi Aktif" : "Aktifkan Notifikasi Bahaya"}
            >
              <Zap size={18} className={Notification.permission === 'granted' ? "fill-emerald-600" : ""} />
            </button>
          )}

          {/* AI Studio Key Selection */}
          {(window as any).aistudio && (
            <button 
              onClick={async () => {
                try {
                  await (window as any).aistudio.openSelectKey();
                  window.location.reload(); // Reload to apply new key
                } catch (err) {
                  console.error("Failed to open key selector", err);
                }
              }}
              className="p-2 rounded-xl text-slate-400 bg-slate-100 hover:text-blue-600 hover:bg-blue-50 transition-all"
              title="Pilih API Key (AI Studio)"
            >
              <Key size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden bg-white p-1 rounded-2xl border border-slate-200 mb-8 shadow-sm">
          <button
            onClick={() => {
              setActiveTab('chat');
              setShowInstallBanner(true);
            }}
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
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Butuh Bantuan Segera?</h2>
                  <p className="text-slate-500 font-medium">Jelaskan situasi Anda, AI kami akan memberikan panduan taktis.</p>
                </div>
              </div>
              <EmergencyInput onSend={handleSend} isLoading={isLoading} />
            </section>

            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="space-y-4 mt-8">
                {chatHistory.slice(0, -1).map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[85%] p-4 rounded-2xl text-sm",
                      msg.role === 'user' 
                        ? "bg-slate-100 text-slate-700 self-end ml-auto rounded-tr-none" 
                        : "bg-white border border-slate-100 text-slate-600 self-start mr-auto rounded-tl-none shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        {msg.role === 'user' ? 'Anda' : 'Asisten AI'}
                      </span>
                      <span className="text-[9px] opacity-30 font-medium">
                        {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="markdown-body">
                      {msg.role === 'assistant' ? (
                        <ResponseDisplay response={msg.content} isLoading={false} isMinimal />
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Current User Input (Last message if it's from user) */}
                {chatHistory[chatHistory.length - 1]?.role === 'user' && (
                  <div className="flex flex-col max-w-[85%] p-4 rounded-2xl text-sm bg-slate-100 text-slate-700 self-end ml-auto rounded-tr-none">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Anda</span>
                      <span className="text-[9px] opacity-30 font-medium">
                        {chatHistory[chatHistory.length - 1].timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p>{chatHistory[chatHistory.length - 1].content}</p>
                  </div>
                )}
              </div>
            )}

            <ResponseDisplay response={response} isLoading={isLoading} />
            
            <AnimatePresence>
              {isLoading && showQuickTips && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex flex-col items-center gap-3 p-6 bg-red-50 border border-red-100 rounded-3xl mt-4"
                >
                  <div className="flex items-center gap-2 text-red-600">
                    <Zap size={18} className="animate-pulse" />
                    <p className="text-xs font-black uppercase tracking-widest">Koneksi Lambat?</p>
                  </div>
                  <p className="text-[11px] text-red-700 font-medium text-center">
                    AI membutuhkan waktu lebih lama untuk menganalisis. Ingin panduan keselamatan dasar segera?
                  </p>
                  <button
                    onClick={handleQuickAdvice}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex items-center gap-2"
                  >
                    <Shield size={14} />
                    Dapatkan Panduan Cepat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
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
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-red-600 transition-colors uppercase tracking-widest"
                    title={isMapFullscreen ? "Keluar Fullscreen" : "Fullscreen Map"}
                  >
                    {isMapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    {isMapFullscreen ? "Normal" : "Full Screen"}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Live Updates</span>
                  </div>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <Filter size={14} className="text-slate-400 shrink-0" />
                {disasterTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                      selectedType === type 
                        ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-600/20" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-red-200"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <EmergencyMap 
                userLocation={userLocation} 
                events={filteredEvents} 
                onShare={handleShare}
                className={isMapFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen rounded-none" : ""}
                isFullscreen={isMapFullscreen}
                onToggleFullscreen={() => setIsMapFullscreen(false)}
              />
              <BMKGGisInfo userLocation={userLocation} />
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
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredEvents.length > 0 ? filteredEvents.map((event) => {
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
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(event);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Bagikan Info"
                          >
                            <Share2 size={14} />
                          </button>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400 font-medium italic">Tidak ada bencana tipe ini.</p>
                    </div>
                  )}
                </div>

                {/* History Section */}
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    <History size={12} />
                    Riwayat Bencana Terdekat
                  </h4>
                  <div className="space-y-2">
                    {historyEvents.map((hist) => (
                      <div key={hist.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-700">{hist.title}</p>
                          <p className="text-[9px] text-slate-400">{hist.time} • {hist.location}</p>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300">{hist.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {!userLocation && !isLoading && (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-center">
                <Navigation size={24} className="mx-auto text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Lokasi Belum Aktif</p>
                <p className="text-[10px] text-slate-400 font-medium mb-4">Aktifkan lokasi untuk melihat nomor darurat lokal dan bahaya di sekitar Anda secara real-time.</p>
                <button 
                  onClick={fetchLocation}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                >
                  Ambil Lokasi Sekarang
                </button>
              </div>
            )}

            {userLocation && (
              <LocalEmergencyContacts lat={userLocation[0]} lng={userLocation[1]} />
            )}

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
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PLN (Listrik)</p>
                  <p className="text-xl font-black">123</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BNPB</p>
                  <p className="text-xl font-black">117</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Disclaimer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 opacity-50">
              <Shield size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">SiagaBencana © 2026</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">v1.4.4-stable</span>
              <span>Patch: 6 Mar 2026, 13:25</span>
            </div>
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
