import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/";
  const origin = requestUrl.origin;

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(`${origin}/login?error=config_missing`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=session_not_found`);
  }

  try {
    await ensureProfile(supabase, user);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=profile_create_failed`);
  }

  return NextResponse.redirect(`${origin}${redirectTo.startsWith("/") ? redirectTo : "/"}`);
}
