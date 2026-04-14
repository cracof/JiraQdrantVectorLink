import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Jira Proxy Endpoint
  app.get("/api/jira/issues", async (req, res) => {
    const { project, issueType, startAt = 0 } = req.query;
    const jiraUrl = process.env.JIRA_URL;
    const jiraToken = process.env.JIRA_TOKEN;

    if (!jiraUrl || !jiraToken) {
      return res.status(500).json({ error: "Jira configuration missing in environment" });
    }

    try {
      const jql = `project = "${project}" AND issuetype = "${issueType}" ORDER BY created DESC`;
      const response = await axios.get(`${jiraUrl}/rest/api/2/search`, {
        params: {
          jql,
          startAt,
          maxResults: 50,
          fields: "summary,description,created,issuetype,status,priority,reporter,assignee,comment,issuelinks"
        },
        headers: {
          Authorization: `Bearer ${jiraToken}`,
          Accept: "application/json",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Jira API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to fetch from Jira", 
        details: error.response?.data || error.message 
      });
    }
  });

  // Qdrant Proxy Endpoint
  app.post("/api/qdrant/:action", async (req, res) => {
    const { action } = req.params;
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    if (!qdrantUrl) {
      return res.status(500).json({ error: "Qdrant URL missing in environment" });
    }

    try {
      const headers: any = { "Content-Type": "application/json" };
      if (qdrantApiKey) headers["api-key"] = qdrantApiKey;

      let response;
      if (action === "collections") {
        response = await axios.get(`${qdrantUrl}/collections`, { headers });
      } else if (action === "create-collection") {
        const { name, vectorSize } = req.body;
        response = await axios.put(`${qdrantUrl}/collections/${name}`, {
          vectors: {
            size: vectorSize,
            distance: "Cosine"
          }
        }, { headers });
      } else if (action === "upsert") {
        const { collectionName, points } = req.body;
        response = await axios.put(`${qdrantUrl}/collections/${collectionName}/points`, {
          points
        }, { headers });
      } else if (action === "search") {
        const { collectionName, vector, limit = 5 } = req.body;
        response = await axios.post(`${qdrantUrl}/collections/${collectionName}/points/search`, {
          vector,
          limit,
          with_payload: true
        }, { headers });
      } else {
        return res.status(400).json({ error: "Invalid Qdrant action" });
      }

      res.json(response.data);
    } catch (error: any) {
      console.error("Qdrant API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to communicate with Qdrant", 
        details: error.response?.data || error.message 
      });
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
