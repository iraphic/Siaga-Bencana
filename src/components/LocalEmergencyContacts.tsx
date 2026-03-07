import React, { useEffect, useState } from 'react';
import { Phone, MapPin, Hospital, Shield, Flame, Info, ExternalLink, LifeBuoy, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { getNearbyEmergencyContacts, EmergencyContact } from '../services/emergencyContacts';
import { cn } from '../utils/cn';

interface LocalEmergencyContactsProps {
  lat: number;
  lng: number;
  t: any;
}

export const LocalEmergencyContacts = ({ lat, lng, t }: LocalEmergencyContactsProps) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [locationName, setLocationName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchContacts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setIsRefreshing(true);
    try {
      const data = await getNearbyEmergencyContacts(lat, lng);
      // Sort contacts: SAR first, then Police, then others
      const sortedContacts = [...data.contacts].sort((a, b) => {
        const order = { 'sar': 1, 'police': 2, 'hospital': 3, 'fire': 4, 'general': 5 };
        return (order[a.type] || 99) - (order[b.type] || 99);
      });
      setContacts(sortedContacts);
      setLocationName(data.locationName);
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [lat, lng]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    fetchContacts(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'hospital': return <Hospital size={16} className="text-emerald-600" />;
      case 'police': return <Shield size={16} className="text-blue-600" />;
      case 'fire': return <Flame size={16} className="text-orange-600" />;
      case 'sar': return <LifeBuoy size={16} className="text-red-600" />;
      default: return <Info size={16} className="text-slate-600" />;
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 transition-colors">
            <Phone size={20} className="text-red-600" />
            {t.local_contacts_title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-1 transition-colors">
            <MapPin size={12} />
            {t.detected_around} <span className={cn("font-bold", locationName === "Area Anda" ? "text-red-600" : "text-slate-900 dark:text-slate-200")}>{locationName}</span>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "ml-2 p-1.5 rounded-lg transition-all flex items-center gap-1",
                locationName === "Area Anda" 
                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800" 
                  : "text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800",
                isRefreshing && "animate-spin"
              )}
              title={t.refresh}
            >
              <RefreshCw size={12} />
              {locationName === "Area Anda" && !isRefreshing && <span className="text-[9px] font-black uppercase tracking-tighter">{t.refresh}</span>}
            </button>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="h-full bg-red-600"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((contact, idx) => (
            <motion.a
              key={idx}
              href={`tel:${contact.number}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-red-200 dark:hover:border-red-900 hover:shadow-lg hover:shadow-red-500/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-colors">
                  {getIcon(contact.type)}
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight line-clamp-1 transition-colors">
                    {contact.name}
                  </h4>
                  <p className="text-sm font-mono font-bold text-red-600 dark:text-red-400 mt-0.5 transition-colors">
                    {contact.number}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
                <ExternalLink size={14} />
              </div>
            </motion.a>
          ))}
        </div>
      )}

      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-center transition-colors">
          {t.data_source_info.replace('{number}', '112')}
        </p>
      </div>
    </div>
  );
};
