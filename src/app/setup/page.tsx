export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { userCount } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
export default async function SetupPage() {
  if ((await userCount()) > 0) redirect("/login");
  return <AuthForm mode="setup" />;
}
