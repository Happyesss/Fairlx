import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";
import { DATABASE_ID, COMMENTS_ID, TASKS_ID } from "@/config";
import { Comment, PopulatedComment, CommentAuthor } from "../types";
import { Query, ID } from "node-appwrite";
import {
  dispatchWorkitemEvent,
  createCommentAddedEvent,
  createMentionEvent,
} from "@/lib/notifications";
import { createReplyEvent } from "@/lib/notifications/events";
import { Task } from "@/features/tasks/types";
import { extractMentions, extractSnippet } from "@/lib/mentions";

// Get all comments for a task, optionally filtering by parentId
export const getComments = async (
  taskId: string,
  workspaceId: string
): Promise<Comment[]> => {
  const { databases } = await createAdminClient();

  if (!COMMENTS_ID) {
    throw new Error("COMMENTS_ID is not defined. Please check your environment variables.");
  }

  const comments = await databases.listDocuments(DATABASE_ID, COMMENTS_ID, [
    Query.equal("taskId", taskId),
    Query.equal("workspaceId", workspaceId),
    Query.orderAsc("$createdAt")
  ]);

  return comments.documents as Comment[];
};

// Get all comment authors from workspace members
// OPTIMIZED: Uses batchGetUsers instead of individual users.get calls
export const getCommentAuthors = async (
  authorIds: string[]
): Promise<Map<string, CommentAuthor>> => {
  const { users } = await createAdminClient();
  const authorsMap = new Map<string, CommentAuthor>();

  // Get unique author IDs
  const uniqueAuthorIds = [...new Set(authorIds)];

  // Batch-fetch all users in one call (was N+1 users.get per author)
  const userMap = await batchGetUsers(users, uniqueAuthorIds);

  for (const authorId of uniqueAuthorIds) {
    const userData = userMap.get(authorId);
    if (userData) {
      authorsMap.set(authorId, {
        $id: userData.$id,
        name: userData.name || userData.email || "Unknown",
        email: userData.email,
        profileImageUrl: userData.prefs?.profileImageUrl || null,
      });
    } else {
      authorsMap.set(authorId, {
        $id: authorId,
        name: "Unknown User",
        email: undefined,
        profileImageUrl: null,
      });
    }
  }

  return authorsMap;
};

// Create a new comment
export const createComment = async (data: {
  content: string;
  taskId: string;
  workspaceId: string;
  authorId: string;
  authorName?: string;
  parentId?: string;
}): Promise<Comment> => {
  const { databases } = await createAdminClient();

  const task = await databases.getDocument<Task>(
    DATABASE_ID,
    TASKS_ID,
    data.taskId
  );

  const comment = await databases.createDocument(
    DATABASE_ID,
    COMMENTS_ID,
    ID.unique(),
    {
      content: data.content,
      taskId: data.taskId,
      workspaceId: data.workspaceId,
      projectId: task.projectId,
      authorId: data.authorId,
      isEdited: false,
      ...(data.parentId ? { parentId: data.parentId } : {}),
    }
  );

  // Emit comment added event, mention events, and reply events (non-blocking)
  try {
    const authorName = data.authorName || "Someone";
    const mentionedUserIds = extractMentions(data.content);
    const snippet = extractSnippet(data.content, 200);

    // 1. Dispatch comment added event with comment content included
    // Exclude mentioned users from this general notification as they'll get specific mention events
    const event = createCommentAddedEvent(
      task,
      data.authorId,
      authorName,
      comment.$id,
      mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
      snippet
    );

    if (mentionedUserIds.length > 0) {
      if (!event.metadata) event.metadata = {};
      event.metadata.excludeUserIds = mentionedUserIds;
    }

    dispatchWorkitemEvent(event).catch((err) => {
      console.error("[Comments] Failed to dispatch comment event:", err);
    });

    // 2. Dispatch individual mention notifications for each mentioned user
    for (const mentionedUserId of mentionedUserIds) {
      if (mentionedUserId === data.authorId) continue; // Don't notify self
      const mentionEvent = createMentionEvent(
        task,
        data.authorId,
        authorName,
        mentionedUserId,
        snippet
      );
      dispatchWorkitemEvent(mentionEvent).catch((err) => {
        console.error("[Comments] Failed to dispatch mention event:", err);
      });
    }

    // 3. Dispatch reply notification if this is a reply to another comment
    if (data.parentId) {
      try {
        const parentComment = await databases.getDocument(
          DATABASE_ID,
          COMMENTS_ID,
          data.parentId
        ) as Comment;

        // Only notify if the parent author is not the same person replying
        if (parentComment.authorId && parentComment.authorId !== data.authorId) {
          // Resolve parent author name
          let parentAuthorName = "Someone";
          try {
            const { users } = await createAdminClient();
            const parentUser = await users.get(parentComment.authorId);
            parentAuthorName = parentUser.name || parentUser.email || "Someone";
          } catch {
            // Use default name
          }

          const replyEvent = createReplyEvent(
            task,
            data.authorId,
            authorName,
            comment.$id,
            parentComment.authorId,
            parentAuthorName,
            snippet
          );
          dispatchWorkitemEvent(replyEvent).catch((err) => {
            console.error("[Comments] Failed to dispatch reply event:", err);
          });
        }
      } catch (err) {
        console.error("[Comments] Error dispatching reply notification:", err);
      }
    }
  } catch (err) {
    console.error("[Comments] Error dispatching notifications:", err);
    // Silently fail - notifications are non-critical
  }

  return comment as Comment;
};

