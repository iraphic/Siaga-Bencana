import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { motion } from 'motion/react';
import { ShieldAlert, CheckCircle2, Info, Volume2, VolumeX } from 'lucide-react';

interface ResponseDisplayProps {
  response: string | null;
  isLoading: boolean;
  isMinimal?: boolean;
}

export const ResponseDisplay = ({ response, isLoading, isMinimal }: ResponseDisplayProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(response || "");
      utterance.lang = 'id-ID';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Maaf, browser Anda tidak mendukung fitur pembacaan suara.");
    }
  };

  if (!response && !isLoading) return null;

  if (isMinimal) {
    return (
      <div className="markdown-body text-slate-600 text-sm">
        <Markdown>{response || ""}</Markdown>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto mt-8"
    >
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <ShieldAlert size={20} />
              <span className="font-bold tracking-tight uppercase text-sm">Panduan Keselamatan AI</span>
            </div>
            <div className="flex items-center gap-3">
              {response && !isLoading && (
                <button 
                  onClick={handleSpeak}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  {isSpeaking ? "Berhenti" : "Bacakan"}
                </button>
              )}
              <div className="text-red-100 text-[10px] font-bold uppercase tracking-widest">
                Real-time Response
              </div>
            </div>
          </div>
          
          {isLoading && (
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 10, ease: "linear" }}
                className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              />
            </div>
          )}
        </div>
        
        <div className="p-8">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded-full w-full animate-pulse" />
              <div className="h-4 bg-slate-100 rounded-full w-5/6 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded-full w-2/3 animate-pulse" />
            </div>
          ) : (
            <div className="markdown-body text-slate-700">
              <Markdown>{response || ""}</Markdown>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Tetap tenang. Bantuan sedang dalam perjalanan atau ikuti langkah di atas dengan hati-hati.
          </p>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
        <Info size={12} />
        <span>AI dapat membuat kesalahan. Prioritaskan instruksi petugas di lapangan.</span>
      </div>
    </motion.div>
  );
};
