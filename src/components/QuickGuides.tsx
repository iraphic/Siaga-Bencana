import React from 'react';
import { Waves, Mountain, Flame, Zap, Shield, Droplets } from 'lucide-react';
import { cn } from '../utils/cn';

interface QuickGuidesProps {
  t: any;
}

export const QuickGuides = ({ t }: QuickGuidesProps) => {
  const guides = [
    {
      id: 'banjir',
      title: t.guides.banjir.title,
      icon: <Droplets size={20} />,
      color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
      steps: t.guides.banjir.steps
    },
    {
      id: 'gempa',
      title: t.guides.gempa.title,
      icon: <Zap size={20} />,
      color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
      steps: t.guides.gempa.steps
    },
    {
      id: 'tsunami',
      title: t.guides.tsunami.title,
      icon: <Waves size={20} />,
      color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
      steps: t.guides.tsunami.steps
    },
    {
      id: 'longsor',
      title: t.guides.longsor.title,
      icon: <Mountain size={20} />,
      color: 'bg-stone-50 dark:bg-stone-900/20 text-stone-600 dark:text-stone-400',
      steps: t.guides.longsor.steps
    },
    {
      id: 'kebakaran',
      title: t.guides.kebakaran.title,
      icon: <Flame size={20} />,
      color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      steps: t.guides.kebakaran.steps
    },
    {
      id: 'perang',
      title: t.guides.perang.title,
      icon: <Shield size={20} />,
      color: 'bg-slate-900 dark:bg-slate-950 text-white',
      steps: t.guides.perang.steps
    }
  ];

  return (
    <section className="mt-8">
      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 transition-colors">
        {t.quick_guides_title}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {guides.map((guide) => (
          <div key={guide.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", guide.color)}>
              {guide.icon}
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 transition-colors">{guide.title}</h4>
            <ul className="space-y-1">
              {guide.steps.map((step, i) => (
                <li key={i} className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1 transition-colors">
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
