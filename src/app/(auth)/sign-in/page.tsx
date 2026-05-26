import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { SignInCard } from "@/features/auth/components/sign-in-card";

const SignInPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string; error?: string; email?: string }>;
}) => {
  const user = await getCurrent();
  const params = await searchParams;

  if (user) {
    const returnUrl = params.returnUrl;
    if (returnUrl) {
      redirect(returnUrl);
    }
    redirect("/");
  }

  return <SignInCard returnUrl={params.returnUrl} error={params.error} prefillEmail={params.email} />;
};

export default SignInPage;
