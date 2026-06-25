import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export async function ensureProfile(supabase: SupabaseServerClient, user: User) {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return;
  }

  const metadata = user.user_metadata;
  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
  const phone = typeof user.phone === "string" ? user.phone : null;

  const profile: ProfileInsert = {
    id: user.id,
    full_name: fullName,
    email: user.email ?? null,
    avatar_url: avatarUrl,
    phone,
  };

  const { error } = await supabase.from("profiles").insert(profile);

  if (error) {
    throw error;
  }
}
