import { DOCUMENTATION_QUESTIONS } from "../constants";
import { aiService } from "@/lib/ai-service";

/**
 * GeminiAPI wrapper - now uses the unified AI service (Ollama)
 * 
 * This class maintains backward compatibility with existing code while
 * delegating all AI calls to the centralized AI service.
 * 
 * Environment variables (via AIService):
 * - OLLAMA_BASE_URL: Base URL for the AI API
 * - OLLAMA_API_KEY: API key for authentication
 * - OLLAMA_MODEL: Default model to use
 */
export class GeminiAPI {
  public isConfigured(): boolean {
    return aiService.isConfigured();
  }

  public ensureConfigured(): void {
    aiService.ensureConfigured();
  }

  async summarizeFile(filePath: string, content: string): Promise<string> {
    return aiService.summarizeFile(filePath, content);
  }

  async generateDocumentation(
    repositoryInfo: { name: string; description?: string; language?: string },
    files: Array<{ path: string; content: string; summary?: string }>
  ): Promise<string> {
    return aiService.generateDocumentation(repositoryInfo, files);
  }

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
    return aiService.answerQuestion(question, codebaseContext);
  }

  async summarizeCommit(commitDiff: string, commitMessage: string): Promise<string> {
    return aiService.summarizeCommit(commitDiff, commitMessage);
  }

  async generateFAQ(files: Array<{ path: string; content: string }>, repositoryName: string): Promise<Record<string, string>> {
    const faq: Record<string, string> = {};
    const fileContext = files.slice(0, 15).map((f) => `${f.path}: ${f.content.slice(0, 800)}`).join("\n---\n");

    for (const question of DOCUMENTATION_QUESTIONS) {
      try {
        const prompt = `Project: ${repositoryName}\n\nCodebase Files:\n${fileContext}\n\nQuestion: ${question}\n\nProvide a detailed, informative answer (max 300 words):`;
        faq[question] = await aiService.generate(prompt, { maxTokens: 400 });
        // small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 250));
      } catch {
        faq[question] = "Unable to generate answer at this time.";
      }
    }

    return faq;
  }

  async analyzeCodeQuality(files: Array<{ path: string; content: string }>): Promise<string> {
    return aiService.analyzeCodeQuality(files);
  }
}

export const geminiAPI = new GeminiAPI();
