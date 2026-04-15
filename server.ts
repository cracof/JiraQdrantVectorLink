import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { SyncCoordinator, SyncProgress } from "./services/syncCoordinator";
import { QdrantClient } from "./services/qdrantClient";
import { Embedder } from "./services/embedder";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const qdrant = new QdrantClient();
  let currentProgress: SyncProgress | null = null;
  
  const coordinator = new SyncCoordinator((progress) => {
    currentProgress = progress;
  });

  // Sync Endpoint
  app.post("/api/sync", async (req, res) => {
    const { project, issueTypes, collection, updatedAfter } = req.body;
    
    if (!project || !issueTypes || !collection) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Run in background
    coordinator.runSync(project, issueTypes, collection, updatedAfter);
    
    res.json({ message: "Sync started in background" });
  });

  // Sync Status Endpoint
  app.get("/api/sync/status", (req, res) => {
    res.json(currentProgress || { isSyncing: false, logs: [] });
  });

  // Search Endpoint
  app.post("/api/search", async (req, res) => {
    const { query, collection, filters, limit = 5 } = req.body;
    
    if (!query || !collection) {
      return res.status(400).json({ error: "Query and collection are required" });
    }

    try {
      const vector = await Embedder.embed(query);
      const results = await qdrant.search(collection, vector, filters, limit);
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
