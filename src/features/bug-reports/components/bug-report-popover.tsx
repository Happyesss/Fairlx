"use client";

import { useState, useRef, useCallback } from "react";
import { Bug, Plus, X, ImageIcon, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useUploadBugImage } from "../hooks/use-upload-bug-image";
import { useSubmitBugReports } from "../hooks/use-submit-bug-reports";
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from "../schemas";
import type { UploadingImage } from "../types";

const MAX_IMAGES = 3;

interface FormState {
  title: string;
  description: string;
  imageFileIds: string[];
  imageUrls: string[];
  uploadingImages: UploadingImage[];
}

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    imageFileIds: [],
    imageUrls: [],
    uploadingImages: [],
  };
}

export const BugReportPopover = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: uploadImage } = useUploadBugImage();
  const { mutate: submitBug, isPending: isSubmitting } = useSubmitBugReports();

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      // reset on close
      setForm(emptyForm());
      setErrors({});
      setSubmitted(false);
    }
  }, []);

  const handleImageSelect = async (files: FileList) => {
    const remaining = MAX_IMAGES - form.uploadingImages.length;
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

    setForm((prev) => ({
      ...prev,
      uploadingImages: [...prev.uploadingImages, ...pending],
    }));

    await Promise.all(
      pending.map(async (img) => {
        try {
          const result = await uploadImage(img.file);
          setForm((prev) => ({
            ...prev,
            imageFileIds: [...prev.imageFileIds, result.data.fileId],
            imageUrls: [...prev.imageUrls, result.data.url],
            uploadingImages: prev.uploadingImages.map((u) =>
              u.localId === img.localId
                ? { ...u, status: "done" as const, fileId: result.data.fileId, url: result.data.url }
                : u
            ),
          }));
        } catch {
          setForm((prev) => ({
            ...prev,
            uploadingImages: prev.uploadingImages.map((u) =>
              u.localId === img.localId ? { ...u, status: "error" as const } : u
            ),
          }));
        }
      })
    );
  };

  const handleRemoveImage = (localId: string) => {
    setForm((prev) => {
      const removed = prev.uploadingImages.find((u) => u.localId === localId);
      return {
        ...prev,
        imageFileIds: removed?.fileId
          ? prev.imageFileIds.filter((id) => id !== removed.fileId)
          : prev.imageFileIds,
        imageUrls: removed?.url
          ? prev.imageUrls.filter((u) => u !== removed.url)
          : prev.imageUrls,
        uploadingImages: prev.uploadingImages.filter((u) => u.localId !== localId),
      };
    });
  };

  const hasUploading = form.uploadingImages.some((u) => u.status === "uploading");

  const validate = () => {
    const e: { title?: string; description?: string } = {};
    if (form.title.trim().length < 3) e.title = "At least 3 characters";
    if (form.description.trim().length < 10) e.description = "At least 10 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    submitBug(
      {
        bugs: [
          {
            title: form.title,
            description: form.description,
            imageFileIds: form.imageFileIds,
            imageUrls: form.imageUrls,
          },
        ],
      },
      { onSuccess: () => setSubmitted(true) }
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Report a bug"
        >
          <Bug className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Report Bug</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0 rounded-xl shadow-lg border" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Report a Bug</h3>
          </div>
          <Link
            href="/bug-report"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Report multiple</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {submitted ? (
          /* Success state */
          <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <div>
              <p className="font-medium text-sm">Bug reported!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thanks for helping us improve.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  setForm(emptyForm());
                  setErrors({});
                  setSubmitted(false);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Report another
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="p-4 space-y-3">
            {/* Title */}
            <div>
              <Input
                placeholder="Bug title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className={cn("text-sm h-8", errors.title && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.title && (
                <p className="text-xs text-destructive mt-0.5">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Textarea
                placeholder="What happened? How can we reproduce it?"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className={cn("text-sm resize-none", errors.description && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.description && (
                <p className="text-xs text-destructive mt-0.5">{errors.description}</p>
              )}
            </div>

            {/* Images */}
            <div className="space-y-2">
              {form.uploadingImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.uploadingImages.map((img) => (
                    <MiniImageThumb
                      key={img.localId}
                      img={img}
                      onRemove={() => handleRemoveImage(img.localId)}
                    />
                  ))}
                </div>
              )}

              {form.uploadingImages.length < MAX_IMAGES && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Attach screenshot ({form.uploadingImages.length}/{MAX_IMAGES})
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => e.target.files && handleImageSelect(e.target.files)}
                  />
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || hasUploading}
                className="flex-1 text-xs h-8"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

interface MiniImageThumbProps {
  img: UploadingImage;
  onRemove: () => void;
}

const MiniImageThumb = ({ img, onRemove }: MiniImageThumbProps) => (
  <div className="relative h-14 w-14 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={img.previewUrl} alt="Screenshot" className="h-full w-full object-cover" />

    {img.status === "uploading" && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <Loader2 className="h-4 w-4 text-white animate-spin" />
      </div>
    )}

    {img.status !== "uploading" && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
      >
        <X className="h-2.5 w-2.5 text-white" />
      </button>
    )}
  </div>
);
