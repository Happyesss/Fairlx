"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CircleDotDashedIcon,
  ChevronDown,
  ChevronRight,
  CircleCheckIcon,
  CircleDotIcon,
  CircleIcon,
  Minus,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Tag,
  Users,
  Check,
  X,
  Send,
  Plus,
  Lock,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { Member } from "@/features/members/types";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useGetAllowedTransitions } from "@/features/workflows/api/use-get-allowed-transitions";
import { useGetWorkflowStatuses } from "@/features/workflows/api/use-get-workflow-statuses";
import { useUpdateTask } from "../api/use-update-task";
import { PopulatedTask, TaskStatus, TaskPriority } from "../types";
import { toast } from "sonner";
import { WorkItemIcon } from "@/features/timeline/components/work-item-icon";

interface TaskDetailsSidebarProps {
  task: PopulatedTask;
  workspaceId: string;
  canEdit?: boolean;
}

// Status configuration
const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  [TaskStatus.TODO]: {
    icon: <CircleIcon className="size-4" />,
    label: "Todo",
    color: "text-gray-400",
  },
  [TaskStatus.ASSIGNED]: {
    icon: <CircleIcon className="size-4" />,
    label: "Backlog",
    color: "text-gray-400",
  },
  [TaskStatus.IN_PROGRESS]: {
    icon: <CircleDotDashedIcon className="size-4" />,
    label: "In Progress",
    color: "text-yellow-500",
  },
  [TaskStatus.IN_REVIEW]: {
    icon: <CircleDotIcon className="size-4" />,
    label: "In Review",
    color: "text-blue-500",
  },
  [TaskStatus.DONE]: {
    icon: <CircleCheckIcon className="size-4" />,
    label: "Done",
    color: "text-green-500",
  },
};

// Extended status list for the popover
const allStatuses = [
  { value: "BACKLOG", icon: <CircleDotDashedIcon className="size-4 text-gray-400" />, label: "Backlog", key: "1" },
  { value: TaskStatus.TODO, icon: <CircleIcon className="size-4 text-gray-400" />, label: "Todo", key: "2" },
  { value: TaskStatus.IN_PROGRESS, icon: <CircleDotDashedIcon className="size-4 text-yellow-500" />, label: "In Progress", key: "3" },
  { value: TaskStatus.DONE, icon: <CircleCheckIcon className="size-4 text-green-500" />, label: "Done", key: "4" },
  { value: "CANCELED", icon: <X className="size-4 text-gray-500" />, label: "Canceled", key: "5" },
  { value: "DUPLICATE", icon: <X className="size-4 text-gray-500" />, label: "Duplicate", key: "6" },
];

// Priority configuration
const priorityConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  [TaskPriority.URGENT]: {
    icon: <AlertTriangle className="size-4" />,
    label: "Urgent",
    color: "text-red-500",
  },
  [TaskPriority.HIGH]: {
    icon: <ArrowUp className="size-4" />,
    label: "High",
    color: "text-orange-500",
  },
  [TaskPriority.MEDIUM]: {
    icon: <Minus className="size-4" />,
    label: "Medium",
    color: "text-yellow-500",
  },
  [TaskPriority.LOW]: {
    icon: <ArrowDown className="size-4" />,
    label: "Low",
    color: "text-blue-500",
  },
};

const allPriorities = [
  { value: "", icon: <Minus className="size-4 text-gray-400" />, label: "No priority", key: "0" },
  { value: TaskPriority.URGENT, icon: <AlertTriangle className="size-4 text-red-500" />, label: "Urgent", key: "1" },
  { value: TaskPriority.HIGH, icon: <ArrowUp className="size-4 text-orange-500" />, label: "High", key: "2" },
  { value: TaskPriority.MEDIUM, icon: <Minus className="size-4 text-yellow-500" />, label: "Medium", key: "3" },
  { value: TaskPriority.LOW, icon: <ArrowDown className="size-4 text-blue-500" />, label: "Low", key: "4" },
];

