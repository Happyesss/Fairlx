"use client";

import { ArrowUpDown, MoreVertical } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { AssigneeAvatarGroup } from "./assignee-avatar-group";

import { Button } from "@/components/ui/button";

import { TaskActions } from "./task-actions";
// import { TaskDate } from "./task-date";
import { StatusDisplay } from "@/features/custom-columns/components/status-display";
import { PriorityBadge } from "./priority-selector";
import { LabelsDisplay } from "./label-management";

import { PopulatedTask } from "../types";

export const createColumns = (
  canEdit: boolean = true,
  canDelete: boolean = true
): ColumnDef<PopulatedTask>[] => [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Task Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const name = row.original.name;

        return <p className="line-clamp-1">{name}</p>;
      },
    },
    {
      accessorKey: "project",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Project
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const project = row.original.project;

        if (!project) {
          return <p className="text-sm text-muted-foreground">No Project</p>;
        }

        return (
          <div className="flex items-center gap-x-2 text-sm font-medium">
            <ProjectAvatar
              className="size-6"
              name={project.name}
              image={project.imageUrl}
            />
            <p className="line-clamp-1">{project.name}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "assignee",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Assignee
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const assignees = row.original.assignees?.length
          ? row.original.assignees
          : row.original.assignee
            ? [row.original.assignee]
            : [];

        if (assignees.length === 0) {
          return <p className="text-sm text-muted-foreground">Unassigned</p>;
        }

        const summaryText =
          assignees.length === 1
            ? assignees[0].name || assignees[0].email || "Unknown member"
            : `${assignees.length} assignees`;

        return (
          <div className="flex items-center gap-x-2 text-sm font-medium">
            <AssigneeAvatarGroup
              assignees={assignees}
              visibleCount={3}
              avatarClassName="size-6 border-2 border-white"
              fallbackClassName="text-xs"
              extraCountClassName="size-6 rounded-full bg-muted text-xs font-medium flex items-center justify-center border-2 border-white"
              popoverAlign="start"
              ariaLabel={`View ${assignees.length} assignees`}
            />
            <p className="line-clamp-1">{summaryText}</p>
          </div>
        );
      },
    },
    // {
    //   accessorKey: "dueDate",
    //   header: ({ column }) => {
    //     return (
    //       <Button
    //         variant="ghost"
    //         onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    //       >
    //         Due Date
    //         <ArrowUpDown className="ml-2 h-4 w-4" />
    //       </Button>
    //     );
    //   },
    //   cell: ({ row }) => {
    //     const dueDate = row.original.dueDate;

    //     return <TaskDate value={dueDate} />;
    //   },
    // },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const status = row.original.status;
        const projectId = row.original.projectId;

        return <StatusDisplay status={status} projectId={projectId} />;
      },
    },
    {
      accessorKey: "priority",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Priority
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const priority = row.original.priority;

        return priority ? <PriorityBadge priority={priority} /> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: "labels",
      header: "Labels",
      cell: ({ row }) => {
        const labels = row.original.labels;

        return labels && labels.length > 0 ? (
          <LabelsDisplay labels={labels} maxDisplay={2} />
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const id = row.original.$id;
        const projectId = row.original.projectId;

        return (
          <TaskActions
            id={id}
            projectId={projectId}
            canEdit={canEdit}
            canDelete={canDelete}
          >
            <Button variant="ghost" className="size-8 p-0">
              <MoreVertical className="size-4" />
            </Button>
          </TaskActions>
        );
      },
    },
  ];
