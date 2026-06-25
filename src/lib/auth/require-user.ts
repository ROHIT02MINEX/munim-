import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(redirectTo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}
