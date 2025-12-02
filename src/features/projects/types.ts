import { Models } from "node-appwrite";

export type Project = Models.Document & {
  name: string;
  description?: string;
  imageUrl: string;
  workspaceId: string;
  deadline?: string;
  assignedTeamIds?: string[]; // Teams that can access this project
};
