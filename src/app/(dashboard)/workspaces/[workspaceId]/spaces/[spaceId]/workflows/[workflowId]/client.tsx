"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GitBranch,
  Trash2,
  Plus,
  GripVertical,
  PanelLeft,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Layers,
  X,
} from "lucide-react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Connection,
  Node,
  BackgroundVariant,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
// import { useGetTeams } from "@/features/teams/api/use-get-teams";
import { useGetWorkflow } from "@/features/workflows/api/use-get-workflow";
import { useDeleteWorkflow } from "@/features/workflows/api/use-delete-workflow";
import { useCreateWorkflowStatus } from "@/features/workflows/api/use-create-workflow-status";
import { useUpdateStatus } from "@/features/workflows/api/use-update-status";
import { useDeleteStatus } from "@/features/workflows/api/use-delete-status";
import { useCreateTransition } from "@/features/workflows/api/use-create-transition";
import { useUpdateTransition } from "@/features/workflows/api/use-update-transition";
import { useDeleteTransition } from "@/features/workflows/api/use-delete-transition";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useUpdateProject } from "@/features/projects/api/use-update-project";
import { useSyncFromProject } from "@/features/workflows/api/use-sync-from-project";
import { useSyncWithResolution } from "@/features/workflows/api/use-sync-with-resolution";
import { useGetMultipleProjectTeams } from "@/features/project-teams/api/use-get-multiple-project-teams";
import { useConfirm } from "@/hooks/use-confirm";
import { PageLoader } from "@/components/page-loader";
import { toast } from "sonner";

import {
  updateWorkflowStatusSchema,
  createWorkflowStatusSchema,
  updateWorkflowTransitionSchema,
} from "@/features/workflows/schemas";
import { z } from "zod";
import {
  WorkflowStatus,
  WorkflowTransition,
  StatusNodeData,
  convertStatusesToNodes,
  convertTransitionsToEdges,
  PopulatedWorkflow,
  StatusType,
  StatusNode as StatusNodeType,
  TransitionEdge as TransitionEdgeType,
} from "@/features/workflows/types";
import { 
  StatusSuggestion, 
  TransitionSuggestion,
  WorkflowSuggestion
} from "@/features/workflows/types/ai-context";
import { StatusNode } from "@/features/workflows/components/status-node";
import { TransitionEdge } from "@/features/workflows/components/transition-edge";
import { StatusEditDialog } from "@/features/workflows/components/status-edit-dialog";
import { TransitionEditDialog } from "@/features/workflows/components/transition-edit-dialog";
import { WorkflowSimpleView } from "@/features/workflows/components/workflow-simple-view";
import { WorkflowAIChat } from "@/features/workflows/components/workflow-ai-chat";
import { ConnectProjectDialog } from "@/features/workflows/components/connect-project-dialog";
import { ResolutionStrategy } from "@/features/workflows/components/workflow-conflict-dialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  statusNode: StatusNode,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: Record<string, any> = {
  transitionEdge: TransitionEdge,
};

