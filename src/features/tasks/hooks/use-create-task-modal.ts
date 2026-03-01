import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";

export const useCreateTaskModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "create-task",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
  );

  const [parentId, setParentId] = useQueryState(
    "parent-id",
    parseAsString.withOptions({ clearOnDefault: true })
  );

  const open = (taskParentId?: string) => {
    if (taskParentId) {
      setParentId(taskParentId);
    }
    setIsOpen(true);
  };
  
  const close = () => {
    setIsOpen(false);
    setParentId(null);
  };

  return {
    isOpen,
    open,
    close,
    setIsOpen,
    parentId,
    setParentId,
  };
};
