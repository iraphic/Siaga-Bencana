/**
 * Robust fetch with multiple proxy fallbacks to handle CORS issues
 */
export const fetchWithProxy = async (targetUrl: string) => {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    `https://thingproxy.freeboard.io/fetch/${targetUrl}`
  ];

  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) continue;
      
      if (proxyUrl.includes('allorigins')) {
        const data = await res.json();
        if (data.contents) {
          try {
            return JSON.parse(data.contents);
          } catch (e) {
            // If it's not JSON, return as text
            return data.contents;
          }
        }
      } else {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          // If it's not JSON, return as text
          return text;
        }
      }
    } catch (e) {
      console.warn(`Proxy ${proxyUrl} failed:`, e);
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Final attempt: direct fetch
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }
  } catch (e) {}
  
  throw new Error("All proxies failed to load data from " + targetUrl);
};
