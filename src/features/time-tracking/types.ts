import { Models } from "node-appwrite";
import { Task } from "@/features/tasks/types";
import { Project } from "@/features/projects/types";

export type TimeLog = Models.Document & {
  taskId: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  logDate: string;
  loggedHours: number;
  description: string;
  startTime?: string;
  endTime?: string;
  user?: {
    userId: string;
    name: string;
    email: string;
  };
  task?: Task;
  project?: Project;
};

export type TimeEntry = {
  id: string;
  taskId: string;
  taskName: string;
  projectId: string;
  projectName: string;
  logDate: string;
  loggedHours: number;
  description: string;
  userName: string;
  userEmail: string;
};

export type TimesheetWeek = {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  entries: TimeEntry[];
};

export type UserTimesheet = {
  userId: string;
  userName: string;
  userEmail: string;
  weeks: TimesheetWeek[];
  totalHours: number;
};

export type EstimateVsActual = {
  taskId: string;
  taskName: string;
  projectName: string;
  estimatedHours: number;
  actualHours: number;
  variance: number;
  variancePercent: number;
  status: string;
};
