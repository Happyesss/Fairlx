import { Models } from "node-appwrite";

// Team Visibility Options
export enum TeamVisibility {
  ALL = "ALL", // Visible to all workspace members
  PROGRAM_ONLY = "PROGRAM_ONLY", // Visible only to program members
  TEAM_ONLY = "TEAM_ONLY", // Visible only to team members
}

// Team Member Role (Basic roles, extended by custom roles)
export enum TeamMemberRole {
  LEAD = "LEAD", // Team lead with additional permissions
  MEMBER = "MEMBER", // Regular team member
  CUSTOM = "CUSTOM", // Custom role with specific permissions
}

// Granular Permissions for Teams
export enum TeamPermission {
  // Task Management
  VIEW_TASKS = "VIEW_TASKS",
  CREATE_TASKS = "CREATE_TASKS",
  EDIT_TASKS = "EDIT_TASKS",
  DELETE_TASKS = "DELETE_TASKS",
  ASSIGN_TASKS = "ASSIGN_TASKS",
  
  // Sprint Management
  VIEW_SPRINTS = "VIEW_SPRINTS",
  CREATE_SPRINTS = "CREATE_SPRINTS",
  EDIT_SPRINTS = "EDIT_SPRINTS",
  DELETE_SPRINTS = "DELETE_SPRINTS",
  
  // Member Management
  VIEW_MEMBERS = "VIEW_MEMBERS",
  ADD_MEMBERS = "ADD_MEMBERS",
  REMOVE_MEMBERS = "REMOVE_MEMBERS",
  CHANGE_MEMBER_ROLES = "CHANGE_MEMBER_ROLES",
  
  // Team Settings
  EDIT_TEAM_SETTINGS = "EDIT_TEAM_SETTINGS",
  DELETE_TEAM = "DELETE_TEAM",
  MANAGE_ROLES = "MANAGE_ROLES",
  
  // Reports & Analytics
  VIEW_REPORTS = "VIEW_REPORTS",
  EXPORT_DATA = "EXPORT_DATA",
}

// Permission Categories for UI
export const PERMISSION_CATEGORIES = {
  TASKS: {
    label: "Task Management",
    permissions: [
      { key: TeamPermission.VIEW_TASKS, label: "View Tasks", description: "View all team tasks" },
      { key: TeamPermission.CREATE_TASKS, label: "Create Tasks", description: "Create new tasks" },
      { key: TeamPermission.EDIT_TASKS, label: "Edit Tasks", description: "Edit existing tasks" },
      { key: TeamPermission.DELETE_TASKS, label: "Delete Tasks", description: "Delete tasks" },
      { key: TeamPermission.ASSIGN_TASKS, label: "Assign Tasks", description: "Assign tasks to members" },
    ],
  },
  SPRINTS: {
    label: "Sprint Management",
    permissions: [
      { key: TeamPermission.VIEW_SPRINTS, label: "View Sprints", description: "View all sprints" },
      { key: TeamPermission.CREATE_SPRINTS, label: "Create Sprints", description: "Create new sprints" },
      { key: TeamPermission.EDIT_SPRINTS, label: "Edit Sprints", description: "Edit sprint details" },
      { key: TeamPermission.DELETE_SPRINTS, label: "Delete Sprints", description: "Delete sprints" },
    ],
  },
  MEMBERS: {
    label: "Member Management",
    permissions: [
      { key: TeamPermission.VIEW_MEMBERS, label: "View Members", description: "View team members" },
      { key: TeamPermission.ADD_MEMBERS, label: "Add Members", description: "Add new members to team" },
      { key: TeamPermission.REMOVE_MEMBERS, label: "Remove Members", description: "Remove members from team" },
      { key: TeamPermission.CHANGE_MEMBER_ROLES, label: "Change Roles", description: "Change member roles" },
    ],
  },
  SETTINGS: {
    label: "Team Settings",
    permissions: [
      { key: TeamPermission.EDIT_TEAM_SETTINGS, label: "Edit Settings", description: "Edit team settings" },
      { key: TeamPermission.DELETE_TEAM, label: "Delete Team", description: "Delete the team" },
      { key: TeamPermission.MANAGE_ROLES, label: "Manage Roles", description: "Create and edit custom roles" },
    ],
  },
  REPORTS: {
    label: "Reports & Analytics",
    permissions: [
      { key: TeamPermission.VIEW_REPORTS, label: "View Reports", description: "View team reports and analytics" },
      { key: TeamPermission.EXPORT_DATA, label: "Export Data", description: "Export team data" },
    ],
  },
} as const;

