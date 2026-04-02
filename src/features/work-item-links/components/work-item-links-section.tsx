"use client";

import { useState } from "react";
import { Link2, Plus, ArrowRight, ArrowLeft, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetWorkItemLinks } from "../api/use-get-work-item-links";
import { useDeleteWorkItemLink } from "../api/use-delete-work-item-link";
import { useCreateLinkModal } from "../hooks/use-create-link-modal";
import { WorkItemLink, WorkItemLinkType, LINK_TYPE_METADATA } from "../types";

interface WorkItemLinksSectionProps {
  workItemId: string;
}

export const WorkItemLinksSection = ({ workItemId }: WorkItemLinksSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { open } = useCreateLinkModal();
  const { data, isLoading } = useGetWorkItemLinks({ workItemId });
  const { mutate: deleteLink } = useDeleteWorkItemLink();

  const outgoingLinks = data?.outgoing || [];
  const incomingLinks = data?.incoming || [];
  const totalLinks = outgoingLinks.length + incomingLinks.length;

  const handleDelete = (linkId: string) => {
    deleteLink({ param: { linkId }, query: { deleteInverse: "true" } });
  };

  const getLinkColor = (linkType: WorkItemLinkType): "default" | "destructive" | "outline" | "secondary" => {
    const metadata = LINK_TYPE_METADATA[linkType];
    switch (metadata?.category) {
      case "dependency":
        return "destructive";
      case "relationship":
        return "secondary";
      case "hierarchy":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 font-semibold text-sm hover:text-primary/80"
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <Link2 className="size-4 mr-1" />
          Connected work items
          {totalLinks > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">({totalLinks})</span>
          )}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => open(workItemId)}
        >
          <Plus className="size-3 mr-1" />
          Add
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : totalLinks === 0 ? (
            <p className="text-sm text-muted-foreground">No connected work items</p>
          ) : (
            <>
              {outgoingLinks.map((link: WorkItemLink) => (
                <div
                  key={link.$id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={getLinkColor(link.linkType)} className="text-xs">
                      {LINK_TYPE_METADATA[link.linkType]?.label || link.linkType}
                    </Badge>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-mono text-xs">{link.targetItemId.slice(0, 8)}...</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => handleDelete(link.$id)}
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {incomingLinks.map((link: WorkItemLink) => (
                <div
                  key={link.$id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={getLinkColor(link.linkType)} className="text-xs">
                      {LINK_TYPE_METADATA[link.linkType]?.label || link.linkType}
                    </Badge>
                    <ArrowLeft className="size-3 text-muted-foreground" />
                    <span className="font-mono text-xs">{link.sourceItemId.slice(0, 8)}...</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => handleDelete(link.$id)}
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
