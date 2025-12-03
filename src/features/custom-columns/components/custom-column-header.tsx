"use client";

import * as React from "react";
import * as Icons from "react-icons/ai";
import * as BiIcons from "react-icons/bi";
import * as BsIcons from "react-icons/bs";
import * as FaIcons from "react-icons/fa";
import * as FiIcons from "react-icons/fi";
import * as HiIcons from "react-icons/hi";
import * as IoIcons from "react-icons/io5";
import * as MdIcons from "react-icons/md";
import * as RiIcons from "react-icons/ri";
import * as TbIcons from "react-icons/tb";
import { PlusIcon, MoreHorizontalIcon, ArrowUpDown, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";

import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { useDeleteCustomColumn } from "../api/use-delete-custom-column";

import { CustomColumn } from "../types";

// Combine all icon sets
const allIcons = {
  ...Icons,
  ...BiIcons,
  ...BsIcons,
  ...FaIcons,
  ...FiIcons,
  ...HiIcons,
  ...IoIcons,
  ...MdIcons,
  ...RiIcons,
  ...TbIcons,
};

interface CustomColumnHeaderProps {
  customColumn: CustomColumn;
  taskCount: number;
  selectedCount?: number;
  onSelectAll?: (columnId: string, selected: boolean) => void;
  showSelection?: boolean;
  showDelete?: boolean;
  onSortByPriority?: (columnId: string) => void;
  onSortByDueDate?: (columnId: string) => void;
  sortDirection?: 'asc' | 'desc';
}

export const CustomColumnHeader = ({
  customColumn,
  showDelete = false,
  onSortByPriority,
  onSortByDueDate,
  sortDirection = 'asc',
}: CustomColumnHeaderProps) => {
  const { open } = useCreateTaskModal();
  const { mutate: deleteCustomColumn } = useDeleteCustomColumn();
  const [ConfirmDialog, confirm] = useConfirm(
    "Delete Column",
    "This will permanently delete the column and move all tasks in this column to 'TODO'. This action cannot be undone.",
    "destructive"
  );

  const IconComponent = allIcons[customColumn.icon as keyof typeof allIcons];

  const handleDelete = async () => {
    const ok = await confirm();
    if (!ok) return;

    deleteCustomColumn({
      param: { customColumnId: customColumn.$id }
    });
  };

  return (
    <>
      <ConfirmDialog />
      <div className="px-3 py-2 flex items-center justify-between mb-2">
        <div className="flex items-center gap-x-2">
          {IconComponent && (
            <IconComponent
              className="size-[18px]"
              style={{ color: customColumn.color }}
            />
          )}
          <h2 className="text-sm font-semibold text-gray-700">{customColumn.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={open} variant="ghost" size="icon" className="h-6 w-6 hover:bg-gray-100">
            <PlusIcon className="h-4 w-4 text-gray-500" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-gray-100">
                <MoreHorizontalIcon className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortByPriority?.(customColumn.$id)}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort by Priority ({sortDirection === 'asc' ? 'Low→High' : 'High→Low'})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortByDueDate?.(customColumn.$id)}>
                <Calendar className="h-4 w-4 mr-2" />
                Sort by Due Date ({sortDirection === 'asc' ? 'Earliest' : 'Latest'})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {showDelete && (
            <Button
              onClick={handleDelete}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500 hover:text-red-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
