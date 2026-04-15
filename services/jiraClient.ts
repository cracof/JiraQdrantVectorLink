import axios from "axios";

export interface JiraConfig {
  url: string;
  token: string;
}

export class JiraClient {
  private config: JiraConfig;

  constructor() {
    this.config = {
      url: process.env.JIRA_URL || "",
      token: process.env.JIRA_TOKEN || ""
    };
  }

  async fetchIssues(project: string, issueTypes: string[], startAt: number = 0, updatedAfter?: string) {
    const typesJql = issueTypes.map(t => `"${t}"`).join(",");
    let jql = `project = "${project}" AND issuetype IN (${typesJql})`;
    
    if (updatedAfter) {
      // Jira expects YYYY-MM-DD HH:mm or relative time
      // We'll assume ISO string and clean it up if needed
      const dateStr = updatedAfter.replace("T", " ").slice(0, 16);
      jql += ` AND updated >= "${dateStr}"`;
    }
    
    jql += " ORDER BY updated ASC";

    const response = await axios.get(`${this.config.url}/rest/api/2/search`, {
      params: {
        jql,
        startAt,
        maxResults: 50,
        fields: "summary,description,created,updated,issuetype,status,priority,reporter,assignee,comment,issuelinks,project,labels"
      },
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/json",
      },
    });

    return response.data;
  }
}
