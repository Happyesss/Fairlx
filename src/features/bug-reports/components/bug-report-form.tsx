"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, X, Upload, CheckCircle, ImageIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useUploadBugImage } from "../hooks/use-upload-bug-image";
import { useSubmitBugReports } from "../hooks/use-submit-bug-reports";
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from "../schemas";
import type { BugEntry, UploadingImage } from "../types";

interface FieldErrors {
  title?: string;
  description?: string;
}

const MAX_IMAGES_PER_BUG = 3;
const MAX_BUGS_PER_SESSION = 5;

function createEmptyBug(): BugEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    imageFileIds: [],
    imageUrls: [],
    uploadingImages: [],
  };
}

export const BugReportForm = () => {
  const [bugs, setBugs] = useState<BugEntry[]>([createEmptyBug()]);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrors>>({});

  const { mutateAsync: uploadImage } = useUploadBugImage();
  const { mutate: submitBugReports, isPending: isSubmitting } = useSubmitBugReports();

  const updateBug = useCallback((id: string, patch: Partial<BugEntry>) => {
    setBugs((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const handleAddBug = () => {
    if (bugs.length >= MAX_BUGS_PER_SESSION) return;
    setBugs((prev) => [...prev, createEmptyBug()]);
  };

  const handleRemoveBug = (id: string) =>
    setBugs((prev) => prev.filter((b) => b.id !== id));

  const handleImageSelect = async (bugId: string, files: FileList) => {
    const bug = bugs.find((b) => b.id === bugId);
    const currentCount = bug?.uploadingImages.length ?? 0;
    const remaining = MAX_IMAGES_PER_BUG - currentCount;
    if (remaining <= 0) return;

    const valid = Array.from(files)
      .filter((f) => ALLOWED_IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE)
      .slice(0, remaining);

    const pending: UploadingImage[] = valid.map((f) => ({
      localId: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: "uploading" as const,
    }));

    setBugs((prev) =>
      prev.map((b) =>
        b.id === bugId
          ? { ...b, uploadingImages: [...b.uploadingImages, ...pending] }
          : b
      )
    );

    await Promise.all(
      pending.map(async (img) => {
        try {
          const result = await uploadImage(img.file);
          setBugs((prev) =>
            prev.map((b) => {
              if (b.id !== bugId) return b;
              return {
                ...b,
                imageFileIds: [...b.imageFileIds, result.data.fileId],
                imageUrls: [...b.imageUrls, result.data.url],
                uploadingImages: b.uploadingImages.map((u) =>
                  u.localId === img.localId
                    ? { ...u, status: "done" as const, fileId: result.data.fileId, url: result.data.url }
                    : u
                ),
              };
            })
          );
        } catch {
          setBugs((prev) =>
            prev.map((b) => {
              if (b.id !== bugId) return b;
              return {
                ...b,
                uploadingImages: b.uploadingImages.map((u) =>
                  u.localId === img.localId ? { ...u, status: "error" as const } : u
                ),
              };
            })
          );
        }
      })
    );
  };

  const handleRemoveImage = (bugId: string, localId: string) => {
    setBugs((prev) =>
      prev.map((b) => {
        if (b.id !== bugId) return b;
        const removed = b.uploadingImages.find((u) => u.localId === localId);
        return {
          ...b,
          imageFileIds: removed?.fileId
            ? b.imageFileIds.filter((id) => id !== removed.fileId)
            : b.imageFileIds,
          imageUrls: removed?.url
            ? b.imageUrls.filter((u) => u !== removed.url)
            : b.imageUrls,
          uploadingImages: b.uploadingImages.filter((u) => u.localId !== localId),
        };
      })
    );
  };

  const validate = () => {
    const errors: Record<string, FieldErrors> = {};
    bugs.forEach((b) => {
      const e: FieldErrors = {};
      if (b.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
      if (b.description.trim().length < 10) e.description = "Description must be at least 10 characters.";
      if (Object.keys(e).length) errors[b.id] = e;
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasUploadingImages = bugs.some((b) =>
    b.uploadingImages.some((u) => u.status === "uploading")
  );

  const handleSubmit = () => {
    if (!validate()) return;
    submitBugReports(
      {
        bugs: bugs.map((b) => ({
          title: b.title,
          description: b.description,
          imageFileIds: b.imageFileIds,
          imageUrls: b.imageUrls,
        })),
      },
      { onSuccess: () => setSubmitted(true) }
    );
  };

  const handleReset = () => {
    setBugs([createEmptyBug()]);
    setSubmitted(false);
    setFieldErrors({});
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <div>
          <h2 className="text-2xl font-semibold">Thank you for your report!</h2>
          <p className="text-muted-foreground mt-2">
            We&apos;ve received your bug report{bugs.length > 1 ? "s" : ""} and will look
            into {bugs.length > 1 ? "them" : "it"} as soon as possible.
          </p>
        </div>
        <Button onClick={handleReset} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Report More Bugs
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Report a Bug</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Describe what went wrong. You can report multiple bugs at once.
        </p>
      </div>

      <div className="space-y-4">
        {bugs.map((bug, index) => (
          <BugEntryCard
            key={bug.id}
            bug={bug}
            index={index}
            showRemove={bugs.length > 1}
            errors={fieldErrors[bug.id]}
            imageCount={bug.uploadingImages.length}
            onTitleChange={(val) => updateBug(bug.id, { title: val })}
            onDescriptionChange={(val) => updateBug(bug.id, { description: val })}
            onImageSelect={(files) => handleImageSelect(bug.id, files)}
            onRemoveImage={(localId) => handleRemoveImage(bug.id, localId)}
            onRemoveBug={() => handleRemoveBug(bug.id)}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={handleAddBug}
          disabled={bugs.length >= MAX_BUGS_PER_SESSION}
          className="flex-1 sm:flex-none"
          size={"xs"}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Bug
          {bugs.length >= MAX_BUGS_PER_SESSION && (
            <span className="ml-1 text-xs text-muted-foreground">(max {MAX_BUGS_PER_SESSION})</span>
          )}
        </Button>

        <Button
          onClick={handleSubmit} size={"xs"}
          disabled={isSubmitting || hasUploadingImages}
          className="flex-1 sm:flex-none sm:ml-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Bug Report"
          )}
        </Button>
      </div>

      {hasUploadingImages && (
        <p className="text-xs text-muted-foreground text-center">
          Please wait for all images to finish uploading before submitting.
        </p>
      )}
    </div>
  );
};

interface BugEntryCardProps {
  bug: BugEntry;
  index: number;
  showRemove: boolean;
  errors?: FieldErrors;
  imageCount: number;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onImageSelect: (files: FileList) => void;
  onRemoveImage: (localId: string) => void;
  onRemoveBug: () => void;
}

const BugEntryCard = ({
  bug,
  index,
  showRemove,
  errors,
  imageCount,
  onTitleChange,
  onDescriptionChange,
  onImageSelect,
  onRemoveImage,
  onRemoveBug,
}: BugEntryCardProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) onImageSelect(e.dataTransfer.files);
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Bug #{index + 1}
          {showRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveBug}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Title */}
        <div>
          <Input
            placeholder="Bug title — e.g. &quot;Dashboard crashes on load&quot;"
            value={bug.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className={cn(errors?.title && "border-destructive focus-visible:ring-destructive")}
          />
          {errors?.title && (
            <p className="text-xs text-destructive mt-1">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <Textarea
            placeholder="Describe the bug in detail — what happened, what you expected, and how to reproduce it..."
            value={bug.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={4}
            className={cn(errors?.description && "border-destructive focus-visible:ring-destructive")}
          />
          {errors?.description && (
            <p className="text-xs text-destructive mt-1">{errors.description}</p>
          )}
        </div>

        {/* Image upload drop zone */}
        {imageCount < MAX_IMAGES_PER_BUG ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop screenshots here or{" "}
                <span className="text-primary font-medium">click to upload</span>
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF, WebP — max 10MB each &middot; {imageCount}/{MAX_IMAGES_PER_BUG} uploaded
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => e.target.files && onImageSelect(e.target.files)}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Maximum {MAX_IMAGES_PER_BUG} images reached. Remove one to upload another.
          </p>
        )}

        {/* Image thumbnails */}
        {bug.uploadingImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bug.uploadingImages.map((img) => (
              <ImageThumb
                key={img.localId}
                img={img}
                onRemove={() => onRemoveImage(img.localId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ImageThumbProps {
  img: UploadingImage;
  onRemove: () => void;
}

const ImageThumb = ({ img, onRemove }: ImageThumbProps) => (
  <div className="relative h-20 w-20 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={img.previewUrl} alt="Bug screenshot" className="h-full w-full object-cover" />

    {img.status === "uploading" && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <Loader2 className="h-5 w-5 text-white animate-spin" />
      </div>
    )}

    {img.status === "error" && (
      <div className="absolute inset-0 flex items-center justify-center bg-destructive/60">
        <ImageIcon className="h-5 w-5 text-white" />
      </div>
    )}

    {img.status !== "uploading" && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
      >
        <X className="h-3 w-3 text-white" />
      </button>
    )}
  </div>
);
