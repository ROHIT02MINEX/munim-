import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getSupabaseConfig, hasSupabaseConfig } from "./config";

const protectedPaths = ["/", "/transactions", "/parties", "/reports", "/settings", "/ai-munim"];
const authPaths = ["/login", "/signup", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!hasSupabaseConfig()) {
    // No Supabase configured — let pages render so user sees the login form
    // rather than a server error.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAuthPage = authPaths.includes(pathname);

  // Redirect unauthenticated users trying to access protected routes → /login
  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages → /
  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
