import { useState, useRef } from "react";
import { Upload } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { useUploadAttachment } from "../hooks/use-upload-attachment";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "../schemas";

interface AttachmentUploadProps {
  taskId: string;
  workspaceId: string;
  className?: string;
}

export const AttachmentUpload = ({ taskId, workspaceId, className }: AttachmentUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { mutate: uploadAttachment, isPending } = useUploadAttachment();

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" exceeds 20MB limit`);
        return;
      }

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        alert(`File type "${file.type}" is not allowed`);
        return;
      }

      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", taskId);
      formData.append("workspaceId", workspaceId);

      uploadAttachment({ form: formData });
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Card className={cn("border-2 border-dashed transition-colors", className, {
      "border-blue-500 bg-blue-50": dragActive,
      "border-gray-300": !dragActive,
    })}>
      <CardContent
        className="p-6 text-center cursor-pointer"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center space-y-4">
          <Upload className="h-12 w-12 text-gray-400" />
          <div>
            <p className="text-lg font-medium">Drop files here or click to upload</p>
            <p className="text-sm text-gray-500 mt-1">
              Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supported: Images, Documents, Archives, Text files
            </p>
          </div>
          {isPending && (
            <div className="w-full max-w-xs">
              <Progress value={50} className="h-2" />
              <p className="text-sm text-gray-500 mt-1">Uploading...</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          accept={ALLOWED_FILE_TYPES.join(",")}
        />
      </CardContent>
    </Card>
  );
};