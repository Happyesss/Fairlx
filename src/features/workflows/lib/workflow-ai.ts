/**
 * Workflow AI - Unified AI service wrapper for workflow AI features
 * 
 * This module provides AI-powered workflow operations including:
 * - Answering questions about workflows
 * - Suggesting statuses and transitions
 * - Generating complete workflow templates
 * - Analyzing workflow issues
 */

import { aiService } from "@/lib/ai-service";
import { 
  WorkflowAIContext, 
  StatusSuggestion, 
  TransitionSuggestion, 
  WorkflowSuggestion 
} from "../types/ai-context";

/**
 * WorkflowAI class for handling AI-powered workflow operations
 */
export class WorkflowAI {
  public isConfigured(): boolean {
    return aiService.isConfigured();
  }

  public ensureConfigured(): void {
    aiService.ensureConfigured();
  }

  /**
   * Answer a question about the workflow using provided context
   */
  async answerWorkflowQuestion(
    question: string,
    context: WorkflowAIContext
  ): Promise<string> {
    const statusList = context.statuses
      .map(s => `- ${s.name} (${s.key}): ${s.statusType}${s.isInitial ? ' [INITIAL]' : ''}${s.isFinal ? ' [FINAL]' : ''}`)
      .join('\n');

    const transitionList = context.transitions
      .map(t => `- ${t.fromStatus} → ${t.toStatus}${t.name ? ` (${t.name})` : ''}${t.requiresApproval ? ' [Requires Approval]' : ''}`)
      .join('\n');

    const issuesSummary = [];
    if (context.summary.orphanedStatuses > 0) issuesSummary.push(`${context.summary.orphanedStatuses} orphaned statuses`);
    if (context.summary.unreachableStatuses > 0) issuesSummary.push(`${context.summary.unreachableStatuses} unreachable statuses`);
    if (context.summary.deadEndStatuses > 0) issuesSummary.push(`${context.summary.deadEndStatuses} dead-end statuses`);

    const prompt = `You are a workflow expert AI assistant. Answer questions about this workflow configuration.

## Workflow: ${context.workflow.name}
${context.workflow.description || 'No description provided.'}

## Statuses (${context.summary.totalStatuses} total):
${statusList || 'No statuses defined.'}

## Transitions (${context.summary.totalTransitions} total):
${transitionList || 'No transitions defined.'}

## Summary:
- Initial statuses: ${context.summary.initialStatuses}
- Final statuses: ${context.summary.finalStatuses}
${issuesSummary.length > 0 ? `- Issues detected: ${issuesSummary.join(', ')}` : '- No issues detected'}

User Question: ${question}

Provide a helpful, detailed answer. If the user asks to modify the workflow (add statuses, create transitions, etc.), please provide the technical details in a JSON block at the end of your response.

The JSON MUST follow this exact structure (no markdown in the JSON):
{
  "actionType": "suggest_workflow",
  "data": {
    "name": "${context.workflow.name}",
    "statuses": [
      {"name": "Status Name", "key": "STATUS_KEY", "statusType": "OPEN|IN_PROGRESS|CLOSED", "color": "#hex", "isInitial": false, "isFinal": false}
    ],
    "transitions": [
      {"fromStatusKey": "FROM_KEY", "toStatusKey": "TO_KEY", "name": "Action Name"}
    ]
  }
}

Respond with a helpful text answer first, followed by the JSON block if applicable.`;

    const response = await aiService.generate(prompt, { maxTokens: 2000 });
    return response.text;
  }

