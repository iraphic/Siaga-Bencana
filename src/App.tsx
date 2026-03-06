import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Map as MapIcon, MessageSquare, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { EmergencyMap, DisasterEvent } from './components/EmergencyMap';
import { EmergencyInput } from './components/EmergencyInput';
import { ResponseDisplay } from './components/ResponseDisplay';
import { getEmergencyAdvice } from './services/geminiService';
import { cn } from './utils/cn';

export default function App() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'map'>('chat');
  const [events, setEvents] = useState<DisasterEvent[]>([]);

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
        const mockEvents: DisasterEvent[] = [
          { id: '1', title: 'Banjir Luapan Sungai', type: 'Flood', lat: -6.2, lng: 106.8, severity: 'High' },
          { id: '2', title: 'Peringatan Dini Longsor', type: 'Landslide', lat: -6.3, lng: 106.9, severity: 'Medium' },
          { id: '3', title: 'Gempa Bumi M 5.2', type: 'Earthquake', lat: -6.9, lng: 107.6, severity: 'High' },
        ];
        
        try {
          const response = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/json');
          const data = await response.json();
          if (data && data.features) {
            const realEvents = data.features.slice(0, 10).map((f: any) => ({
              id: f.properties.eventid,
              title: f.properties.eventname,
              type: f.properties.eventtype,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              severity: f.properties.severitydata?.severity || 'Unknown'
            }));
            setEvents([...mockEvents, ...realEvents]);
          } else {
            setEvents(mockEvents);
          }
        } catch (e) {
          setEvents(mockEvents);
        }
      } catch (error) {
        console.error("Error fetching disasters:", error);
      }
    };

    fetchDisasters();
    const interval = setInterval(fetchDisasters, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (text: string) => {
    setIsLoading(true);
    setResponse(null);
    setActiveTab('chat');
    
    const locationObj = userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined;
    const advice = await getEmergencyAdvice(text, locationObj);
    
    setResponse(advice);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 md:pb-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <AlertCircle size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Siaga Banjir</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Panduan mematikan listrik dan evakuasi barang berharga saat air mulai naik.</p>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4">
                    <Info size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Tas Darurat</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Daftar barang esensial yang harus ada di tas siaga bencana Anda.</p>
                </div>
              </div>
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
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-2xl border border-red-100">
                  <AlertCircle size={16} className="text-red-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-900">Peringatan Sekitar</p>
                    <p className="text-[10px] text-red-700 font-medium">Ada {events.length} laporan bencana terdeteksi.</p>
                  </div>
                </div>
                
                {/* List of disasters */}
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {events.map((event) => (
                    <div key={event.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-red-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          event.severity === 'High' ? "bg-red-500" : "bg-orange-500"
                        )} />
                        <div>
                          <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{event.title}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">{event.type}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                    </div>
                  ))}
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
      <footer className="max-w-5xl mx-auto px-4 py-8 border-t border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            &copy; 2026 SIAGABENCANA AI • Small Apps for Big Preparedness
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-widest">Privacy</a>
            <a href="#" className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-widest">Terms</a>
            <a href="#" className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-widest">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
