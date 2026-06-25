import ReportsClient from "./reports-client";
import { requireUser } from "@/lib/auth/require-user";

export default async function ReportsPage() {
  await requireUser("/reports");
  return <ReportsClient />;
}
