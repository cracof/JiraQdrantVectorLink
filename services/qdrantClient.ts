import axios from "axios";

export class QdrantClient {
  private url: string;
  private apiKey?: string;

  constructor() {
    this.url = (process.env.QDRANT_URL || "").replace(/\/+$/, "").replace(/\/dashboard.*$/, "");
    this.apiKey = process.env.QDRANT_API_KEY;
  }

  private get headers() {
    const h: any = { "Content-Type": "application/json" };
    if (this.apiKey) h["api-key"] = this.apiKey;
    return h;
  }

  async ensureCollection(name: string, vectorSize: number = 384) {
    try {
      await axios.get(`${this.url}/collections/${name}`, { headers: this.headers });
      console.log(`Collection ${name} exists.`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`Creating collection ${name}...`);
        await axios.put(`${this.url}/collections/${name}`, {
          vectors: { size: vectorSize, distance: "Cosine" }
        }, { headers: this.headers });
        
        // Add indexes for performance
        const fieldsToIndex = ['issue_key', 'project_key', 'issue_type', 'status', 'priority', 'chunk_type', 'updated'];
        for (const field of fieldsToIndex) {
          await axios.post(`${this.url}/collections/${name}/index`, {
            field_name: field,
            field_schema: "keyword"
          }, { headers: this.headers });
        }
      } else {
        throw error;
      }
    }
  }

  async upsert(name: string, points: any[]) {
    return axios.put(`${this.url}/collections/${name}/points`, { points }, { headers: this.headers });
  }

  async search(name: string, vector: number[], filter?: any, limit: number = 5) {
    const response = await axios.post(`${this.url}/collections/${name}/points/search`, {
      vector,
      limit,
      filter,
      with_payload: true
    }, { headers: this.headers });
    return response.data.result;
  }

  async deleteByIssueKey(name: string, issueKey: string) {
    return axios.post(`${this.url}/collections/${name}/points/delete`, {
      filter: {
        must: [{ key: "issue_key", match: { value: issueKey } }]
      }
    }, { headers: this.headers });
  }
}
