import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route for Weather Proxy
  app.get("/api/weather", async (req, res) => {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    try {
      const apiUrl = `https://cuacakita.vercel.app/api/weather/forecast?lat=${lat}&long=${lon}`;
      const response = await axios.get(apiUrl);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching weather from provider:", error);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
