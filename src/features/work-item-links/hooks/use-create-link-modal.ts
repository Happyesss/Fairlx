import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";

export const useCreateLinkModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "create-link",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
  );
  
  const [sourceItemId, setSourceItemId] = useQueryState(
    "link-source",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );

  const open = (workItemId?: string) => {
    if (workItemId) {
      setSourceItemId(workItemId);
    }
    setIsOpen(true);
  };
  
  const close = () => {
    setIsOpen(false);
    setSourceItemId("");
  };

  return {
    isOpen,
    sourceItemId,
    open,
    close,
    setIsOpen,
  };
};
