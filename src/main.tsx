import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Debugging API Key
if (!process.env.GEMINI_API_KEY) {
  console.error("CRITICAL ERROR: GEMINI_API_KEY is missing in the build!");
  alert("API Key Gemini tidak ditemukan! Pastikan Anda sudah menambahkan GEMINI_API_KEY di Environment Variables Vercel, lalu lakukan REDEPLOY.");
} else {
  console.log("GEMINI_API_KEY is present in the build.");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
