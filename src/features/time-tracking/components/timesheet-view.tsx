import { useState } from "react";
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { CalendarIcon, Download, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useGetTimesheet } from "../api/use-get-timesheet";
import { UserTimesheet } from "../types";

interface TimesheetViewProps {
  workspaceId: string;
}

export const TimesheetView = ({ workspaceId }: TimesheetViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);

  const { data: timesheets, isLoading } = useGetTimesheet({
    workspaceId,
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(weekEnd, "yyyy-MM-dd"),
  });

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const handleExportCSV = () => {
    if (!timesheets) return;

    const csvData: string[] = [];
    csvData.push("User,Date,Project,Task,Hours,Description");

    timesheets.forEach((userTimesheet: UserTimesheet) => {
      userTimesheet.weeks.forEach(week => {
        week.entries.forEach(entry => {
          const row = [
            userTimesheet.userName,
            entry.logDate,
            entry.projectName,
            entry.taskName,
            entry.loggedHours.toString(),
            `"${entry.description.replace(/"/g, '""')}"` // Escape quotes in CSV
          ];
          csvData.push(row.join(","));
        });
      });
    });

    const csvContent = csvData.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `timesheet-${format(weekStart, "yyyy-MM-dd")}-to-${format(weekEnd, "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Timesheet</span>
            <Skeleton className="h-10 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalWeekHours = timesheets?.reduce((sum, user) => sum + user.totalHours, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Timesheet</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousWeek}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarIcon className="h-4 w-4" />
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!timesheets || timesheets.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!timesheets || timesheets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No time logs found for this week.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Weekly Summary</h3>
              <Badge variant="secondary">
                Total: {totalWeekHours.toFixed(2)} hours
              </Badge>
            </div>

            {timesheets.map((userTimesheet) => (
              <div key={userTimesheet.userId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{userTimesheet.userName}</h4>
                  <Badge variant="outline">
                    {userTimesheet.totalHours.toFixed(2)} hours
                  </Badge>
                </div>

                {userTimesheet.weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {week.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                              {format(parseISO(entry.logDate), "MMM d")}
                            </TableCell>
                            <TableCell>{entry.projectName}</TableCell>
                            <TableCell>{entry.taskName}</TableCell>
                            <TableCell>{entry.loggedHours}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {entry.description}
                            </TableCell>
                          </TableRow>
                        ))}
                        {week.entries.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                              No time logs for this week
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
