import { useState } from "react";
import { Clock, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { useGetTimeLogs } from "../api/use-get-time-logs";
import { useDeleteTimeLog } from "../api/use-delete-time-log";
import { CreateTimeLogModal } from "./create-time-log-modal";
import { format, parseISO } from "date-fns";

interface TaskTimeLogsProps {
  taskId: string;
  taskName: string;
  workspaceId: string;
}

export const TaskTimeLogs = ({ taskId, taskName, workspaceId }: TaskTimeLogsProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: timeLogs, isLoading } = useGetTimeLogs({
    workspaceId,
    taskId,
  });

  const { mutate: deleteTimeLog } = useDeleteTimeLog();

  const handleDeleteTimeLog = (timeLogId: string) => {
    if (confirm("Are you sure you want to delete this time log?")) {
      deleteTimeLog({ param: { timeLogId } });
    }
  };

  const totalHours = timeLogs?.documents.reduce((sum, log) => sum + log.loggedHours, 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with Total and Log Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              Total: {totalHours.toFixed(2)} hours
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Log Time
          </Button>
        </div>

        {/* Time Logs List */}
        {!timeLogs?.documents || timeLogs.documents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm mb-4">No time logs recorded yet.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Log Your First Entry
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {timeLogs.documents.map((log) => (
              <div
                key={log.$id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">
                        {format(parseISO(log.logDate), "MMM d, yyyy")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.loggedHours}h
                      </Badge>
                      {log.startTime && log.endTime && (
                        <span className="text-xs text-gray-500">
                          {log.startTime} - {log.endTime}
                        </span>
                      )}
                    </div>
                    {log.description && (
                      <p className="text-sm text-gray-600">{log.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Logged by {log.user?.name || "Unknown User"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTimeLog(log.$id)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateTimeLogModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        taskId={taskId}
        taskName={taskName}
      />
    </>
  );
};
