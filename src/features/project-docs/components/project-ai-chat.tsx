"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { 
  Loader2, 
  Send, 
  Sparkles, 
  FileText, 
  ListTodo, 
  Copy, 
  Check, 
  X,
  Minimize2,
  Maximize2,
  Users,
  Plus,
  Edit,
  CheckCircle2,
  Calendar,
  Flag,
  Tag,
  Clock,
  GitBranch,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  Bug,
  Layout,
  Layers,
  Box,
  Camera,
} from "lucide-react";

import { RichTextEditor } from "@/components/editor/rich-text-editor";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { 
  useAskProjectQuestion, 
  useGetProjectAIContext, 
  useAICreateTask, 
  useAIUpdateTask,
  useExecuteTaskSuggestion,
} from "../api/use-project-ai";
import { useUploadAttachment } from "@/features/attachments/hooks/use-upload-attachment";
import { WorkItemType } from "@/features/sprints/types";
import { ProjectAIAnswer, AITaskResponse, AITaskData, AvailableMember, TaskContext, GitHubRecommendation } from "../types/ai-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TaskPicker } from "./task-picker";

interface ProjectAIChatProps {
  projectId: string;
  workspaceId: string;
}

// Extended conversation item that can include task actions
interface ConversationItem extends ProjectAIAnswer {
  taskResponse?: AITaskResponse;
  availableMembers?: AvailableMember[];
  suggestedLabels?: string[];
  githubRecommendation?: GitHubRecommendation;
}

const SUGGESTED_QUESTIONS = [
  "What is this project about?",
  "Summarize the PRD",
  "What tasks are in progress?",
  "List high priority tasks",
];