// Inner component that uses ReactFlow hooks
const WorkflowEditor = () => {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.workflowId as string;
  const spaceId = params.spaceId as string;
  const workspaceId = useWorkspaceId();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const { data: workflow, isLoading: workflowLoading, refetch: refetchWorkflow } = useGetWorkflow({ workflowId });
  const { data: projectsData } = useGetProjects({ workspaceId });

  // Track dismissed warnings
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  // Auto-sync on page open - refetch workflow data once on mount
  const hasSyncedOnMount = useRef(false);
  const hasAutoSyncedProjects = useRef(false);
  useEffect(() => {
    if (!hasSyncedOnMount.current && workflowId) {
      hasSyncedOnMount.current = true;
      // Refetch workflow data to ensure we have the latest
      refetchWorkflow();
    }
  }, [workflowId, refetchWorkflow]);
  const { mutate: deleteWorkflow, isPending: isDeleting } = useDeleteWorkflow();
  const { mutateAsync: createStatus } = useCreateWorkflowStatus();
  const { mutateAsync: updateStatus } = useUpdateStatus();
  const { mutateAsync: deleteStatusMutation } = useDeleteStatus();
  const { mutateAsync: createTransition } = useCreateTransition();
  const { mutateAsync: updateTransition } = useUpdateTransition();
  const { mutateAsync: deleteTransitionMutation } = useDeleteTransition();
  const { mutate: updateProject, isPending: isUpdatingProject } = useUpdateProject();
  const { mutate: syncFromProject, isPending: isSyncing } = useSyncFromProject();
  const { mutate: syncWithResolution } = useSyncWithResolution();

  // Get projects for this space
  const projects = useMemo(() => {
    if (!projectsData?.documents) return [];
    // Filter to only show projects in this space
    return projectsData.documents.filter(p => p.spaceId === spaceId);
  }, [projectsData, spaceId]);

  // Get projects connected to this workflow (for team lookups)
  const connectedProjects = useMemo(() =>
    projects.filter(p => p.workflowId === workflowId),
    [projects, workflowId]
  );

  // Auto-sync connected projects on page open to clean up orphaned statuses
  useEffect(() => {
    if (!hasAutoSyncedProjects.current && connectedProjects.length > 0 && !workflowLoading) {
      hasAutoSyncedProjects.current = true;
      // Sync the first connected project to clean up orphaned workflow statuses
      const projectToSync = connectedProjects[0];
      if (projectToSync) {
        syncFromProject({ param: { workflowId, projectId: projectToSync.$id } });
      }
    }
  }, [connectedProjects, workflowLoading, workflowId, syncFromProject]);

  // Fetch teams from ALL connected projects (for transition access control)
  const connectedProjectIds = useMemo(() => 
    connectedProjects.map(p => p.$id),
    [connectedProjects]
  );

  // Fetch teams from each connected project in parallel using useQueries
  const projectTeamsQueries = useGetMultipleProjectTeams({ projectIds: connectedProjectIds });

  // Aggregate teams from all projects with project context labels
  const teamsForDialog = useMemo(() => {
    const allTeams: Array<{ $id: string; name: string; projectId: string; projectName: string }> = [];
    
    connectedProjects.forEach((project, index) => {
      const teamsData = projectTeamsQueries[index]?.data;
      if (teamsData?.documents) {
        teamsData.documents.forEach(team => {
          allTeams.push({
            $id: team.$id,
            name: connectedProjects.length > 1 
              ? `${team.name} (${project.name})` 
              : team.name,
            projectId: project.$id,
            projectName: project.name,
          });
        });
      }
    });
    
    return allTeams;
  }, [connectedProjects, projectTeamsQueries]);

  // Check if any teams are still loading
  const isLoadingTeams = projectTeamsQueries.some(query => query.isLoading);

  // Available projects to connect (those without this workflow or different workflow)
  const availableProjects = useMemo(() =>
    projects.filter(p => p.workflowId !== workflowId),
    [projects, workflowId]
  );

  // ============ EDGE CASE: Detect orphaned statuses ============
  // Orphaned statuses have no incoming or outgoing transitions (unreachable)
  const orphanedStatuses = useMemo(() => {
    if (!workflow?.statuses || !workflow?.transitions) return [];

    const transitions = workflow.transitions ?? [];
    return workflow.statuses.filter(status => {
      // Initial statuses are entry points, so they can have no incoming transitions
      if (status.isInitial) return false;

      const hasIncoming = transitions.some(t => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some(t => t.fromStatusId === status.$id);

      // A status is orphaned if it has neither incoming nor outgoing transitions
      return !hasIncoming && !hasOutgoing;
    });
  }, [workflow?.statuses, workflow?.transitions]);

  // Detect unreachable statuses (have outgoing but no incoming transitions and not initial)
  const unreachableStatuses = useMemo(() => {
    if (!workflow?.statuses || !workflow?.transitions) return [];

    const transitions = workflow.transitions ?? [];
    return workflow.statuses.filter(status => {
      if (status.isInitial) return false;

      const hasIncoming = transitions.some(t => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some(t => t.fromStatusId === status.$id);

      // Unreachable = has outgoing but no way to get there
      return !hasIncoming && hasOutgoing;
    });
  }, [workflow?.statuses, workflow?.transitions]);

  // Detect dead-end statuses (have incoming but no outgoing and not final)
  const deadEndStatuses = useMemo(() => {
    if (!workflow?.statuses || !workflow?.transitions) return [];

    const transitions = workflow.transitions ?? [];
    return workflow.statuses.filter(status => {
      if (status.isFinal) return false;

      const hasIncoming = transitions.some(t => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some(t => t.fromStatusId === status.$id);

      // Dead-end = can get there but can't leave (and not marked as final)
      return hasIncoming && !hasOutgoing;
    });
  }, [workflow?.statuses, workflow?.transitions]);

  // Combine all workflow warnings
  const workflowWarnings = useMemo(() => {
    const warnings: Array<{ type: string; message: string; statuses: string[] }> = [];

    if (orphanedStatuses.length > 0) {
      warnings.push({
        type: "orphaned",
        message: "Orphaned statuses (no connections)",
        statuses: orphanedStatuses.map(s => s.name),
      });
    }

    if (unreachableStatuses.length > 0) {
      warnings.push({
        type: "unreachable",
        message: "Unreachable statuses (no incoming transitions)",
        statuses: unreachableStatuses.map(s => s.name),
      });
    }

    if (deadEndStatuses.length > 0) {
      warnings.push({
        type: "deadend",
        message: "Dead-end statuses (no outgoing transitions, not final)",
        statuses: deadEndStatuses.map(s => s.name),
      });
    }

    return warnings;
  }, [orphanedStatuses, unreachableStatuses, deadEndStatuses]);

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Workflow",
    "Are you sure you want to delete this workflow? This action cannot be undone.",
    "destructive"
  );

  const [DeleteStatusDialog, confirmDeleteStatus] = useConfirm(
    "Delete Status",
    "Are you sure? Deleting this status will also delete all transitions to/from it.",
    "destructive"
  );

  const [DeleteTransitionDialog, confirmDeleteTransition] = useConfirm(
    "Delete Transition",
    "Are you sure you want to delete this transition?",
    "destructive"
  );

  const [DisconnectDialog, confirmDisconnect] = useConfirm(
    "Disconnect Project",
    "Are you sure you want to disconnect this project from the workflow?",
    "destructive"
  );

  // Dialog states
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [connectProjectOpen, setConnectProjectOpen] = useState(false);
  const [infoPanelWidth, setInfoPanelWidth] = useState(380);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [showCanvasTip, setShowCanvasTip] = useState(true);
  const [editingStatus, setEditingStatus] = useState<WorkflowStatus | null>(null);
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState<WorkflowSuggestion | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  const [nodes, setNodes, onNodesChange] = useNodesState<StatusNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<TransitionEdgeType>([]);

  // React Flow instance for coordinate conversion
  const reactFlowInstance = useReactFlow();

  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = infoPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const rawWidth = startWidthRef.current + delta;
      // Snap closed if dragged below 80px, otherwise clamp 200-700
      if (rawWidth < 80) {
        setInfoPanelWidth(0);
      } else {
        setInfoPanelWidth(Math.min(Math.max(rawWidth, 200), 700));
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [infoPanelWidth]);

  // Use refs to avoid dependency issues in callbacks
  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;

  // ============ DEBOUNCED POSITION UPDATES ============
  // Batch position updates to prevent API spam when dragging nodes
  const pendingPositionUpdates = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const isSavingPositions = useRef(false);

  // Debounced save function - batches all pending position updates
  const savePositions = useCallback(async () => {
    if (isSavingPositions.current) return;

    const updates = pendingPositionUpdates.current;
    if (updates.size === 0) return;

    // Copy and clear pending updates
    const toSave = new Map(updates);
    pendingPositionUpdates.current.clear();
    isSavingPositions.current = true;

    try {
      // Batch save all positions in parallel
      await Promise.all(
        Array.from(toSave.entries()).map(([statusId, position]) =>
          updateStatus({
            param: { workflowId, statusId },
            json: {
              positionX: Math.round(position.x),
              positionY: Math.round(position.y),
            },
          }).catch(() => {
            // Failed to save position
          })
        )
      );
    } finally {
      isSavingPositions.current = false;
    }
  }, [workflowId, updateStatus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
        // Save any pending updates before unmount
        savePositions();
      }
    };
  }, [savePositions]);

  const confirmDeleteStatusRef = useRef(confirmDeleteStatus);
  confirmDeleteStatusRef.current = confirmDeleteStatus;

  const confirmDeleteTransitionRef = useRef(confirmDeleteTransition);
  confirmDeleteTransitionRef.current = confirmDeleteTransition;

  // Handle drag over for the canvas drop zone
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop on canvas - place status from sidebar onto canvas
  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData("application/reactflow");
      if (!data) return;

      try {
        const { type, status } = JSON.parse(data);
        if (type !== "statusNode" || !status) return;

        // Get the position where the node was dropped
        const reactFlowBounds = event.currentTarget.getBoundingClientRect();
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });

        // Update the status position in the database
        await updateStatus({
          param: { workflowId, statusId: status.$id },
          json: {
            positionX: Math.round(position.x),
            positionY: Math.round(position.y),
          },
        });
      } catch {
        // Failed to place status on canvas
      }
    },
    [workflowId, updateStatus, reactFlowInstance]
  );

  // Status edit/delete handlers for nodes - use refs to avoid infinite loops
  const handleNodeEdit = useCallback((statusId: string) => {
    const status = workflowRef.current?.statuses?.find(s => s.$id === statusId);
    if (status) {
      setEditingStatus(status);
      setStatusDialogOpen(true);
    }
  }, []);

  const handleNodeDelete = useCallback(async (statusId: string) => {
    const ok = await confirmDeleteStatusRef.current();
    if (!ok) return;
    await deleteStatusMutation({
      param: { workflowId, statusId },
    });
  }, [workflowId, deleteStatusMutation]);

  // Transition edit/delete handlers for edges - use refs to avoid infinite loops
  const handleEdgeEdit = useCallback((transitionId: string) => {
    const transition = workflowRef.current?.transitions?.find(t => t.$id === transitionId);
    if (transition) {
      setEditingTransition(transition);
      setTransitionDialogOpen(true);
    }
  }, []);

  const handleEdgeDelete = useCallback(async (transitionId: string) => {
    const ok = await confirmDeleteTransitionRef.current();
    if (!ok) return;
    await deleteTransitionMutation({
      param: { workflowId, transitionId },
    });
  }, [workflowId, deleteTransitionMutation]);

  // Handle removing status from canvas (reset position to 0)
  const handleRemoveStatus = useCallback(
    async (statusId: string) => {
      try {
        await updateStatus({
          param: { workflowId, statusId },
          json: {
            positionX: 0,
            positionY: 0,
          },
        });
      } catch {
        // Failed to remove status
      }
    },
    [workflowId, updateStatus]
  );

  // Convert workflow data to React Flow nodes and edges
  useEffect(() => {
    let currentNodes = workflow?.statuses 
      ? convertStatusesToNodes(workflow.statuses, handleNodeEdit, handleNodeDelete, handleRemoveStatus) 
      : [];
    let currentEdges = workflow?.transitions 
      ? convertTransitionsToEdges(workflow.transitions, handleEdgeEdit, handleEdgeDelete)
      : [];

    if (previewSuggestion) {
      // Offset preview nodes slightly to avoid complete overlap if they match existing names
      const previewNodes = convertStatusesToNodes(
        previewSuggestion.statuses || [],
        () => {}, 
        () => {}, 
        () => {},
        true
      );
      
      const previewEdges = convertTransitionsToEdges(
        previewSuggestion.transitions || [],
        () => {}, 
        () => {},
        true
      );

      // Merge preview nodes and edges
      currentNodes = [...currentNodes, ...previewNodes];
      currentEdges = [...currentEdges, ...previewEdges];
    }

    setNodes(currentNodes);
    setEdges(currentEdges);
  }, [workflow?.statuses, workflow?.transitions, previewSuggestion, setNodes, setEdges, handleNodeEdit, handleNodeDelete, handleRemoveStatus, handleEdgeEdit, handleEdgeDelete]);

  const handleDelete = async () => {
    const ok = await confirmDelete();
    if (!ok) return;

    deleteWorkflow(
      { param: { workflowId } },
      {
        onSuccess: () => {
          router.push(`/workspaces/${workspaceId}/spaces/${spaceId}`);
        },
      }
    );
  };

  // Connect project to workflow with optional resolution strategy
  const handleConnectProject = useCallback((projectId: string, resolution?: ResolutionStrategy) => {
    // If a resolution strategy is provided, use the sync-with-resolution endpoint
    if (resolution) {
      syncWithResolution({
        param: { workflowId, projectId },
        json: { resolution },
      });
      setConnectProjectOpen(false);
      return;
    }

    // No conflict, just connect and sync
    updateProject(
      { param: { projectId }, form: { workflowId } },
      {
        onSuccess: () => {
          setConnectProjectOpen(false);
          syncFromProject({ param: { workflowId, projectId } });
        }
      }
    );
  }, [workflowId, updateProject, syncFromProject, syncWithResolution]);

  // Disconnect project from workflow
  const handleDisconnectProject = useCallback(async (projectId: string) => {
    const ok = await confirmDisconnect();
    if (!ok) return;
    updateProject({ param: { projectId }, form: { workflowId: "" } });
  }, [confirmDisconnect, updateProject]);

  // Sync workflow statuses from project's columns
  const handleSyncFromProject = useCallback((projectId: string) => {
    syncFromProject({ param: { workflowId, projectId } });
  }, [workflowId, syncFromProject]);

  // Handle new connection (transition) creation
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      try {
        await createTransition({
          param: { workflowId },
          json: {
            fromStatusId: connection.source,
            toStatusId: connection.target,
          },
        });
      } catch {
        // Failed to create transition
      }
    },
    [workflowId, createTransition]
  );

  // Handle node position change (drag) - DEBOUNCED to prevent API spam
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node<StatusNodeData>) => {
      // Add to pending updates (will batch multiple drags)
      pendingPositionUpdates.current.set(node.id, {
        x: node.position.x,
        y: node.position.y,
      });

      // Clear existing timeout
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }

      // Set new timeout to batch save (500ms debounce)
      // This waits until user stops dragging for 500ms before saving
      positionUpdateTimeout.current = setTimeout(() => {
        savePositions();
      }, 500);
    },
    [savePositions]
  );

  // Status handlers
  const handleAddStatus = () => {
    setEditingStatus(null);
    setStatusDialogOpen(true);
  };

  const handleSaveStatus = async (data: Partial<WorkflowStatus>) => {
    if (editingStatus) {
      await updateStatus({
        param: { workflowId, statusId: editingStatus.$id },
        json: {
          ...data,
          description: data.description ?? undefined,
        } as z.infer<typeof updateWorkflowStatusSchema>,
      });
    } else {
      // Calculate position for new status
      const lastNode = nodes[nodes.length - 1];
      const positionX = lastNode ? lastNode.position.x + 250 : 100;
      const positionY = lastNode ? lastNode.position.y : 100;

      await createStatus({
        param: { workflowId },
        json: {
          ...data,
          positionX,
          positionY,
          description: data.description ?? undefined,
        } as z.infer<typeof createWorkflowStatusSchema>,
      });
    }
    setStatusDialogOpen(false);
    setEditingStatus(null);
  };

  // Transition handlers
  const handleSaveTransition = async (data: Partial<WorkflowTransition>) => {
    if (editingTransition) {
      await updateTransition({
        param: { workflowId, transitionId: editingTransition.$id },
        json: {
          ...data,
          description: data.description ?? undefined,
        } as z.infer<typeof updateWorkflowTransitionSchema>,
      });
    }
    setTransitionDialogOpen(false);
    setEditingTransition(null);
  };

  // AI handlers - create status from AI suggestion
  const handleAICreateStatus = useCallback(
    async (suggestion: StatusSuggestion) => {
      // Calculate position for new status
      const lastNode = nodes[nodes.length - 1];
      const positionX = lastNode ? lastNode.position.x + 250 : 100;
      const positionY = lastNode ? lastNode.position.y : 100;

      // Sanitize key for consistency
      const sanitizedKey = suggestion.key.trim().toUpperCase().replace(/[\s-]+/g, "_");

      // Check if status already exists by key
      const existingStatus = workflow?.statuses?.find(s => s.key === sanitizedKey);
      if (existingStatus) {
        console.log(`Status with key ${sanitizedKey} already exists, skipping creation.`);
        return;
      }

      await createStatus({
        param: { workflowId },
        json: {
          name: suggestion.name,
          key: sanitizedKey,
          statusType: suggestion.statusType as StatusType,
          color: suggestion.color,
          isInitial: suggestion.isInitial || false,
          isFinal: suggestion.isFinal || false,
          description: suggestion.description || "",
          positionX,
          positionY,
        },
      });
    },
    [workflowId, createStatus, nodes, workflow?.statuses]
  );

  // AI handlers - create transition from AI suggestion
  const handleAICreateTransition = useCallback(
    async (suggestion: TransitionSuggestion) => {
      // Sanitize keys for consistency
      const fromStatusKey = suggestion.fromStatusKey.trim().toUpperCase().replace(/[\s-]+/g, "_");
      const toStatusKey = suggestion.toStatusKey.trim().toUpperCase().replace(/[\s-]+/g, "_");

      // Find status IDs from keys
      const fromStatus = workflow?.statuses?.find(s => s.key === fromStatusKey);
      const toStatus = workflow?.statuses?.find(s => s.key === toStatusKey);

      if (!fromStatus || !toStatus) {
        return;
      }

      // Check if transition already exists
      const existingTransition = workflow?.transitions?.find(
        t => t.fromStatusId === fromStatus.$id && t.toStatusId === toStatus.$id
      );
      if (existingTransition) {
        console.log(`Transition already exists, skipping creation.`);
        return;
      }

      await createTransition({
        param: { workflowId },
        json: {
          fromStatusId: fromStatus.$id,
          toStatusId: toStatus.$id,
          name: suggestion.name || "",
          requiresApproval: suggestion.requiresApproval || false,
        },
      });
    },
    [workflowId, createTransition, workflow?.statuses, workflow?.transitions]
  );

  const handleApplyFullWorkflow = useCallback(
    async (suggestion: WorkflowSuggestion) => {
      if (suggestion.statuses) {
        for (const s of suggestion.statuses) {
          await handleAICreateStatus(s);
        }
      }
      if (suggestion.transitions) {
        // Delay transitions slightly to ensure statuses are created
        setTimeout(async () => {
          for (const t of suggestion.transitions) {
            await handleAICreateTransition(t);
          }
        }, 500);
      }
      toast.success(`Applied workflow update: ${suggestion.name || "Custom"}`);
    },
    [handleAICreateStatus, handleAICreateTransition]
  );

  // Redirect if workflow not found
  useEffect(() => {
    if (!workflowLoading && !workflow) {
      router.push(`/workspaces/${workspaceId}/spaces/${spaceId}`);
    }
  }, [workflowLoading, workflow, router, workspaceId, spaceId]);

  if (workflowLoading) {
    return <PageLoader />;
  }

  if (!workflow) {
    return <PageLoader />;
  }

  const statuses = workflow.statuses || [];
  const transitions = workflow.transitions || [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <DeleteDialog />
      <DeleteStatusDialog />
      <DeleteTransitionDialog />
      <DisconnectDialog />

      {/* Connect Project Dialog */}
      <ConnectProjectDialog
        open={connectProjectOpen}
        onOpenChange={setConnectProjectOpen}
        workflow={workflow}
        availableProjects={availableProjects}
        isLoading={isUpdatingProject}
        onConnect={handleConnectProject}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 p-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/workspaces/${workspaceId}/spaces/${spaceId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GitBranch className="size-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{workflow.name}</h1>
                {workflow.isDefault && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
                {workflow.isSystem && (
                  <Badge variant="outline" className="text-xs">System</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {workflow.description && (
                  <span>{workflow.description}</span>
                )}
                {connectedProjects.length > 0 && (
                  <>
                    {workflow.description && <span>•</span>}
                    <span>Used by: {connectedProjects.slice(0, 3).map(p => p.name).join(", ")}
                      {connectedProjects.length > 3 && ` +${connectedProjects.length - 3} more`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {transitions.length} transitions
            </Badge>
            <Badge variant="outline" className="text-xs">
              {projects.filter(p => p.workflowId === workflowId).length} projects
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={`/workspaces/${workspaceId}/workflow-guide`}>
              <BookOpen className="size-4 mr-2" />
              Workflow Guide
            </Link>
          </Button>
          {isAdmin && !workflow.isSystem && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddStatus}
              >
                <Plus className="size-4 mr-2" />
                Add Status
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content with Info Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Info Panel with Tabs */}
        <div
          className="border-r bg-background shrink-0 overflow-hidden flex flex-col"
          style={{ width: `${infoPanelWidth}px` }}
        >
            <Tabs defaultValue="builder" className="flex flex-col h-full">
              {/* Tab Headers */}
              <div className="border-b px-3 pt-3 pb-0 shrink-0">
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="builder" className="text-xs gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Builder
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Assistant
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Builder Tab Content */}
              <TabsContent value="builder" className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden">
                <div className="p-4">
                  {/* Workflow Warnings */}
                  {workflowWarnings.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {workflowWarnings.filter(w => !dismissedWarnings.has(w.type)).map((warning, index) => (
                        <div
                          key={index}
                          className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                {warning.message}
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300/80 mt-1">
                                {warning.statuses.join(", ")}
                              </p>
                            </div>
                            <button
                              onClick={() => setDismissedWarnings(prev => new Set([...prev, warning.type]))}
                              className="p-1 rounded-md hover:bg-yellow-200/50 dark:hover:bg-yellow-800/30 transition-colors"
                              aria-label="Dismiss warning"
                            >
                              <X className="size-4 text-yellow-600 dark:text-yellow-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <WorkflowSimpleView
                    workflow={workflow as PopulatedWorkflow}
                    projects={projects}
                    workspaceId={workspaceId}
                    spaceId={spaceId}
                    isAdmin={isAdmin}
                    onConnectProject={() => setConnectProjectOpen(true)}
                    onDisconnectProject={handleDisconnectProject}
                    onSyncFromProject={handleSyncFromProject}
                    isSyncing={isSyncing}
                    onRemoveStatus={handleRemoveStatus}
                  />
                </div>
              </TabsContent>

              {/* AI Assistant Tab Content */}
              <TabsContent value="ai" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                <WorkflowAIChat
                  workflowId={workflowId}
                  workspaceId={workspaceId}
                  onCreateStatus={handleAICreateStatus}
                  onCreateTransition={handleAICreateTransition}
                  onPreview={(suggestion) => {
                    if ("statuses" in suggestion || "transitions" in suggestion) {
                      setPreviewSuggestion(suggestion as WorkflowSuggestion);
                    } else if ("statusType" in suggestion) {
                      setPreviewSuggestion({ 
                        statuses: [suggestion as StatusSuggestion], 
                        transitions: [] 
                      });
                    } else {
                      setPreviewSuggestion({ 
                        statuses: [], 
                        transitions: [suggestion as TransitionSuggestion] 
                      });
                    }
                  }}
                  onApplyFullWorkflow={handleApplyFullWorkflow}
                />
              </TabsContent>
            </Tabs>
          </div>

        {/* Resize Handle */}
        {infoPanelWidth > 0 ? (
          <div
            onMouseDown={handlePanelResizeStart}
            className="w-1.5 bg-border hover:bg-primary/50 active:bg-primary/50 transition-colors cursor-col-resize flex items-center justify-center group shrink-0"
          >
            <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ) : (
          <div className="border-r bg-background flex flex-col items-center py-3 shrink-0">
            <button
              onMouseDown={handlePanelResizeStart}
              onClick={() => setInfoPanelWidth(380)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Show panel (or drag right)"
            >
              <PanelLeft className="size-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onMove={(_, viewport) => setZoomLevel(Math.round(viewport.zoom * 100))}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 0.8 }}
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{
              type: "transitionEdge",
              animated: true,
            }}
            connectionLineStyle={{
              stroke: "#3B82F6",
              strokeWidth: 2,
              strokeDasharray: "5,5",
            }}
            proOptions={{ hideAttribution: true }}
            className="bg-muted/30"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-background/80 !border-border !right-3 !bottom-3"
            />

            {/* Zoom Indicator - moved to top-left next to Controls */}
            <Panel position="top-left" className="!top-14 !left-3 !z-50 flex flex-col gap-2">
              <Badge variant="secondary" className="text-xs font-mono !bg-primary/7 !text-primary !border-primary/10">
                {zoomLevel}%
              </Badge>
              
              {previewSuggestion && (
                <Card className="p-3 shadow-xl border-purple-200 bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-purple-100">
                        <Sparkles className="size-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold">Preview Mode</h4>
                        <p className="text-[10px] text-muted-foreground">AI Suggestion</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          handleApplyFullWorkflow(previewSuggestion);
                          setPreviewSuggestion(null);
                        }}
                      >
                        Apply All
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 px-3 text-xs"
                        onClick={() => setPreviewSuggestion(null)}
                      >
                        Exit Preview
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </Panel>

            <Panel position="top-right" className="flex gap-2">
              <Card className="p-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                    <span>To Do</span>
                  </div>
                  <Separator orientation="vertical" className="h-3" />
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>In Progress</span>
                  </div>
                  <Separator orientation="vertical" className="h-3" />
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>Done</span>
                  </div>
                </div>
              </Card>
            </Panel>

            {/* Help Tip - moved and restyled */}
            {showCanvasTip && (
              <Panel position="top-right" className="!top-20 !right-2 !z-40">
                <Card className="relative p-2 max-w-[220px] !bg-primary/6 !border !border-primary/10 shadow-md">
                  <button
                    onClick={() => setShowCanvasTip(false)}
                    aria-label="Dismiss canvas tip"
                    className="absolute top-1 right-1 p-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    <X className="size-4 text-primary" />
                  </button>
                  <p className="text-[12px] text-primary leading-snug">
                    💡 <strong>Tip:</strong> Drag from one status to another to create transitions. Click the transition label then the Edit icon to set approval rules.
                  </p>
                </Card>
              </Panel>
            )}

            {statuses.length === 0 && (
              <Panel position="top-center" className="!top-1/2 !-translate-y-1/2">
                <Card className="p-6 text-center">
                  <GitBranch className="size-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-2">No Statuses Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add statuses to define workflow stages, then connect them with transitions.
                  </p>
                  {isAdmin && (
                    <Button onClick={handleAddStatus}>
                      <Plus className="size-4 mr-2" />
                      Add First Status
                    </Button>
                  )}
                </Card>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Dialogs */}
      <StatusEditDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        status={editingStatus}
        workflowId={workflowId}
        existingKeys={workflow?.statuses?.map((s: WorkflowStatus) => s.key) || []}
        onSave={handleSaveStatus}
      />

      <TransitionEditDialog
        open={transitionDialogOpen}
        onOpenChange={setTransitionDialogOpen}
        transition={editingTransition}
        statuses={statuses}
        teams={teamsForDialog}
        isLoadingTeams={isLoadingTeams}
        onSave={handleSaveTransition}
      />
    </div>
  );
};

// Wrap with ReactFlowProvider for useReactFlow hooks
export const WorkflowDetailClient = () => {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
};