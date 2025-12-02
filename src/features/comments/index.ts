// Components
export { CommentInput } from "./components/comment-input";
export { CommentItem } from "./components/comment-item";
export { CommentList } from "./components/comment-list";
export { TaskComments } from "./components/task-comments";
export { MentionInput } from "./components/mention-input";
export { CommentContent } from "./components/comment-content";

// Hooks
export { useGetComments } from "./hooks/use-get-comments";
export { useCreateComment } from "./hooks/use-create-comment";
export { useUpdateComment } from "./hooks/use-update-comment";
export { useDeleteComment } from "./hooks/use-delete-comment";

// Types
export type {
  Comment,
  PopulatedComment,
  CommentAuthor,
  CreateCommentData,
  UpdateCommentData,
} from "./types";

// Schemas
export {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  getCommentsSchema,
} from "./schemas";

// Utils
export {
  extractMentions,
  parseContentWithMentions,
} from "./utils/mention-utils";
export type { ContentPart } from "./utils/mention-utils";
