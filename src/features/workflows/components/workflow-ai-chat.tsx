"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Loader2, 
  Send, 
  Sparkles, 
  GitBranch,
  Plus,
  ArrowRight,
  Search,
  Lightbulb,
  Copy,
  Check,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

import { 
  useGetWorkflowAIContext,
  useAskWorkflowQuestion, 
  useAISuggestStatus,
  useAISuggestTransition,
  useAIAnalyzeWorkflow,
} from "../api/use-workflow-ai";
import { 
  WorkflowAIAnswer, 
  StatusSuggestion, 
  TransitionSuggestion,
  WorkflowSuggestion,
} from "../types/ai-context";

interface WorkflowAIChatProps {
  workflowId: string;
  workspaceId: string;
  onCreateStatus?: (status: StatusSuggestion) => void;
  onCreateTransition?: (transition: TransitionSuggestion) => void;
  onPreview?: (suggestion: StatusSuggestion | TransitionSuggestion | WorkflowSuggestion) => void;
  onApplyFullWorkflow?: (suggestion: WorkflowSuggestion) => void;
}

interface ConversationItem extends WorkflowAIAnswer {
  statusSuggestion?: StatusSuggestion;
  transitionSuggestion?: TransitionSuggestion;
}

const SUGGESTED_PROMPTS = [
  { icon: Search, text: "Analyze this workflow", type: "analyze" },
  { icon: Plus, text: "Add a review status", type: "status" },
  { icon: ArrowRight, text: "Create transition from In Progress to Review", type: "transition" },
  { icon: Lightbulb, text: "What improvements can I make?", type: "question" },
];

