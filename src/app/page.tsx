import { LandingPage } from "@/components/landing/landing-page";
import { getCurrent } from "@/features/auth/queries";
import { getWorkspaces } from "@/features/workspaces/queries";
import { redirect } from "next/navigation";


export default async function Home() {
  const user = await getCurrent();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