// Default permissions for built-in roles
export const DEFAULT_ROLE_PERMISSIONS: Record<TeamMemberRole, TeamPermission[]> = {
  [TeamMemberRole.LEAD]: Object.values(TeamPermission), // All permissions
  [TeamMemberRole.MEMBER]: [
    TeamPermission.VIEW_TASKS,
    TeamPermission.CREATE_TASKS,
    TeamPermission.EDIT_TASKS,
    TeamPermission.VIEW_SPRINTS,
    TeamPermission.VIEW_MEMBERS,
    TeamPermission.VIEW_REPORTS,
  ],
  [TeamMemberRole.CUSTOM]: [], // Custom roles define their own
};

// Custom Role type
export type CustomRole = Models.Document & {
  teamId: string;
  name: string;
  description?: string;
  color?: string; // For badge color
  permissions: TeamPermission[];
  isDefault?: boolean; // If true, assigned to new members by default
  createdBy: string;
  lastModifiedBy?: string;
};

// Team Member Availability
export enum TeamMemberAvailability {
  FULL_TIME = "FULL_TIME",
  PART_TIME = "PART_TIME",
  CONTRACTOR = "CONTRACTOR",
}

// Base Team type (from Appwrite)
export type Team = Models.Document & {
  name: string;
  description?: string;
  workspaceId: string;
  programId?: string;
  teamLeadId?: string;
  imageUrl?: string;
  visibility: TeamVisibility;
  createdBy: string;
  lastModifiedBy?: string;
  memberCount?: number; // Added when listing teams
};

// Team Member type (from Appwrite)
export type TeamMember = Models.Document & {
  teamId: string;
  memberId: string; // References members collection (userId)
  role: TeamMemberRole;
  customRoleId?: string; // Reference to custom role if role is CUSTOM
  availability: TeamMemberAvailability;
  joinedAt: string;
  leftAt?: string;
  isActive: boolean;
  lastModifiedBy?: string;
};

// Populated Team with additional data
export type PopulatedTeam = Team & {
  // Team lead information
  teamLead?: {
    $id: string;
    userId: string;
    name: string;
    email: string;
    profileImageUrl?: string;
  };
  // Program information
  program?: {
    $id: string;
    name: string;
    description?: string;
  };
  // Team statistics
  memberCount?: number;
  activeTaskCount?: number;
  completedTaskCount?: number;
};

// Populated Team Member with user details
export type PopulatedTeamMember = TeamMember & {
  // User information from members collection
  user: {
    $id: string;
    userId: string;
    name: string;
    email: string;
    profileImageUrl?: string;
    role: string; // Workspace role (ADMIN/MEMBER)
  };
  // Team information
  team: {
    $id: string;
    name: string;
    imageUrl?: string;
  };
};

// Team with members list
export type TeamWithMembers = Team & {
  members: PopulatedTeamMember[];
  memberCount: number;
};

// Team analytics/statistics
export type TeamAnalytics = {
  teamId: string;
  teamName: string;
  totalMembers: number;
  activeMembers: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  totalTimeLogged: number; // in hours
  averageTaskCompletionTime: number; // in days
  velocity: number; // tasks completed per sprint
};

// Team capacity planning
export type TeamCapacity = {
  teamId: string;
  teamName: string;
  totalCapacity: number; // total hours available
  allocatedCapacity: number; // hours allocated to tasks
  availableCapacity: number; // remaining hours
  utilizationRate: number; // percentage (0-100)
  members: Array<{
    memberId: string;
    name: string;
    availability: TeamMemberAvailability;
    capacity: number;
    allocated: number;
    available: number;
  }>;
};

// Team performance metrics
export type TeamPerformance = {
  teamId: string;
  period: string; // e.g., "2024-Q1" or "Sprint 5"
  tasksCompleted: number;
  tasksCreated: number;
  averageCompletionTime: number;
  velocity: number;
  burndownRate: number;
  qualityScore: number; // based on bugs/rework
};

// Create/Update Team DTOs
export type CreateTeamData = {
  name: string;
  description?: string;
  workspaceId: string;
  programId?: string;
  teamLeadId?: string;
  imageUrl?: string;
  visibility?: TeamVisibility;
};

export type UpdateTeamData = Partial<CreateTeamData>;

// Create/Update Team Member DTOs
export type AddTeamMemberData = {
  teamId: string;
  memberId: string;
  role?: TeamMemberRole;
  availability?: TeamMemberAvailability;
};

export type UpdateTeamMemberData = {
  role?: TeamMemberRole;
  availability?: TeamMemberAvailability;
  isActive?: boolean;
};

// Team filter/query options
export type TeamFilters = {
  workspaceId?: string;
  programId?: string;
  visibility?: TeamVisibility;
  teamLeadId?: string;
  search?: string;
};

// Team member filter/query options
export type TeamMemberFilters = {
  teamId?: string;
  memberId?: string;
  role?: TeamMemberRole;
  availability?: TeamMemberAvailability;
  isActive?: boolean;
};
