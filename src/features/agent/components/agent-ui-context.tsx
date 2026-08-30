"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { ManageMcpDialog } from "./manage-mcp-dialog";
import { ManageModelsDialog } from "./manage-models-dialog";

type AgentUiContextValue = {
  openMcp: () => void;
  openModels: () => void;
};

const AgentUiContext = createContext<AgentUiContextValue | null>(null);

export function AgentShell({ children }: { children: ReactNode }) {
  const [mcpOpen, setMcpOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);

  const value = useMemo<AgentUiContextValue>(
    () => ({
      openMcp: () => setMcpOpen(true),
      openModels: () => setModelsOpen(true),
    }),
    []
  );

  return (
    <AgentUiContext.Provider value={value}>
      {children}
      <ManageMcpDialog open={mcpOpen} onOpenChange={setMcpOpen} />
      <ManageModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} />
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
