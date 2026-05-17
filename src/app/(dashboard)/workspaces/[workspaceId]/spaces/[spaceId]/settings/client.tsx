"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {  Save, Eye, EyeOff, Workflow } from "lucide-react";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useGetSpace } from "@/features/spaces/api/use-get-space";
import { useUpdateSpace } from "@/features/spaces/api/use-update-space";
import { useDeleteSpace } from "@/features/spaces/api/use-delete-space";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useGetWorkflows } from "@/features/workflows/api/use-get-workflows";
import { SpaceVisibility, WorkflowInheritanceMode } from "@/features/spaces/types";
import { SpaceWorkflowsModal } from "@/features/workflows/components/space-workflows-modal";

const SPACE_COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Orange", value: "#f97316" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Slate", value: "#64748b" },
];

type Section = "general" | "appearance" | "access" | "workflows" | "danger";

const NAV_ITEMS: { id: Section; label: string; danger?: boolean }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "access", label: "Access & Visibility" },
  { id: "workflows", label: "Workflows" },
  { id: "danger", label: "Delete Space", danger: true },
];

export const SpaceSettingsClient = () => {
  const router = useRouter();
  const params = useParams();
  const spaceId = params.spaceId as string;
  const workspaceId = useWorkspaceId();

  const { data: space, isLoading: isLoadingSpace } = useGetSpace({ spaceId });
  const { data: workflowsData } = useGetWorkflows({ workspaceId, spaceId });
  const { mutate: updateSpace, isPending: isUpdating } = useUpdateSpace();
  const { mutate: deleteSpace, isPending: isDeleting } = useDeleteSpace();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>(SpaceVisibility.PUBLIC);
  const [defaultWorkflowId, setDefaultWorkflowId] = useState<string>("");
  const [workflowInheritance, setWorkflowInheritance] = useState<WorkflowInheritanceMode>(WorkflowInheritanceMode.SUGGEST);
  const [hasChanges, setHasChanges] = useState(false);
  const [isWorkflowsModalOpen, setIsWorkflowsModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("general");

  useState(() => {
    if (space) {
      setName(space.name || "");
      setKey(space.key || "");
      setDescription(space.description || "");
      setColor(space.color || "#6366f1");
      setVisibility(space.visibility || SpaceVisibility.PUBLIC);
      setDefaultWorkflowId(space.defaultWorkflowId || "");
      setWorkflowInheritance(space.workflowInheritance || WorkflowInheritanceMode.SUGGEST);
    }
  });

  if (isLoadingSpace) return <PageLoader />;
  if (!space) return <PageError message="Space not found." />;
  if (!isAdmin) return <PageError message="You don\'t have permission to access space settings." />;

  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case "name": setName(value); break;
      case "key": setKey(value.toUpperCase()); break;
      case "description": setDescription(value); break;
      case "color": setColor(value); break;
      case "visibility": setVisibility(value as SpaceVisibility); break;
      case "defaultWorkflowId": setDefaultWorkflowId(value === "NO_WORKFLOW_VALUE" ? "" : value); break;
      case "workflowInheritance": setWorkflowInheritance(value as WorkflowInheritanceMode); break;
    }
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSpace(
      {
        param: { spaceId },
        json: {
          name: name || space.name,
          key: key || space.key,
          description: description || space.description,
          color: color || space.color,
          visibility: visibility || space.visibility,
          defaultWorkflowId: defaultWorkflowId || undefined,
          workflowInheritance: workflowInheritance || WorkflowInheritanceMode.SUGGEST,
        },
      },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  const handleDelete = () => {
    deleteSpace(
      { param: { spaceId } },
      { onSuccess: () => router.push(`/workspaces/${workspaceId}/spaces`) }
    );
  };

  const workflows = workflowsData?.documents ?? [];
  const activeColor = color || space.color || "#6366f1";

  return (
    <div className="w-full h-[83vh] px-2">
      <SpaceWorkflowsModal
        isOpen={isWorkflowsModalOpen}
        onClose={() => setIsWorkflowsModalOpen(false)}
        spaceId={spaceId}
        spaceName={name || space.name}
        workspaceId={workspaceId}
      />


      {/* Settings Panel */}
      <div className="bg-card rounded-2xl border h-full border-border shadow-sm overflow-hidden">
        <div className="flex h-full">

          {/* Left Navigation */}
          <aside className="w-44 shrink-0 border-r border-border bg-muted/20 p-3 flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={[
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-100",
                  item.danger
                    ? activeSection === item.id
                      ? "bg-destructive/10 text-destructive font-medium"
                      : "text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                    : activeSection === item.id
                    ? "bg-blue-500/10 text-blue-700 font-medium"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </aside>

          {/* Content Area */}
          <main className="flex-1 p-7 min-w-0">

            {/* ── General ── */}
         {activeSection === "general" && (
  <section className="flex flex-col h-full justify-between">
    <div>
      <h2 className="text-[18px] font-semibold mb-2">General</h2>

      <div className="divide-y divide-border">
        {/* Space Name */}
        <div className="flex flex-col py-4 gap-4">
          <div className="shrink-0">
            <p className="text-sm font-regular">Space Name</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The display name for this space.
            </p>
          </div>

          <Input
            value={name || space.name}
            onChange={(e) => handleFieldChange("name", e.target.value)}
            className="w-6/12 h-8 text-sm rounded-md border border-border bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-primary"
            placeholder="Enter space name"
          />
        </div>

        {/* Space Key */}
        <div className="flex flex-col py-4 gap-4">
          <div className="shrink-0">
            <p className="text-sm font-regular">Space Key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prefix for work items, e.g. ENG-001.
            </p>
          </div>

          <Input
            value={key || space.key}
            onChange={(e) => handleFieldChange("key", e.target.value)}
            className="w-6/12 h-8 text-sm rounded-md border border-border bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-primary"
            placeholder="ENG"
            maxLength={10}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col py-4 gap-4">
          <div className="shrink-0">
            <p className="text-sm font-regular">Description</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A short description of this space.
            </p>
          </div>

          <Textarea
            value={description || space.description || ""}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            className="w-6/12 min-h-[80px] text-sm rounded-md border border-border bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-primary"
            rows={3}
            placeholder="Describe this space..."
          />
        </div>
      </div>
    </div>

    <div className="w-full flex justify-end">
      <Button
        onClick={handleSave}
        disabled={!hasChanges || isUpdating}
        size="xs"
      >
        <Save className="size-3" />
        {isUpdating ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  </section>
)}

            {/* ── Appearance ── */}
{activeSection === "appearance" && (
  <section className="flex flex-col h-full justify-between">
    <div>
      <h2 className="text-[18px] font-semibold mb-2">Appearance</h2>

      <div className="divide-y divide-border">
        {/* Theme Color */}
        <div className="flex flex-col py-4 gap-4">
          <div>
            <p className="text-sm font-regular">Theme Color</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a color that represents this space.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => handleFieldChange("color", c.value)}
                className={[
                  "size-7 rounded-full transition-all duration-150 hover:scale-110",
                  (color || space.color) === c.value
                    ? "ring-2 ring-offset-2 ring-foreground/30 scale-110"
                    : "",
                ].join(" ")}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col py-4 gap-4">
          <div>
            <p className="text-sm font-regular">Preview</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How your space icon will appear.
            </p>
          </div>

          <div
            className="size-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm transition-colors duration-200"
            style={{ backgroundColor: activeColor }}
          >
            {(name || space.name).charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </div>

    <div className="w-full flex justify-end">
      <Button
        onClick={handleSave}
        disabled={!hasChanges || isUpdating}
        size="xs"
      >
        <Save className="size-3" />
        {isUpdating ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  </section>
)}

           {/* ── Access & Visibility ── */}
{activeSection === "access" && (
  <section className="flex flex-col h-full justify-between">
    <div>
      <h2 className="text-[18px] font-semibold mb-2">
        Access & Visibility
      </h2>

      <div className="divide-y divide-border">
        <div className="flex flex-col py-4 gap-4">
          <div>
            <p className="text-sm font-regular">Visibility</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(visibility || space.visibility) === SpaceVisibility.PUBLIC
                ? "All workspace members can see this space."
                : "Only invited members can access this space."}
            </p>
          </div>

          <Select
            value={visibility || space.visibility}
            onValueChange={(v) => handleFieldChange("visibility", v)}
          >
            <SelectTrigger className="w-fit px-3 h-8 text-sm rounded-md border border-border bg-transparent shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={SpaceVisibility.PUBLIC}>
                <div className="flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  Public
                </div>
              </SelectItem>

              <SelectItem value={SpaceVisibility.PRIVATE}>
                <div className="flex items-center gap-1.5">
                  <EyeOff className="size-3.5" />
                  Private
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <div className="w-full flex justify-end">
      <Button
        onClick={handleSave}
        disabled={!hasChanges || isUpdating}
        size="xs"
      >
        <Save className="size-3" />
        {isUpdating ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  </section>
)}

          {/* ── Workflows ── */}
{activeSection === "workflows" && (
  <section className="flex flex-col h-full justify-between">
    <div>
      <h2 className="text-[18px] font-semibold mb-2">Workflows</h2>

      <div className="divide-y divide-border">
        {/* Default Workflow */}
        <div className="flex flex-col py-4 gap-4">
          <div>
            <p className="text-sm font-regular">Default Workflow</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              New projects will use this workflow by default.
            </p>
          </div>

          <Select
            value={defaultWorkflowId || space.defaultWorkflowId || "NO_WORKFLOW_VALUE"}
            onValueChange={(v) => handleFieldChange("defaultWorkflowId", v)}
          >
            <SelectTrigger className="w-fit px-3 h-8 text-sm rounded-md border border-border bg-transparent shadow-none focus:ring-0">
              <SelectValue placeholder="None" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="NO_WORKFLOW_VALUE">
                <span className="text-muted-foreground">No default</span>
              </SelectItem>

              {workflows.map((wf) => (
                <SelectItem key={wf.$id} value={wf.$id}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workflow Inheritance */}
        <div className="flex flex-col py-4 gap-4">
          <div>
            <p className="text-sm font-regular">Workflow Inheritance</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How projects inherit the default workflow.
            </p>
          </div>

          <Select
            value={
              workflowInheritance ||
              space.workflowInheritance ||
              WorkflowInheritanceMode.SUGGEST
            }
            onValueChange={(v) =>
              handleFieldChange("workflowInheritance", v)
            }
          >
            <SelectTrigger className="w-fit px-3 h-8 text-sm rounded-md border border-border bg-transparent shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={WorkflowInheritanceMode.REQUIRE}>
                Required
              </SelectItem>

              <SelectItem value={WorkflowInheritanceMode.SUGGEST}>
                Suggested
              </SelectItem>

              <SelectItem value={WorkflowInheritanceMode.NONE}>
                None
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Manage Workflows */}
        <div className="flex flex-col py-4 gap-4">
          <div>
            <p className="text-sm font-regular">Manage Workflows</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              View and edit all workflows in this space.
            </p>
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsWorkflowsModalOpen(true)}
            className="w-fit"
          >
            <Workflow className="size-3.5" />
            Manage
          </Button>
        </div>
      </div>
    </div>

    <div className="w-full flex justify-end">
      <Button
        onClick={handleSave}
        disabled={!hasChanges || isUpdating}
        size="xs"
      >
        <Save className="size-3" />
        {isUpdating ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  </section>
)}

            {/* ── Danger Zone ── */}
            {activeSection === "danger" && (
              <section>
                <h2 className="text-sm font-semibold mb-0.5 text-destructive">Delete Space</h2>
                <p className="text-xs text-muted-foreground mb-5">Irreversible actions for this space.</p>
                <div className="divide-y divide-border">

                  <div className="flex items-center justify-between py-4 gap-6">
                    <div className="shrink-0">
                      <p className="text-sm font-medium">Delete this space</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Permanently deletes the space. Projects will be unassigned, not deleted.
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          className="h-8 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the space
                            <strong> {space.name}</strong> and remove all projects from it.
                            The projects themselves will not be deleted, just unassigned.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeleting ? "Deleting..." : "Delete Space"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                </div>
              </section>
            )}

          </main>
        </div>
      </div>
    </div>
  );
};