export const WorkflowAIChat = ({
  workflowId,
  workspaceId,
  onCreateStatus,
  onCreateTransition,
  onPreview,
  onApplyFullWorkflow,
}: WorkflowAIChatProps) => {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: contextData, isLoading: isLoadingContext } = useGetWorkflowAIContext(
    workflowId,
    workspaceId
  );
  const { mutate: askQuestion, isPending: isAsking } = useAskWorkflowQuestion();
  const { mutate: suggestStatus, isPending: isSuggestingStatus } = useAISuggestStatus();
  const { mutate: suggestTransition, isPending: isSuggestingTransition } = useAISuggestTransition();
  const { mutate: analyzeWorkflow, isPending: isAnalyzing } = useAIAnalyzeWorkflow();

  const context = contextData?.data;
  const isProcessing = isAsking || isSuggestingStatus || isSuggestingTransition || isAnalyzing;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [conversation]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Detect action type from question
  const detectActionType = (text: string): "status" | "transition" | "analyze" | "question" => {
    const statusPatterns = [
      /create\s+(a\s+)?status/i,
      /add\s+(a\s+)?status/i,
      /new\s+status/i,
      /status\s+for/i,
      /status\s+called/i,
    ];
    const transitionPatterns = [
      /create\s+(a\s+)?transition/i,
      /add\s+(a\s+)?transition/i,
      /connect\s+/i,
      /transition\s+from/i,
      /allow\s+moving/i,
    ];
    const analyzePatterns = [
      /analyze/i,
      /check\s+(for\s+)?issues/i,
      /review\s+workflow/i,
      /find\s+problems/i,
    ];

    // Long or complex prompts should almost always use the general assistant
    if (text.length > 80) return "question";

    for (const pattern of statusPatterns) {
      if (pattern.test(text)) return "status";
    }
    for (const pattern of transitionPatterns) {
      if (pattern.test(text)) return "transition";
    }
    for (const pattern of analyzePatterns) {
      if (pattern.test(text)) return "analyze";
    }
    return "question";
  };

  const handleAsk = (prompt?: string, type?: string) => {
    const text = prompt || question;
    if (!text.trim()) return;

    const actionType = type || detectActionType(text);

    // Add user question to conversation
    const userItem: ConversationItem = {
      question: text,
      answer: "",
      timestamp: new Date().toISOString(),
      contextUsed: { statusesCount: 0, transitionsCount: 0 },
    };
    setConversation(prev => [...prev, userItem]);
    setQuestion("");

    if (actionType === "status") {
      suggestStatus(
        { workflowId, workspaceId, prompt: text },
        {
          onSuccess: (response) => {
            const item: ConversationItem = {
              question: text,
              answer: response.data.message,
              timestamp: new Date().toISOString(),
              contextUsed: { statusesCount: context?.summary.totalStatuses || 0, transitionsCount: 0 },
              statusSuggestion: response.data.status,
            };
            setConversation(prev => [...prev.slice(0, -1), item]);
          },
          onError: () => {
            setConversation(prev => prev.slice(0, -1));
          },
        }
      );
    } else if (actionType === "transition") {
      suggestTransition(
        { workflowId, workspaceId, prompt: text },
        {
          onSuccess: (response) => {
            const item: ConversationItem = {
              question: text,
              answer: response.data.message,
              timestamp: new Date().toISOString(),
              contextUsed: { statusesCount: 0, transitionsCount: context?.summary.totalTransitions || 0 },
              transitionSuggestion: response.data.transition,
            };
            setConversation(prev => [...prev.slice(0, -1), item]);
          },
          onError: () => {
            setConversation(prev => prev.slice(0, -1));
          },
        }
      );
    } else if (actionType === "analyze") {
      analyzeWorkflow(
        { workflowId, workspaceId },
        {
          onSuccess: (response) => {
            const item: ConversationItem = {
              ...response.data,
              question: text,
            };
            setConversation(prev => [...prev.slice(0, -1), item]);
          },
          onError: () => {
            setConversation(prev => prev.slice(0, -1));
          },
        }
      );
    } else {
      askQuestion(
        { workflowId, workspaceId, question: text },
        {
          onSuccess: (response) => {
            const data = response.data;
            const item: ConversationItem = {
              ...data,
            };
            
            // If the response contains a workflow suggestion, extract it
            if (data.action?.type === "suggest_workflow") {
              // For simplicity in the current UI, we'll store the first status/transition found if any,
              // but we should really support a "Full Suggestion" card.
              // Actually, let's keep the 'action' on the item and render it below.
            }
            
            setConversation(prev => [...prev.slice(0, -1), item]);
          },
          onError: () => {
            setConversation(prev => prev.slice(0, -1));
          },
        }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleCreateStatus = (status: StatusSuggestion) => {
    onCreateStatus?.(status);
    toast.success(`Creating status: ${status.name}`);
  };

  const handleCreateTransition = (transition: TransitionSuggestion) => {
    onCreateTransition?.(transition);
    toast.success(`Creating transition: ${transition.fromStatusKey} → ${transition.toStatusKey}`);
  };

  const handleApplyFullWorkflow = (suggestion: WorkflowSuggestion) => {
    onApplyFullWorkflow?.(suggestion);
  };

  const clearConversation = () => {
    setConversation([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-1" ref={scrollAreaRef}>
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full mb-4">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-sm mb-1">Workflow AI Assistant</h4>
            <p className="text-xs text-muted-foreground mb-4">
              I can help you build and optimize your workflow.
            </p>
            
            {/* Context badges */}
            {context && (
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline" className="text-[10px]">
                  <GitBranch className="h-3 w-3 mr-1" />
                  {context.summary.totalStatuses} Statuses
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <ArrowRight className="h-3 w-3 mr-1" />
                  {context.summary.totalTransitions} Transitions
                </Badge>
              </div>
            )}

            {/* Quick prompts */}
            <div className="w-full space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Try asking</p>
              <div className="grid gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs justify-start font-normal"
                    onClick={() => handleAsk(prompt.text, prompt.type)}
                    disabled={isProcessing || isLoadingContext}
                  >
                    <prompt.icon className="h-3 w-3 mr-2 text-muted-foreground" />
                    {prompt.text}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {conversation.map((item, index) => (
              <div key={index} className="space-y-2">
                {/* User Question */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm">
                    {item.question}
                  </div>
                </div>

                {/* AI Response */}
                {item.answer && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div className="px-3 py-2 rounded-xl bg-muted text-sm">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            code: ({ className, children }) => {
                              const codeString = String(children).replace(/\n$/, "");
                              const codeId = `code-${index}-${Math.random().toString(36).substr(2, 9)}`;
                              
                              if (className) {
                                return (
                                  <div className="relative group my-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-1 top-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleCopyCode(codeString, codeId)}
                                    >
                                      {copiedCode === codeId ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <pre className="bg-slate-900 text-slate-50 rounded-md p-3 text-xs overflow-x-auto">
                                      <code>{children}</code>
                                    </pre>
                                  </div>
                                );
                              }
                              return (
                                <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {item.answer}
                        </ReactMarkdown>
                      </div>

                      {/* Status Suggestion Card */}
                      {item.statusSuggestion && onCreateStatus && (
                        <Card className="mt-2 border-green-200 bg-green-50/50 dark:bg-green-950/20">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: item.statusSuggestion.color }}
                                />
                                <div>
                                  <p className="text-sm font-medium">{item.statusSuggestion.name}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    {item.statusSuggestion.key} • {item.statusSuggestion.statusType}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleCreateStatus(item.statusSuggestion!)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Create
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Transition Suggestion Card */}
                      {item.transitionSuggestion && onCreateTransition && (
                        <Card className="mt-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ArrowRight className="h-4 w-4 text-blue-600" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {item.transitionSuggestion.fromStatusKey} → {item.transitionSuggestion.toStatusKey}
                                  </p>
                                  {item.transitionSuggestion.name && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {item.transitionSuggestion.name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleCreateTransition(item.transitionSuggestion!)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Create
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Multi-Action Suggestion Card (Workflow Suggestion) */}
                      {item.action?.type === "suggest_workflow" && (
                        <Card className="mt-2 border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4 text-purple-600" />
                                <h5 className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                                  Complex Workflow Update
                                </h5>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-100"
                                  onClick={() => item.action?.data && onPreview?.(item.action.data)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Preview
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                                  onClick={() => item.action?.data && handleApplyFullWorkflow(item.action.data as WorkflowSuggestion)}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Apply All
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              {((item.action.data as WorkflowSuggestion).statuses || []).length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-purple-800 uppercase tracking-wider">Statuses to create</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(item.action.data as WorkflowSuggestion).statuses.map((s, i) => (
                                      <Badge key={i} variant="outline" className="text-[9px] bg-white/50">
                                        {s.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {((item.action.data as WorkflowSuggestion).transitions || []).length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-purple-800 uppercase tracking-wider">Transitions to add</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {(item.action.data as WorkflowSuggestion).transitions.length} connections defined
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {!item.answer && isProcessing && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-muted">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background p-3 space-y-2">
        {conversation.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-5 px-2"
              onClick={clearConversation}
            >
              Clear chat
            </Button>
          </div>
        )}
        <div className="relative">
          <Textarea
            placeholder="Ask about your workflow or say 'Add a status for...' or 'Create transition from...'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing || isLoadingContext}
            className="min-h-[60px] max-h-[100px] pr-12 resize-none rounded-xl text-sm"
            rows={2}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-7 w-7 rounded-lg"
            onClick={() => handleAsk()}
            disabled={!question.trim() || isProcessing || isLoadingContext}
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
