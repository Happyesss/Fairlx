import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";

export const useCreateTaskModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "create-task",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
  );

  const [parentTaskId, setParentTaskId] = useQueryState(
    "parent-task-id",
    parseAsString.withOptions({ clearOnDefault: true })
  );

  const open = (parentId?: string) => {
    if (parentId) {
      setParentTaskId(parentId);
    }
    setIsOpen(true);
  };
  
  const close = () => {
    setIsOpen(false);
    setParentTaskId(null);
  };

  return {
    isOpen,
    open,
    close,
    setIsOpen,
    parentTaskId,
    setParentTaskId,
  };
};
