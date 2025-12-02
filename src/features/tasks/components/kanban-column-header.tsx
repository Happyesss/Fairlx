import {
  CircleCheckIcon,
  CircleDotDashedIcon,
  CircleDotIcon,
  CircleIcon,
  PlusIcon,
  MoreHorizontalIcon,
  CheckSquare,
  XSquare,
  ArrowUpDown,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { snakeCaseToTitleCase } from "@/lib/utils";

import { TaskStatus } from "../types";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";

const statusIconMap: Record<TaskStatus, React.ReactNode> = {
  [TaskStatus.ASSIGNED]: <CircleIcon className="size-[18px] text-red-400" />,
  [TaskStatus.IN_PROGRESS]: (
    <CircleDotDashedIcon className="size-[18px] text-yellow-400" />
  ),
  [TaskStatus.COMPLETED]: (
    <CircleDotIcon className="size-[18px] text-blue-400" />
  ),
  [TaskStatus.CLOSED]: (
    <CircleCheckIcon className="size-[18px] text-emerald-400" />
  ),
};

interface KanbanColumnHeaderProps {
  board: TaskStatus;
  taskCount: number;
  selectedCount?: number;
  onSelectAll?: (status: TaskStatus, selected: boolean) => void;
  showSelection?: boolean;
  onClearSelection?: (status: TaskStatus) => void;
  onSortByPriority?: (status: TaskStatus) => void;
  onSortByDueDate?: (status: TaskStatus) => void;
  canCreateTasks?: boolean;
  sortDirection?: 'asc' | 'desc';
}

export const KanbanColumnHeader = ({
  board,
  taskCount,
  selectedCount = 0,
  onSelectAll,
  showSelection = false,
  onClearSelection,
  onSortByPriority,
  onSortByDueDate,
  canCreateTasks = true,
  sortDirection = 'asc',
}: KanbanColumnHeaderProps) => {
  const { open } = useCreateTaskModal();

  const icon = statusIconMap[board];

  const isAllSelected = taskCount > 0 && selectedCount === taskCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < taskCount;

  return (
    <div className="px-3 py-2 flex items-center justify-between mb-2">
      <div className="flex items-center gap-x-2">
        {showSelection && (
          <Checkbox
            checked={isAllSelected}
            ref={(ref) => {
              // Checkbox component forwards a button ref; cast to HTMLInputElement to set indeterminate
              if (ref) (ref as HTMLInputElement).indeterminate = isPartiallySelected;
            }}
            onCheckedChange={(checked) => onSelectAll?.(board, !!checked)}
          />
        )}
        {icon}
        <h2 className="text-sm font-semibold text-gray-700">{snakeCaseToTitleCase(board)}</h2>
      </div>
      <div className="flex items-center gap-2">
        {canCreateTasks && (
          <Button onClick={open} variant="ghost" size="icon" className="h-6 w-6 hover:bg-gray-100">
            <PlusIcon className="h-4 w-4 text-gray-500" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-gray-100">
              <MoreHorizontalIcon className="h-4 w-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showSelection && (
              <>
                <DropdownMenuItem onClick={() => onSelectAll?.(board, true)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClearSelection?.(board)}>
                  <XSquare className="h-4 w-4 mr-2" />
                  Clear Selection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onSortByPriority?.(board)}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort by Priority ({sortDirection === 'asc' ? 'Low→High' : 'High→Low'})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortByDueDate?.(board)}>
              <Calendar className="h-4 w-4 mr-2" />
              Sort by Due Date ({sortDirection === 'asc' ? 'Earliest' : 'Latest'})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