// Update an existing comment
export const updateComment = async (
  commentId: string,
  content: string,
  workspaceId: string,
  userId: string
): Promise<Comment> => {
  const { databases } = await createAdminClient();

  // First get the comment to verify ownership
  const existingComment = (await databases.getDocument(
    DATABASE_ID,
    COMMENTS_ID,
    commentId
  )) as Comment;

  // Verify workspace access
  if (existingComment.workspaceId !== workspaceId) {
    throw new Error("Unauthorized");
  }

  // Verify that the user is the author of the comment
  if (existingComment.authorId !== userId) {
    throw new Error("You can only edit your own comments");
  }

  const updatedComment = await databases.updateDocument(
    DATABASE_ID,
    COMMENTS_ID,
    commentId,
    {
      content,
      isEdited: true,
    }
  );

  return updatedComment as Comment;
};

// Delete a comment
export const deleteComment = async (
  commentId: string,
  workspaceId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<void> => {
  const { databases } = await createAdminClient();

  // First get the comment to verify ownership
  const existingComment = (await databases.getDocument(
    DATABASE_ID,
    COMMENTS_ID,
    commentId
  )) as Comment;

  // Verify workspace access
  if (existingComment.workspaceId !== workspaceId) {
    throw new Error("Unauthorized");
  }

  // Verify that the user is the author of the comment or an admin
  if (existingComment.authorId !== userId && !isAdmin) {
    throw new Error("You can only delete your own comments");
  }

  // Delete any replies to this comment first
  const replies = await databases.listDocuments(DATABASE_ID, COMMENTS_ID, [
    Query.equal("parentId", commentId),
  ]);

  for (const reply of replies.documents) {
    await databases.deleteDocument(DATABASE_ID, COMMENTS_ID, reply.$id);
  }

  // Delete the comment
  await databases.deleteDocument(DATABASE_ID, COMMENTS_ID, commentId);
};

// Get a single comment
export const getComment = async (commentId: string): Promise<Comment> => {
  const { databases } = await createAdminClient();

  const comment = await databases.getDocument(
    DATABASE_ID,
    COMMENTS_ID,
    commentId
  );

  return comment as Comment;
};

// Get comments with authors populated
export const getPopulatedComments = async (
  taskId: string,
  workspaceId: string
): Promise<PopulatedComment[]> => {
  const comments = await getComments(taskId, workspaceId);

  if (comments.length === 0) {
    return [];
  }

  // Get all author IDs
  const authorIds = comments.map((c) => c.authorId);
  const authorsMap = await getCommentAuthors(authorIds);

  // Separate root comments and replies
  const rootComments = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);

  // Map comments with authors and organize replies
  const populatedComments: PopulatedComment[] = rootComments.map((comment) => {
    const commentReplies = replies
      .filter((r) => r.parentId === comment.$id)
      .map((reply) => ({
        ...reply,
        author: authorsMap.get(reply.authorId),
        replies: [],
      }));

    return {
      ...comment,
      author: authorsMap.get(comment.authorId),
      replies: commentReplies,
    };
  });

  return populatedComments;
};