  /**
   * Generate a status suggestion based on user prompt
   */
  async suggestStatus(
    prompt: string,
    context: WorkflowAIContext
  ): Promise<StatusSuggestion | null> {
    const existingKeys = context.statuses.map(s => s.key);
    const existingNames = context.statuses.map(s => s.name.toLowerCase());

    const aiPrompt = `You are a workflow expert. Generate a status based on this request.

Current workflow: ${context.workflow.name}
Existing statuses: ${existingKeys.join(', ') || 'None'}

User request: ${prompt}

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "name": "Status Name",
  "key": "STATUS_KEY",
  "statusType": "OPEN" | "IN_PROGRESS" | "CLOSED",
  "color": "#hexcolor",
  "isInitial": false,
  "isFinal": false,
  "description": "Brief description"
}

Rules:
- key must be UPPERCASE_SNAKE_CASE
- key must be unique (not in: ${existingKeys.join(', ')})
- statusType must be one of: OPEN, IN_PROGRESS, CLOSED
- color should be a hex color appropriate for the status type
- isInitial should be true only for starting statuses
- isFinal should be true only for end statuses`;

    const aiResponse = await aiService.generate(aiPrompt, { maxTokens: 500, temperature: 0.2 });

    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const suggestion = JSON.parse(jsonMatch[0]) as StatusSuggestion;
      
      // Validate and sanitize
      if (!suggestion.name || !suggestion.key || !suggestion.statusType) return null;
      
      // Ensure key is unique
      if (existingKeys.includes(suggestion.key)) {
        suggestion.key = suggestion.key + '_NEW';
      }
      
      // Ensure name is unique
      if (existingNames.includes(suggestion.name.toLowerCase())) {
        suggestion.name = suggestion.name + ' (New)';
      }
      
      return suggestion;
    } catch {
      return null;
    }
  }

  /**
   * Generate a transition suggestion based on user prompt
   */
  async suggestTransition(
    prompt: string,
    context: WorkflowAIContext
  ): Promise<TransitionSuggestion | null> {
    const statusKeys = context.statuses.map(s => s.key);
    const existingTransitions = context.transitions.map(t => `${t.fromStatus}→${t.toStatus}`);

    const aiPrompt = `You are a workflow expert. Generate a transition based on this request.

Current workflow: ${context.workflow.name}
Available statuses: ${statusKeys.join(', ')}
Existing transitions: ${existingTransitions.join(', ') || 'None'}

User request: ${prompt}

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "fromStatusKey": "FROM_STATUS_KEY",
  "toStatusKey": "TO_STATUS_KEY",
  "name": "Optional transition name",
  "requiresApproval": false
}

Rules:
- fromStatusKey and toStatusKey MUST be from available statuses: ${statusKeys.join(', ')}
- Do not create a transition that already exists
- requiresApproval should be true for critical transitions`;

    const aiResponse = await aiService.generate(aiPrompt, { maxTokens: 300, temperature: 0.2 });

    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const suggestion = JSON.parse(jsonMatch[0]) as TransitionSuggestion;
      
      // Validate
      if (!suggestion.fromStatusKey || !suggestion.toStatusKey) return null;
      if (!statusKeys.includes(suggestion.fromStatusKey) || !statusKeys.includes(suggestion.toStatusKey)) return null;
      
      // Check if transition already exists
      const transitionKey = `${suggestion.fromStatusKey}→${suggestion.toStatusKey}`;
      if (existingTransitions.includes(transitionKey)) return null;
      
      return suggestion;
    } catch {
      return null;
    }
  }

  /**
   * Generate a complete workflow template based on user description
   */
  async generateWorkflowTemplate(
    description: string
  ): Promise<WorkflowSuggestion | null> {
    const aiPrompt = `You are a workflow expert. Generate a complete workflow template based on this description.

User description: ${description}

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "name": "Workflow Name",
  "description": "Brief workflow description",
  "statuses": [
    {
      "name": "Status Name",
      "key": "STATUS_KEY",
      "statusType": "OPEN" | "IN_PROGRESS" | "CLOSED",
      "color": "#hexcolor",
      "isInitial": true/false,
      "isFinal": true/false,
      "description": "Status description"
    }
  ],
  "transitions": [
    {
      "fromStatusKey": "FROM_KEY",
      "toStatusKey": "TO_KEY",
      "name": "Optional name",
      "requiresApproval": false
    }
  ]
}

Requirements:
- Include at least one INITIAL status (isInitial: true)
- Include at least one FINAL status (isFinal: true)
- Create logical transitions between statuses
- Use appropriate colors for each status type
- OPEN statuses: gray/slate colors
- IN_PROGRESS statuses: blue/yellow colors
- CLOSED statuses: green/emerald colors`;

    const aiResponse = await aiService.generate(aiPrompt, { maxTokens: 2000, temperature: 0.4 });

    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const suggestion = JSON.parse(jsonMatch[0]) as WorkflowSuggestion;
      
      // Validate
      if (!suggestion.name || !suggestion.statuses || suggestion.statuses.length === 0) return null;
      
      return suggestion;
    } catch {
      return null;
    }
  }

  /**
   * Analyze workflow and suggest improvements
   */
  async analyzeWorkflow(context: WorkflowAIContext): Promise<string> {
    const statusList = context.statuses
      .map(s => `- ${s.name} (${s.key}): ${s.statusType}${s.isInitial ? ' [INITIAL]' : ''}${s.isFinal ? ' [FINAL]' : ''}`)
      .join('\n');

    const transitionList = context.transitions
      .map(t => `- ${t.fromStatus} → ${t.toStatus}`)
      .join('\n');

    const prompt = `You are a workflow expert. Analyze this workflow and provide improvement suggestions.

## Workflow: ${context.workflow.name}
${context.workflow.description || ''}

## Statuses:
${statusList || 'No statuses defined.'}

## Transitions:
${transitionList || 'No transitions defined.'}

## Current Issues:
- Orphaned statuses (no connections): ${context.summary.orphanedStatuses}
- Unreachable statuses (no incoming): ${context.summary.unreachableStatuses}
- Dead-end statuses (no outgoing, not final): ${context.summary.deadEndStatuses}

Provide a structured analysis with:
1. **Workflow Health**: Overall assessment
2. **Issues Found**: Explain any problems detected
3. **Recommendations**: Specific improvements to make
4. **Missing Elements**: Suggest any statuses or transitions that might be needed

Be concise and actionable.`;

    const response = await aiService.generate(prompt, { maxTokens: 1500 });
    return response.text;
  }
}

// Export singleton instance
export const workflowAI = new WorkflowAI();
