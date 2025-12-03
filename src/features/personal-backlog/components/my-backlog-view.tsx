"use client";

import { useState, useCallback, useEffect } from "react";
import { PlusIcon, Loader2, SearchIcon, FlagIcon, ClockIcon, CalendarIcon, Trash2Icon, CircleDashedIcon, CircleDotDashedIcon, CircleCheckIcon, Edit2Icon } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useConfirm } from "@/hooks/use-confirm";

import { useGetBacklogItems } from "../api/use-get-backlog-items";
import { useCreateBacklogItem } from "../api/use-create-backlog-item";
import { useDeleteBacklogItem } from "../api/use-delete-backlog-item";
import { useBulkUpdateBacklogItems } from "../api/use-bulk-update-backlog-items";
import { BacklogItemType, BacklogItemPriority, BacklogItemStatus, BacklogItem } from "../types";
import { CreateBacklogItemDialog } from "./create-backlog-item-dialog";
import { EditBacklogItemDialog } from "./edit-backlog-item-dialog";
import { BacklogPriorityBadge } from "./backlog-priority-badge";
import { BacklogLabelBadge } from "./backlog-label-badge";
import { BacklogTypeBadge } from "./backlog-type-badge";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";

const boards: BacklogItemStatus[] = [
  BacklogItemStatus.TODO,
  BacklogItemStatus.IN_PROGRESS,
  BacklogItemStatus.DONE,
];

type ItemsState = {
  [key in BacklogItemStatus]: BacklogItem[];
};

interface MyBacklogViewProps {
  workspaceId: string;
}

