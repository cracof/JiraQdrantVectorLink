import { JiraClient } from "./jiraClient";
import { Transformer, JiraChunk } from "./transformer";
import { Embedder } from "./embedder";
import { QdrantClient } from "./qdrantClient";

export interface SyncProgress {
  total: number;
  processed: number;
  currentIssue: string;
  isSyncing: boolean;
  logs: string[];
  error: string | null;
}

export class SyncCoordinator {
  private jira = new JiraClient();
  private qdrant = new QdrantClient();
  private progress: SyncProgress = {
    total: 0,
    processed: 0,
    currentIssue: "",
    isSyncing: false,
    logs: [],
    error: null
  };

  private onProgressUpdate: (p: SyncProgress) => void;

  constructor(onProgressUpdate: (p: SyncProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
  }

  private log(msg: string) {
    console.log(msg);
    this.progress.logs = [msg, ...this.progress.logs].slice(0, 100);
    this.onProgressUpdate({ ...this.progress });
  }

  async runSync(project: string, issueTypes: string[], collection: string, updatedAfter?: string) {
    if (this.progress.isSyncing) return;

    this.progress = {
      total: 0,
      processed: 0,
      currentIssue: "",
      isSyncing: true,
      logs: [`Starting sync for project ${project}...`],
      error: null
    };
    this.onProgressUpdate({ ...this.progress });

    try {
      await this.qdrant.ensureCollection(collection);

      let startAt = 0;
      let hasMore = true;

      while (hasMore) {
        this.log(`Fetching batch from Jira (startAt: ${startAt})...`);
        const data = await this.jira.fetchIssues(project, issueTypes, startAt, updatedAfter);
        
        const issues = data.issues || [];
        if (issues.length === 0) {
          hasMore = false;
          break;
        }

        this.progress.total = data.total;
        this.onProgressUpdate({ ...this.progress });

        for (const issue of issues) {
          this.progress.currentIssue = issue.key;
          this.log(`Processing ${issue.key}...`);

          // 1. Transform to chunks
          const chunks = Transformer.transformIssue(issue);
          
          // 2. Prepare points for Qdrant
          const points = [];
          for (const chunk of chunks) {
            // Check if we really need to re-embed (optional optimization: could check Qdrant for hash)
            // For now, we embed all chunks of the updated issue
            const vector = await Embedder.embed(chunk.text);
            points.push({
              id: chunk.id,
              vector,
              payload: {
                ...chunk.payload,
                text_hash: chunk.hash
              }
            });
          }

          // 3. Upsert to Qdrant
          await this.qdrant.upsert(collection, points);
          
          this.progress.processed++;
          this.onProgressUpdate({ ...this.progress });

          // Small delay to prevent CPU/Network saturation
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        startAt += issues.length;
        if (startAt >= data.total) hasMore = false;
      }

      this.log("Sync completed successfully.");
      this.progress.isSyncing = false;
      this.onProgressUpdate({ ...this.progress });

    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      this.log(`Error during sync: ${msg}`);
      this.progress.error = msg;
      this.progress.isSyncing = false;
      this.onProgressUpdate({ ...this.progress });
    }
  }

  getProgress() {
    return this.progress;
  }
}
