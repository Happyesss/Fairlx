import { useState, useEffect } from "react";
import type { SprintStatus, WorkItemType, WorkItemStatus, WorkItemPriority } from "@/features/sprints/types";
import type { TaskStatus, TaskPriority } from "@/features/tasks/types";
import type { 
    ProjectStatus, 
    BoardType 
} from "@/features/projects/types";
import type { 
    ProgramStatus, 
    ProgramPriority
} from "@/features/programs/types";
import type { SpaceVisibility } from "@/features/spaces/types";
import type { ActivityType } from "@/features/audit-logs/types";

/**
 * IMPORTANT: Use literal strings for status and priority with 'as' assertions 
 * using imported TYPES (not objects) to avoid circular dependencies 
 * with the types file, which can cause runtime ReferenceErrors in Next.js SSR.
 */

export const IS_TOUR_ACTIVE_KEY = "fairlx_tour_active";

export const DUMMY_SPRINTS = {
    documents: [
        {
            $id: "s1",
            name: "Sprint 1: Core Foundation",
            workspaceId: "dummy",
            projectId: "p1",
            status: "COMPLETED" as SprintStatus,
            position: 1000,
            startDate: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "sprints",
            $databaseId: "main",
            $permissions: [],
        },
        {
            $id: "s2",
            name: "Sprint 2: AI Engine",
            workspaceId: "dummy",
            projectId: "p1",
            status: "ACTIVE" as SprintStatus,
            position: 2000,
            startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "sprints",
            $databaseId: "main",
            $permissions: [],
        },
        {
            $id: "s3",
            name: "Sprint 3: Mobile Experience",
            workspaceId: "dummy",
            projectId: "p1",
            status: "PLANNED" as SprintStatus,
            position: 3000,
            startDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "sprints",
            $databaseId: "main",
            $permissions: [],
        }
    ],
    total: 3
};

