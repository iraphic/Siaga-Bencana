import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Loader2, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';

interface EmergencyInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export const EmergencyInput = ({ onSend, isLoading }: EmergencyInputProps) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'id-ID';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Apa situasi darurat Anda? (Ketik atau tekan mic)"
          className={cn(
            "w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-4 pr-24 min-h-[80px] max-h-[200px] resize-none",
            "focus:outline-none focus:border-red-500 transition-all duration-300 shadow-sm",
            "text-lg leading-relaxed placeholder:text-slate-400",
            isListening && "border-red-500 ring-4 ring-red-500/10"
          )}
        />
        
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleMicClick}
            className={cn(
              "p-3 rounded-xl transition-all duration-300",
              isListening 
                ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30" 
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
            title={isListening ? "Berhenti mendengarkan" : "Gunakan suara"}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-3 rounded-xl transition-all duration-300",
              input.trim() && !isLoading
                ? "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:scale-105 active:scale-95"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-lg"
            >
              Mendengarkan...
            </motion.div>
          )}
        </AnimatePresence>
      </form>
      <p className="mt-3 text-center text-slate-400 text-xs font-medium">
        Contoh: "Banjir sudah masuk rumah, listrik masih menyala, apa yang harus saya lakukan?"
      </p>
    </div>
  );
};
