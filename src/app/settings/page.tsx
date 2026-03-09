import { redirect } from "next/navigation";
import { AdminSettings } from "@/components/AdminSettings";
import { getAuthUserFromCookies } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getAuthUserFromCookies();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  return <AdminSettings />;
}
