"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { CreateLinkForm } from "./create-link-form";
import { useCreateLinkModal } from "../hooks/use-create-link-modal";

interface CreateLinkModalProps {
  workspaceId: string;
}

export const CreateLinkModal = ({
  workspaceId,
}: CreateLinkModalProps) => {
  const { isOpen, sourceItemId, setIsOpen, close } = useCreateLinkModal();

  return (
    <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
      <CreateLinkForm
        workspaceId={workspaceId}
        sourceItemId={sourceItemId || undefined}
        onCancel={close}
        onSuccess={close}
      />
    </ResponsiveModal>
  );
};
