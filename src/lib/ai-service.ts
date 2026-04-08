/**
 * Unified AI Service - Google Gemini API wrapper
 * 
 * This module provides a centralized AI service that works with Google's Gemini AI.
 * 
 * Environment variables:
 * - GEMINI_API_KEY: API key for Google Gemini authentication
 * - GEMINI_MODEL: Default model to use (default: gemini-2.5-flash)
 */

// OpenAI-compatible response types
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}


/**
 * Unified AI Service class for all AI-powered features
 */
export class AIService {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  }

  /**
   * Check if the AI service is properly configured
   */
  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Ensure the service is configured, throw error if not
   */
  public ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY must be configured in the environment");
    }
  }

  /**
   * Get available models from the API
   */
  async getModels(): Promise<string[]> {
    this.ensureConfigured();
    
    try {
      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`Failed to get models: ${res.status}`);
      }

      const data = await res.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch (err) {
      console.error("Error fetching models:", err);
      return [];
    }
  }

  /**
   * Send a chat completion request to Gemini
   */
  private async chatCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    retries = 3
  ): Promise<string> {
    this.ensureConfigured();

    const model = options?.model || this.defaultModel;
    
    // Convert messages to Gemini format
    const systemInstruction = messages.find(m => m.role === "system")?.content;
    const conversationMessages = messages.filter(m => m.role !== "system");
    
    const contents = conversationMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 2000,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        let retryDelay = 1000 * Math.pow(2, 3 - retries); // Default exponential backoff

        // Parse Gemini-specific retry info if available
        try {
          const errorData = JSON.parse(text);
          if (errorData.error?.details) {
            const retryInfo = errorData.error.details.find(
              (d: any) => d["@type"]?.includes("RetryInfo")
            );
            if (retryInfo?.retryDelay) {
              // Extract number from "54.520959962s" or similar
              const seconds = parseFloat(retryInfo.retryDelay);
              if (!isNaN(seconds)) {
                retryDelay = (seconds + 1) * 1000;
              }
            }
          }
        } catch {
          // Fallback to default backoff
        }

        // Retry on 429 (Quota) / 5xx (Server)
        if ((res.status === 429 || res.status >= 500) && retries > 0) {
          console.warn(`[AIService] ${res.status} encountered. Retrying in ${retryDelay}ms... (${retries} retries left)`);
          await new Promise((r) => setTimeout(r, retryDelay));
          return this.chatCompletion(messages, options, retries - 1);
        }
        throw new Error(`Gemini API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err) {
      if (retries > 0) {
        const backoff = 1000 * Math.pow(2, 3 - retries);
        await new Promise((r) => setTimeout(r, backoff));
        return this.chatCompletion(messages, options, retries - 1);
      }
      throw err;
    }
  }

  /**
   * Generate a response from a simple prompt
   */
  async generate(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    
    messages.push({ role: "user", content: prompt });

    return this.chatCompletion(messages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
  }

  /**
   * Summarize a code file
   */
  async summarizeFile(filePath: string, content: string): Promise<string> {
    const prompt = `Analyze this code file and provide a concise summary (max 200 words):

File: ${filePath}

\`\`\`
${content.slice(0, 5000)}
\`\`\`

Summarize:
- What this file does
- Key components/functions
- Main responsibilities`;

    return this.generate(prompt, { maxTokens: 400 });
  }

  /**
   * Generate comprehensive documentation for a repository
   */
  async generateDocumentation(
    repositoryInfo: { name: string; description?: string; language?: string },
    files: Array<{ path: string; content: string; summary?: string }>
  ): Promise<string> {
    const fileContext = files
      .map((f, index) => {
        const preview = f.content.slice(0, 3000);
        const lines = preview.split('\n').length;
        return `
## File ${index + 1}: \`${f.path}\`
**Lines analyzed:** ${lines}
**Content preview:**
\`\`\`
${preview}
\`\`\`
`;
      })
      .join("\n");

    const prompt = `You are a senior technical documentation specialist. Analyze the provided codebase and generate comprehensive, production-grade technical documentation.

## Repository Information
- **Name:** ${repositoryInfo.name}
- **Description:** ${repositoryInfo.description || "Not provided"}
- **Primary Language:** ${repositoryInfo.language || "Multiple"}
- **Files Analyzed:** ${files.length}

## Source Code Analysis
${fileContext}

---

Generate complete technical documentation in Markdown format. The documentation should include:

1. **Project Overview** - Purpose, goals, target audience
2. **Architecture and Design** - System architecture, directory structure, tech stack
3. **Core Features** - Major features with technical implementation notes
4. **Getting Started** - Prerequisites, installation, configuration
5. **API Documentation** - Key endpoints and code examples
6. **Development Guide** - Project structure, coding standards
7. **Testing** - Testing strategy and running tests
8. **Deployment** - Build and deployment procedures
9. **Security** - Authentication, authorization, best practices
10. **Troubleshooting** - Common issues and FAQs

Be thorough, professional, and use actual code examples from the analyzed files.`;

    return this.generate(prompt, { maxTokens: 8000, temperature: 0.2 });
  }

  /**
   * Answer a question about the codebase
   */
  async answerQuestion(
    question: string,
    codebaseContext: {
      files: Array<{ path: string; content: string; summary?: string }>;
      documentation?: string;
      commits?: Array<{
        hash: string;
        message: string;
        author: string;
        date: string;
        url: string;
      }>;
    }
  ): Promise<string> {
    const fileContext = codebaseContext.files
      .slice(0, 10)
      .map((f) => `File: ${f.path}\n${f.summary || f.content.slice(0, 1000)}\n---`)
      .join("\n");

    // Build commit history context if available
    let commitContext = "";
    if (codebaseContext.commits && codebaseContext.commits.length > 0) {
      const commits = codebaseContext.commits;
      const sortedCommits = [...commits].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      const initialCommit = sortedCommits[0];
      const recentCommits = sortedCommits.slice(-10).reverse();
      
      commitContext = `
## Commit History (${commits.length} total commits analyzed)

### Initial Commit
- **Author:** ${initialCommit.author}
- **Date:** ${new Date(initialCommit.date).toLocaleDateString()}
- **Hash:** ${initialCommit.hash.slice(0, 7)}
- **Message:** ${initialCommit.message}

### Recent Commits (Last 10)
${recentCommits.map((c, i) => `
${i + 1}. **${c.author}** - ${new Date(c.date).toLocaleDateString()}
   - Message: ${c.message}
   - Hash: ${c.hash.slice(0, 7)}
`).join('')}

### All Contributors
${Array.from(new Set(commits.map(c => c.author))).join(', ')}
`;
    }

    const prompt = `You are an expert code analyst. Answer the following question about this codebase in a well-organized, structured format.

Question: ${question}

${commitContext ? `## Git Commit History\n${commitContext}\n---\n` : ''}

## Codebase Context:
${fileContext}

${codebaseContext.documentation ? `\nExisting Documentation:\n${codebaseContext.documentation.slice(0, 2000)}` : ""}

Provide a comprehensive answer with:
1. **Direct Answer**: Clear, direct answer to the question
2. **Details**: Specific details from the code
3. **File Locations** (if applicable): Relevant file paths
4. **Code Examples** (if applicable): Relevant code snippets
5. **Additional Context**: Any other relevant information

Format your response in clean Markdown.`;

    return this.generate(prompt, { maxTokens: 1500 });
  }

  /**
   * Summarize a git commit
   */
  async summarizeCommit(commitDiff: string, commitMessage: string): Promise<string> {
    const prompt = `Summarize this git commit in a clear, concise way (max 150 words):

Commit Message: ${commitMessage}

Diff (truncated):
\`\`\`diff
${commitDiff.slice(0, 4000)}
\`\`\`

Provide:
1. What changed (high-level)
2. Why it matters
3. Key files affected
4. Impact on the codebase

Be technical but clear. Focus on the "what" and "why".`;

    return this.generate(prompt, { maxTokens: 400 });
  }

  /**
   * Analyze code quality
   */
  async analyzeCodeQuality(files: Array<{ path: string; content: string }>): Promise<string> {
    const codeSnippets = files.slice(0, 5).map((f) => `${f.path}:\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``).join("\n\n");

    const prompt = `Analyze the code quality of this project and provide actionable insights:

${codeSnippets}

Provide analysis on:
1. Code organization and structure
2. Potential improvements
3. Security considerations
4. Performance opportunities
5. Best practices adherence

Keep it constructive and specific.`;

    return this.generate(prompt, { maxTokens: 800 });
  }
}

// Export singleton instance
export const aiService = new AIService();
