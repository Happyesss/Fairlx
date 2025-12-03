"use client";

import { 
  FileText, 
  MoreVertical, 
  Download, 
  Trash2, 
  Pencil, 
  Archive,
  RefreshCw,
  User,
  Tag,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { PopulatedProjectDocument, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_COLORS, DocumentCategory } from "../types";
import { formatFileSize, getFileExtensionLabel } from "../schemas";
import { useDeleteProjectDocument, useDownloadDocument, useUpdateProjectDocument } from "../api/use-project-docs";
import { useConfirm } from "@/hooks/use-confirm";

interface DocumentCardProps {
  document: PopulatedProjectDocument;
  workspaceId: string;
  projectId: string;
  onEdit?: (document: PopulatedProjectDocument) => void;
  onReplace?: (document: PopulatedProjectDocument) => void;
}

export const DocumentCard = ({
  document,
  workspaceId,
  projectId,
  onEdit,
  onReplace,
}: DocumentCardProps) => {
  const [ConfirmDialog, confirmDelete] = useConfirm(
    "Delete Document",
    `Are you sure you want to delete "${document.name}"? This action cannot be undone.`,
    "destructive"
  );

  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteProjectDocument();
  const { mutate: downloadDocument, isPending: isDownloading } = useDownloadDocument();
  const { mutate: updateDocument, isPending: isUpdating } = useUpdateProjectDocument();

  const handleDelete = async () => {
    const ok = await confirmDelete();
    if (!ok) return;

    deleteDocument({
      documentId: document.$id,
      projectId,
      workspaceId,
    });
  };

  const handleDownload = () => {
    downloadDocument({
      documentId: document.$id,
      workspaceId,
      fileName: document.name,
    });
  };

  const handleArchive = () => {
    updateDocument({
      documentId: document.$id,
      projectId,
      isArchived: !document.isArchived,
    });
  };

  const handleOpenInNewTab = () => {
    if (document.url) {
      window.open(document.url, "_blank", "noopener,noreferrer");
    }
  };

  const getFileIcon = () => {
    const ext = getFileExtensionLabel(document.mimeType);
    const iconColors: Record<string, string> = {
      PDF: "text-red-500",
      DOC: "text-blue-500",
      DOCX: "text-blue-500",
      XLS: "text-green-500",
      XLSX: "text-green-500",
      PPT: "text-orange-500",
      PPTX: "text-orange-500",
      PNG: "text-purple-500",
      JPG: "text-purple-500",
      MD: "text-gray-600",
      TXT: "text-gray-500",
    };
    return iconColors[ext] || "text-gray-400";
  };

  return (
    <>
      <ConfirmDialog />
      <Card 
        className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer"
        onClick={handleOpenInNewTab}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* File Icon */}
            <div className={`p-3 rounded-lg bg-muted/50 shrink-0 ${getFileIcon()}`}>
              <FileText className="h-6 w-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-medium text-sm truncate" title={document.name}>
                    {document.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${DOCUMENT_CATEGORY_COLORS[document.category as DocumentCategory] || DOCUMENT_CATEGORY_COLORS[DocumentCategory.OTHER]}`}
                    >
                      {DOCUMENT_CATEGORY_LABELS[document.category as DocumentCategory] || "Other"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      v{document.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getFileExtensionLabel(document.mimeType)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(document.size)}
                    </span>
                    {document.isArchived && (
                      <Badge variant="secondary" className="text-xs">
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(); }} disabled={isDownloading}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(document); }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReplace?.(document); }}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Replace File
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }} disabled={isUpdating}>
                      <Archive className="h-4 w-4 mr-2" />
                      {document.isArchived ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description */}
              {document.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {document.description}
                </p>
              )}

              {/* Tags */}
              {document.tags && document.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {document.tags.slice(0, 3).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs py-0 px-1.5">
                      {tag}
                    </Badge>
                  ))}
                  {document.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{document.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(document.$createdAt), { addSuffix: true })}
                    </TooltipTrigger>
                    <TooltipContent>
                      Uploaded: {new Date(document.$createdAt).toLocaleString()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {document.uploader && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {document.uploader.name}
                      </TooltipTrigger>
                      <TooltipContent>
                        Uploaded by {document.uploader.name}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {document.$updatedAt && document.$updatedAt !== document.$createdAt && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 text-primary">
                        <RefreshCw className="h-3 w-3" />
                        Updated
                      </TooltipTrigger>
                      <TooltipContent>
                        Updated: {new Date(document.$updatedAt).toLocaleString()}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
