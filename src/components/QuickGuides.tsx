import React from 'react';
import { Waves, Mountain, Flame, Zap, ChevronRight, Shield } from 'lucide-react';
import { cn } from '../utils/cn';

const guides = [
  {
    id: 'banjir',
    title: 'Banjir',
    icon: <Waves size={20} />,
    color: 'bg-blue-50 text-blue-600',
    steps: ['Matikan listrik', 'Pindahkan barang ke atas', 'Siapkan tas siaga']
  },
  {
    id: 'gempa',
    title: 'Gempa',
    icon: <Zap size={20} />,
    color: 'bg-orange-50 text-orange-600',
    steps: ['Drop, Cover, Hold on', 'Jauhi kaca/lemari', 'Lari ke area terbuka']
  },
  {
    id: 'longsor',
    title: 'Longsor',
    icon: <Mountain size={20} />,
    color: 'bg-stone-50 text-stone-600',
    steps: ['Evakuasi segera', 'Jauhi lereng curam', 'Cari tempat stabil']
  },
  {
    id: 'kebakaran',
    title: 'Kebakaran',
    icon: <Flame size={20} />,
    color: 'bg-red-50 text-red-600',
    steps: ['Tutup hidung/mulut', 'Merangkak di bawah asap', 'Gunakan tangga darurat']
  },
  {
    id: 'perang',
    title: 'Perang Dunia',
    icon: <Shield size={20} />,
    color: 'bg-slate-900 text-white',
    steps: ['Cari bunker/basement', 'Stok air & makanan', 'Pantau radio darurat']
  }
];

export const QuickGuides = () => {
  return (
    <section className="mt-8">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Panduan Cepat Keselamatan</h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {guides.map((guide) => (
          <div key={guide.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", guide.color)}>
              {guide.icon}
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-2">{guide.title}</h4>
            <ul className="space-y-1">
              {guide.steps.map((step, i) => (
                <li key={i} className="text-[10px] text-slate-500 flex items-start gap-1">
                  <span className="text-red-400">•</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
