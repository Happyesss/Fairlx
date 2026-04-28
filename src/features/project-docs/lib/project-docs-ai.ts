/**
 * Project Docs AI - Unified AI service wrapper for project documentation AI features
 * 
 * This is a standalone AI utility specifically for the project-docs feature.
 * It provides AI-powered Q&A based on project documents, tasks, and details.
 * 
 * All methods return AIServiceResponse (text + tokenUsage + model)
 * to enable token-accurate, model-aware billing.
 */

import { aiService, type AIServiceResponse } from "@/lib/ai-service";

/**
 * Project Docs AI class for handling AI-powered project context Q&A
 */
export class ProjectDocsAI {
  public isConfigured(): boolean {
    return aiService.isConfigured();
  }

  public ensureConfigured(): void {
    aiService.ensureConfigured();
  }

  /**
   * Answer a question about the project using provided context
   */
  async answerProjectQuestion(prompt: string, maxTokens: number = 2000): Promise<AIServiceResponse> {
    return aiService.generate(prompt, {
      maxTokens,
      temperature: 0.3
    });
  }

  /**
   * Generate a summary of the project based on documents and tasks
   */
  async generateProjectSummary(
    projectName: string,
    documents: Array<{ name: string; category: string; content: string }>,
    tasks: Array<{ name: string; status: string; description?: string }>
  ): Promise<AIServiceResponse> {
    const docContext = documents
      .slice(0, 10)
      .map((d) => `- **${d.name}** (${d.category}): ${d.content.slice(0, 500)}`)
      .join("\n");

    const taskContext = tasks
      .slice(0, 20)
      .map((t) => {
        // Strip HTML tags for plain text in AI context
        const plainDesc = t.description
          ?.replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100) || "No description";
        return `- ${t.name} [${t.status}]: ${plainDesc}`;
      })
      .join("\n");

    const prompt = `Generate a comprehensive project summary for "${projectName}".

## Project Documents
${docContext || "No documents available."}

## Project Tasks
${taskContext || "No tasks created."}

---

Create a professional project summary including:
1. **Overview**: What is this project about?
2. **Key Documents**: What documentation exists and what do they cover?
3. **Current Work**: What tasks are in progress or planned?
4. **Status Assessment**: Overall project health and progress

Format in clean Markdown. Be concise but informative.`;

    return aiService.generate(prompt, { maxTokens: 1500 });
  }

  /**
   * Extract key insights from a document
   */
  async extractDocumentInsights(
    documentName: string,
    documentContent: string,
    category: string
  ): Promise<AIServiceResponse> {
    const prompt = `Analyze this ${category} document and extract key insights:

## Document: ${documentName}

${documentContent.slice(0, 8000)}

---

Provide:
1. **Summary**: Brief overview of the document
2. **Key Points**: Main takeaways (bullet points)
3. **Action Items**: Any tasks or requirements mentioned
4. **Dependencies**: External dependencies or requirements

Format in clean Markdown.`;

    return aiService.generate(prompt, { maxTokens: 1500 });
  }
}

// Export singleton instance
export const projectDocsAI = new ProjectDocsAI();