export const DUMMY_WORK_ITEMS = {
    documents: [
        {
            $id: "w1",
            title: "Architect System Core",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-1",
            sprintId: "s1",
            status: "DONE" as WorkItemStatus,
            priority: "URGENT" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m1"],
            dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            position: 1000,
            assignees: [{ $id: "m1", name: "Surendra", email: "surendra@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w2",
            title: "Implement Real-time Analytics",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-2",
            sprintId: "s2",
            status: "IN_PROGRESS" as WorkItemStatus,
            priority: "HIGH" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m1"],
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            position: 2000,
            assignees: [{ $id: "m1", name: "Surendra", email: "surendra@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: true,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w3",
            title: "AI Model Integration",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-3",
            sprintId: "s2",
            status: "IN_REVIEW" as WorkItemStatus,
            priority: "URGENT" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m2"],
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            position: 3000,
            assignees: [{ $id: "m2", name: "Alex Chen", email: "alex@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: true,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w4",
            title: "User Authentication Flow",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-4",
            sprintId: "s1",
            status: "DONE" as WorkItemStatus,
            priority: "MEDIUM" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m1"],
            dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            position: 4000,
            assignees: [{ $id: "m1", name: "Surendra", email: "surendra@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w5",
            title: "Responsive Design Audit",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-5",
            sprintId: "s2",
            status: "TODO" as WorkItemStatus,
            priority: "LOW" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m3"],
            dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
            position: 5000,
            assignees: [{ $id: "m3", name: "Sarah Miller", email: "sarah@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w6",
            title: "Database Migration",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-6",
            sprintId: "s2",
            status: "IN_PROGRESS" as WorkItemStatus,
            priority: "HIGH" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m1"],
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            position: 6000,
            assignees: [{ $id: "m1", name: "Surendra", email: "surendra@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w7",
            title: "Billing System API",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-7",
            sprintId: "s3",
            status: "TODO" as WorkItemStatus,
            priority: "MEDIUM" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m2"],
            dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
            position: 7000,
            assignees: [{ $id: "m2", name: "Alex Chen", email: "alex@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w8",
            title: "Performance Benchmarking",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-8",
            sprintId: "s2",
            status: "TODO" as WorkItemStatus,
            priority: "LOW" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m1"],
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            position: 8000,
            assignees: [{ $id: "m1", name: "Surendra", email: "surendra@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w9",
            title: "Marketing Website Copy",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-9",
            sprintId: "s1",
            status: "DONE" as WorkItemStatus,
            priority: "LOW" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m3"],
            dueDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
            position: 9000,
            assignees: [{ $id: "m3", name: "Sarah Miller", email: "sarah@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        },
        {
            $id: "w10",
            title: "GitHub Webhook Integration",
            workspaceId: "dummy",
            projectId: "p1",
            key: "FX-10",
            sprintId: "s2",
            status: "IN_PROGRESS" as WorkItemStatus,
            priority: "MEDIUM" as WorkItemPriority,
            type: "TASK" as WorkItemType, // This one is a string in Task, but WorkItemType in WorkItem
            epicId: null,
            assigneeIds: ["m2"],
            dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
            position: 10000,
            assignees: [{ $id: "m2", name: "Alex Chen", email: "alex@example.com" }],
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "work-items",
            $databaseId: "main",
            $permissions: [],
            flagged: false,
            storyPoints: 0,
            labels: [],
        }
    ],
    total: 10
};


export const isTourActive = () => {
    if (typeof window === "undefined") return false;
    const win = window as Window & { isFairlxTourActive?: boolean };
    const active = win.isFairlxTourActive === true || localStorage.getItem(IS_TOUR_ACTIVE_KEY) === "true";
    return active;
};

export const notifyTourChanged = () => {
    if (typeof window !== "undefined") {
        console.log("[Tour] Notifying tour state change...");
        window.dispatchEvent(new CustomEvent("fairlx-tour-changed"));
    }
};

export const useTourActive = () => {
    const [active, setActive] = useState(isTourActive());

    useEffect(() => {
        const handleEvent = () => {
            const current = isTourActive();
            console.log("[Tour] Hook detected change:", current);
            setActive(current);
        };
        window.addEventListener("storage", handleEvent);
        window.addEventListener("fairlx-tour-changed", handleEvent);
        return () => {
            window.removeEventListener("storage", handleEvent);
            window.removeEventListener("fairlx-tour-changed", handleEvent);
        };
    }, []);

    return active;
};

export const DUMMY_ANALYTICS = {
    taskCount: 24,
    taskDifference: 5,
    assignedTaskCount: 12,
    assignedTaskDifference: 2,
    completedTaskCount: 18,
    completedTaskDifference: 8,
    incompleteTaskCount: 6,
    incompleteTaskDifference: -3,
    overdueTaskCount: 2,
    overdueTaskDifference: 1,
    statusDistribution: [
        { id: "completed", name: "Done", value: 18, color: "#22c55e" },
        { id: "in-progress", name: "In Progress", value: 4, color: "#2663ec" },
        { id: "todo", name: "To Do", value: 2, color: "#e5e7eb" },
    ],
    priorityDistribution: [
        { name: "URGENT", count: 2, fill: "#ef4444" },
        { name: "HIGH", count: 6, fill: "#f87171" },
        { name: "MEDIUM", count: 12, fill: "#eab308" },
        { name: "LOW", count: 4, fill: "#22c55e" },
    ],
    monthlyData: [
        { name: "Jan", total: 10, completed: 8 },
        { name: "Feb", total: 15, completed: 12 },
        { name: "Mar", total: 12, completed: 10 },
        { name: "Apr", total: 20, completed: 15 },
        { name: "May", total: 25, completed: 20 },
        { name: "Jun", total: 24, completed: 18 },
    ],
    memberWorkload: [
        { id: "m1", userId: "u1", tasks: 8, completedTasks: 6 },
        { id: "m2", userId: "u2", tasks: 6, completedTasks: 4 },
    ],
    contributionData: [
        { id: "m1", userId: "u1", completed: 6, total: 8 },
        { id: "m2", userId: "u2", completed: 4, total: 6 },
    ],
};

export const DUMMY_PROJECT_ANALYTICS = {
    ...DUMMY_ANALYTICS,
    projectTaskCount: 12,
    projectTaskDifference: 3,
};

export const DUMMY_TASKS = {
    documents: [
        { $id: "t1", title: "Design system refresh", status: "DONE" as TaskStatus, priority: "MEDIUM" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 1000, workspaceId: "dummy", projectId: "p1", key: "T-1", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t2", title: "Setup CI/CD pipeline", status: "IN_PROGRESS" as TaskStatus, priority: "URGENT" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 2000, workspaceId: "dummy", projectId: "p1", key: "T-2", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t3", title: "User interview sessions", status: "TODO" as TaskStatus, priority: "MEDIUM" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 3000, workspaceId: "dummy", projectId: "p2", key: "T-3", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t4", title: "Landing page SEO audit", status: "DONE" as TaskStatus, priority: "LOW" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 4000, workspaceId: "dummy", projectId: "p2", key: "T-4", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t5", title: "Database migration", status: "IN_PROGRESS" as TaskStatus, priority: "HIGH" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 5000, workspaceId: "dummy", projectId: "p1", key: "T-5", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t6", title: "API Rate Limiting", status: "IN_REVIEW" as TaskStatus, priority: "HIGH" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 6000, workspaceId: "dummy", projectId: "p1", key: "T-6", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t7", title: "Mobile App Dark Mode", status: "TODO" as TaskStatus, priority: "LOW" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 7000, workspaceId: "dummy", projectId: "p3", key: "T-7", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t8", title: "Wallet Integration", status: "IN_PROGRESS" as TaskStatus, priority: "URGENT" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 8000, workspaceId: "dummy", projectId: "p1", key: "T-8", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t9", title: "Email Template Redesign", status: "DONE" as TaskStatus, priority: "MEDIUM" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 9000, workspaceId: "dummy", projectId: "p2", key: "T-9", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t10", title: "Security Headers Audit", status: "DONE" as TaskStatus, priority: "LOW" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 10000, workspaceId: "dummy", projectId: "p4", key: "T-10", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t11", title: "Multi-tenancy Support", status: "TODO" as TaskStatus, priority: "HIGH" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 11000, workspaceId: "dummy", projectId: "p1", key: "T-11", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t12", title: "SVG Icon Set Update", status: "DONE" as TaskStatus, priority: "LOW" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 12000, workspaceId: "dummy", projectId: "p2", key: "T-12", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t13", title: "Redis Cache Optimization", status: "IN_PROGRESS" as TaskStatus, priority: "MEDIUM" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 13000, workspaceId: "dummy", projectId: "p1", key: "T-13", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t14", title: "Documentation Site Refresh", status: "TODO" as TaskStatus, priority: "MEDIUM" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 14000, workspaceId: "dummy", projectId: "p5", key: "T-14", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
        { $id: "t15", title: "Analytics Dashboard V2", status: "IN_REVIEW" as TaskStatus, priority: "URGENT" as TaskPriority, type: "TASK" as WorkItemType, flagged: false, dueDate: new Date().toISOString(), assigneeId: "current-user", assigneeIds: ["current-user"], position: 15000, workspaceId: "dummy", projectId: "p1", key: "T-15", $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), $collectionId: "tasks", $databaseId: "main", $permissions: [] },
    ],
    total: 15,
};

export const DUMMY_PROGRAMS = {
    documents: [
        { 
            $id: "pr1", 
            name: "Q3 Product Launch", 
            description: "All hands on deck for the big release.", 
            workspaceId: "dummy", 
            status: "ACTIVE" as ProgramStatus, 
            priority: "HIGH" as ProgramPriority, 
            color: "#3b82f6", 
            imageUrl: "", 
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            milestoneCount: 8,
            createdBy: "u1",
            $collectionId: "programs",
            $databaseId: "main",
            $permissions: [],
            $createdAt: new Date().toISOString(), 
            $updatedAt: new Date().toISOString() 
        },
        { 
            $id: "pr2", 
            name: "Global Expansion", 
            description: "Scaling Fairlx to new markets.", 
            workspaceId: "dummy", 
            status: "ACTIVE" as ProgramStatus, 
            priority: "MEDIUM" as ProgramPriority, 
            color: "#ec4899", 
            imageUrl: "", 
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            milestoneCount: 12,
            createdBy: "u1",
            $collectionId: "programs",
            $databaseId: "main",
            $permissions: [],
            $createdAt: new Date().toISOString(), 
            $updatedAt: new Date().toISOString() 
        },
    ],
    total: 2,
};

export const DUMMY_PROJECT_DETAIL = {
    $id: "p1",
    name: "Fairlx",
    description: "Building the world's most advanced AI-powered project management platform.",
    imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Fairlx&backgroundColor=3b82f6",
    workspaceId: "dummy",
    workflowId: "",
    spaceId: undefined,
    key: "FX",
    color: "#3b82f6",
    boardType: "KANBAN" as BoardType,
    status: "ACTIVE" as ProjectStatus,
    customWorkItemTypes: [],
    customPriorities: [],
    customLabels: [],
    $collectionId: "projects",
    $databaseId: "main",
    $permissions: [],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
};

export const DUMMY_PROJECTS = {
    documents: [
        { $id: "p1", name: "Fairlx", description: "Building the world's most advanced AI-powered project management platform.", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Fairlx&backgroundColor=3b82f6", workspaceId: "dummy", workflowId: "", spaceId: undefined, key: "FX", color: "#3b82f6", boardType: "KANBAN" as BoardType, status: "ACTIVE" as ProjectStatus, customWorkItemTypes: [], customPriorities: [], customLabels: [], $collectionId: "projects", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "p2", name: "Marketing Campaign", description: "Strategic marketing and brand awareness.", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Marketing&backgroundColor=ec4899", workspaceId: "dummy", workflowId: "", spaceId: undefined, key: "MC", color: "#ec4899", boardType: "KANBAN" as BoardType, status: "ACTIVE" as ProjectStatus, customWorkItemTypes: [], customPriorities: [], customLabels: [], $collectionId: "projects", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "p3", name: "Mobile App Redesign", description: "Redesigning the mobile experience for modern users.", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Mobile&backgroundColor=8b5cf6", workspaceId: "dummy", workflowId: "", spaceId: undefined, key: "MA", color: "#8b5cf6", boardType: "KANBAN" as BoardType, status: "ACTIVE" as ProjectStatus, customWorkItemTypes: [], customPriorities: [], customLabels: [], $collectionId: "projects", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "p4", name: "Fairlx AI Engine", description: "Core AI infrastructure and LLM integration.", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=AI&backgroundColor=10b981", workspaceId: "dummy", workflowId: "", spaceId: undefined, key: "AI", color: "#10b981", boardType: "KANBAN" as BoardType, status: "ACTIVE" as ProjectStatus, customWorkItemTypes: [], customPriorities: [], customLabels: [], $collectionId: "projects", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "p5", name: "Internal Docs", description: "Company-wide documentation and knowledge base.", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Docs&backgroundColor=f59e0b", workspaceId: "dummy", workflowId: "", spaceId: undefined, key: "ID", color: "#f59e0b", boardType: "KANBAN" as BoardType, status: "ACTIVE" as ProjectStatus, customWorkItemTypes: [], customPriorities: [], customLabels: [], $collectionId: "projects", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
    ],
    total: 5,
};

export const DUMMY_SPACES = {
    documents: [
        { $id: "s1", name: "Engineering", key: "ENG", workspaceId: "dummy", color: "#3b82f6", imageUrl: "", visibility: "PUBLIC" as SpaceVisibility, parentSpaceId: null, description: null, teamCount: 3, projectCount: 8, $collectionId: "spaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "s2", name: "Design", key: "DSN", workspaceId: "dummy", color: "#ec4899", imageUrl: "", visibility: "PUBLIC" as SpaceVisibility, parentSpaceId: null, description: null, teamCount: 2, projectCount: 4, $collectionId: "spaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "s3", name: "Growth", key: "GRW", workspaceId: "dummy", color: "#8b5cf6", imageUrl: "", visibility: "PUBLIC" as SpaceVisibility, parentSpaceId: null, description: null, teamCount: 1, projectCount: 3, $collectionId: "spaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "s4", name: "Product", key: "PRD", workspaceId: "dummy", color: "#10b981", imageUrl: "", visibility: "PUBLIC" as SpaceVisibility, parentSpaceId: null, description: null, teamCount: 2, projectCount: 5, $collectionId: "spaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "s5", name: "Customer Success", key: "CS", workspaceId: "dummy", color: "#f59e0b", imageUrl: "", visibility: "PUBLIC" as SpaceVisibility, parentSpaceId: null, description: null, teamCount: 1, projectCount: 2, $collectionId: "spaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
    ],
    total: 5,
};

export const DUMMY_WORKSPACES = {
    documents: [
        { $id: "w-dummy-1", name: "Stemlen", imageUrl: "", userId: "dummy", $collectionId: "workspaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
        { $id: "w-dummy-2", name: "Fairlx Enterprise", imageUrl: "", userId: "dummy", $collectionId: "workspaces", $databaseId: "main", $permissions: [], $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() },
    ],
    total: 2,
};

export const DUMMY_ACTIVITY_LOGS = {
    data: [
        {
            id: "log1",
            type: "WORK_ITEM" as ActivityType,
            action: "updated",
            description: "moved 'Architect System Core' to DONE",
            userId: "u1",
            userName: "Surendra",
            userImageUrl: "",
            entityName: "",
            projectId: "p1",
            workspaceId: "dummy",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "log2",
            type: "WORK_ITEM" as ActivityType,
            action: "created",
            description: "created task 'GitHub Webhook Integration'",
            userId: "u2",
            userName: "Alex Chen",
            userImageUrl: "",
            entityName: "",
            projectId: "p1",
            workspaceId: "dummy",
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "log3",
            type: "SPRINT" as ActivityType,
            action: "updated",
            description: "completed sprint 'Core Foundation'",
            userId: "u1",
            userName: "Surendra",
            userImageUrl: "",
            entityName: "",
            projectId: "p1",
            workspaceId: "dummy",
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "log4",
            type: "WORK_ITEM" as ActivityType,
            action: "updated",
            description: "assigned 'Implement Real-time Analytics' to Sarah Miller",
            userId: "u1",
            userName: "Surendra",
            userImageUrl: "",
            entityName: "",
            projectId: "p1",
            workspaceId: "dummy",
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "log5",
            type: "PROJECT" as ActivityType,
            action: "created",
            description: "launched project 'Fairlx'",
            userId: "u1",
            userName: "Surendra",
            userImageUrl: "",
            entityName: "",
            projectId: "p1",
            workspaceId: "dummy",
            timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
    ],
    total: 5,
    hasMore: false,
    nextCursor: undefined,
};

export const DUMMY_DOCUMENTS = {
    documents: [
        {
            $id: "doc1",
            title: "Fairlx Product Requirements Document (PRD)",
            category: "PRD",
            description: "Core requirements for the Fairlx AI engine and workspace architecture.",
            tags: ["core", "ai", "roadmap"],
            fileId: "dummy-f1",
            mimeType: "application/pdf",
            projectId: "p1",
            workspaceId: "dummy",
            $createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "documents",
            $databaseId: "main",
            $permissions: [],
        },
        {
            $id: "doc2",
            title: "Design System Guidelines",
            category: "UI DESIGN",
            description: "Visual identity and component library documentation.",
            tags: ["design", "components"],
            fileId: "dummy-f2",
            mimeType: "application/pdf",
            projectId: "p1",
            workspaceId: "dummy",
            $createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            $updatedAt: new Date().toISOString(),
            $collectionId: "documents",
            $databaseId: "main",
            $permissions: [],
        }
    ],
    total: 2
};

export const DUMMY_PROJECT_AI_CONTEXT = {
    project: {
        id: "p1",
        name: "Fairlx",
        description: "Building the world's most advanced AI-powered project management platform.",
        workspaceId: "dummy",
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    documents: [
        {
            id: "doc1",
            name: "Fairlx Product Requirements Document (PRD)",
            category: "PRD",
            description: "Core requirements for the Fairlx AI engine and workspace architecture.",
            tags: ["core", "ai", "roadmap"],
            extractedText: "Fairlx is an AI-first project management tool. Key features include reactive dummy data, wallet-based billing, and multi-tenant workspaces...",
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        }
    ],
    tasks: [
        {
            id: "w1",
            name: "Architect System Core",
            status: "DONE",
            priority: "URGENT",
            assigneeName: "Surendra",
            dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "w2",
            name: "Implement Real-time Analytics",
            status: "IN_PROGRESS",
            priority: "HIGH",
            assigneeName: "Surendra",
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }
    ],
    members: [
        { id: "m1", userId: "u1", name: "Surendra", role: "ADMIN", tasksAssigned: 8 },
        { id: "m2", userId: "u2", name: "Alex Chen", role: "MEMBER", tasksAssigned: 6 }
    ],
    summary: {
        totalDocuments: 1,
        totalTasks: 2,
        totalMembers: 2,
        tasksByStatus: { "DONE": 1, "IN_PROGRESS": 1 },
        tasksByAssignee: { "u1": 1 },
        documentCategories: ["PRD"]
    }
};