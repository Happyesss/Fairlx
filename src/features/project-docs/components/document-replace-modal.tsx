"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, Loader2, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useReplaceProjectDocument } from "../api/use-project-docs";
import { PopulatedProjectDocument } from "../types";
import {
  MAX_FILE_SIZE,
  ALLOWED_DOCUMENT_TYPES,
  formatFileSize,
  validateFile,
  getFileExtensionLabel,
} from "../schemas";

const replaceFormSchema = z.object({
  version: z.string().max(50).optional(),
});

type ReplaceFormValues = z.infer<typeof replaceFormSchema>;

interface DocumentReplaceModalProps {
  document: PopulatedProjectDocument;
  projectId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentReplaceModal = ({
  document,
  projectId,
  workspaceId,
  open,
  onOpenChange,
}: DocumentReplaceModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: replaceDocument, isPending } = useReplaceProjectDocument();

  const form = useForm<ReplaceFormValues>({
    resolver: zodResolver(replaceFormSchema),
    defaultValues: {
      version: incrementVersion(document.version),
    },
  });

  const handleFile = useCallback((file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file");
      setSelectedFile(null);
      return;
    }

    setFileError(null);
    setSelectedFile(file);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = (values: ReplaceFormValues) => {
    if (!selectedFile) {
      setFileError("Please select a file to upload");
      return;
    }

    replaceDocument(
      {
        documentId: document.$id,
        projectId,
        workspaceId,
        file: selectedFile,
        version: values.version,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedFile(null);
          form.reset();
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSelectedFile(null);
      setFileError(null);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Replace Document</DialogTitle>
          <DialogDescription>
            Upload a new version of &quot;{document.name}&quot;. The old file will be permanently replaced.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current File Info */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Current File</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{getFileExtensionLabel(document.mimeType)}</span>
                <span>•</span>
                <span>{formatFileSize(document.size)}</span>
                <span>•</span>
                <span>v{document.version}</span>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
                ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                ${fileError ? "border-destructive" : ""}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_DOCUMENT_TYPES.join(",")}
                onChange={handleFileInput}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)} • {getFileExtensionLabel(selectedFile.type)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {isDragActive ? "Drop the file here" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max {formatFileSize(MAX_FILE_SIZE)}
                  </p>
                </div>
              )}
            </div>

            {fileError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {fileError}
              </div>
            )}

            {/* Version */}
            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Version</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 1.1, 2.0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !selectedFile}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Replacing...
                  </>
                ) : (
                  "Replace File"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Helper function to increment version
function incrementVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length === 0) return "1.1";
  
  const lastPart = parseInt(parts[parts.length - 1], 10);
  if (isNaN(lastPart)) return version + ".1";
  
  parts[parts.length - 1] = String(lastPart + 1);
  return parts.join(".");
}
