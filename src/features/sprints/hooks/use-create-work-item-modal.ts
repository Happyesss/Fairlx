import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";

export const useCreateWorkItemModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "create-work-item",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
  );

  const [projectId, setProjectId] = useQueryState(
    "work-item-project",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );
  
  const [sprintId, setSprintId] = useQueryState(
    "work-item-sprint",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );

  const [initialStatus, setInitialStatus] = useQueryState(
    "work-item-status",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );

  const open = (projectId?: string, sprintId?: string, status?: string) => {
    if (projectId) setProjectId(projectId);
    if (sprintId) setSprintId(sprintId);
    if (status) setInitialStatus(status);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setProjectId("");
    setSprintId("");
    setInitialStatus("");
  };

  return {
    isOpen,
    projectId,
    sprintId,
    initialStatus,
    open,
    close,
    setIsOpen,
  };
};
