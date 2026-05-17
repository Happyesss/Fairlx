import {
  CircleCheckIcon,
  CircleDotDashedIcon,
  CircleDotIcon,
  CircleIcon,
  MoreHorizontalIcon,
  CheckSquare,
  XSquare,
  ArrowUpDown,
  Calendar,
  AlertTriangleIcon,
  Settings2Icon,
  PlusIcon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { snakeCaseToTitleCase, cn } from "@/lib/utils";

import { TaskStatus } from "../types";

const statusIconMap: Record<TaskStatus, React.ReactNode> = {
  [TaskStatus.TODO]: <CircleIcon className="size-[18px] text-gray-400" />,
  [TaskStatus.ASSIGNED]: (
    <CircleIcon className="size-[18px] text-red-400" />
  ),
  [TaskStatus.IN_PROGRESS]: (
    <CircleDotDashedIcon className="size-[18px] text-yellow-400" />
  ),
  [TaskStatus.IN_REVIEW]: (
    <CircleDotIcon className="size-[18px] text-blue-400" />
  ),
  [TaskStatus.DONE]: (
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
  // WIP Limit props
  wipLimit?: number;
  onSetWipLimit?: (status: TaskStatus, limit: number | null) => void;
  onQuickCreate?: (status: TaskStatus) => void;
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
  sortDirection = 'asc',
  wipLimit,
  onSetWipLimit,
  canCreateTasks,
  onQuickCreate,
}: KanbanColumnHeaderProps) => {
  const icon = statusIconMap[board];


  const isAllSelected = taskCount > 0 && selectedCount === taskCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < taskCount;

  // WIP limit status
  const isOverWipLimit = wipLimit !== undefined && wipLimit > 0 && taskCount > wipLimit;
  const isAtWipLimit = wipLimit !== undefined && wipLimit > 0 && taskCount === wipLimit;
  const wipPercentage = wipLimit && wipLimit > 0 ? Math.min((taskCount / wipLimit) * 100, 100) : 0;

  return (
    <div className={cn(
      "px-3 py-2 flex items-center justify-between mb-2 rounded-t-lg",
      isOverWipLimit && "bg-red-50 border-b-2 border-red-400"
    )}>
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
        <h2 className="text-sm font-semibold text-foreground">{snakeCaseToTitleCase(board)}</h2>

        {/* Task count with WIP limit indicator */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Badge
                  variant={isOverWipLimit ? "destructive" : isAtWipLimit ? "secondary" : "outline"}
                  className={cn(
                    "text-xs px-1.5 py-0 h-5",
                    isOverWipLimit && "animate-pulse"
                  )}
                >
                  {taskCount}
                  {wipLimit !== undefined && wipLimit > 0 && (
                    <span className="text-muted-foreground ml-0.5">/{wipLimit}</span>
                  )}
                </Badge>
                {isOverWipLimit && (
                  <AlertTriangleIcon className="size-4 text-red-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {wipLimit !== undefined && wipLimit > 0 ? (
                <div className="text-xs">
                  <div className="font-medium">
                    {isOverWipLimit
                      ? `⚠️ Over WIP limit by ${taskCount - wipLimit}`
                      : isAtWipLimit
                        ? "At WIP limit"
                        : `${wipLimit - taskCount} slots remaining`
                    }
                  </div>
                  <div className="text-muted-foreground">
                    WIP Limit: {wipLimit} | Current: {taskCount}
                  </div>
                </div>
              ) : (
                <span>{taskCount} work items</span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* WIP Progress bar (only show if limit is set) */}
      {wipLimit !== undefined && wipLimit > 0 && (
        <div className="flex-1 mx-3 max-w-[60px]">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                isOverWipLimit ? "bg-red-500" : isAtWipLimit ? "bg-yellow-500" : "bg-green-500"
              )}
              style={{ width: `${wipPercentage}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {canCreateTasks && (
          <Button
            onClick={() => onQuickCreate?.(board)}
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent"
          >
            <PlusIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent">
              <MoreHorizontalIcon className="h-4 w-4 text-muted-foreground" />
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
            {onSetWipLimit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  const limit = prompt("Set WIP limit (0 to remove):", String(wipLimit || ""));
                  if (limit !== null) {
                    const numLimit = parseInt(limit);
                    onSetWipLimit(board, numLimit > 0 ? numLimit : null);
                  }
                }}>
                  <Settings2Icon className="h-4 w-4 mr-2" />
                  {wipLimit ? `Change WIP Limit (${wipLimit})` : "Set WIP Limit"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