// Label colors
const labelColors: Record<string, string> = {
  Bug: "bg-red-500",
  Feature: "bg-purple-500",
  Improvement: "bg-blue-500",
  Documentation: "bg-green-500",
  Design: "bg-pink-500",
};

const suggestedLabels = ["Bug", "Feature", "Improvement"];
const allLabels = ["Feature", "Improvement", "Documentation", "Design"];

// Default work item types (stable constant to avoid recreating inside component)
const defaultWorkItemTypes = [
  { key: "TASK", label: "Task", icon: "check-square", color: "#3b82f6" },
  { key: "BUG", label: "Bug", icon: "bug", color: "#ef4444" },
  { key: "EPIC", label: "Epic", icon: "layers", color: "#a855f7" },
  { key: "STORY", label: "Story", icon: "file-text", color: "#10b981" },
  { key: "SUBTASK", label: "Subtask", icon: "arrow-right", color: "#6b7280" },
];

// Helper function to get status icon based on workflow status configuration
const getStatusIcon = (iconName: string, color: string): React.ReactNode => {
  const iconStyle = { color };
  const className = "size-4";

  switch (iconName) {
    case "CircleCheck":
    case "CheckCircle":
      return <CircleCheckIcon className={className} style={iconStyle} />;
    case "CircleDot":
      return <CircleDotIcon className={className} style={iconStyle} />;
    case "CircleDashed":
    case "CircleDotDashed":
      return <CircleDotDashedIcon className={className} style={iconStyle} />;
    case "X":
    case "XCircle":
      return <X className={className} style={iconStyle} />;
    default:
      return <CircleIcon className={className} style={iconStyle} />;
  }
};

