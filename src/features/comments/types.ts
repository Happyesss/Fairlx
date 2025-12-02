import { Models } from "node-appwrite";

export type Comment = Models.Document & {
  content: string;
  taskId: string;
  workspaceId: string;
  authorId: string;
  isEdited: boolean;
  parentId?: string; // For threaded replies
};

export type CommentAuthor = {
  $id: string;
  name: string;
  email?: string;
  profileImageUrl?: string | null;
};

export type PopulatedComment = Comment & {
  author?: CommentAuthor;
  replies?: PopulatedComment[];
};

export type CreateCommentData = {
  content: string;
  taskId: string;
  workspaceId: string;
  parentId?: string;
};

export type UpdateCommentData = {
  commentId: string;
  content: string;
  workspaceId: string;
};
