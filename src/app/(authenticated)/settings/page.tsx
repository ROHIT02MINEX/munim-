import SettingsClient from "./settings-client";
import { requireUser } from "@/lib/auth/require-user";

export default async function SettingsPage() {
  await requireUser("/settings");
  return <SettingsClient />;
}
