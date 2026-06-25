import PartiesClient from "./parties-client";
import { requireUser } from "@/lib/auth/require-user";

export default async function PartiesPage() {
  await requireUser("/parties");
  return <PartiesClient />;
}
