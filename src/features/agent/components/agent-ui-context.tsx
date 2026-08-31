"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { InviteMembersDialog, NewWorkspaceDialog, SearchDialog } from "./agent-dialogs";
import { ManageMcpDialog } from "./manage-mcp-dialog";
import { ManageModelsDialog } from "./manage-models-dialog";
import { RecentWorkModal } from "./recent-work-modal";

type AgentUiContextValue = {
  openMcp: () => void;
  openModels: () => void;
  openRecentWork: () => void;
  openInvite: () => void;
  openSearch: () => void;
  openNewWorkspace: () => void;
};

const AgentUiContext = createContext<AgentUiContextValue | null>(null);

export function AgentShell({ children }: { children: ReactNode }) {
  const [mcpOpen, setMcpOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [recentWorkOpen, setRecentWorkOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);

  const value = useMemo<AgentUiContextValue>(
    () => ({
      openMcp: () => setMcpOpen(true),
      openModels: () => setModelsOpen(true),
      openRecentWork: () => setRecentWorkOpen(true),
      openInvite: () => setInviteOpen(true),
      openSearch: () => setSearchOpen(true),
      openNewWorkspace: () => setNewWorkspaceOpen(true),
    }),
    []
  );

  return (
    <AgentUiContext.Provider value={value}>
      {children}
      <ManageMcpDialog open={mcpOpen} onOpenChange={setMcpOpen} />
      <ManageModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} />
      <RecentWorkModal open={recentWorkOpen} onOpenChange={setRecentWorkOpen} />
      <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <NewWorkspaceDialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen} />
    </AgentUiContext.Provider>
  );
}

export function useAgentUi() {
  const context = useContext(AgentUiContext);
  if (!context) {
    throw new Error("useAgentUi must be used within AgentShell");
  }
  return context;
}
