import DashboardClient from "./dashboard-client";
import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardPage() {
  await requireUser("/");
  return <DashboardClient />;
}
