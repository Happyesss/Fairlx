import { Hono } from "hono";
import { handle } from "hono/vercel";

import auth from "@/features/auth/server/route";
import members from "@/features/members/server/route";
import workspaces from "@/features/workspaces/server/route";
import projects from "@/features/projects/server/route";
import tasks from "@/features/tasks/server/route";
import timeLogs from "@/features/time-tracking/server/route";
import customColumns from "@/features/custom-columns/api/route";
import defaultColumnSettings from "@/features/default-column-settings/api/route";
import attachments from "@/features/attachments/api/route";
import notifications from "@/features/notifications/server/route";
import sprints from "@/features/sprints/server/route";
import workItems from "@/features/sprints/server/work-items-route";
import personalBacklog from "@/features/personal-backlog/server/route";

const app = new Hono().basePath("/api");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes = app
  .route("/auth", auth)
  .route("/workspaces", workspaces)
  .route("/members", members)
  .route("/projects", projects)
  .route("/tasks", tasks)
  .route("/timeLogs", timeLogs)
  .route("/custom-columns", customColumns)
  .route("/default-column-settings", defaultColumnSettings)
  .route("/attachments", attachments)
  .route("/notifications", notifications)
  .route("/sprints", sprints)
  .route("/work-items", workItems)
  .route("/personal-backlog", personalBacklog);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
