"use client";

import { useState } from "react";
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  Maximize2, 
  ZoomIn, 
  ZoomOut,
  RotateCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useDownloadDocument } from "../api/use-project-docs";
import { PopulatedProjectDocument, DOCUMENT_CATEGORY_LABELS, DocumentCategory } from "../types";
import { formatFileSize, getFileExtensionLabel, isPreviewable } from "../schemas";

interface DocumentPreviewModalProps {
  document: PopulatedProjectDocument;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentPreviewModal = ({
  document,
  workspaceId,
  open,
  onOpenChange,
}: DocumentPreviewModalProps) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { mutate: downloadDocument, isPending: isDownloading } = useDownloadDocument();

  const handleDownload = () => {
    downloadDocument({
      documentId: document.$id,
      workspaceId,
      fileName: document.name,
    });
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const canPreview = isPreviewable(document.mimeType) && document.url;
  const isImage = document.mimeType.startsWith("image/");
  const isPDF = document.mimeType === "application/pdf";
  const isText = document.mimeType.startsWith("text/") || document.mimeType === "application/json";

  const renderPreview = () => {
    if (!canPreview || !document.url) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg">Preview not available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This file type cannot be previewed
          </p>
          <Button onClick={handleDownload} disabled={isDownloading}>
            <Download className="h-4 w-4 mr-2" />
            Download to View
          </Button>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex items-center justify-center h-full overflow-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={document.url}
            alt={document.name}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease",
              maxWidth: zoom === 100 ? "100%" : "none",
              maxHeight: zoom === 100 ? "100%" : "none",
            }}
            className="object-contain"
          />
        </div>
      );
    }

    if (isPDF) {
      return (
        <iframe
          src={`${document.url}#toolbar=0`}
          className="w-full h-full border-0"
          title={document.name}
        />
      );
    }

    if (isText) {
      return (
        <iframe
          src={document.url}
          className="w-full h-full border-0 bg-white"
          title={document.name}
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`
          ${isFullscreen ? "max-w-full w-full h-full m-0 rounded-none" : "max-w-4xl h-[85vh]"}
          flex flex-col p-0
        `}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-base truncate">{document.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {DOCUMENT_CATEGORY_LABELS[document.category as DocumentCategory]}
                  </Badge>
                  <span>v{document.version}</span>
                  <span>•</span>
                  <span>{getFileExtensionLabel(document.mimeType)}</span>
                  <span>•</span>
                  <span>{formatFileSize(document.size)}</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {isImage && (
                <>
                  <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
                  <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRotate} title="Rotate">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              
              {document.url && (
                <Button variant="ghost" size="icon" asChild title="Open in New Tab">
                  <a href={document.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                disabled={isDownloading}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
