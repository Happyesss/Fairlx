"use client";

import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";

/**
 * Hook for managing project selection modal state.
 * Uses URL query params for shared state across components.
 */
export const useProjectSelectionModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "project-selection",
    parseAsBoolean
      .withDefault(false)
      .withOptions({ clearOnDefault: true })
  );

  const [selectedProjectId, setSelectedProjectId] = useQueryState(
    "project-selection-id",
    parseAsString.withOptions({ clearOnDefault: true })
  );

  const open = (projectId?: string) => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setSelectedProjectId(null);
  };

  return {
    isOpen,
    open,
    close,
    setIsOpen,
    selectedProjectId,
    setSelectedProjectId,
  };
};
