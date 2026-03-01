import { zValidator } from "@hono/zod-validator";
import { endOfMonth, startOfMonth, subMonths, format } from "date-fns";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { z } from "zod";

import {
  DATABASE_ID,
  IMAGES_BUCKET_ID,
  MEMBERS_ID,
  PROJECTS_ID,
  TASKS_ID,
  TIME_LOGS_ID,
  WORKSPACES_ID,
  CUSTOM_COLUMNS_ID,
  DEFAULT_COLUMN_SETTINGS_ID,
  SPACES_ID,
  ORGANIZATIONS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { generateInviteCode } from "@/lib/utils";

import { MemberRole, WorkspaceMemberRole } from "@/features/members/types";
import { getMember } from "@/features/members/utils";
import { TaskStatus } from "@/features/tasks/types";

import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";
import { Workspace } from "../types";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");

    const members = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("userId", user.$id),
    ]);

    if (members.total === 0) {
      return c.json({ data: { documents: [], total: 0 } });
    }

    const workspaceIds = members.documents.map((member) => member.workspaceId);

    const workspaces = await databases.listDocuments(
      DATABASE_ID,
      WORKSPACES_ID,
      [Query.orderDesc("$createdAt"), Query.contains("$id", workspaceIds)]
    );

    return c.json({ data: workspaces });
  })
  .get("/:workspaceId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { workspaceId } = c.req.param();

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspace = await databases.getDocument<Workspace>(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId
    );

    return c.json({ data: workspace });
  })
  .get("/:workspaceId/info", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workspaceId } = c.req.param();

    const workspace = await databases.getDocument<Workspace>(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId
    );

    // Check if user is already a member
    const existingMember = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    // Get member count
    const members = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("workspaceId", workspaceId),
    ]);

    // Get spaces count
    const spaces = await databases.listDocuments(DATABASE_ID, SPACES_ID, [
      Query.equal("workspaceId", workspaceId),
    ]);

    // Get projects count
    const projects = await databases.listDocuments(DATABASE_ID, PROJECTS_ID, [
      Query.equal("workspaceId", workspaceId),
    ]);

    // Get organization info if workspace belongs to an org
    let organization = null;
    if (workspace.organizationId) {
      try {
        const org = await databases.getDocument(
          DATABASE_ID,
          ORGANIZATIONS_ID,
          workspace.organizationId
        );
        organization = {
          $id: org.$id,
          name: org.name,
          imageUrl: org.imageUrl,
        };
      } catch {
        // Organization might not exist or user doesn't have access
      }
    }

    return c.json({
      data: {
        $id: workspace.$id,
        name: workspace.name,
        imageUrl: workspace.imageUrl,
        memberCount: members.total,
        spacesCount: spaces.total,
        projectsCount: projects.total,
        organization,
        isMember: !!existingMember,
      },
    });
  })
  .post(
    "/",
    zValidator("form", createWorkspaceSchema),
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const storage = c.get("storage");
      const user = c.get("user");

      const { name, image } = c.req.valid("form");

      // Validate workspace limit
      const { validateWorkspaceCreation } = await import("@/features/members/utils");
      const accountType = (user.prefs?.accountType as "PERSONAL" | "ORG") || "PERSONAL";

      const validation = await validateWorkspaceCreation({
        databases,
        userId: user.$id,
        accountType,
      });

      if (!validation.allowed) {
        return c.json({ error: validation.reason || "Cannot create workspace" }, 403);
      }

      let uploadedImageUrl: string | undefined;

      if (image instanceof File) {
        const file = await storage.createFile(
          IMAGES_BUCKET_ID,
          ID.unique(),
          image
        );

        const arrayBuffer = await storage.getFilePreview(
          IMAGES_BUCKET_ID,
          file.$id
        );

        uploadedImageUrl = `data:image/png;base64,${Buffer.from(
          arrayBuffer
        ).toString("base64")}`;
      }

      // Get ORG ID
      const prefs = user.prefs || {};
      const primaryOrganizationId = prefs.primaryOrganizationId as string | undefined;

      // Check if first workspace
      const existingMembers = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
        Query.equal("userId", user.$id),
      ]);
      const isFirstWorkspace = existingMembers.total === 0;

      const workspace = await databases.createDocument(
        DATABASE_ID,
        WORKSPACES_ID,
        ID.unique(),
        {
          name,
          userId: user.$id,
          imageUrl: uploadedImageUrl,
          inviteCode: generateInviteCode(6),
          // Link organization
          organizationId: accountType === "ORG" ? primaryOrganizationId : null,
          isDefault: isFirstWorkspace,
          billingScope: accountType === "ORG" ? "organization" : "user",
        }
      );

      // Grant initial role
      await databases.createDocument(DATABASE_ID, MEMBERS_ID, ID.unique(), {
        userId: user.$id,
        workspaceId: workspace.$id,
        role: isFirstWorkspace ? MemberRole.OWNER : MemberRole.ADMIN,
      });

      return c.json({ data: workspace });
    }
  )
  .patch(
    "/:workspaceId",
    sessionMiddleware,
    zValidator("form", updateWorkspaceSchema),
    async (c) => {
      const databases = c.get("databases");
      const storage = c.get("storage");
      const user = c.get("user");

      const { workspaceId } = c.req.param();
      const { name, image } = c.req.valid("form");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      // Verify update permissions - support both legacy and new roles
      if (!member || (
        member.role !== MemberRole.ADMIN &&
        member.role !== MemberRole.OWNER &&
        member.role !== WorkspaceMemberRole.WS_ADMIN
      )) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      let uploadedImageUrl: string | undefined;

      if (image instanceof File) {
        const file = await storage.createFile(
          IMAGES_BUCKET_ID,
          ID.unique(),
          image
        );

        const arrayBuffer = await storage.getFilePreview(
          IMAGES_BUCKET_ID,
          file.$id
        );

        uploadedImageUrl = `data:image/png;base64,${Buffer.from(
          arrayBuffer
        ).toString("base64")}`;
      } else {
        uploadedImageUrl = image;
      }

      const updateData = { name, imageUrl: uploadedImageUrl };
      (updateData as Record<string, unknown>).lastModifiedBy = user.$id;

      const workspace = await databases.updateDocument(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId,
        updateData
      );

      return c.json({ data: workspace });
    }
  )
  .delete("/:workspaceId", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");

    const { workspaceId } = c.req.param();

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    // Verify delete permissions
    if (!member || member.role !== MemberRole.OWNER) {
      return c.json({ error: "Only workspace owner can delete" }, 401);
    }

    // Delete all related data when workspace is deleted
    try {
      // Get all projects in this workspace
      const projects = await databases.listDocuments(
        DATABASE_ID,
        PROJECTS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Get all spaces in this workspace (Issue 3 - cascade deletion)
      const { SPACES_ID, SPACE_MEMBERS_ID } = await import("@/config");
      const spaces = await databases.listDocuments(
        DATABASE_ID,
        SPACES_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Get all tasks in this workspace
      const tasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Get all time logs in this workspace
      const timeLogs = await databases.listDocuments(
        DATABASE_ID,
        TIME_LOGS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Get all members in this workspace
      const members = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Get all custom columns in this workspace
      const customColumns = await databases.listDocuments(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Get all default column settings in this workspace
      const defaultColumnSettings = await databases.listDocuments(
        DATABASE_ID,
        DEFAULT_COLUMN_SETTINGS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Delete time logs
      for (const timeLog of timeLogs.documents) {
        await databases.deleteDocument(DATABASE_ID, TIME_LOGS_ID, timeLog.$id);
      }

      // Delete all tasks
      for (const task of tasks.documents) {
        await databases.deleteDocument(DATABASE_ID, TASKS_ID, task.$id);
      }

      // Delete all projects
      for (const project of projects.documents) {
        await databases.deleteDocument(DATABASE_ID, PROJECTS_ID, project.$id);
      }

      // Delete spaces and members
      for (const space of spaces.documents) {
        // Get and delete all members of this space
        const spaceMembers = await databases.listDocuments(
          DATABASE_ID,
          SPACE_MEMBERS_ID,
          [Query.equal("spaceId", space.$id)]
        );
        for (const sm of spaceMembers.documents) {
          await databases.deleteDocument(DATABASE_ID, SPACE_MEMBERS_ID, sm.$id);
        }
        // Delete the space
        await databases.deleteDocument(DATABASE_ID, SPACES_ID, space.$id);
      }

      // Delete all members
      for (const member of members.documents) {
        await databases.deleteDocument(DATABASE_ID, MEMBERS_ID, member.$id);
      }

      // Delete all custom columns
      for (const customColumn of customColumns.documents) {
        await databases.deleteDocument(DATABASE_ID, CUSTOM_COLUMNS_ID, customColumn.$id);
      }

      // Delete all default column settings
      for (const setting of defaultColumnSettings.documents) {
        await databases.deleteDocument(DATABASE_ID, DEFAULT_COLUMN_SETTINGS_ID, setting.$id);
      }

      // Finally delete the workspace
      await databases.deleteDocument(DATABASE_ID, WORKSPACES_ID, workspaceId);

      return c.json({ data: { $id: workspaceId } });
    } catch {
      return c.json({ error: "Failed to delete workspace and related data" }, 500);
    }
  })
  .post("/:workspaceId/reset-invite-code", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");

    const { workspaceId } = c.req.param();

    // Check if this workspace belongs to an organization
    const workspace = await databases.getDocument<Workspace>(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId
    );

    // GATE: Block invite code reset for ORG workspaces
    // ORG workspaces should add members through org-level management
    if (workspace.organizationId) {
      return c.json({
        error: "Invite codes are disabled for organization workspaces. Members must be added through organization management.",
        code: "ORG_INVITE_DISABLED",
      }, 400);
    }

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    // Verify reset permissions - support both legacy and new roles
    if (!member || (
      member.role !== MemberRole.ADMIN &&
      member.role !== MemberRole.OWNER &&
      member.role !== WorkspaceMemberRole.WS_ADMIN
    )) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const updatedWorkspace = await databases.updateDocument(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId,
      {
        inviteCode: generateInviteCode(6),
        lastModifiedBy: user.$id,
      }
    );

    return c.json({ data: updatedWorkspace });
  })
  .post(
    "/:workspaceId/join",
    sessionMiddleware,
    zValidator("json", z.object({ code: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.param();
      const { code } = c.req.valid("json");

      const databases = c.get("databases");
      const user = c.get("user");

      // GATE: Block ORG accounts from using invite codes
      // ORG accounts must add members through org-level management
      if (user.prefs?.accountType === "ORG") {
        return c.json({
          error: "Organization accounts cannot join workspaces via invite code. Members must be added through organization management.",
          code: "ORG_INVITE_DISABLED",
        }, 400);
      }

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (member) {
        return c.json({ error: "Already a member" }, 400);
      }

      const workspace = await databases.getDocument<Workspace>(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId
      );

      if (workspace.inviteCode !== code) {
        return c.json({ error: "Invalid invite code" }, 400);
      }

      await databases.createDocument(DATABASE_ID, MEMBERS_ID, ID.unique(), {
        workspaceId,
        userId: user.$id,
        role: MemberRole.MEMBER,
      });

      return c.json({ data: workspace });
    }
  )
  .get("/:workspaceId/analytics", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { workspaceId } = c.req.param();

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));

    // PERFORMANCE OPTIMIZED: Fetch tasks and members IN PARALLEL (they are independent)
    const [allTasks, workspaceMembers] = await Promise.all([
      databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.limit(5000),
          Query.select(["status", "priority", "dueDate", "assigneeIds", "$createdAt", "$updatedAt"])
        ]
      ),
      databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId)]
      ),
    ]);

    const tasks = allTasks.documents;

    // Monthly data for difference/trend calculations
    const thisMonthTasks = tasks.filter(t => new Date(t.$createdAt) >= thisMonthStart);
    const lastMonthTasks = tasks.filter(t => {
      const createdDate = new Date(t.$createdAt);
      return createdDate >= lastMonthStart && createdDate < thisMonthStart;
    });

    // 1. Basic Counts - ALL-TIME totals for dashboard stat cards
    const taskCount = tasks.length;
    const taskDifference = thisMonthTasks.length - lastMonthTasks.length;

    // 2. Assigned Tasks (Current User/Member) - all-time
    const assignedTaskCount = tasks.filter(t => t.assigneeIds?.includes(member.$id)).length;
    const assignedTaskDifference =
      thisMonthTasks.filter(t => t.assigneeIds?.includes(member.$id)).length -
      lastMonthTasks.filter(t => t.assigneeIds?.includes(member.$id)).length;

    // 3. Status Distribution - ALL-TIME counts
    const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE);
    const incompleteTasks = tasks.filter(t => t.status !== TaskStatus.DONE);

    const completedTaskCount = completedTasks.length;
    const completedTaskDifference =
      thisMonthTasks.filter(t => t.status === TaskStatus.DONE).length -
      lastMonthTasks.filter(t => t.status === TaskStatus.DONE).length;

    const incompleteTaskCount = incompleteTasks.length;
    const incompleteTaskDifference =
      thisMonthTasks.filter(t => t.status !== TaskStatus.DONE).length -
      lastMonthTasks.filter(t => t.status !== TaskStatus.DONE).length;

    // 4. Overdue Tasks - all incomplete tasks past due date
    const overdueTaskCount = incompleteTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;
    const overdueTaskDifference =
      thisMonthTasks.filter(t => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now).length -
      lastMonthTasks.filter(t => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < now).length;

    // 5. Member Aggregations
    const memberDocs = workspaceMembers.documents;

    // Build a map of member stats to avoid O(N*M) nested filters
    const memberStatsMap = new Map<string, { total: number; completed: number }>();
    tasks.forEach(task => {
      task.assigneeIds?.forEach((id: string) => {
        const stats = memberStatsMap.get(id) || { total: 0, completed: 0 };
        stats.total++;
        if (task.status === TaskStatus.DONE) {
          stats.completed++;
        }
        memberStatsMap.set(id, stats);
      });
    });

    const memberWorkload = memberDocs.map(m => {
      const stats = memberStatsMap.get(m.$id) || { total: 0, completed: 0 };
      return {
        id: m.$id,
        userId: m.userId,
        tasks: stats.total,
        completedTasks: stats.completed,
      };
    }).filter(m => m.tasks > 0).sort((a, b) => b.tasks - a.tasks).slice(0, 4);

    const contributionData = memberDocs.map(m => {
      const stats = memberStatsMap.get(m.$id) || { total: 0, completed: 0 };
      return {
        id: m.$id,
        userId: m.userId,
        completed: stats.completed,
        total: stats.total,
      };
    }).filter(m => m.total > 0).sort((a, b) => b.completed - a.completed).slice(0, 6);

    // 6. Rich Aggregations for Charts
    const statusDistribution = [
      { id: "completed", name: "Done", value: completedTasks.length, color: "#22c55e" },
      { id: "in-progress", name: "In Progress", value: tasks.filter(t => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW").length, color: "#2663ec" },
      { id: "todo", name: "To Do", value: tasks.filter(t => t.status === "TODO" || t.status === "ASSIGNED").length, color: "#e5e7eb" },
    ];

    const priorityDistribution = [
      { name: "URGENT", count: tasks.filter(t => t.priority === "URGENT").length, fill: "#ef4444" },
      { name: "HIGH", count: tasks.filter(t => t.priority === "HIGH").length, fill: "#f87171" },
      { name: "MEDIUM", count: tasks.filter(t => t.priority === "MEDIUM").length, fill: "#eab308" },
      { name: "LOW", count: tasks.filter(t => t.priority === "LOW").length, fill: "#22c55e" },
    ];

    // Monthly data for last 6 months
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const mName = format(monthDate, "MMM");

      const monthTasks = tasks.filter(t => {
        const createdDate = new Date(t.$createdAt);
        return createdDate >= mStart && createdDate <= mEnd;
      });
      const mCompleted = monthTasks.filter(t => t.status === TaskStatus.DONE).length;

      monthlyData.push({
        name: mName,
        total: monthTasks.length,
        completed: mCompleted
      });
    }

    return c.json({
      data: {
        taskCount,
        taskDifference,
        assignedTaskCount,
        assignedTaskDifference,
        completedTaskCount,
        completedTaskDifference,
        incompleteTaskCount,
        incompleteTaskDifference,
        overdueTaskCount,
        overdueTaskDifference,
        statusDistribution,
        priorityDistribution,
        monthlyData,
        memberWorkload,
        contributionData,
      },
    });
  });

export default app;
