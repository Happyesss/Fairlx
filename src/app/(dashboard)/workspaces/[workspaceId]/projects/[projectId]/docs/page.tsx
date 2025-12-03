import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { ProjectDocsClient } from "./client";

const ProjectDocsPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <ProjectDocsClient />;
};

export default ProjectDocsPage;
