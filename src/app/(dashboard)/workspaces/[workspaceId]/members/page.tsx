import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { MembersList } from "@/features/workspaces/components/members-list";

const WorkspaceIdMembersPage = async () => {
  const user = await getCurrent();

  if (!user) redirect("/sign-in");

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-4">
      <MembersList />
    </div>
  );
};

export default WorkspaceIdMembersPage;