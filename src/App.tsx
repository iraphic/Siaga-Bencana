import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { translations } from './translations';
import { Shield, Map as MapIcon, MessageSquare, AlertCircle, Info, ChevronRight, Zap, Navigation, Smartphone, Download, Share2, History, Filter, Maximize2, Minimize2, Phone, MapPin, Sun, Languages, CloudRain, CloudLightning, Cloud, Thermometer, Wind, Compass } from 'lucide-react';
import { EmergencyMap, DisasterEvent } from './components/EmergencyMap';
import { BMKGGisInfo } from './components/BMKGGisInfo';
import { EmergencyInput } from './components/EmergencyInput';
import { ResponseDisplay } from './components/ResponseDisplay';
import { QuickGuides } from './components/QuickGuides';
import { getEmergencyAdvice } from './services/geminiService';
import { LocalEmergencyContacts } from './components/LocalEmergencyContacts';
import { cn } from './utils/cn';
import { fetchWithProxy } from './utils/fetchWithProxy';

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

export interface WeatherForecast {
  time: string;
  temp: number;
  condition: string;
  icon: string;
}

export interface WeatherInfo {
  location: string;
  temp: number;
  condition: string;
  icon: string;
  description: string;
  humidity?: number;
  windSpeed?: number;
  windDirection?: string;
  forecasts?: WeatherForecast[];
}

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
  const [activeTab, setActiveTab] = useState<'chat' | 'map' | 'emergency'>('chat');
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
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const getWindDirection = (code: string) => {
    const directions: { [key: string]: string } = {
      'N': lang === 'id' ? 'Utara' : 'North',
      'NNE': lang === 'id' ? 'Utara Timur Laut' : 'North-Northeast',
      'NE': lang === 'id' ? 'Timur Laut' : 'Northeast',
      'ENE': lang === 'id' ? 'Timur Timur Laut' : 'East-Northeast',
      'E': lang === 'id' ? 'Timur' : 'East',
      'ESE': lang === 'id' ? 'Timur Tenggara' : 'East-Southeast',
      'SE': lang === 'id' ? 'Tenggara' : 'Southeast',
      'SSE': lang === 'id' ? 'Selatan Tenggara' : 'South-Southeast',
      'S': lang === 'id' ? 'Selatan' : 'South',
      'SSW': lang === 'id' ? 'Selatan Barat Daya' : 'South-Southwest',
      'SW': lang === 'id' ? 'Barat Daya' : 'Southwest',
      'WSW': lang === 'id' ? 'Barat Barat Daya' : 'West-Southwest',
      'W': lang === 'id' ? 'Barat' : 'West',
      'WNW': lang === 'id' ? 'Barat Barat Laut' : 'West-Northwest',
      'NW': lang === 'id' ? 'Barat Laut' : 'Northwest',
      'NNW': lang === 'id' ? 'Utara Barat Laut' : 'North-Northwest',
      'VARIABLE': lang === 'id' ? 'Berubah-ubah' : 'Variable'
    };
    return directions[code.toUpperCase()] || code;
  };

  const fetchWeather = async (lat: number, lon: number) => {
    setIsFetchingWeather(true);
    
    try {
      const apiUrl = `https://openapi.de4a.space/api/weather/forecast?lat=${lat}&long=${lon}`;
      const weatherData = await fetchWithProxy(apiUrl);
      
      if (weatherData && weatherData.status === 1 && weatherData.data && weatherData.data.length > 0) {
        const locationInfo = weatherData.data[0].location;
        const areaName = `${locationInfo.subdistrict}, ${locationInfo.city}`;
        
        // Flatten weather data
        const allForecasts: any[] = [];
        weatherData.data[0].weather.forEach((group: any[]) => {
          group.forEach((item: any) => {
            allForecasts.push(item);
          });
        });

        // Sort by datetime
        allForecasts.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

        const now = new Date();
        // Find current or next forecast
        let currentIndex = allForecasts.findIndex(f => new Date(f.datetime) >= now);
        if (currentIndex === -1) currentIndex = 0;

        const current = allForecasts[currentIndex];

        // Generate next forecasts (3-hour intervals as provided by API)
        const nextForecasts: WeatherForecast[] = [];
        for (let i = 1; i <= 5; i++) {
          const idx = currentIndex + i;
          if (allForecasts[idx]) {
            const f = allForecasts[idx];
            const fDate = new Date(f.datetime);
            const hour = String(fDate.getHours()).padStart(2, '0');
            const day = String(fDate.getDate()).padStart(2, '0');
            const month = String(fDate.getMonth() + 1).padStart(2, '0');
            
            let timeLabel = `${day}/${month} ${hour}:00`;
            if (i === 1) timeLabel = lang === 'id' ? "3 Jam Lagi" : "3h Later";
            if (i === 2) timeLabel = lang === 'id' ? "6 Jam Lagi" : "6h Later";

            nextForecasts.push({
              time: timeLabel,
              temp: Math.round(f.t),
              condition: f.weather_desc,
              icon: f.image
            });
          }
        }

        setWeather({
          location: areaName,
          temp: Math.round(current.t),
          condition: current.weather_desc,
          icon: current.image,
          description: current.weather_desc,
          humidity: current.hu,
          windSpeed: current.ws,
          windDirection: current.wd,
          forecasts: nextForecasts
        });
      }
    } catch (error) {
      console.error("Error fetching weather:", error);
      if (!weather) {
        setWeather({
          location: "Lokasi Anda",
          temp: 28,
          condition: "Berawan",
          icon: "",
          description: "Data cuaca tidak tersedia sementara"
        });
      }
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const fetchLocation = () => {
    if (navigator.geolocation) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setUserLocation([lat, lon]);
          setIsFetchingLocation(false);
          fetchWeather(lat, lon);
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsFetchingLocation(false);
          if (error.code === 1) {
            alert(t.location_denied);
          } else {
            alert(t.location_failed);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert(t.browser_not_supported);
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
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setShowInstallBanner(false);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show banner after 5 seconds if not installed (fallback simulation)
    const timer = setTimeout(() => {
      if (!isStandalone && !deferredPrompt) {
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
          const bmkgData = await fetchWithProxy('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
          if (bmkgData) {
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
          }
        } catch (e) {
          console.error("Error fetching BMKG data:", e);
        }

        // 2. Fetch GDACS for global/other events
        try {
          const data = await fetchWithProxy('https://www.gdacs.org/gdacsapi/api/events/geteventlist/json');
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

  const downloadChatAsPDF = () => {
    if (chatHistory.length === 0) return;
    
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text("SiagaBencana - Konsultasi Darurat", margin, y);
    y += 10;
    
    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Waktu Unduh: ${new Date().toLocaleString('id-ID')}`, margin, y);
    y += 15;
    
    chatHistory.forEach((msg) => {
      const role = msg.role === 'user' ? "PENGGUNA" : "ASISTEN AI";
      const time = msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      // Role Header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(msg.role === 'user' ? 51 : 15, msg.role === 'user' ? 65 : 23, msg.role === 'user' ? 85 : 42); // Slate-800 or Slate-900
      doc.text(`${role} (${time}):`, margin, y);
      y += 7;
      
      // Content
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // Slate-600
      
      // Clean markdown-like syntax for PDF
      const cleanContent = msg.content
        .replace(/###\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '• ')
        .replace(/`{1,3}/g, '');
        
      const splitText = doc.splitTextToSize(cleanContent, 180);
      doc.text(splitText, margin, y);
      
      y += (splitText.length * 5) + 12;
      
      // Page break check
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    
    // Footer on last page
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("Dokumen ini dihasilkan secara otomatis oleh SiagaBencana AI. Simpan untuk akses offline.", margin, 285);
    
    doc.save(`SiagaBencana_Konsultasi_${new Date().getTime()}.pdf`);
  };

  const disasterTypes = ['All', 'Gempa BMKG', ...Array.from(new Set(events.filter(e => e.source !== 'BMKG').map(e => e.type)))];
  const filteredEvents = selectedType === 'All' 
    ? events 
    : selectedType === 'Gempa BMKG'
      ? events.filter(e => e.source === 'BMKG')
      : events.filter(e => e.type === selectedType);

  const getWeatherIcon = (condition: string, size = 20, iconUrl?: string) => {
    if (iconUrl) {
      return <img src={iconUrl} alt={condition} style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
    }
    const c = condition.toLowerCase();
    if (c.includes('hujan') || c.includes('rain')) return <CloudRain size={size} className="text-blue-400" />;
    if (c.includes('petir') || c.includes('storm')) return <CloudLightning size={size} className="text-yellow-400" />;
    if (c.includes('cerah') || c.includes('clear') || c.includes('sun')) return <Sun size={size} className="text-orange-400" />;
    if (c.includes('berawan') || c.includes('cloud')) return <Cloud size={size} className="text-slate-400" />;
    return <Cloud size={size} className="text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 pb-24 md:pb-8 transition-colors">
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
              className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl transition-colors"
            >
              <div className="bg-slate-900 dark:bg-slate-950 p-6 text-white flex justify-between items-center transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl">
                    <MessageSquare size={20} />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-sm">{t.feedback_button}</h3>
                </div>
                <button onClick={() => setShowFeedbackModal(false)} className="text-white/40 hover:text-white">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleFeedbackSubmit} className="p-8 space-y-6 bg-white dark:bg-slate-900 transition-colors">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">
                  {t.feedback_title}
                </p>
                <textarea
                  required
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={t.feedback_placeholder}
                  className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none"
                />
                <button 
                  type="submit"
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  {t.feedback_submit}
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
        }}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all group"
        title={t.feedback_button}
      >
        <MessageSquare size={24} className="group-hover:rotate-12 transition-transform" />
        <div className="absolute right-full mr-4 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t.feedback_button}
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
              className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl transition-colors"
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
                <h3 className="text-2xl font-black leading-tight">{t.earthquake_detail}</h3>
                <p className="text-white/80 text-sm font-bold uppercase tracking-widest mt-1">Sumber: BMKG Indonesia</p>
              </div>
              
              <div className="p-8 space-y-6 bg-white dark:bg-slate-900 transition-colors">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">{t.magnitude}</p>
                    <p className="text-2xl font-black text-red-600 dark:text-red-500 transition-colors">{bmkgGempa.Magnitude} SR</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">{t.depth}</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white transition-colors">{bmkgGempa.Kedalaman}</p>
                  </div>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800 w-full transition-colors" />

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="mt-1 text-red-500 dark:text-red-400"><Navigation size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">{t.location}</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug transition-colors">{bmkgGempa.Wilayah}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 transition-colors">Koordinat: {bmkgGempa.Coordinates}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 text-blue-500 dark:text-blue-400"><Info size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">{t.event_time}</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors">{bmkgGempa.Tanggal}, {bmkgGempa.Jam}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="mt-1 text-orange-500 dark:text-orange-400"><Shield size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">{t.potential}</p>
                      <p className="text-sm font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg inline-block transition-colors">{bmkgGempa.Potensi}</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowGempaModal(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.understand_button}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Weather Banner */}
      <AnimatePresence>
        {weather && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 overflow-hidden transition-colors"
          >
            <div className="max-w-5xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm transition-colors shrink-0">
                    {getWeatherIcon(weather.condition, 20, weather.icon)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t.weather_forecast}</span>
                      <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{weather.location}</span>
                        <a href="https://openapi.de4a.space/docs" target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-slate-400 dark:text-slate-600 hover:text-blue-500 transition-colors uppercase tracking-tighter">OpenAPI</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{weather.temp}°C</span>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate">{weather.condition}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setWeather(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black uppercase tracking-widest transition-colors shrink-0"
                >
                  {lang === 'id' ? 'Tutup' : 'Close'}
                </button>
              </div>

              {/* Weather Detail Cards */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center transition-colors">
                  <Thermometer size={14} className="text-blue-500 mb-1" />
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">{t.humidity}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{weather.humidity}%</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center transition-colors">
                  <Wind size={14} className="text-emerald-500 mb-1" />
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">{t.wind_speed}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{weather.windSpeed} km/h</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center transition-colors">
                  <Compass size={14} className="text-orange-500 mb-1" />
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">{t.wind_direction}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate w-full text-center">
                    {weather.windDirection ? getWindDirection(weather.windDirection) : '-'}
                  </span>
                </div>
              </div>

              {/* Forecast Row */}
              {weather.forecasts && weather.forecasts.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {weather.forecasts.map((f, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[70px] bg-white/40 dark:bg-slate-900/40 rounded-xl py-2 px-3 border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter mb-1">{f.time}</span>
                      <div className="flex items-center gap-1.5 mb-1">
                        {getWeatherIcon(f.condition, 14, f.icon)}
                        <span className="text-xs font-black text-slate-900 dark:text-white">{f.temp}°</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 truncate w-full text-center leading-tight">{f.condition}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
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
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-1.5 rounded-lg text-white">
              <Shield size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight leading-none text-slate-900 dark:text-white">{t.app_name}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.app_desc}</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => {
                setActiveTab('chat');
              }}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-colors",
                activeTab === 'chat' ? "text-red-600" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              {t.chat_tab}
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-colors",
                activeTab === 'map' ? "text-red-600" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              {t.map_tab}
            </button>
            <button 
              onClick={() => setActiveTab('emergency')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-colors",
                activeTab === 'emergency' ? "text-red-600" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              {t.emergency_tab}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-1 md:mr-2">
              <button 
                onClick={() => setLang('id')}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  lang === 'id' ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                )}
              >
                ID
              </button>
              <button 
                onClick={() => setLang('en')}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  lang === 'en' ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                )}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 mb-8 shadow-sm transition-colors">
          <button
            onClick={() => {
              setActiveTab('chat');
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-[10px] font-bold transition-all",
              activeTab === 'chat' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <MessageSquare size={14} />
            {t.chat_tab}
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-[10px] font-bold transition-all",
              activeTab === 'map' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <MapIcon size={14} />
            {t.map_tab}
          </button>
          <button
            onClick={() => setActiveTab('emergency')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-[10px] font-bold transition-all",
              activeTab === 'emergency' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <Phone size={14} />
            {t.emergency_tab}
          </button>
        </div>

        {activeTab === 'emergency' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white transition-colors">{t.emergency_contacts_title}</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">{t.emergency_contacts_desc}</p>
                </div>
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-2xl border border-red-100 dark:border-red-900/30 transition-colors">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-widest">{t.status_24h}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* National Numbers */}
                <div className="bg-slate-900 dark:bg-slate-950 text-white p-8 rounded-[24px] shadow-xl shadow-slate-900/20 transition-colors">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
                    <Shield size={24} className="text-red-500" />
                    {t.national_service}
                  </h3>
                  <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.national_numbers.ambulance}</p>
                      <p className="text-2xl font-black">118 / 119</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.national_numbers.police}</p>
                      <p className="text-2xl font-black">110</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.national_numbers.fire}</p>
                      <p className="text-2xl font-black">113</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.national_numbers.basarnas}</p>
                      <p className="text-2xl font-black">115</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.national_numbers.pln}</p>
                      <p className="text-2xl font-black">123</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.national_numbers.emergency}</p>
                      <p className="text-2xl font-black text-red-500">112</p>
                    </div>
                  </div>
                </div>

                {/* Local Context Info */}
                <div className="flex flex-col justify-center space-y-6">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Navigation size={18} className="text-blue-600 dark:text-blue-400" />
                      {t.local_info_title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t.local_info_desc}
                    </p>
                  </div>
                  {!userLocation && (
                    <button 
                      onClick={fetchLocation}
                      className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-all flex items-center justify-center gap-3"
                    >
                      <MapPin size={18} />
                      {t.activate_location}
                    </button>
                  )}
                </div>
              </div>

              {userLocation && (
                <div className="mt-12">
                  <LocalEmergencyContacts lat={userLocation[0]} lng={userLocation[1]} t={t} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Content Area */}
            <div className={cn(
              "lg:col-span-7 space-y-8",
              activeTab !== 'chat' && "hidden lg:block"
            )}>
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white transition-colors">{t.emergency_advice_title}</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">{t.emergency_advice_desc}</p>
                </div>
              </div>
              <EmergencyInput onSend={handleSend} isLoading={isLoading} t={t} />
            </section>

            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="space-y-4 mt-8">
                {chatHistory.slice(0, -1).map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[85%] p-4 rounded-2xl text-sm transition-colors",
                      msg.role === 'user' 
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-end ml-auto rounded-tr-none" 
                        : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 self-start mr-auto rounded-tl-none shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        {msg.role === 'user' ? t.user : t.assistant}
                      </span>
                      <span className="text-[9px] opacity-30 font-medium">
                        {msg.timestamp.toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
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
                  <div className="flex flex-col max-w-[85%] p-4 rounded-2xl text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-end ml-auto rounded-tr-none transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{t.user}</span>
                      <span className="text-[9px] opacity-30 font-medium">
                        {chatHistory[chatHistory.length - 1].timestamp.toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p>{chatHistory[chatHistory.length - 1].content}</p>
                  </div>
                )}
              </div>
            )}

            <ResponseDisplay response={response} isLoading={isLoading} />
            
            {chatHistory.length > 0 && !isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center mt-6"
              >
                <button
                  onClick={downloadChatAsPDF}
                  className="flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xl shadow-slate-900/20 group"
                >
                  <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                  {t.download_chat}
                </button>
              </motion.div>
            )}
            
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
                <QuickGuides t={t} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                      <Zap size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 transition-colors">{t.guides.powerbank.title}</h3>
                    <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 transition-colors">
                      {t.guides.powerbank.steps.map((step: string, i: number) => (
                        <li key={i} className="flex gap-2"><span>•</span> {step}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                      <Info size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 transition-colors">{t.guides.tas_darurat.title}</h3>
                    <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 transition-colors">
                      {t.guides.tas_darurat.steps.map((step: string, i: number) => (
                        <li key={i} className="flex gap-2"><span>•</span> {step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Sidebar / Map Area */}
          <div className={cn(
            "lg:col-span-5 space-y-6",
            activeTab !== 'map' && "hidden lg:block"
          )}>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs transition-colors">Peta Peringatan Dini</h3>
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
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-red-200 dark:hover:border-red-700"
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
              <BMKGGisInfo userLocation={userLocation} t={t} />
              
              {/* Weather Forecast Section in Map Tab */}
              {weather && (
                <div className="mt-4 p-5 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <Sun size={14} className="text-orange-500" />
                      {t.weather_forecast}
                    </h4>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{weather.location}</span>
                      <a href="https://openapi.de4a.space/docs" target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors uppercase tracking-widest">Source: OpenAPI</a>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Current Weather Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 transition-colors">
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm transition-colors">
                        {getWeatherIcon(weather.condition, 28, weather.icon)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Saat Ini</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-slate-900 dark:text-white">{weather.temp}°C</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{weather.condition}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-900/20 flex flex-col items-center justify-center transition-colors">
                        <Thermometer size={14} className="text-blue-500 mb-1" />
                        <span className="text-[10px] font-black text-slate-900 dark:text-white">{weather.humidity}%</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{t.humidity}</span>
                      </div>
                      <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20 flex flex-col items-center justify-center transition-colors">
                        <Wind size={14} className="text-emerald-500 mb-1" />
                        <span className="text-[10px] font-black text-slate-900 dark:text-white">{weather.windSpeed} <span className="text-[8px]">km/h</span></span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{lang === 'id' ? 'Angin' : 'Wind'}</span>
                      </div>
                      <div className="p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-xl border border-orange-100/50 dark:border-orange-900/20 flex flex-col items-center justify-center transition-colors">
                        <Compass size={14} className="text-orange-500 mb-1" />
                        <span className="text-[10px] font-black text-slate-900 dark:text-white truncate w-full text-center">
                          {weather.windDirection ? getWindDirection(weather.windDirection) : '-'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{t.wind_direction}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Forecast */}
                  {weather.forecasts && weather.forecasts.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Prakiraan Beberapa Jam Kedepan</p>
                      <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {weather.forecasts.map((f, i) => (
                          <div key={i} className="flex flex-col items-center min-w-[85px] bg-slate-50/50 dark:bg-slate-800/30 rounded-xl py-3 px-2 border border-slate-100 dark:border-slate-800 transition-colors">
                            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 mb-2">{f.time}</span>
                            <div className="mb-2">
                              {getWeatherIcon(f.condition, 18, f.icon)}
                            </div>
                            <span className="text-sm font-black text-slate-900 dark:text-white mb-0.5">{f.temp}°C</span>
                            <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 text-center leading-tight line-clamp-1">{f.condition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-3">
                <div className={cn(
                  "flex items-start gap-3 p-3 rounded-2xl border transition-colors",
                  nearbyEvents.length > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
                )}>
                  {nearbyEvents.length > 0 ? <AlertCircle size={16} className="text-red-600 mt-0.5" /> : <Navigation size={16} className="text-emerald-600 mt-0.5" />}
                  <div>
                <p className={cn("text-xs font-bold", nearbyEvents.length > 0 ? "text-red-900 dark:text-red-400" : "text-emerald-900 dark:text-emerald-400")}>
                  {nearbyEvents.length > 0 ? t.nearby_hazard : t.area_safe}
                </p>
                <p className={cn("text-[10px] font-medium", nearbyEvents.length > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
                  {nearbyEvents.length > 0 
                    ? t.hazard_found.replace('{count}', nearbyEvents.length.toString()) 
                    : t.no_hazard}
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
                        isNearby 
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" 
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-700"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            event.severity === 'High' ? "bg-red-500" : "bg-orange-500"
                          )} />
                          <div>
                            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-1 transition-colors">{event.title}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-tighter transition-colors">{event.type}</p>
                              {dist !== null && (
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold transition-colors">
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
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Bagikan Info"
                          >
                            <Share2 size={14} />
                          </button>
                          <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-red-400 transition-colors" />
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium italic transition-colors">{t.no_events_type}</p>
                    </div>
                  )}
                </div>

                {/* History Section */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 transition-colors">
                    <History size={12} />
                    {t.history_title}
                  </h4>
                  <div className="space-y-2">
                    {historyEvents.map((hist) => (
                      <div key={hist.id} className="p-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between transition-colors">
                        <div>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors">{hist.title}</p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 transition-colors">{hist.time} • {hist.location}</p>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300 dark:text-slate-600 transition-colors">{hist.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {!userLocation && !isLoading && (
              <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center transition-colors">
                <Navigation size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 transition-colors">{t.location_inactive}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-4 transition-colors">{t.location_inactive_desc}</p>
                <button 
                  onClick={fetchLocation}
                  className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-all shadow-sm"
                >
                  {t.activate_location}
                </button>
              </div>
            )}

            </div>
          </div>
        )}
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
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 transition-colors">v1.9.1-stable</span>
              <span>Patch: 8 Mar 2026, 21:20 WIB</span>
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
