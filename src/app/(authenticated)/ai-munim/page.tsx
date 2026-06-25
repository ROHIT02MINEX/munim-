import AiMunimClient from "./ai-munim-client";
import { requireUser } from "@/lib/auth/require-user";

export default async function AiMunimPage() {
  await requireUser("/ai-munim");
  return <AiMunimClient />;
}
