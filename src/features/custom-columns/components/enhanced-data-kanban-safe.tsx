"use client";

import React from "react";
import { DataKanban } from "@/features/tasks/components/data-kanban";

import { Task, TaskStatus } from "@/features/tasks/types";

interface SafeEnhancedDataKanbanProps {
  data: Task[] | undefined;
  onChange: (
    tasks: { $id: string; status: TaskStatus | string; position: number }[]
  ) => void;
  isAdmin?: boolean;
  members?: Array<{ $id: string; name: string }>;
}

export const SafeEnhancedDataKanban = ({
  data = [],
  onChange,
  isAdmin = false,
  members = []
}: SafeEnhancedDataKanbanProps) => {
  return (
    <>
      <DataKanban
        data={data || []}
        onChange={onChange}
        canCreateTasks={isAdmin}
        canEditTasks={isAdmin}
        canDeleteTasks={isAdmin}
        members={members}
      />
    </>
  );
};
