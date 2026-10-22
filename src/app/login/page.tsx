export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getCurrentUser, userCount } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  if ((await userCount()) === 0) redirect("/setup");
  return <AuthForm mode="login" />;
}
