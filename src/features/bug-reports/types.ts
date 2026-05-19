export interface BugReport {
  $id: string;
  userId: string;
  email: string;
  username: string;
  title: string;
  description: string;
  imageFileIds: string[];
  imageUrls: string[];
  $createdAt: string;
}

export interface BugEntry {
  id: string;
  title: string;
  description: string;
  imageFileIds: string[];
  imageUrls: string[];
  uploadingImages: UploadingImage[];
}

export interface UploadingImage {
  localId: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  fileId?: string;
  url?: string;
}
