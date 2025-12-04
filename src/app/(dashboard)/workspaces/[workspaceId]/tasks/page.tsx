import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { TaskViewSwitcher } from "@/features/tasks/components/task-view-switcher";
import { PencilIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const TasksPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");
  const userName = user?.name?.split(' ')[0] ?? "User"

  return (
    <div className="h-full flex flex-col">
      {/* Header - Outside Cards */}
      <div className="flex items-center justify-between mb-6 px-6 pt-4">
        {/* Welcome Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Welcome, {userName}! 👋</h1>
          <p className="text-sm text-gray-600 mt-1">Here's your workspace overview</p>
        </div>
        <Link href="/profile">
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Settings className="size-4 mr-3" />
            Profile
          </button>
        </Link>
      </div>

      <TaskViewSwitcher showMyTasksOnly={true} />
    </div>
  );
};

export default TasksPage;