export const ProjectAIChat = ({ projectId, workspaceId }: ProjectAIChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pendingTaskAction, setPendingTaskAction] = useState<AITaskResponse | null>(null);
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskContext | null>(null);
  
  // NEW: Task Type selection & Attachments state
  const [isAskingType, setIsAskingType] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: contextData, isLoading: isLoadingContext } = useGetProjectAIContext(
    projectId,
    workspaceId
  );
  const { mutate: askQuestion, isPending: isAsking } = useAskProjectQuestion();
  const { mutate: createTaskAI, isPending: isCreatingTask } = useAICreateTask();
  const { mutate: updateTaskAI, isPending: isUpdatingTask } = useAIUpdateTask();
  const { mutate: executeTask, isPending: isExecutingTask } = useExecuteTaskSuggestion();

  const context = contextData?.data;
  const isProcessing = isAsking || isCreatingTask || isUpdatingTask || isExecutingTask;

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  };

  // Auto-scroll to bottom when conversation changes or while processing
  useEffect(() => {
    scrollToBottom();
  }, [conversation, isProcessing]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Detect if the question is a task create action
  const detectCreateAction = (text: string): boolean => {
    const createPatterns = [
      /create\s+(a\s+)?task/i,
      /add\s+(a\s+)?task/i,
      /new\s+task/i,
      /make\s+(a\s+)?task/i,
    ];
    return createPatterns.some(pattern => pattern.test(text));
  };

  const handleAsk = (questionText?: string) => {
    const q = questionText || question.trim();
    if (!q) return;

    // Scroll to bottom when user sends a message
    scrollToBottom();

    if (editMode && selectedTask) {
      // Explicit edit mode — task already selected via picker
      updateTaskAI(
        { projectId, workspaceId, taskId: selectedTask.id, prompt: q, autoExecute: false },
        {
          onSuccess: (response) => {
            const conversationItem: ConversationItem = {
              question: `[Edit: ${selectedTask.name}] ${q}`,
              answer: response.message,
              timestamp: new Date().toISOString(),
              contextUsed: {
                documentsCount: 0,
                tasksCount: 1,
                membersCount: context?.members.length || 0,
                categories: [],
              },
              taskResponse: response,
            };
            setConversation((prev) => [...prev, conversationItem]);
            if (response.action && !response.action.executed) {
              setPendingTaskAction(response);
            }
            setQuestion("");
            setEditMode(false);
            setSelectedTask(null);
          },
        }
      );
      return;
    }

    if (detectCreateAction(q)) {
      // Show user message immediately
      const conversationItem: ConversationItem = {
        question: q,
        answer: "Thinking... I see you want to create a work item. What type of item is this?",
        timestamp: new Date().toISOString(),
        contextUsed: {
          documentsCount: 0,
          tasksCount: 0,
          membersCount: context?.members.length || 0,
          categories: [],
        },
      };
      setConversation((prev) => [...prev, conversationItem]);
      
      // Store prompt and ask for type
      setPendingPrompt(q);
      setIsAskingType(true);
      setQuestion(""); // CLEAR input immediately
      scrollToBottom();
      return;
    }

    // GENERAL CHAT (Missing in previous version)
    askQuestion(
      { projectId, workspaceId, question: q },
      {
        onSuccess: (response) => {
          setConversation((prev) => [...prev, {
            ...response.data,
            timestamp: new Date().toISOString(),
          }]);
          setQuestion("");
        },
        onError: () => {
          toast.error("Failed to get answer from AI");
        }
      }
    );
  };

  const { mutate: uploadAttachment } = useUploadAttachment();

  const handleCreateTaskWithType = (type: string) => {
    setIsAskingType(false);
    
    // Include info about attachments in the prompt for AI
    const attachmentInfo = attachments.length > 0 
      ? `\n\n[Note: User has attached ${attachments.length} file(s) including ${attachments.filter(a => a.type.startsWith('image/')).length} image(s).]`
      : "";

    createTaskAI(
      { projectId, workspaceId, prompt: pendingPrompt + attachmentInfo, autoExecute: false, type },
      {
        onSuccess: (response) => {
          // Update the EXISTING conversation item (the last one)
          setConversation((prev) => {
            const newConv = [...prev];
            if (newConv.length > 0) {
              const lastIndex = newConv.length - 1;
              newConv[lastIndex] = {
                ...newConv[lastIndex],
                answer: response.message,
                taskResponse: response,
                githubRecommendation: response.githubRecommendation,
              };
            }
            return newConv;
          });
          
          if (response.action && !response.action.executed) {
            setPendingTaskAction(response);
          }
          setPendingPrompt("");
        },
      }
    );
  };

  const handleExecuteTaskAction = async (taskResponse: AITaskResponse, conversationIndex: number) => {
    if (!taskResponse.action?.taskData) return;

    setExecutingIndex(conversationIndex);

    executeTask(
      {
        projectId,
        workspaceId,
        taskData: taskResponse.action.taskData,
        taskId: taskResponse.action.taskId,
      },
      {
        onSuccess: async (response) => {
          const newTaskId = response.task?.id;
          
          // UPLOAD ATTACHMENTS if any
          if (newTaskId && attachments.length > 0) {
            toast.info(`Uploading ${attachments.length} attachment(s)...`);
            for (const file of attachments) {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("taskId", newTaskId);
              formData.append("projectId", projectId);
              formData.append("workspaceId", workspaceId);
              
              await new Promise((resolve) => {
                uploadAttachment({ form: formData }, {
                  onSuccess: resolve,
                  onError: (err) => {
                    console.error("Failed to upload:", file.name, err);
                    resolve(null);
                  }
                });
              });
            }
            setAttachments([]);
          }

          // Update the conversation with the result using index
          setConversation((prev) =>
            prev.map((item, idx) =>
              idx === conversationIndex
                ? { ...item, taskResponse: response, answer: response.message }
                : item
            )
          );
          setPendingTaskAction(null);
          setExecutingIndex(null);
          toast.success(response.action?.type === "update" ? "Task updated!" : "Task created!");
        },
        onError: () => {
          setExecutingIndex(null);
          toast.error("Failed to execute task action");
        },
      }
    );
  };

  const handleQuickCreateTask = () => {
    setQuestion("Create a task for ");
    setEditMode(false);
    setSelectedTask(null);
  };

  const handleQuickUpdateTask = () => {
    setEditMode(true);
    setSelectedTask(null);
    setQuestion("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
      e.preventDefault();
      handleAsk();
    }
  };

  const clearConversation = () => {
    setConversation([]);
    setPendingTaskAction(null);
    setEditMode(false);
    setSelectedTask(null);
  };

  // Task Preview Card Component with editable fields
  const TaskPreviewCard = ({ 
    taskData: initialTaskData, 
    onExecute, 
    onCancel, 
    isUpdate = false, 
    isPending = false,
    availableMembers = [],
    suggestedLabels = [],
    onRegenerate,
  }: {
    taskData: AITaskData;
    onExecute: (updatedTaskData: AITaskData) => void;
    onCancel: () => void;
    isUpdate?: boolean;
    isPending?: boolean;
    availableMembers?: AvailableMember[];
    suggestedLabels?: string[];
    onRegenerate?: () => void;
  }) => {
    const [taskData, setTaskData] = useState<AITaskData>(initialTaskData);
    const [newLabel, setNewLabel] = useState("");
    const [showAssigneeList, setShowAssigneeList] = useState(false);
    const [showLabelInput, setShowLabelInput] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    const statuses = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CLOSED"];

    const handleToggleAssignee = (memberId: string) => {
      const currentAssignees = taskData.assigneeIds || [];
      const newAssignees = currentAssignees.includes(memberId)
        ? currentAssignees.filter(id => id !== memberId)
        : [...currentAssignees, memberId];
      setTaskData({ ...taskData, assigneeIds: newAssignees });
    };

    const handleToggleLabel = (label: string) => {
      const currentLabels = taskData.labels || [];
      const newLabels = currentLabels.includes(label)
        ? currentLabels.filter(l => l !== label)
        : [...currentLabels, label];
      setTaskData({ ...taskData, labels: newLabels });
    };

    const handleAddCustomLabel = () => {
      if (newLabel.trim() && !(taskData.labels || []).includes(newLabel.trim())) {
        setTaskData({ 
          ...taskData, 
          labels: [...(taskData.labels || []), newLabel.trim()] 
        });
        setNewLabel("");
      }
    };

    const selectedMembers = availableMembers.filter(m => 
      (taskData.assigneeIds || []).includes(m.id)
    );

    return (
      <Card className="mt-3 border-dashed border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {isUpdate ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isUpdate ? "Proposed Task Update" : "Proposed New Task"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          {/* Task Name & Description */}
          <div className="space-y-1">
            <p className="font-medium text-sm">{taskData.name}</p>
            {taskData.description && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showPreview ? "Hide Preview" : "Preview Description"}
                </Button>
                
                {showPreview ? (
                  <div className="rounded-md border bg-background overflow-hidden">
                    <RichTextEditor
                      content={taskData.description}
                      editable={false}
                      showToolbar={false}
                      minHeight="100px"
                      className="border-none text-xs"
                    />
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 px-1">
                    {taskData.description.replace(/<[^>]*>/g, '').slice(0, 100)}...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Status & Priority Selection */}
          <div className="flex flex-wrap gap-2">
            {/* Status Badge/Select */}
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
              <Select
                value={taskData.status || "ASSIGNED"}
                onValueChange={(value) => setTaskData({ ...taskData, status: value })}
              >
                <SelectTrigger className="h-6 text-xs w-auto min-w-[100px] border-dashed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status} className="text-xs">
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Badge/Select */}
            <div className="flex items-center gap-1">
              <Flag className="h-3 w-3 text-muted-foreground" />
              <Select
                value={taskData.priority || "MEDIUM"}
                onValueChange={(value) => setTaskData({ ...taskData, priority: value })}
              >
                <SelectTrigger className="h-6 text-xs w-auto min-w-[90px] border-dashed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority} value={priority} className="text-xs">
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date & Estimated Hours (read-only badges) */}
            {taskData.dueDate && (
              <Badge variant="outline" className="text-xs h-6">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date(taskData.dueDate).toLocaleDateString()}
              </Badge>
            )}
            {taskData.estimatedHours && (
              <Badge variant="outline" className="text-xs h-6">
                <Clock className="h-3 w-3 mr-1" />
                {taskData.estimatedHours}h
              </Badge>
            )}
          </div>

          {/* Assignees Section */}
          {availableMembers.length > 0 && (
            <div className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowAssigneeList(!showAssigneeList)}
              >
                <span className="text-xs font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Assignees ({selectedMembers.length})
                </span>
                <span className="text-xs text-muted-foreground">
                  {showAssigneeList ? "Hide" : "Select"}
                </span>
              </div>
              
              {/* Selected Assignees Display */}
              {selectedMembers.length > 0 && !showAssigneeList && (
                <div className="flex flex-wrap gap-1">
                  {selectedMembers.map(m => (
                    <Badge key={m.id} variant="secondary" className="text-xs">
                      {m.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Assignee Selection List */}
              {showAssigneeList && (
                <div className="max-h-32 overflow-y-auto space-y-1 bg-muted/50 rounded-md p-2">
                  {availableMembers.map(member => (
                    <label 
                      key={member.id} 
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5"
                    >
                      <Checkbox
                        checked={(taskData.assigneeIds || []).includes(member.id)}
                        onCheckedChange={() => handleToggleAssignee(member.id)}
                        className="h-3 w-3"
                      />
                      <span>{member.name}</span>
                      <span className="text-muted-foreground">({member.role})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Labels Section */}
          <div className="space-y-2">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowLabelInput(!showLabelInput)}
            >
              <span className="text-xs font-medium flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Labels ({(taskData.labels || []).length})
              </span>
              <span className="text-xs text-muted-foreground">
                {showLabelInput ? "Hide" : "Edit"}
              </span>
            </div>

            {/* Current Labels Display */}
            {(taskData.labels || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(taskData.labels || []).map(label => (
                  <Badge 
                    key={label} 
                    variant="outline" 
                    className="text-xs cursor-pointer hover:bg-destructive/10"
                    onClick={() => handleToggleLabel(label)}
                  >
                    {label}
                    <X className="h-2 w-2 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Label Selection & Input */}
            {showLabelInput && (
              <div className="space-y-2 bg-muted/50 rounded-md p-2">
                {/* Suggested Labels */}
                {suggestedLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {suggestedLabels.filter(l => !(taskData.labels || []).includes(l)).map(label => (
                      <Badge 
                        key={label} 
                        variant="outline" 
                        className="text-xs cursor-pointer hover:bg-primary/10"
                        onClick={() => handleToggleLabel(label)}
                      >
                        <Plus className="h-2 w-2 mr-1" />
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Custom Label Input */}
                <div className="flex gap-1">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Add custom label..."
                    className="h-6 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomLabel();
                      }
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs px-2"
                    onClick={handleAddCustomLabel}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-none"
              onClick={() => onExecute(taskData)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              {isUpdate ? "Apply Updates" : "Create Task"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-shrink-0"
              onClick={() => {
                if (onRegenerate) {
                  onRegenerate();
                } else {
                  toast.error("Regeneration is not available for this item");
                }
              }}
              disabled={isPending}
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isPending && "animate-spin")} />
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-shrink-0"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!isOpen) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 z-50"
              size="icon"
            >
              <Sparkles className="h-6 w-6 text-white" />
              {context && (context.summary.totalDocuments > 0 || context.summary.totalTasks > 0) && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Project AI Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col bg-background border rounded-2xl shadow-2xl transition-all duration-300",
        isExpanded 
          ? "w-[600px] h-[80vh]" 
          : "w-[400px] h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Project AI</h3>
            <div className="flex items-center gap-2">
              {isLoadingContext ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : context ? (
                <span className="text-xs text-muted-foreground">
                  {context.summary.totalDocuments} docs • {context.summary.totalTasks} tasks
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conversation Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full mb-4">
              <Sparkles className="h-8 w-8 text-purple-600" />
            </div>
            <h4 className="font-medium mb-2">Ask about your project</h4>
            <p className="text-sm text-muted-foreground mb-4">
              I can help you with questions, create tasks, and update existing tasks.
            </p>
            
            {/* Context badges */}
            {context && (
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {context.summary.totalDocuments} Documents
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <ListTodo className="h-3 w-3 mr-1" />
                  {context.summary.totalTasks} Tasks
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {context.summary.totalMembers} Members
                </Badge>
              </div>
            )}

            {/* Task Action Buttons */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-dashed"
                onClick={handleQuickCreateTask}
                disabled={isProcessing || isLoadingContext}
              >
                <Plus className="h-3 w-3 mr-1" />
                Create Task
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-dashed"
                onClick={handleQuickUpdateTask}
                disabled={isProcessing || isLoadingContext}
              >
                <Edit className="h-3 w-3 mr-1" />
                Update Task
              </Button>
            </div>

            {/* Suggested questions */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleAsk(q)}
                  disabled={isProcessing || isLoadingContext}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {conversation.map((item, index) => (
              <div key={index} className="space-y-3">
                {/* User Question */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%]">
                    <p className="text-sm">{item.question}</p>
                  </div>
                </div>

                {/* AI Answer */}
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeString = String(children).replace(/\n$/, "");
                            const codeId = `code-${index}-${Math.random().toString(36).substr(2, 9)}`;
                            
                            if (match) {
                              return (
                                <div className="relative group my-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleCopyCode(codeString, codeId)}
                                  >
                                    {copiedCode === codeId ? (
                                      <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ fontSize: "12px", borderRadius: "8px" }}
                                  >
                                    {codeString}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            
                            return (
                              <code className={cn("bg-muted-foreground/20 px-1 py-0.5 rounded text-xs", className)} {...props}>
                                {children}
                              </code>
                            );
                          },
                          p({ children }) {
                            return <p className="text-sm mb-2 last:mb-0">{children}</p>;
                          },
                          ul({ children }) {
                            return <ul className="text-sm list-disc pl-4 mb-2">{children}</ul>;
                          },
                          ol({ children }) {
                            return <ol className="text-sm list-decimal pl-4 mb-2">{children}</ol>;
                          },
                          li({ children }) {
                            return <li className="text-sm mb-1">{children}</li>;
                          },
                          h1({ children }) {
                            return <h1 className="text-base font-bold mb-2">{children}</h1>;
                          },
                          h2({ children }) {
                            return <h2 className="text-sm font-bold mb-2">{children}</h2>;
                          },
                          h3({ children }) {
                            return <h3 className="text-sm font-semibold mb-1">{children}</h3>;
                          },
                        }}
                      >
                        {item.answer}
                      </ReactMarkdown>
                    </div>

                    {/* GitHub Recommendation Card */}
                    {item.githubRecommendation && (
                      <Card className="mt-3 border-2 border-purple-500/30 bg-purple-500/5">
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400">
                            <div className="p-1 bg-purple-500/20 rounded-full">
                              <GitBranch className="h-4 w-4" />
                            </div>
                            GitHub-Ready Output
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-3">
                          {/* Branch Name */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Branch Name</label>
                            <div className="flex items-center gap-1">
                              <code className="flex-1 text-xs bg-background/80 border rounded px-2 py-1 font-mono truncate">
                                {item.githubRecommendation.branchName}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleCopyCode(item.githubRecommendation!.branchName, "gh-branch")}
                              >
                                {copiedCode === "gh-branch" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>

                          {/* Commit */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Commit Title</label>
                            <div className="flex items-center gap-1">
                              <code className="flex-1 text-xs bg-background/80 border rounded px-2 py-1 font-mono truncate">
                                {item.githubRecommendation.commitTitle}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleCopyCode(item.githubRecommendation!.commitTitle, "gh-commit-title")}
                              >
                                {copiedCode === "gh-commit-title" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>

                          {item.githubRecommendation.commitBody && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Commit Body</label>
                              <div className="relative">
                                <pre className="text-xs bg-background/80 border rounded px-2 py-1.5 whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
                                  {item.githubRecommendation.commitBody}
                                </pre>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 absolute top-1 right-1"
                                  onClick={() => handleCopyCode(item.githubRecommendation!.commitBody, "gh-commit-body")}
                                >
                                  {copiedCode === "gh-commit-body" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* PR */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                              PR Title → <span className="font-mono">{item.githubRecommendation.targetBranch}</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <code className="flex-1 text-xs bg-background/80 border rounded px-2 py-1 font-mono truncate">
                                {item.githubRecommendation.prTitle}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleCopyCode(item.githubRecommendation!.prTitle, "gh-pr-title")}
                              >
                                {copiedCode === "gh-pr-title" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>

                          {item.githubRecommendation.prDescription && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">PR Description</label>
                              <div className="relative">
                                <pre className="text-xs bg-background/80 border rounded px-2 py-1.5 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                  {item.githubRecommendation.prDescription}
                                </pre>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 absolute top-1 right-1"
                                  onClick={() => handleCopyCode(item.githubRecommendation!.prDescription, "gh-pr-desc")}
                                >
                                  {copiedCode === "gh-pr-desc" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          )}

                          {item.githubRecommendation.note && (
                            <p className="text-[10px] text-muted-foreground italic mt-1">
                              {item.githubRecommendation.note}
                            </p>
                          )}

                          {/* Copy All Button */}
                          <div className="pt-1 border-t border-purple-500/20">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs w-full border-purple-500/30 hover:bg-purple-500/10"
                              onClick={() => {
                                const ghRec = item.githubRecommendation!;
                                const allText = `Branch: ${ghRec.branchName}\nCommit: ${ghRec.commitTitle}\n\n${ghRec.commitBody}\n\nPR Title: ${ghRec.prTitle}\nTarget: ${ghRec.targetBranch}\n\n${ghRec.prDescription}`;
                                handleCopyCode(allText, "gh-all");
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy All Git Info
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Task Action Card */}
                    {item.taskResponse?.action && !item.taskResponse.action.executed && item.taskResponse.action.taskData && (
                      <TaskPreviewCard
                        taskData={item.taskResponse.action.taskData}
                        availableMembers={item.taskResponse.availableMembers || []}
                        suggestedLabels={item.taskResponse.suggestedLabels || []}
                        isUpdate={item.taskResponse.action.type === "suggest_update" || item.taskResponse.action.type === "update"}
                        onExecute={(modifiedTaskData) => {
                          // Use the modified task data from the preview card
                          const updatedResponse: AITaskResponse = {
                            ...item.taskResponse!,
                            action: {
                              ...item.taskResponse!.action!,
                              taskData: modifiedTaskData,
                            },
                          };
                          handleExecuteTaskAction(updatedResponse, index);
                        }}
                        onCancel={() => {
                          setConversation((prev) =>
                            prev.map((c, idx) =>
                              idx === index
                                ? { ...c, taskResponse: undefined, answer: "Task action cancelled." }
                                : c
                            )
                          );
                        }}
                        isPending={executingIndex === index}
                        onRegenerate={() => handleAsk(item.question)}
                      />
                    )}

                    {/* Success Card for executed tasks */}
                    {item.taskResponse?.action?.executed && item.taskResponse.success && (
                      <Card className="mt-3 border-2 border-green-500/30 bg-green-500/5">
                        <CardContent className="p-3 space-y-3">
                          {/* Success Header */}
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <div className="p-1 bg-green-500/20 rounded-full">
                              <Check className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium">
                              Task {item.taskResponse.action.type === "update" || item.taskResponse.action.type === "suggest_update" ? "Updated" : "Created"} Successfully!
                            </span>
                          </div>

                          {/* Task Details */}
                          {item.taskResponse.task && (
                            <div className="bg-background/50 rounded-md p-2 space-y-2">
                              <p className="font-medium text-sm">{item.taskResponse.task.name}</p>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-xs bg-background">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {item.taskResponse.task.status}
                                </Badge>
                                {item.taskResponse.action.taskData?.priority && (
                                  <Badge variant="outline" className="text-xs bg-background">
                                    <Flag className="h-3 w-3 mr-1" />
                                    {item.taskResponse.action.taskData.priority}
                                  </Badge>
                                )}
                                {item.taskResponse.action.taskData?.labels && item.taskResponse.action.taskData.labels.length > 0 && (
                                  <>
                                    {item.taskResponse.action.taskData.labels.slice(0, 3).map(label => (
                                      <Badge key={label} variant="secondary" className="text-xs">
                                        {label}
                                      </Badge>
                                    ))}
                                    {item.taskResponse.action.taskData.labels.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{item.taskResponse.action.taskData.labels.length - 3}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Follow-up Actions */}
                          <div className="pt-2 border-t border-green-500/20">
                            <p className="text-xs text-muted-foreground mb-2">What else can I help you with?</p>
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setQuestion("Create another task for ")}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Create another task
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setQuestion(`Update task "${item.taskResponse?.task?.name}" to `)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Update this task
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setQuestion("Show me all tasks in progress")}
                              >
                                <ListTodo className="h-3 w-3 mr-1" />
                                View tasks
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {item.contextUsed.documentsCount} docs, {item.contextUsed.tasksCount} tasks, {item.contextUsed.membersCount} members analyzed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start pt-2">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-3">
                  <div className="relative">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <Loader2 className="h-4 w-4 animate-spin absolute inset-0 opacity-20" />
                  </div>
                  <span className="text-sm text-foreground font-medium animate-pulse">
                    {isCreatingTask ? "Architecting your task..." : isUpdatingTask ? "Refining task details..." : "Thinking..."}
                  </span>
                </div>
              </div>
            )}

            {/* NEW: Type Picker UI when AI detects creation intent */}
            {isAskingType && (
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-primary font-medium">
                  < Sparkles className="h-4 w-4" />
                  <span>Great! What type of work item is this?</span>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-1 border-primary/20 hover:border-primary hover:bg-primary/10"
                    onClick={() => handleCreateTaskWithType(WorkItemType.TASK)}
                  >
                    <Layout className="h-5 w-5 text-blue-500" />
                    <span className="text-xs">General Task</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-1 border-red-500/20 hover:border-red-500 hover:bg-red-500/10"
                    onClick={() => handleCreateTaskWithType(WorkItemType.BUG)}
                  >
                    <Bug className="h-5 w-5 text-red-500" />
                    <span className="text-xs">Bug Report</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-1 border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                    onClick={() => handleCreateTaskWithType(WorkItemType.STORY)}
                  >
                    <Layers className="h-5 w-5 text-green-500" />
                    <span className="text-xs">User Story</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-1 border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                    onClick={() => handleCreateTaskWithType(WorkItemType.EPIC)}
                  >
                    <Box className="h-5 w-5 text-purple-500" />
                    <span className="text-xs">Epic</span>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsAskingType(false)} className="text-xs">
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
        {/* Attachment Preview Tray */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto p-1">
            {attachments.map((file, i) => (
              <div key={i} className="relative group">
                <Badge variant="secondary" className="h-8 pr-7 pl-2 py-0 flex items-center gap-2">
                  {file.type.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
                  <span className="max-w-[100px] truncate text-[10px]">{file.name}</span>
                </Badge>
                <button 
                  className="absolute right-1 top-1.5 h-5 w-5 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center transition-colors"
                  onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              onChange={(e) => {
                if (e.target.files) {
                  setAttachments([...attachments, ...Array.from(e.target.files)]);
                }
              }}
            />
            <input 
              type="file" 
              ref={screenshotInputRef} 
              className="hidden" 
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setAttachments([...attachments, e.target.files[0]]);
                }
              }}
            />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="shadow-xl"><p>Attach Files (PDF, Docs)</p></TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => screenshotInputRef.current?.click()}>
                    <Camera className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="shadow-xl"><p>Upload Screenshot / Photo</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {conversation.length > 0 && (
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-2">
              <Button
                variant={!editMode ? "primary" : "ghost"}
                size="sm"
                className="text-xs h-6"
                onClick={handleQuickCreateTask}
                disabled={isProcessing}
              >
                <Plus className="h-3 w-3 mr-1" />
                New Task
              </Button>
              <Button
                variant={editMode ? "primary" : "ghost"}
                size="sm"
                className="text-xs h-6"
                onClick={handleQuickUpdateTask}
                disabled={isProcessing}
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit Task
              </Button>
            </div>
            <div className="flex gap-1 items-center">
              {editMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 text-muted-foreground"
                  onClick={() => { setEditMode(false); setSelectedTask(null); }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6"
                onClick={clearConversation}
              >
                Clear chat
              </Button>
            </div>
          </div>
        )}

        {/* Task Picker — shown in edit mode */}
        {editMode && context?.tasks && (
          <div className="mb-2">
            <TaskPicker
              tasks={context.tasks}
              selectedTask={selectedTask}
              onSelect={(task) => setSelectedTask(task)}
              onClear={() => setSelectedTask(null)}
              disabled={isProcessing}
              inputText={question}
            />
          </div>
        )}

        <div className="relative">
          <Textarea
            placeholder={
              editMode
                ? selectedTask
                  ? `Describe changes for "${selectedTask.name}"...`
                  : "Select a task above first, then describe changes..."
                : "Ask about your project or say 'Create a task for...'"
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing || isLoadingContext || (editMode && !selectedTask)}
            className="min-h-[60px] max-h-[120px] pr-12 resize-none rounded-xl"
            rows={2}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8 rounded-lg"
            onClick={() => handleAsk()}
            disabled={!question.trim() || isProcessing || isLoadingContext || (editMode && !selectedTask)}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {editMode
            ? "Select a task → describe your changes → press Enter"
            : "Press Enter to send • Try \"Create a task\" or click \"Edit Task\""}
        </p>
      </div>
    </div>
  );
};
