export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getCurrentUser, safeUserCount } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
export default async function LoginPage() {
  let signedIn = false;
  try { signedIn = !!(await getCurrentUser()); } catch { redirect("/status"); }
  if (signedIn) redirect("/");
  if ((await safeUserCount()) === 0) redirect("/setup");
  return <AuthForm mode="login" />;
}