export const TaskDetailsSidebar = ({
  task,
  workspaceId,
  canEdit = true,
}: TaskDetailsSidebarProps) => {
  const { data: members } = useGetMembers({ workspaceId });
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();

  // Get project to find workflow
  const { data: projectData } = useGetProject({ projectId: task.projectId });
  const workflowId = projectData?.workflowId;


  // Get workflow statuses to find the current status ID
  const { data: workflowStatusesData } = useGetWorkflowStatuses({
    workflowId: workflowId || ""
  });

  // Find the current status document by matching the key to task.status
  const currentStatusDoc = useMemo(() => {
    if (!workflowStatusesData?.documents) return null;
    return workflowStatusesData.documents.find(
      (s: { key: string }) => s.key === task.status
    );
  }, [workflowStatusesData, task.status]);

  // Get allowed transitions from current status
  const { data: allowedTransitions, isLoading: isLoadingTransitions } = useGetAllowedTransitions({
    workflowId: workflowId || "",
    fromStatusId: currentStatusDoc?.$id || "",
    enabled: !!workflowId && !!currentStatusDoc?.$id,
  });

  // Filter statuses to only show allowed transitions (when workflow is active)
  const workflowFilteredStatuses = useMemo(() => {
    // No workflow = show all default statuses
    if (!workflowId || !allowedTransitions) {
      return allStatuses;
    }

    // Get allowed target status keys
    const allowedStatusKeys = new Set<string>();

    // Always include current status
    allowedStatusKeys.add(task.status);

    // Add allowed transition targets
    allowedTransitions.forEach((t: { toStatus?: { key: string } }) => {
      if (t.toStatus?.key) {
        allowedStatusKeys.add(t.toStatus.key);
      }
    });

    // If we have workflow statuses, use those instead of default statuses
    if (workflowStatusesData?.documents && workflowStatusesData.documents.length > 0) {
      return workflowStatusesData.documents.map((status: {
        key: string;
        name: string;
        icon: string;
        color: string
      }) => ({
        value: status.key,
        label: status.name,
        icon: getStatusIcon(status.icon, status.color),
        key: status.key,
        isAllowed: allowedStatusKeys.has(status.key),
      }));
    }

    // Fallback: filter default statuses
    return allStatuses.map(status => ({
      ...status,
      isAllowed: allowedStatusKeys.has(status.value),
    }));
  }, [workflowId, allowedTransitions, task.status, workflowStatusesData]);

  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(true);
  const [labelOpen, setLabelOpen] = useState(true);


  const [statusSearch, setStatusSearch] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");

  // Optimistic local state — instant UI like the date picker
  const [localStatus, setLocalStatus] = useState<string>(task.status);
  const [localPriority, setLocalPriority] = useState<string | undefined>(task.priority);
  const [localType, setLocalType] = useState<string>(task.type || "TASK");
  const [localAssigneeId, setLocalAssigneeId] = useState<string | null>(
    task.assignees && task.assignees.length > 0
      ? task.assignees[0].$id
      : task.assignee?.$id || null
  );

  // Sync local state from server when task prop changes
  useEffect(() => { setLocalStatus(task.status); }, [task.status]);
  useEffect(() => { setLocalPriority(task.priority); }, [task.priority]);
  useEffect(() => { setLocalType(task.type || "TASK"); }, [task.type]);
  useEffect(() => {
    const id = task.assignees && task.assignees.length > 0
      ? task.assignees[0].$id
      : task.assignee?.$id || null;
    setLocalAssigneeId(id);
  }, [task.assignees, task.assignee]);

  const handleUpdateTask = (updates: Record<string, string | string[] | null | undefined>) => {
    updateTask(
      { param: { taskId: task.$id }, json: updates },
      {
        onError: (error) => {
          // Show the actual error message from server
          const errorMessage = error?.message || "Failed to update task";
          toast.error(errorMessage);
        },
      }
    );
  };

  const handleStatusChange = (status: string, isAllowed?: boolean) => {
    // If workflow is active and transition is not allowed, show error
    if (workflowId && isAllowed === false) {
      toast.error("This status transition is not allowed by the workflow rules");
      return;
    }
    const prev = localStatus;
    setLocalStatus(status);
    setStatusOpen(false);
    updateTask(
      { param: { taskId: task.$id }, json: { status } },
      {
        onError: (error) => {
          setLocalStatus(prev);
          // Show the actual error message from server - it contains the specific reason
          const errorMessage = error?.message || "Failed to update task";
          toast.error(errorMessage);
        },
      }
    );
  };

  const handlePriorityChange = (priority: string) => {
    const prev = localPriority;
    setLocalPriority(priority || undefined);
    setPriorityOpen(false);
    updateTask(
      { param: { taskId: task.$id }, json: { priority: priority || undefined } },
      {
        onError: (error) => {
          setLocalPriority(prev);
          toast.error(error?.message || "Failed to update task");
        },
      }
    );
  };

  const handleTypeChange = (type: string) => {
    const prev = localType;
    setLocalType(type);
    setTypeOpen(false);
    updateTask(
      { param: { taskId: task.$id }, json: { type } },
      {
        onError: (error) => {
          setLocalType(prev);
          toast.error(error?.message || "Failed to update task");
        },
      }
    );
  };

  const handleAssigneeChange = (assigneeId: string) => {
    const prev = localAssigneeId;
    const assigneeIds = assigneeId === "__none" ? [] : [assigneeId];
    setLocalAssigneeId(assigneeId === "__none" ? null : assigneeId);
    setAssigneeOpen(false);
    updateTask(
      { param: { taskId: task.$id }, json: { assigneeIds } },
      {
        onError: (error) => {
          setLocalAssigneeId(prev);
          toast.error(error?.message || "Failed to update task");
        },
      }
    );
  };



  const handleAddLabel = (label: string) => {
    const currentLabels = task.labels || [];
    if (!currentLabels.includes(label)) {
      handleUpdateTask({ labels: [...currentLabels, label] });
    }
    setLabelsOpen(false);
  };


  // Get current status display - prefer workflow status if available
  const currentStatus = useMemo(() => {
    // First check if we have a matching workflow status
    const workflowStatus = workflowFilteredStatuses.find(
      s => s.value === localStatus
    );
    if (workflowStatus) {
      return {
        icon: workflowStatus.icon,
        label: workflowStatus.label,
        color: "", // Color is embedded in the icon
      };
    }
    // Fallback to static config
    return statusConfig[localStatus] || {
      icon: <CircleDotDashedIcon className="size-4 text-gray-400" />,
      label: "Backlog",
      color: "text-gray-400",
    };
  }, [localStatus, workflowFilteredStatuses]);

  // Get current priority display
  const currentPriority = localPriority
    ? priorityConfig[localPriority]
    : null;

  // Get current assignee — use local optimistic state
  const currentAssignee = useMemo(() => {
    if (!localAssigneeId) return null;
    // Find from task.assignees or members
    if (task.assignees && task.assignees.length > 0) {
      const found = task.assignees.find((a: { $id: string }) => a.$id === localAssigneeId);
      if (found) return found;
    }
    if (task.assignee && task.assignee.$id === localAssigneeId) return task.assignee;
    // Fallback: try to find from members list
    const member = members?.documents?.find((m: Member) => m.$id === localAssigneeId);
    if (member) return { $id: member.$id, name: member.name, profileImageUrl: member.profileImageUrl };
    return null;
  }, [localAssigneeId, task.assignees, task.assignee, members]);

  // Default work item types
  // Get available work item types (custom + defaults)
  const workItemTypes = useMemo(() => {
    const custom = projectData?.customWorkItemTypes || [];
    const customKeys = new Set(custom.map((t: { key: string }) => t.key));
    const filteredDefaults = defaultWorkItemTypes.filter(t => !customKeys.has(t.key));
    return [...filteredDefaults, ...custom];
  }, [projectData?.customWorkItemTypes]);

  // Get current type display
  const currentType = useMemo(() => {
    const typeKey = localType;
    return workItemTypes.find(t => t.key === typeKey) || defaultWorkItemTypes[0];
  }, [localType, workItemTypes]);

  // Filter types by search
  const filteredTypes = useMemo(() => {
    return workItemTypes.filter((t) =>
      t.label.toLowerCase().includes(typeSearch.toLowerCase())
    );
  }, [workItemTypes, typeSearch]);

  // Filter functions - use workflow statuses if available
  const filteredStatuses = useMemo(() => {
    const statuses = workflowFilteredStatuses.length > 0 ? workflowFilteredStatuses : allStatuses;
    return statuses.filter((s) =>
      s.label.toLowerCase().includes(statusSearch.toLowerCase())
    );
  }, [workflowFilteredStatuses, statusSearch]);

  const filteredMembers = members?.documents?.filter((m: Member) =>
    m.name?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );



  const filteredLabels = [...suggestedLabels, ...allLabels].filter(
    (l) =>
      l.toLowerCase().includes(labelSearch.toLowerCase()) &&
      !(task.labels || []).includes(l)
  );

  return (
    <div className="flex flex-col gap-1  py-2">
      <div className="mt-2 mb-1 px-2">
        <div onClick={() => setProjectOpen(!projectOpen)} className="flex gap-1 cursor-pointer items-center flex-row">
          {projectOpen ? (
            <ChevronDown className="size-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 text-muted-foreground" />
          )}

          <span className="text-xs text-muted-foreground ">Status</span>

        </div>

        {projectOpen ? (
          <>
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild disabled={!canEdit || isUpdating}>
                <button className="flex items-center gap-3 mt-2 px-2 py-2 hover:bg-accent rounded-md w-full text-left">
                  <span className={cn("flex items-center", currentStatus.color)}>
                    {currentStatus.icon}
                  </span>
                  <span className="text-[13px] font-normal ">{currentStatus.label}</span>
                  {isLoadingTransitions && workflowId && (
                    <span className="text-xs text-gray-400 ml-auto">Loading...</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-card border border-border text-foreground shadow-lg" align="start" side="left" sideOffset={8}>
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 border-b border-gray-200 mb-1">
                    <Input
                      placeholder="Change status..."
                      value={statusSearch}
                      onChange={(e) => setStatusSearch(e.target.value)}
                      className="h-7 border-0 focus-visible:ring-0 p-0 text-xs bg-transparent text-foreground placeholder:text-muted-foreground"
                    />

                  </div>
                  {workflowId && (
                    <div className="px-2 py-1 mb-1 text-xs text-gray-500 flex items-center gap-1">
                      <Lock className="size-3" />
                      <span>Workflow enforced</span>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {filteredStatuses.map((status) => {
                      const isAllowed = 'isAllowed' in status ? status.isAllowed !== false : true;
                      const isCurrent = localStatus === status.value;

                      return (
                        <button
                          key={status.value}
                          onClick={() => handleStatusChange(status.value, isAllowed)}
                          disabled={!isAllowed && !isCurrent}
                          className={cn(
                            "flex items-center justify-between w-full px-2 py-1.5 rounded text-sm",
                            isAllowed || isCurrent
                              ? "hover:bg-accent cursor-pointer"
                              : "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {status.icon}
                            <span className="text-xs tracking-normal">{status.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCurrent && <Check className="size-4 text-muted-foreground" />}
                            {!isAllowed && !isCurrent && workflowId && (
                              <Lock className="size-3 text-muted-foreground/50" />
                            )}
                            <span className="text-xs text-muted-foreground/60">{status.key}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger asChild disabled={!canEdit}>
                <button className="flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md w-full text-left">
                  {currentPriority ? (
                    <>
                      <span className={cn("flex items-center", currentPriority.color)}>
                        {currentPriority.icon}
                      </span>
                      <span className="text-[13px] font-normal ">{currentPriority.label}</span>
                    </>
                  ) : (
                    <>
                      <Minus className="size-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Set priority</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-card border border-border text-foreground shadow-lg" align="start" side="left" sideOffset={8}>
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 mb-1">
                    <span className="text-xs text-gray-500">Set priority to...</span>
                  </div>
                  <div className="space-y-0.5">
                    {allPriorities.map((priority) => (
                      <button
                        key={priority.value || "none"}
                        onClick={() => handlePriorityChange(priority.value)}
                        className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-accent rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {priority.icon}
                          <span className="text-xs tracking-normal">{priority.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {localPriority === priority.value && <Check className="size-4 text-gray-600" />}
                          <span className="text-xs text-gray-400">{priority.key}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild disabled={!canEdit}>
                <button className="flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md w-full text-left">
                  {currentAssignee ? (
                    <>
                      <MemberAvatar
                        name={currentAssignee.name || ""}
                        imageUrl={currentAssignee.profileImageUrl}
                        className="size-5"
                      />
                      <span className="text-[13px] font-normal ">{currentAssignee.name}</span>
                    </>
                  ) : (
                    <>
                      <Users className="size-4 text-gray-400" />
                      <span className="text-[13px] font-normal text-gray-500">Assign to...</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-card border border-border text-foreground shadow-lg" align="start" side="left" sideOffset={8}>
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2  border-gray-200 mb-4">
                    <Input
                      placeholder="Assign to..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="h-7 border-0 focus-visible:ring-0 p-0 text-xs bg-transparent text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {/* No assignee option */}
                    <button
                      onClick={() => handleAssigneeChange("__none")}
                      className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-accent rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="size-5 text-gray-400" />
                        <span className="text-xs tracking-normal">No assignee</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!currentAssignee && <Check className="size-4 text-gray-600" />}
                        <span className="text-xs text-gray-400">0</span>
                      </div>
                    </button>

                    {/* Members list */}
                    {filteredMembers?.map((member: Member, index: number) => (
                      <button
                        key={member.$id}
                        onClick={() => handleAssigneeChange(member.$id)}
                        className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-accent rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <MemberAvatar
                            name={member.name || "Unknown"}
                            imageUrl={member.profileImageUrl}
                            className="size-5"
                          />
                          <span className="text-xs tracking-normal">{member.name || "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {currentAssignee?.$id === member.$id && <Check className="size-4 text-gray-600" />}
                          <span className="text-xs text-gray-400">{index + 1}</span>
                        </div>
                      </button>
                    ))}

                    {/* Team members section header */}
                    {members && members.documents && members.documents.length > 0 && (
                      <div className="px-2 py-1 text-xs text-gray-500 font-medium mt-2">
                        Team members
                      </div>
                    )}

                    {/* Invite option */}
                    <button className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-500">
                      <Send className="size-4" />
                      <span className="text-xs">Invite and assign...</span>
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>


            {/* Work Item Type */}
            <Popover open={typeOpen} onOpenChange={setTypeOpen}>
              <PopoverTrigger asChild disabled={!canEdit}>
                <button className="flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md w-full text-left">
                  <WorkItemIcon
                    type={currentType.key}
                    className="size-4"
                    project={projectData}
                  />
                  <span className="text-[13px] font-normal">{currentType.label}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-card border border-border text-foreground shadow-lg" align="start" side="left" sideOffset={8}>
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 border-b border-gray-200 mb-1">
                    <Input
                      placeholder="Change type..."
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      className="h-7 border-0 focus-visible:ring-0 p-0 text-xs bg-transparent text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <div className="space-y-0.5">
                    {filteredTypes.map((type) => (
                      <button
                        key={type.key}
                        onClick={() => handleTypeChange(type.key)}
                        className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-accent rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <WorkItemIcon
                            type={type.key}
                            className="size-4"
                            project={projectData}
                          />
                          <span className="text-xs tracking-normal">{type.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {localType === type.key && <Check className="size-4 text-gray-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        ) : ("")}

      </div>


      {/* Labels Section */}

      <>
        <div className=" px-2 mb-2 mt-2 border-t pt-4">
          <div onClick={() => setLabelOpen(!labelOpen)} className="flex gap-1 cursor-pointer items-center flex-row">

            {labelOpen ? (
              <ChevronDown className="size-3 text-gray-500" />
            ) : (
              <ChevronRight className="size-3 text-gray-500" />
            )}

            <span className="text-xs text-muted-foreground ">Labels</span>

          </div>

          {labelOpen ? (
            <>
              <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                <PopoverTrigger asChild disabled={!canEdit}>
                  {task.labels && task.labels.length > 0 ? (<button className="flex  gap-3 px-2 py-2 hover:bg-accent rounded-md w-full text-left">
                    <Plus className="size-4 text-gray-400" />

                  </button>) :
                    (
                      <button className="flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-md w-full text-left">
                        <Tag className="size-4 text-muted-foreground" />
                        <span className="text-[13px] font-normal text-muted-foreground">Add label</span>
                      </button>)
                  }

                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-card border border-border text-foreground shadow-lg" align="start" side="left" sideOffset={8}>
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 mb-1">
                      <Input
                        placeholder="Add labels..."
                        value={labelSearch}
                        onChange={(e) => setLabelSearch(e.target.value)}
                        className="h-7 border-0 focus-visible:ring-0 p-0 text-xs bg-transparent text-gray-900 placeholder:text-gray-400"
                      />
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">L</span>
                    </div>

                    {/* Suggestions */}
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 px-2">Suggestions</span>
                      <div className="space-y-0.5 mt-1">
                        {suggestedLabels
                          .filter((l) => !(task.labels || []).includes(l))
                          .map((label) => (
                            <button
                              key={label}
                              onClick={() => handleAddLabel(label)}
                              className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-accent rounded text-sm"
                            >
                              <span
                                className={cn(
                                  "size-3 rounded-full",
                                  labelColors[label] || "bg-gray-400"
                                )}
                              />
                              <span className="text-xs tracking-normal">{label}</span>
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* All Labels */}
                    <div>
                      <span className="text-xs text-gray-500 px-2">Labels</span>
                      <div className="space-y-0.5 mt-1">
                        {filteredLabels.map((label) => (
                          <button
                            key={label}
                            onClick={() => handleAddLabel(label)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-accent rounded text-sm"
                          >
                            <span
                              className={cn(
                                "size-3 rounded-full",
                                labelColors[label] || "bg-gray-400"
                              )}
                            />
                            <span className="text-xs tracking-normal">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 mt-1">
                  {task.labels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted border border-border text-muted-foreground"
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          labelColors[label] || "bg-gray-400"
                        )}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              )}

            </>

          ) : ("")}

        </div>
      </>



    </div>
  );
};
