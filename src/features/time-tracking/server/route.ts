import { ID, Query } from "node-appwrite";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { startOfWeek, endOfWeek, format, parseISO } from "date-fns";

import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID, TIME_LOGS_ID, CUSTOM_COLUMNS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";

import { getMember } from "@/features/members/utils";
import { Project } from "@/features/projects/types";
import { Task, TaskStatus } from "@/features/tasks/types";
import { CustomColumn } from "@/features/custom-columns/types";

import {
  createTimeLogSchema,
  updateTimeLogSchema,
  timesheetQuerySchema,
  estimateVsActualQuerySchema
} from "../schemas";
import { TimeLog, TimeEntry, UserTimesheet, EstimateVsActual } from "../types";

const app = new Hono()
  .delete("/:timeLogId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { timeLogId } = c.req.param();

    const timeLog = await databases.getDocument<TimeLog>(
      DATABASE_ID,
      TIME_LOGS_ID,
      timeLogId
    );

    const member = await getMember({
      databases,
      workspaceId: timeLog.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Only allow users to delete their own time logs
    if (timeLog.userId !== user.$id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await databases.deleteDocument(DATABASE_ID, TIME_LOGS_ID, timeLogId);

    return c.json({ data: { $id: timeLog.$id } });
  })
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        taskId: z.string().nullish(),
        userId: z.string().nullish(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        projectId: z.string().nullish(),
      })
    ),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, taskId, userId, startDate, endDate, projectId } =
        c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("logDate"),
      ];

      if (taskId) {
        query.push(Query.equal("taskId", taskId));
      }

      if (userId) {
        query.push(Query.equal("userId", userId));
      }

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      if (startDate) {
        query.push(Query.greaterThanEqual("logDate", startDate));
      }

      if (endDate) {
        query.push(Query.lessThanEqual("logDate", endDate));
      }

      const timeLogs = await databases.listDocuments<TimeLog>(
        DATABASE_ID,
        TIME_LOGS_ID,
        query
      );

      const taskIds = timeLogs.documents.map((log) => log.taskId);
      const userIds = timeLogs.documents.map((log) => log.userId);
      const projectIds = timeLogs.documents.map((log) => log.projectId);

      const [tasks, projects, members] = await Promise.all([
        taskIds.length > 0
          ? databases.listDocuments<Task>(DATABASE_ID, TASKS_ID, [Query.contains("$id", taskIds)])
          : { documents: [] },
        projectIds.length > 0
          ? databases.listDocuments<Project>(DATABASE_ID, PROJECTS_ID, [Query.contains("$id", projectIds)])
          : { documents: [] },
        userIds.length > 0
          ? databases.listDocuments(DATABASE_ID, MEMBERS_ID, [Query.contains("userId", userIds)])
          : { documents: [] },
      ]);

      // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
      const memberUserIds = members.documents.map(m => m.userId);
      const userMap = await batchGetUsers(users, memberUserIds);

      const userDetails = members.documents
        .map((member) => {
          const userData = userMap.get(member.userId);
          if (!userData) return null;
          return {
            userId: member.userId,
            name: userData.name || userData.email,
            email: userData.email,
          };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      const populatedTimeLogs = timeLogs.documents.map((log) => {
        const task = tasks.documents.find((task) => task.$id === log.taskId);
        const project = projects.documents.find((project) => project.$id === log.projectId);
        const userDetail = userDetails.find((user) => user.userId === log.userId);

        return {
          ...log,
          task,
          project,
          user: userDetail,
        };
      });

      return c.json({ data: { ...timeLogs, documents: populatedTimeLogs } });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTimeLogSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId, logDate, loggedHours, description, startTime, endTime } =
        c.req.valid("json");

      // Get task to validate workspace access
      const task = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      const member = await getMember({
        databases,
        workspaceId: task.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const timeLog = await databases.createDocument(
        DATABASE_ID,
        TIME_LOGS_ID,
        ID.unique(),
        {
          taskId,
          userId: user.$id,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          logDate: format(logDate, "yyyy-MM-dd"),
          loggedHours,
          description,
          startTime,
          endTime,
        }
      );

      return c.json({ data: timeLog });
    }
  )
  .patch(
    "/:timeLogId",
    sessionMiddleware,
    zValidator("json", updateTimeLogSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { logDate, loggedHours, description, startTime, endTime } =
        c.req.valid("json");

      const { timeLogId } = c.req.param();

      const existingTimeLog = await databases.getDocument<TimeLog>(
        DATABASE_ID,
        TIME_LOGS_ID,
        timeLogId
      );

      const member = await getMember({
        databases,
        workspaceId: existingTimeLog.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Only allow users to edit their own time logs
      if (existingTimeLog.userId !== user.$id) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updateData: Partial<TimeLog> = {};

      if (logDate !== undefined) updateData.logDate = format(logDate, "yyyy-MM-dd");
      if (loggedHours !== undefined) updateData.loggedHours = loggedHours;
      if (description !== undefined) updateData.description = description;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      (updateData as Record<string, unknown>).lastModifiedBy = user.$id;

      const timeLog = await databases.updateDocument(
        DATABASE_ID,
        TIME_LOGS_ID,
        timeLogId,
        updateData
      );

      return c.json({ data: timeLog });
    }
  )
  .get(
    "/timesheet",
    sessionMiddleware,
    zValidator("query", timesheetQuerySchema),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, userId, startDate, endDate, projectId } =
        c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Default to current week if no date range provided
      const start = startDate ? parseISO(startDate) : startOfWeek(new Date());
      const end = endDate ? parseISO(endDate) : endOfWeek(new Date());

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.greaterThanEqual("logDate", format(start, "yyyy-MM-dd")),
        Query.lessThanEqual("logDate", format(end, "yyyy-MM-dd")),
        Query.orderDesc("logDate"),
      ];

      if (userId) {
        query.push(Query.equal("userId", userId));
      }

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      const timeLogs = await databases.listDocuments<TimeLog>(
        DATABASE_ID,
        TIME_LOGS_ID,
        query
      );

      // Get related data
      const taskIds = [...new Set(timeLogs.documents.map(log => log.taskId))];
      const userIds = [...new Set(timeLogs.documents.map(log => log.userId))];
      const projectIds = [...new Set(timeLogs.documents.map(log => log.projectId))];

      const [tasks, projects, members] = await Promise.all([
        taskIds.length > 0
          ? databases.listDocuments<Task>(DATABASE_ID, TASKS_ID, [Query.contains("$id", taskIds)])
          : { documents: [] },
        projectIds.length > 0
          ? databases.listDocuments<Project>(DATABASE_ID, PROJECTS_ID, [Query.contains("$id", projectIds)])
          : { documents: [] },
        userIds.length > 0
          ? databases.listDocuments(DATABASE_ID, MEMBERS_ID, [Query.contains("userId", userIds)])
          : { documents: [] },
      ]);

      // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
      const memberUserIds = members.documents.map(m => m.userId);
      const userMap = await batchGetUsers(users, memberUserIds);

      const userDetails = members.documents
        .map((member) => {
          const userData = userMap.get(member.userId);
          if (!userData) return null;
          return {
            userId: member.userId,
            name: userData.name || userData.email,
            email: userData.email,
          };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      // Group by user and week
      const userTimesheets: UserTimesheet[] = [];

      userDetails.forEach(userDetail => {
        const userLogs = timeLogs.documents.filter(log => log.userId === userDetail.userId);
        const weeks: { [key: string]: TimeEntry[] } = {};

        userLogs.forEach(log => {
          const logDate = parseISO(log.logDate);
          const weekStart = startOfWeek(logDate);
          const weekKey = format(weekStart, "yyyy-MM-dd");

          if (!weeks[weekKey]) {
            weeks[weekKey] = [];
          }

          const task = tasks.documents.find(t => t.$id === log.taskId);
          const project = projects.documents.find(p => p.$id === log.projectId);

          weeks[weekKey].push({
            id: log.$id,
            taskId: log.taskId,
            taskName: task?.name || "Unknown Task",
            projectId: log.projectId,
            projectName: project?.name || "Unknown Project",
            logDate: log.logDate,
            loggedHours: log.loggedHours,
            description: log.description,
            userName: userDetail.name,
            userEmail: userDetail.email,
          });
        });

        const weekData = Object.entries(weeks).map(([weekStartStr, entries]) => {
          const weekStart = parseISO(weekStartStr);
          const weekEnd = endOfWeek(weekStart);

          return {
            weekStart: format(weekStart, "yyyy-MM-dd"),
            weekEnd: format(weekEnd, "yyyy-MM-dd"),
            totalHours: entries.reduce((sum, entry) => sum + entry.loggedHours, 0),
            entries,
          };
        });

        const totalHours = userLogs.reduce((sum, log) => sum + log.loggedHours, 0);

        userTimesheets.push({
          userId: userDetail.userId,
          userName: userDetail.name,
          userEmail: userDetail.email,
          weeks: weekData,
          totalHours,
        });
      });

      return c.json({ data: userTimesheets });
    }
  )
  .get(
    "/estimates-vs-actuals",
    sessionMiddleware,
    zValidator("query", estimateVsActualQuerySchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, projectId, startDate, endDate } =
        c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Get tasks query
      const taskQuery = [Query.equal("workspaceId", workspaceId)];

      if (projectId) {
        taskQuery.push(Query.equal("projectId", projectId));
      }

      const tasks = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskQuery
      );

      // Get time logs for these tasks
      const taskIds = tasks.documents.map(task => task.$id);

      if (taskIds.length === 0) {
        return c.json({ data: [] });
      }

      const timeLogQuery = [
        Query.equal("workspaceId", workspaceId),
        Query.contains("taskId", taskIds),
      ];

      if (startDate) {
        timeLogQuery.push(Query.greaterThanEqual("logDate", startDate));
      }

      if (endDate) {
        timeLogQuery.push(Query.lessThanEqual("logDate", endDate));
      }

      const timeLogs = await databases.listDocuments<TimeLog>(
        DATABASE_ID,
        TIME_LOGS_ID,
        timeLogQuery
      );

      // Get projects for task names
      const projectIds = [...new Set(tasks.documents.map(task => task.projectId))];
      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectIds.length > 0 ? [Query.contains("$id", projectIds)] : []
      );

      // Get custom columns for proper status names
      const customColumns = await databases.listDocuments<CustomColumn>(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      // Helper function to get status display name
      const getStatusName = (status: string) => {
        // Check if it's a standard TaskStatus
        if (Object.values(TaskStatus).includes(status as TaskStatus)) {
          return status;
        }

        // Otherwise, look up in custom columns
        const customColumn = customColumns.documents.find(col => col.$id === status);
        return customColumn?.name || status;
      };

      // Calculate estimates vs actuals
      const estimatesVsActuals: EstimateVsActual[] = tasks.documents.map(task => {
        const taskTimeLogs = timeLogs.documents.filter(log => log.taskId === task.$id);
        const actualHours = taskTimeLogs.reduce((sum, log) => sum + log.loggedHours, 0);
        const estimatedHours = task.estimatedHours || 0;
        const variance = actualHours - estimatedHours;
        const variancePercent = estimatedHours > 0 ? (variance / estimatedHours) * 100 : 0;

        const project = projects.documents.find(p => p.$id === task.projectId);

        return {
          taskId: task.$id,
          taskName: task.name || "Untitled Task",
          projectName: project?.name || "Unknown Project",
          estimatedHours,
          actualHours,
          variance,
          variancePercent,
          status: getStatusName(task.status),
        };
      }).filter(item => item.estimatedHours > 0 || item.actualHours > 0); // Only show tasks with estimates or actuals

      return c.json({ data: estimatesVsActuals });
    }
  );

export default app;
