"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GitBranch,
  Trash2,
  Plus,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ReactFlow,
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
  WorkflowSuggestion,
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
const nodeTypes: Record<string, any> = { statusNode: StatusNode };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: Record<string, any> = { transitionEdge: TransitionEdge };

// Inner component that uses ReactFlow hooks
const WorkflowEditor = () => {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.workflowId as string;
  const spaceId = params.spaceId as string;
  const workspaceId = useWorkspaceId();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const {
    data: workflow,
    isLoading: workflowLoading,
    refetch: refetchWorkflow,
  } = useGetWorkflow({ workflowId });
  const { data: projectsData } = useGetProjects({ workspaceId });

  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  // ── floating panel state ──────────────────────────────────────────────────
  // Panel is open by default; user can collapse it to a slim rail
  const [panelOpen, setPanelOpen] = useState(true);
  const PANEL_WIDTH = 360; // fixed width when open

  const [showCanvasTip, setShowCanvasTip] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  // ─────────────────────────────────────────────────────────────────────────

  const hasSyncedOnMount = useRef(false);
  const hasAutoSyncedProjects = useRef(false);
  useEffect(() => {
    if (!hasSyncedOnMount.current && workflowId) {
      hasSyncedOnMount.current = true;
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

  const projects = useMemo(() => {
    if (!projectsData?.documents) return [];
    return projectsData.documents.filter((p) => p.spaceId === spaceId);
  }, [projectsData, spaceId]);

  const connectedProjects = useMemo(
    () => projects.filter((p) => p.workflowId === workflowId),
    [projects, workflowId]
  );

  useEffect(() => {
    if (!hasAutoSyncedProjects.current && connectedProjects.length > 0 && !workflowLoading) {
      hasAutoSyncedProjects.current = true;
      const projectToSync = connectedProjects[0];
      if (projectToSync) {
        syncFromProject({ param: { workflowId, projectId: projectToSync.$id } });
      }
    }
  }, [connectedProjects, workflowLoading, workflowId, syncFromProject]);

  const connectedProjectIds = useMemo(
    () => connectedProjects.map((p) => p.$id),
    [connectedProjects]
  );
  const projectTeamsQueries = useGetMultipleProjectTeams({ projectIds: connectedProjectIds });

  const teamsForDialog = useMemo(() => {
    const allTeams: Array<{
      $id: string;
      name: string;
      projectId: string;
      projectName: string;
    }> = [];
    connectedProjects.forEach((project, index) => {
      const teamsData = projectTeamsQueries[index]?.data;
      if (teamsData?.documents) {
        teamsData.documents.forEach((team) => {
          allTeams.push({
            $id: team.$id,
            name:
              connectedProjects.length > 1 ? `${team.name} (${project.name})` : team.name,
            projectId: project.$id,
            projectName: project.name,
          });
        });
      }
    });
    return allTeams;
  }, [connectedProjects, projectTeamsQueries]);

  const isLoadingTeams = projectTeamsQueries.some((q) => q.isLoading);

  const availableProjects = useMemo(
    () => projects.filter((p) => p.workflowId !== workflowId),
    [projects, workflowId]
  );

  // ── warnings ──────────────────────────────────────────────────────────────
  const orphanedStatuses = useMemo(() => {
    if (!workflow?.statuses || !workflow?.transitions) return [];
    const transitions = workflow.transitions ?? [];
    return workflow.statuses.filter((status) => {
      if (status.isInitial) return false;
      const hasIncoming = transitions.some((t) => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some((t) => t.fromStatusId === status.$id);
      return !hasIncoming && !hasOutgoing;
    });
  }, [workflow?.statuses, workflow?.transitions]);

  const unreachableStatuses = useMemo(() => {
    if (!workflow?.statuses || !workflow?.transitions) return [];
    const transitions = workflow.transitions ?? [];
    return workflow.statuses.filter((status) => {
      if (status.isInitial) return false;
      const hasIncoming = transitions.some((t) => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some((t) => t.fromStatusId === status.$id);
      return !hasIncoming && hasOutgoing;
    });
  }, [workflow?.statuses, workflow?.transitions]);

  const deadEndStatuses = useMemo(() => {
    if (!workflow?.statuses || !workflow?.transitions) return [];
    const transitions = workflow.transitions ?? [];
    return workflow.statuses.filter((status) => {
      if (status.isFinal) return false;
      const hasIncoming = transitions.some((t) => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some((t) => t.fromStatusId === status.$id);
      return hasIncoming && !hasOutgoing;
    });
  }, [workflow?.statuses, workflow?.transitions]);

  const workflowWarnings = useMemo(() => {
    const warnings: Array<{ type: string; message: string; statuses: string[] }> = [];
    if (orphanedStatuses.length > 0)
      warnings.push({
        type: "orphaned",
        message: "Orphaned statuses (no connections)",
        statuses: orphanedStatuses.map((s) => s.name),
      });
    if (unreachableStatuses.length > 0)
      warnings.push({
        type: "unreachable",
        message: "Unreachable statuses (no incoming transitions)",
        statuses: unreachableStatuses.map((s) => s.name),
      });
    if (deadEndStatuses.length > 0)
      warnings.push({
        type: "deadend",
        message: "Dead-end statuses (no outgoing transitions, not final)",
        statuses: deadEndStatuses.map((s) => s.name),
      });
    return warnings;
  }, [orphanedStatuses, unreachableStatuses, deadEndStatuses]);
  // ─────────────────────────────────────────────────────────────────────────

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

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [connectProjectOpen, setConnectProjectOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<WorkflowStatus | null>(null);
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState<WorkflowSuggestion | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<StatusNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<TransitionEdgeType>([]);

  const reactFlowInstance = useReactFlow();

  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;

  // ── debounced position saves ──────────────────────────────────────────────
  const pendingPositionUpdates = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const isSavingPositions = useRef(false);

  const savePositions = useCallback(async () => {
    if (isSavingPositions.current) return;
    const updates = pendingPositionUpdates.current;
    if (updates.size === 0) return;
    const toSave = new Map(updates);
    pendingPositionUpdates.current.clear();
    isSavingPositions.current = true;
    try {
      await Promise.all(
        Array.from(toSave.entries()).map(([statusId, position]) =>
          updateStatus({
            param: { workflowId, statusId },
            json: { positionX: Math.round(position.x), positionY: Math.round(position.y) },
          }).catch(() => {})
        )
      );
    } finally {
      isSavingPositions.current = false;
    }
  }, [workflowId, updateStatus]);

  useEffect(() => {
    return () => {
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
        savePositions();
      }
    };
  }, [savePositions]);
  // ─────────────────────────────────────────────────────────────────────────

  const confirmDeleteStatusRef = useRef(confirmDeleteStatus);
  confirmDeleteStatusRef.current = confirmDeleteStatus;
  const confirmDeleteTransitionRef = useRef(confirmDeleteTransition);
  confirmDeleteTransitionRef.current = confirmDeleteTransition;

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      const data = event.dataTransfer.getData("application/reactflow");
      if (!data) return;
      try {
        const { type, status } = JSON.parse(data);
        if (type !== "statusNode" || !status) return;
        const reactFlowBounds = event.currentTarget.getBoundingClientRect();
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });
        await updateStatus({
          param: { workflowId, statusId: status.$id },
          json: { positionX: Math.round(position.x), positionY: Math.round(position.y) },
        });
      } catch {}
    },
    [workflowId, updateStatus, reactFlowInstance]
  );

  const handleNodeEdit = useCallback((statusId: string) => {
    const status = workflowRef.current?.statuses?.find((s) => s.$id === statusId);
    if (status) { setEditingStatus(status); setStatusDialogOpen(true); }
  }, []);

  const handleNodeDelete = useCallback(
    async (statusId: string) => {
      const ok = await confirmDeleteStatusRef.current();
      if (!ok) return;
      await deleteStatusMutation({ param: { workflowId, statusId } });
    },
    [workflowId, deleteStatusMutation]
  );

  const handleEdgeEdit = useCallback((transitionId: string) => {
    const transition = workflowRef.current?.transitions?.find((t) => t.$id === transitionId);
    if (transition) { setEditingTransition(transition); setTransitionDialogOpen(true); }
  }, []);

  const handleEdgeDelete = useCallback(
    async (transitionId: string) => {
      const ok = await confirmDeleteTransitionRef.current();
      if (!ok) return;
      await deleteTransitionMutation({ param: { workflowId, transitionId } });
    },
    [workflowId, deleteTransitionMutation]
  );

  const handleRemoveStatus = useCallback(
    async (statusId: string) => {
      try {
        await updateStatus({
          param: { workflowId, statusId },
          json: { positionX: 0, positionY: 0 },
        });
      } catch {}
    },
    [workflowId, updateStatus]
  );

  useEffect(() => {
    let currentNodes = workflow?.statuses
      ? convertStatusesToNodes(workflow.statuses, handleNodeEdit, handleNodeDelete, handleRemoveStatus)
      : [];
    let currentEdges = workflow?.transitions
      ? convertTransitionsToEdges(workflow.transitions, handleEdgeEdit, handleEdgeDelete)
      : [];

    if (previewSuggestion) {
      const previewNodes = convertStatusesToNodes(
        previewSuggestion.statuses || [], () => {}, () => {}, () => {}, true
      );
      const previewEdges = convertTransitionsToEdges(
        previewSuggestion.transitions || [], () => {}, () => {}, true
      );
      currentNodes = [...currentNodes, ...previewNodes];
      currentEdges = [...currentEdges, ...previewEdges];
    }

    setNodes(currentNodes);
    setEdges(currentEdges);
  }, [
    workflow?.statuses, workflow?.transitions, previewSuggestion,
    setNodes, setEdges, handleNodeEdit, handleNodeDelete, handleRemoveStatus,
    handleEdgeEdit, handleEdgeDelete,
  ]);

  const handleDelete = async () => {
    const ok = await confirmDelete();
    if (!ok) return;
    deleteWorkflow(
      { param: { workflowId } },
      { onSuccess: () => router.push(`/workspaces/${workspaceId}/spaces/${spaceId}`) }
    );
  };

  const handleConnectProject = useCallback(
    (projectId: string, resolution?: ResolutionStrategy) => {
      if (resolution) {
        syncWithResolution({ param: { workflowId, projectId }, json: { resolution } });
        setConnectProjectOpen(false);
        return;
      }
      updateProject(
        { param: { projectId }, form: { workflowId } },
        {
          onSuccess: () => {
            setConnectProjectOpen(false);
            syncFromProject({ param: { workflowId, projectId } });
          },
        }
      );
    },
    [workflowId, updateProject, syncFromProject, syncWithResolution]
  );

  const handleDisconnectProject = useCallback(
    async (projectId: string) => {
      const ok = await confirmDisconnect();
      if (!ok) return;
      updateProject({ param: { projectId }, form: { workflowId: "" } });
    },
    [confirmDisconnect, updateProject]
  );

  const handleSyncFromProject = useCallback(
    (projectId: string) => syncFromProject({ param: { workflowId, projectId } }),
    [workflowId, syncFromProject]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        await createTransition({
          param: { workflowId },
          json: { fromStatusId: connection.source, toStatusId: connection.target },
        });
      } catch {}
    },
    [workflowId, createTransition]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node<StatusNodeData>) => {
      pendingPositionUpdates.current.set(node.id, { x: node.position.x, y: node.position.y });
      if (positionUpdateTimeout.current) clearTimeout(positionUpdateTimeout.current);
      positionUpdateTimeout.current = setTimeout(() => savePositions(), 500);
    },
    [savePositions]
  );

  const handleAddStatus = () => { setEditingStatus(null); setStatusDialogOpen(true); };

  const handleSaveStatus = async (data: Partial<WorkflowStatus>) => {
    if (editingStatus) {
      await updateStatus({
        param: { workflowId, statusId: editingStatus.$id },
        json: { ...data, description: data.description ?? undefined } as z.infer<typeof updateWorkflowStatusSchema>,
      });
    } else {
      const lastNode = nodes[nodes.length - 1];
      const positionX = lastNode ? lastNode.position.x + 250 : 100;
      const positionY = lastNode ? lastNode.position.y : 100;
      await createStatus({
        param: { workflowId },
        json: { ...data, positionX, positionY, description: data.description ?? undefined } as z.infer<typeof createWorkflowStatusSchema>,
      });
    }
    setStatusDialogOpen(false);
    setEditingStatus(null);
  };

  const handleSaveTransition = async (data: Partial<WorkflowTransition>) => {
    if (editingTransition) {
      await updateTransition({
        param: { workflowId, transitionId: editingTransition.$id },
        json: { ...data, description: data.description ?? undefined } as z.infer<typeof updateWorkflowTransitionSchema>,
      });
    }
    setTransitionDialogOpen(false);
    setEditingTransition(null);
  };

  const handleAICreateStatus = useCallback(
    async (suggestion: StatusSuggestion) => {
      const lastNode = nodes[nodes.length - 1];
      const positionX = lastNode ? lastNode.position.x + 250 : 100;
      const positionY = lastNode ? lastNode.position.y : 100;
      const sanitizedKey = suggestion.key.trim().toUpperCase().replace(/[\s-]+/g, "_");
      const existingStatus = workflow?.statuses?.find((s) => s.key === sanitizedKey);
      if (existingStatus) return;
      await createStatus({
        param: { workflowId },
        json: {
          name: suggestion.name, key: sanitizedKey,
          statusType: suggestion.statusType as StatusType, color: suggestion.color,
          isInitial: suggestion.isInitial || false, isFinal: suggestion.isFinal || false,
          description: suggestion.description || "", positionX, positionY,
        },
      });
    },
    [workflowId, createStatus, nodes, workflow?.statuses]
  );

  const handleAICreateTransition = useCallback(
    async (suggestion: TransitionSuggestion) => {
      const fromStatusKey = suggestion.fromStatusKey.trim().toUpperCase().replace(/[\s-]+/g, "_");
      const toStatusKey = suggestion.toStatusKey.trim().toUpperCase().replace(/[\s-]+/g, "_");
      const fromStatus = workflow?.statuses?.find((s) => s.key === fromStatusKey);
      const toStatus = workflow?.statuses?.find((s) => s.key === toStatusKey);
      if (!fromStatus || !toStatus) return;
      const existingTransition = workflow?.transitions?.find(
        (t) => t.fromStatusId === fromStatus.$id && t.toStatusId === toStatus.$id
      );
      if (existingTransition) return;
      await createTransition({
        param: { workflowId },
        json: {
          fromStatusId: fromStatus.$id, toStatusId: toStatus.$id,
          name: suggestion.name || "", requiresApproval: suggestion.requiresApproval || false,
        },
      });
    },
    [workflowId, createTransition, workflow?.statuses, workflow?.transitions]
  );

  const handleApplyFullWorkflow = useCallback(
    async (suggestion: WorkflowSuggestion) => {
      if (suggestion.statuses) {
        for (const s of suggestion.statuses) await handleAICreateStatus(s);
      }
      if (suggestion.transitions) {
        setTimeout(async () => {
          for (const t of suggestion.transitions) await handleAICreateTransition(t);
        }, 500);
      }
      toast.success(`Applied workflow update: ${suggestion.name || "Custom"}`);
    },
    [handleAICreateStatus, handleAICreateTransition]
  );

  useEffect(() => {
    if (!workflowLoading && !workflow) {
      router.push(`/workspaces/${workspaceId}/spaces/${spaceId}`);
    }
  }, [workflowLoading, workflow, router, workspaceId, spaceId]);

  if (workflowLoading) return <PageLoader />;
  if (!workflow) return <PageLoader />;

  const statuses = workflow.statuses || [];
  const transitions = workflow.transitions || [];

  return (
    // ── Full-bleed container: fills the space left by app sidebar + topbar ──
    <div className="relative w-full p-0 h-[calc(100vh-4.5rem)] overflow-hidden">
      <DeleteDialog />
      <DeleteStatusDialog />
      <DeleteTransitionDialog />
      <DisconnectDialog />

      <ConnectProjectDialog
        open={connectProjectOpen}
        onOpenChange={setConnectProjectOpen}
        workflow={workflow}
        availableProjects={availableProjects}
        isLoading={isUpdatingProject}
        onConnect={handleConnectProject}
      />

      {/* ── Full-bleed ReactFlow canvas ─────────────────────────────────── */}
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
        defaultEdgeOptions={{ type: "transitionEdge", animated: true }}
        connectionLineStyle={{ stroke: "#3B82F6", strokeWidth: 2, strokeDasharray: "5,5" }}
        proOptions={{ hideAttribution: true }}
       className="w-full h-full bg-background"

      >
<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        {/* <Controls showInteractive={false} /> */}
<MiniMap
  nodeStrokeWidth={3}
  zoomable
  pannable
  className="!border-border !left-4 !right-auto !bottom-4"
  nodeStrokeColor="hsl(var(--border))"
/>

        <Panel position="bottom-center" className="!bottom-5">
<div className="flex items-center gap-1 rounded-lg border bg-background/90 backdrop-blur-xl shadow-xl p-1">    <Button
      variant="ghost"
      size="icon"
      className="rounded-xl size-9"
      onClick={() => reactFlowInstance.zoomIn()}
    >
      +
    </Button>

    <Separator orientation="vertical" className="h-6" />

    <Button
      variant="ghost"
      size="icon"
      className="rounded-xl size-9"
      onClick={() => reactFlowInstance.zoomOut()}
    >
      −
    </Button>

    <Separator orientation="vertical" className="h-6" />

    <div className="px-3 text-sm font-medium min-w-[60px] text-center">
      {zoomLevel}%
    </div>

    <Separator orientation="vertical" className="h-6" />

    <Button
      variant="ghost"
      size="icon"
      className="rounded-xl size-9"
      onClick={() => reactFlowInstance.fitView({ padding: 0.4 })}
    >
      ⌂
    </Button>
  </div>
</Panel>

     

        {/* Legend */}
<Panel position="top-left" className="!top-[5.5rem] !left-4">
            <Card className="px-3 py-2 shadow-md bg-background/90 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                <span>To Do</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>In Progress</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span>Done</span>
              </div>
            </div>
          </Card>
        </Panel>

        {/* Canvas tip */}
        {showCanvasTip && (
<Panel position="top-left" className="!top-[9.5rem] !left-4">
              <Card className="relative !p-3 max-w-[220px] !bg-primary/6 !border !border-primary/10 shadow-md bg-background/90 backdrop-blur-sm">
              <button
                onClick={() => setShowCanvasTip(false)}
                aria-label="Dismiss tip"
                className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-primary/10 transition-colors"
              >
                <X className="size-3.5 text-primary" />
              </button>
              <p className="text-[11px] text-primary leading-snug pr-4">
                💡 <strong>Tip:</strong> Drag from one status to another to create transitions. Click the transition label then the Edit icon to set approval rules.
              </p>
            </Card>
          </Panel>
        )}

        {/* AI preview card */}
        {previewSuggestion && (
          <Panel position="bottom-left" className="!bottom-12 !left-4">
            <Card className="p-3 shadow-xl border-purple-200 bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-purple-100">
                  <Sparkles className="size-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Preview Mode</h4>
                  <p className="text-[10px] text-muted-foreground">AI Suggestion</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700"
                    onClick={() => { handleApplyFullWorkflow(previewSuggestion); setPreviewSuggestion(null); }}
                  >
                    Apply All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={() => setPreviewSuggestion(null)}
                  >
                    Exit
                  </Button>
                </div>
              </div>
            </Card>
          </Panel>
        )}

        {/* Empty state */}
        {statuses.length === 0 && (
          <Panel position="top-center" className="!top-1/2 !-translate-y-1/2">
            <Card className="p-6 text-center shadow-lg bg-background/95 backdrop-blur-sm">
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

      {/* ── Floating workflow header bar ────────────────────────────────── */}
      {/*
          Positioned absolutely at the top, full width.
          Uses backdrop-blur so the canvas shows through.
      */}
      <div
       className="
  absolute top-5 left-0 right-0 z-30 flex items-center gap-3 px-4 py-2.5 mx-5 rounded-xl bg-background/95 backdrop-blur-xl shadow-sm border
"
      >
      

        {/* Workflow identity */}
        <div className="flex items-center gap-1 ">

            {/* Back */}
        <Link href={`/workspaces/${workspaceId}/spaces/${spaceId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>

           <h1 className="text-sm font-medium ">{workflow.name}</h1>


        </div>

        <div className="flex-1" />

        {/* Stats + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs font-medium rounded-md hidden sm:flex">
            {transitions.length} transitions
          </Badge>
          <Badge variant="outline" className="text-xs font-medium rounded-md hidden sm:flex">
            {projects.filter((p) => p.workflowId === workflowId).length} projects
          </Badge>

                    <Separator orientation="vertical" className="h-5 mx-1" />


          <Button variant="outline" size="xs" asChild>
            <Link href={`/workspaces/${workspaceId}/workflow-guide`}>
              <BookOpen className="size-2 !font-medium" />
              <span className="hidden md:inline !font-medium">Workflow Guide</span>
            </Link>
          </Button>
          {isAdmin && !workflow.isSystem && (
            <>
              <Button variant="outline" size="xs" className="!font-medium" onClick={handleAddStatus}>
                <Plus className="size-2 !font-medium" />
                Add Status
              </Button>

                        <Separator orientation="vertical" className="h-5 mx-1" />

              <Button
                variant="destructive"
                size="xs"
                className="size-8"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="size-2" />
              </Button>
            </>
          )}

          {/* Toggle side panel */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setPanelOpen((o) => !o)}
            title={panelOpen ? "Hide panel" : "Show panel"}
          >
            {panelOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>
      </div>

      {/* ── Floating side panel ─────────────────────────────────────────── */}
      {/*
          Positioned absolutely on the right, below the floating header.
          Slides in/out with a CSS transition.
          Does NOT affect canvas width — canvas always stays full-bleed.
      */}
     <div
className="
  absolute top-[88px] right-5 bottom-5 z-20
  flex flex-col
  rounded-xl
  border
  bg-background/80
  backdrop-blur-2xl
  shadow-[0_4px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.35)]
  transition-all duration-300 ease-in-out
  overflow-hidden
"
  style={{
  width: panelOpen ? `${PANEL_WIDTH}px` : "0px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.06)"
}}
>
        {/* Inner wrapper keeps content at full width so it doesn't squish during animation */}
        <div className="flex flex-col h-full" style={{ width: `${PANEL_WIDTH}px` }}>
          <Tabs defaultValue="builder" className="flex flex-col h-full">
            {/* Tab headers */}
<div className="px-4 pt-4 pb-2 shrink-0">
<TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-1">                <TabsTrigger value="builder" className="
  text-xs gap-1.5 rounded-lg py-1
  data-[state=active]:bg-blue-600/10
  data-[state=active]:text-blue-600
  data-[state=active]:shadow-sm
  data-[state=active]:border
  border-transparent 
  transition-all
">
                  <Layers className="h-3.5 w-3.5" />
                  Builder
                </TabsTrigger>
                <TabsTrigger value="ai" className="
  text-xs gap-1.5 rounded-lg py-1
 data-[state=active]:bg-blue-600/10
  data-[state=active]:text-blue-600
   data-[state=active]:shadow-sm
  data-[state=active]:border
  border-transparent
  transition-all
">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Assistant
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Builder tab */}
            <TabsContent
              value="builder"
              className="flex-1 overflow-y-auto m-0 mt-2 data-[state=inactive]:hidden"
            >
              <div className="px-4 pb-4 pt-2">
                {/* Warnings */}
                {workflowWarnings.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {workflowWarnings
                      .filter((w) => !dismissedWarnings.has(w.type))
                      .map((warning, index) => (
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
                              onClick={() =>
                                setDismissedWarnings((prev) => new Set([...prev, warning.type]))
                              }
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

            {/* AI tab */}
            <TabsContent
              value="ai"
              className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
            >
              <WorkflowAIChat
                workflowId={workflowId}
                workspaceId={workspaceId}
                onCreateStatus={handleAICreateStatus}
                onCreateTransition={handleAICreateTransition}
                onPreview={(suggestion) => {
                  if ("statuses" in suggestion || "transitions" in suggestion) {
                    setPreviewSuggestion(suggestion as WorkflowSuggestion);
                  } else if ("statusType" in suggestion) {
                    setPreviewSuggestion({ statuses: [suggestion as StatusSuggestion], transitions: [] });
                  } else {
                    setPreviewSuggestion({ statuses: [], transitions: [suggestion as TransitionSuggestion] });
                  }
                }}
                onApplyFullWorkflow={handleApplyFullWorkflow}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
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
export const WorkflowDetailClient = () => (
  <ReactFlowProvider>
    <WorkflowEditor />
  </ReactFlowProvider>
);