export const MyBacklogView = ({ workspaceId }: MyBacklogViewProps) => {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BacklogItemStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<BacklogItemPriority | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<BacklogItemType | "ALL">("ALL");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogStatus, setCreateDialogStatus] = useState<BacklogItemStatus>(BacklogItemStatus.TODO);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

  const { data, isLoading } = useGetBacklogItems({
    workspaceId,
    status: statusFilter === "ALL" ? null : statusFilter,
    priority: priorityFilter === "ALL" ? null : priorityFilter,
    type: typeFilter === "ALL" ? null : typeFilter,
    search: searchQuery || null,
  });

  const { mutate: createItem, isPending: isCreating } = useCreateBacklogItem();
  const { mutate: deleteItem } = useDeleteBacklogItem();
  const { mutate: bulkUpdate } = useBulkUpdateBacklogItems();
  const [ConfirmDialog, confirm] = useConfirm(
    "Delete item",
    "Are you sure you want to delete this backlog item?",
    "destructive"
  );
  const { isAdmin } = useCurrentMember({ workspaceId });

  // State management similar to main kanban board
  const [items, setItems] = useState<ItemsState>(() => {
    const initialItems: ItemsState = {
      [BacklogItemStatus.TODO]: [],
      [BacklogItemStatus.IN_PROGRESS]: [],
      [BacklogItemStatus.DONE]: [],
    };

    return initialItems;
  });

  // Update items state when data changes
  useEffect(() => {
    const newItems: ItemsState = {
      [BacklogItemStatus.TODO]: [],
      [BacklogItemStatus.IN_PROGRESS]: [],
      [BacklogItemStatus.DONE]: [],
    };

    const itemsList = data?.documents ?? [];
    itemsList.forEach((item) => {
      if (item.status in newItems) {
        newItems[item.status as BacklogItemStatus].push(item);
      }
    });

    Object.keys(newItems).forEach((status) => {
      newItems[status as BacklogItemStatus].sort((a, b) => a.position - b.position);
    });

    setItems(newItems);
  }, [data?.documents]);

  const handleCreateItem = () => {
    if (!newItemTitle.trim()) return;

    createItem(
      {
        title: newItemTitle,
        workspaceId,
        priority: BacklogItemPriority.MEDIUM,
        status: BacklogItemStatus.TODO,
        type: BacklogItemType.TASK,
        flagged: false,
      },
      {
        onSuccess: () => {
          setNewItemTitle("");
        },
      }
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    const ok = await confirm();
    if (ok) {
      deleteItem({ param: { itemId } });
    }
  };

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const { source, destination } = result;
      const sourceStatus = source.droppableId as BacklogItemStatus;
      const destStatus = destination.droppableId as BacklogItemStatus;

      let updatesPayload: {
        $id: string;
        status: BacklogItemStatus;
        position: number;
      }[] = [];

      setItems((prevItems) => {
        const newItems = { ...prevItems };

        // Safely remove the item from the source column
        const sourceColumn = [...newItems[sourceStatus]];
        const [movedItem] = sourceColumn.splice(source.index, 1);

        // If there's no moved item, return the previous state
        if (!movedItem) {
          console.warn("No item found at the source index");
          return prevItems;
        }

        // Create a new item object with potentially updated status
        const updatedMovedItem =
          sourceStatus !== destStatus
            ? { ...movedItem, status: destStatus }
            : movedItem;

        // Update the source column
        newItems[sourceStatus] = sourceColumn;

        // Add the item to the destination column
        const destColumn = [...newItems[destStatus]];
        destColumn.splice(destination.index, 0, updatedMovedItem);
        newItems[destStatus] = destColumn;

        // Prepare minimal update payloads
        updatesPayload = [];

        // Always update the moved item
        updatesPayload.push({
          $id: updatedMovedItem.$id,
          status: destStatus,
          position: Math.min((destination.index + 1) * 1000, 1_000_000),
        });

        // Update positions for affected items in the destination column
        newItems[destStatus].forEach((item, index) => {
          if (item && item.$id !== updatedMovedItem.$id) {
            const newPosition = Math.min((index + 1) * 1000, 1_000_000);
            if (item.position !== newPosition) {
              updatesPayload.push({
                $id: item.$id,
                status: destStatus,
                position: newPosition,
              });
            }
          }
        });

        // If the item moved between columns, update positions in the source column
        if (sourceStatus !== destStatus) {
          newItems[sourceStatus].forEach((item, index) => {
            if (item) {
              const newPosition = Math.min((index + 1) * 1000, 1_000_000);
              if (item.position !== newPosition) {
                updatesPayload.push({
                  $id: item.$id,
                  status: sourceStatus,
                  position: newPosition,
                });
              }
            }
          });
        }

        return newItems;
      });

      bulkUpdate({ items: updatesPayload });
    },
    [bulkUpdate]
  );

  return (
    <>
      <ConfirmDialog />
      <div className="h-full flex flex-col px-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">My Backlog</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Your personal task backlog and ideas</p>
          </div>

          {/* Create New Item */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Quick add a new backlog item..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateItem();
                }
              }}
              className="flex-1 !h-10 text-xs"
              disabled={isCreating}
            />
            {isAdmin && (
              <>
                <Button onClick={handleCreateItem} disabled={isCreating || !newItemTitle.trim()} className="text-xs font-medium !py-5.5" variant="outline">
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : <PlusIcon className="!size-3 !font-light" />}
                  Quick Add
                </Button>
                <Button onClick={() => {
                  setCreateDialogStatus(BacklogItemStatus.TODO);
                  setCreateDialogOpen(true);

                }} className="text-xs font-medium !py-5.5 tracking-normal bg-primary">
                  <PlusIcon className="!size-3 mr-0" />
                  New Item
                </Button>
              </>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 flex items-center min-w-[200px]">
              <SearchIcon className="absolute  left-3.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs !h-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BacklogItemStatus | "ALL")}>
              <SelectTrigger className="w-[140px] !text-xs !h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="!text-xs " value="ALL">All Status</SelectItem>
                <Separator />
                <SelectItem className="text-xs" value={BacklogItemStatus.TODO}>
                  <div className="flex items-center gap-x-2">
                    <CircleDashedIcon className="size-[18px] text-pink-400" />
                    To Do
                  </div>
                </SelectItem>
                <SelectItem className="text-xs" value={BacklogItemStatus.IN_PROGRESS}>
                  <div className="flex items-center gap-x-2">
                    <CircleDotDashedIcon className="size-[18px] text-yellow-400" />
                    In Progress
                  </div>
                </SelectItem>
                <SelectItem className="text-xs" value={BacklogItemStatus.DONE}>
                  <div className="flex items-center gap-x-2">
                    <CircleCheckIcon className="size-[18px] text-emerald-400" />
                    Done
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>


            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as BacklogItemPriority | "ALL")}>
              <SelectTrigger className="w-[140px] !text-xs !h-10">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="ALL">All Priority</SelectItem>
                <Separator />
                <SelectItem className="text-xs" value={BacklogItemPriority.URGENT}>Urgent</SelectItem>
                <SelectItem className="text-xs" value={BacklogItemPriority.HIGH}>High</SelectItem>
                <SelectItem className="text-xs" value={BacklogItemPriority.MEDIUM}>Medium</SelectItem>
                <SelectItem className="text-xs" value={BacklogItemPriority.LOW}>Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as BacklogItemType | "ALL")}>
              <SelectTrigger className="w-[140px] !text-xs !h-10">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="ALL">All Types</SelectItem>
                <Separator />
                <SelectItem className="text-xs" value={BacklogItemType.TASK}>Task</SelectItem>
                <SelectItem className="text-xs" value={BacklogItemType.BUG}>Bug</SelectItem>
                <SelectItem className="text-xs" value={BacklogItemType.IDEA}>Idea</SelectItem>
                <SelectItem className="text-xs" value={BacklogItemType.IMPROVEMENT}>Improvement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Backlog Board */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex overflow-x-auto gap-4 pb-4">
              {boards.map((status) => {
                const statusIcon =
                  status === BacklogItemStatus.TODO ? <CircleDashedIcon className="size-[18px] text-pink-400" /> :
                    status === BacklogItemStatus.IN_PROGRESS ? <CircleDotDashedIcon className="size-[18px] text-yellow-400" /> :
                      <CircleCheckIcon className="size-[18px] text-emerald-400" />;

                const statusTitle =
                  status === BacklogItemStatus.TODO ? "To Do" :
                    status === BacklogItemStatus.IN_PROGRESS ? "In Progress" :
                      "Done";

                return (
                  <div
                    key={status}
                    className="flex-1 bg-gray-50 rounded-xl min-w-[280px] border max-w-[320px]"
                  >
                    {/* Column Header */}
                    <div className="px-3 py-2 flex items-center  justify-between mb-2">
                      <div className="flex items-center gap-x-2">
                        {statusIcon}
                        <h2 className="text-sm font-semibold text-gray-700">{statusTitle}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <Button
                            onClick={() => {
                              setCreateDialogStatus(status as BacklogItemStatus);
                              setCreateDialogOpen(true);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-gray-100"
                          >
                            <PlusIcon className="h-4 w-4 text-gray-500" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <Droppable droppableId={status}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="min-h-[500px] px-3 pb-3"
                        >
                          {items[status].map((item, index) => (
                            <Draggable key={item.$id} draggableId={item.$id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <div
                                    onClick={() => setEditingItem(item)}
                                    className={`bg-white mb-2.5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${snapshot.isDragging ? "shadow-lg rotate-2 opacity-90" : ""
                                      }`}
                                  >
                                    <div className="flex p-4 flex-col items-start justify-between gap-x-2">
                                      {/* Top Section - Priority, Type, Labels and Actions */}
                                      <div className="flex-1 flex w-full justify-between">
                                        <div className="flex gap-2 flex-wrap">
                                          {item.priority && <BacklogPriorityBadge priority={item.priority} />}
                                          {item.labels && item.labels.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {item.labels.slice(0, 2).map((label, index) => (
                                                <BacklogLabelBadge key={index} label={label} />
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingItem(item);
                                            }}
                                          >
                                            <Edit2Icon className="size-[18px] stroke-1 text-neutral-700 hover:opacity-75 transition" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteItem(item.$id);
                                            }}
                                          >
                                            <Trash2Icon className="size-[18px] stroke-1 text-neutral-700 hover:text-destructive hover:opacity-75 transition" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Title Section */}
                                      <div className="flex items-start gap-2 mt-4 w-full">
                                        {item.flagged && (
                                          <FlagIcon className="size-4 fill-red-500 text-red-500 shrink-0 mt-0.5" />
                                        )}
                                        <h1 className="text-sm line-clamp-2 font-semibold flex-1">
                                          {item.title}
                                        </h1>
                                      </div>

                                      {/* Description */}
                                      {item.description && (
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-3 w-full">
                                          {(() => {
                                            const words = item.description.split(/\s+/);
                                            const shouldEllipsize = words.length > 5 || words.some((w) => w.length > 20);
                                            const preview = words
                                              .slice(0, 5)
                                              .map((word) => (word.length > 20 ? word.slice(0, 20) + "..." : word))
                                              .join(" ");
                                            return preview + (shouldEllipsize ? "....." : "");
                                          })()}
                                        </p>
                                      )}
                                    </div>

                                    {/* Bottom Section - Date and Time Info */}
                                    <div className="flex items-center border-t py-3 px-4 border-gray-200 gap-x-1.5 justify-between">
                                      <p className="text-xs flex gap-0.5 items-center text-muted-foreground">
                                        <CalendarIcon className="size-[14px] inline-block mr-1 text-gray-500" />
                                        {item.dueDate
                                          ? new Date(item.dueDate)
                                            .toLocaleDateString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                            })
                                            .replace(/ /g, "-")
                                          : "No Date"}
                                      </p>

                                      <div className="flex items-center gap-x-2">
                                        {item.estimatedHours ? (
                                          <p className="text-xs flex items-center text-muted-foreground">
                                            <ClockIcon className="size-[14px] mr-1 text-gray-500" />
                                            {item.estimatedHours}h
                                          </p>
                                        ) : (
                                          <BacklogTypeBadge type={item.type} />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {/* Add Item Button */}


                          {isAdmin && (
                            <Button
                              onClick={() => {
                                setCreateDialogStatus(status as BacklogItemStatus);
                                setCreateDialogOpen(true);
                              }}
                              variant="ghost"
                              className="w-full text-xs bg-white border border-gray-200 shadow-sm justify-start text-gray-500  mt-2" >
                              <PlusIcon className="h-4 w-4 " />
                              Add Task
                            </Button>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}

        {/* Dialogs */}
        <CreateBacklogItemDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          workspaceId={workspaceId}
          defaultStatus={createDialogStatus}
        />

        {editingItem && (
          <EditBacklogItemDialog
            open={!!editingItem}
            onOpenChange={(open) => !open && setEditingItem(null)}
            item={editingItem}
          />
        )}
      </div>
    </>
  );
};
