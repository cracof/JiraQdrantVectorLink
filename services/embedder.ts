import { pipeline } from "@xenova/transformers";

export class Embedder {
  private static instance: any = null;

  static async getInstance() {
    if (!this.instance) {
      console.log("Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");
      this.instance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      console.log("Local embedding model loaded.");
    }
    return this.instance;
  }

  static async embed(text: string): Promise<number[]> {
    const generate = await this.getInstance();
    const output = await generate(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  static async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    // For now, simple loop, but could be optimized
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
