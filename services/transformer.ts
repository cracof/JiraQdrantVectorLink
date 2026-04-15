import crypto from "crypto";

export interface JiraChunk {
  id: string; // Deterministic ID
  text: string; // Clean text for embedding
  payload: any; // Metadata
  hash: string; // Hash of text to detect changes
}

export class Transformer {
  static generateDeterministicId(issueKey: string, type: string, index: string | number): string {
    const rawId = `${issueKey}:${type}:${index}`;
    // Qdrant accepts UUIDs or 64-bit unsigned integers. 
    // We'll use a UUID v5-like approach or a simple hash converted to UUID format.
    return crypto.createHash('md5').update(rawId).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  }

  static generateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  static transformIssue(issue: any): JiraChunk[] {
    const chunks: JiraChunk[] = [];
    const fields = issue.fields;
    const issueKey = issue.key;

    // 1. Summary & Description Chunk
    const mainText = `Issue ${issueKey}. Project: ${fields.project.name}. Type: ${fields.issuetype.name}. Priority: ${fields.priority?.name || 'None'}. Status: ${fields.status.name}. Summary: ${fields.summary}. Description: ${fields.description || "No description provided."}`;
    
    chunks.push({
      id: this.generateDeterministicId(issueKey, 'main', 0),
      text: mainText,
      hash: this.generateTextHash(mainText),
      payload: {
        issue_key: issueKey,
        issue_id: issue.id,
        project_key: fields.project.key,
        project_name: fields.project.name,
        issue_type: fields.issuetype.name,
        status: fields.status.name,
        priority: fields.priority?.name,
        assignee: fields.assignee?.displayName || "Unassigned",
        reporter: fields.reporter?.displayName,
        labels: fields.labels || [],
        created: fields.created,
        updated: fields.updated,
        chunk_type: 'main',
        chunk_index: 0,
        source: "jira",
        text: mainText
      }
    });

    // 2. Comments Chunks
    if (fields.comment?.comments) {
      fields.comment.comments.forEach((comment: any, index: number) => {
        const commentText = `Issue ${issueKey}. Comment by ${comment.author.displayName} on ${comment.created}: ${comment.body}`;
        chunks.push({
          id: this.generateDeterministicId(issueKey, 'comment', comment.id),
          text: commentText,
          hash: this.generateTextHash(commentText),
          payload: {
            issue_key: issueKey,
            issue_id: issue.id,
            project_key: fields.project.key,
            project_name: fields.project.name,
            issue_type: fields.issuetype.name,
            status: fields.status.name,
            priority: fields.priority?.name,
            assignee: fields.assignee?.displayName || "Unassigned",
            reporter: fields.reporter?.displayName,
            labels: fields.labels || [],
            created: fields.created,
            updated: fields.updated,
            chunk_type: 'comment',
            chunk_index: index + 1,
            comment_id: comment.id,
            source: "jira",
            text: commentText
          }
        });
      });
    }

    return chunks;
  }
}
