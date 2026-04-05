/**
 * Unified AI Service - OpenAI-compatible API wrapper
 * 
 * This module provides a centralized AI service that works with any OpenAI-compatible
 * endpoint, including Ollama with OpenAI compatibility layer.
 * 
 * Environment variables:
 * - OLLAMA_BASE_URL: Base URL for the AI API (default: https://ollama.fairlx.com/v1)
 * - OLLAMA_API_KEY: API key for authentication
 * - OLLAMA_MODEL: Default model to use (default: qwen2.5-coder:7b)
 */

// OpenAI-compatible response types
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: ChatUsage;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Unified AI Service class for all AI-powered features
 */
export class AIService {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.fairlx.com/v1";
    this.apiKey = process.env.OLLAMA_API_KEY || "";
    this.defaultModel = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
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
      throw new Error("OLLAMA_API_KEY must be configured in the environment");
    }
  }

  /**
   * Get available models from the API
   */
  async getModels(): Promise<string[]> {
    this.ensureConfigured();
    
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to get models: ${res.status}`);
      }

      const data = await res.json();
      return data.data?.map((m: { id: string }) => m.id) || [];
    } catch (err) {
      console.error("Error fetching models:", err);
      return [];
    }
  }

  /**
   * Send a chat completion request
   */
  private async chatCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    retries = 2
  ): Promise<string> {
    this.ensureConfigured();

    const request: ChatCompletionRequest = {
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2000,
      stream: false,
    };

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const text = await res.text();
        // Retry on 429/5xx
        if ((res.status === 429 || res.status >= 500) && retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
          return this.chatCompletion(messages, options, retries - 1);
        }
        throw new Error(`AI API error ${res.status}: ${text}`);
      }

      const data: ChatCompletionResponse = await res.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1000));
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
