import { useState } from "react";
import { MoreHorizontal, Download, Trash2, Eye, File, Image, FileText, Archive, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/hooks/use-confirm";

import { useDeleteAttachment } from "../hooks/use-delete-attachment";
import { Attachment } from "../types";
import { PREVIEWABLE_TYPES } from "../schemas";

interface AttachmentListProps {
  attachments: Attachment[];
  workspaceId: string;
}

interface AttachmentItemProps {
  attachment: Attachment;
  workspaceId: string;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image className="h-4 w-4" />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
    return <FileText className="h-4 w-4" />;
  }
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive")) {
    return <Archive className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
};

const formatFileSize = (bytes: number) => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
};

const AttachmentItem = ({ attachment, workspaceId }: AttachmentItemProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [ConfirmDialog, confirm] = useConfirm(
    "Delete Attachment",
    "Are you sure you want to delete this attachment? This action cannot be undone.",
    "destructive"
  );

  const { mutate: deleteAttachment, isPending: isDeletingAttachment } = useDeleteAttachment();

  const handleDelete = async () => {
    const ok = await confirm();
    if (!ok) return;

    deleteAttachment({
      param: { attachmentId: attachment.$id },
      query: { workspaceId },
    });
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const downloadUrl = `/api/attachments/${attachment.$id}/download?workspaceId=${workspaceId}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed");
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: attachment.mimeType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreview = () => {
    const previewUrl = `/api/attachments/${attachment.$id}/preview?workspaceId=${workspaceId}`;
    window.open(previewUrl, "_blank");
  };

  const isPreviewable = PREVIEWABLE_TYPES.includes(attachment.mimeType);

  return (
    <>
      <ConfirmDialog />
      <Card className="hover:bg-gray-50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={isPreviewable ? handlePreview : handleDownload}
              className="flex items-center space-x-3 flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="flex-shrink-0">
                {getFileIcon(attachment.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-500">{formatFileSize(attachment.size)}</span>
                  <Badge variant="secondary" className="text-xs">
                    {attachment.mimeType.split("/")[1]?.toUpperCase() || "FILE"}
                  </Badge>
                </div>
              </div>
            </button>
            <div className="flex items-center space-x-2">
              {isPreviewable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreview}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isDeletingAttachment}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {isDownloading ? "Downloading..." : "Download"}
                  </DropdownMenuItem>
                  {isPreviewable && (
                    <DropdownMenuItem onClick={handlePreview}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                    disabled={isDeletingAttachment}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export const AttachmentList = ({ attachments, workspaceId }: AttachmentListProps) => {
  if (attachments.length === 0) {
    return (
      <div className="text-center py-8">
        <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No attachments yet</p>
        <p className="text-sm text-gray-400 mt-1">Upload files to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Attachments ({attachments.length})</h3>
        <Badge variant="outline">{formatFileSize(attachments.reduce((total, att) => total + att.size, 0))} total</Badge>
      </div>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.$id}
            attachment={attachment}
            workspaceId={workspaceId}
          />
        ))}
      </div>
    </div>
  );
};