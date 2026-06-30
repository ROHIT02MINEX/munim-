"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  ReceiptText, 
  Users, 
  TrendingUp, 
  Bot, 
  Download, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  LogOut,
  Sparkles
} from "lucide-react";
import { useSync } from "@/lib/sync";
import { seedDatabase, defaultCategories } from "@/lib/mockData";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db";

// Define beforeinstallprompt event interface
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = useNextPathname();
  const router = useNextRouter();
  const { isOnline, pendingCount, syncNow, isSyncing } = useSync();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 1. Initialise Database & PWA Installation Triggers
  useEffect(() => {
    setMounted(true);
    // Seed default categories first
    seedDatabase().catch((err) => console.error("Failed to seed database:", err));

    // Handle authenticated user isolation & initial sync from Supabase
    const initUserSession = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const cachedUserId = localStorage.getItem("munim_user_id");
          const isNewUser = cachedUserId !== user.id;

          if (isNewUser) {
            console.log("New user detected. Clearing previous workspace data...");
            await Promise.all([
              db.transactions.clear(),
              db.parties.clear(),
              db.categories.clear(),
              db.budgets.clear(),
              db.reports.clear(),
              db.settings.clear(),
              db.syncQueue.clear()
            ]);
          }

          // Trigger sync first to push any local offline entries
          if (navigator.onLine) {
            try {
              await syncNow();
            } catch (se) {
              console.error("Error syncing before pull:", se);
            }
          }

          // Sync down all user data from Supabase tables
          const [profileRes, txRes, ptRes, catRes, budgetRes, reportRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
            supabase.from("transactions").select("*"),
            supabase.from("parties").select("*"),
            supabase.from("categories").select("*"),
            supabase.from("budgets").select("*"),
            supabase.from("reports").select("*")
          ]);

          // Save unsynced local data first to prevent overwriting
          const unsyncedTxs = await db.transactions.filter(t => t.status !== "synced").toArray();
          const unsyncedPts = await db.parties.filter(p => p.status !== "synced").toArray();

          // Clear database tables to merge fresh data from Supabase
          await Promise.all([
            db.transactions.clear(),
            db.parties.clear(),
            db.categories.clear(),
            db.budgets.clear(),
            db.reports.clear(),
            db.settings.clear()
          ]);

          // Initialize Categories (Restore from Supabase OR Seed Default Categories if first login)
          if (catRes.data && catRes.data.length > 0) {
            const remoteCats = catRes.data.map(item => ({
              id: item.id,
              ...(item.payload as any)
            }));
            await db.categories.bulkPut(remoteCats);
          } else {
            // First login: seed default categories locally and save them to Supabase
            await seedDatabase();
            if (navigator.onLine) {
              const insertCats = defaultCategories.map(cat => ({
                id: cat.id,
                user_id: user.id,
                payload: { id: cat.id, name: cat.name, type: cat.type, icon: cat.icon, color: cat.color }
              }));
              if (insertCats.length > 0) {
                await supabase.from("categories").insert(insertCats);
              }
            }
          }

          // Initialize Settings (Restore from Profile OR Set Defaults if first login)
          const rawSettings = profileRes.data?.settings;
          const remoteSettings = (rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)) 
            ? (rawSettings as Record<string, any>) 
            : null;
          if (remoteSettings && Object.keys(remoteSettings).length > 0) {
            await db.settings.put({ id: "current_settings", ...remoteSettings });
          } else {
            const defaultSettings = { currency: "INR", theme: "dark", language: "en" };
            await db.settings.put({ id: "current_settings", ...defaultSettings });
            if (navigator.onLine) {
              await supabase.from("profiles").update({ settings: defaultSettings }).eq("id", user.id);
            }
          }

          // Put synced transactions from Supabase
          if (txRes.data && txRes.data.length > 0) {
            const localTxs = txRes.data.map(item => ({
              id: item.id,
              ...(item.payload as any),
              status: "synced" as const
            }));
            await db.transactions.bulkPut(localTxs);
          }

          // Put synced parties from Supabase
          if (ptRes.data && ptRes.data.length > 0) {
            const localPts = ptRes.data.map(item => ({
              id: item.id,
              ...(item.payload as any),
              status: "synced" as const
            }));
            await db.parties.bulkPut(localPts);
          }

          // Put synced budgets from Supabase
          if (budgetRes.data && budgetRes.data.length > 0) {
            const localBudgets = budgetRes.data.map(item => ({
              id: item.id,
              ...(item.payload as any)
            }));
            await db.budgets.bulkPut(localBudgets);
          }

          // Put synced reports from Supabase
          if (reportRes.data && reportRes.data.length > 0) {
            const localReports = reportRes.data.map(item => ({
              id: item.id,
              ...(item.payload as any)
            }));
            await db.reports.bulkPut(localReports);
          }

          // Re-apply local unsynced edits/inserts
          if (unsyncedTxs.length > 0) {
            await db.transactions.bulkPut(unsyncedTxs);
          }
          if (unsyncedPts.length > 0) {
            await db.parties.bulkPut(unsyncedPts);
          }

          localStorage.setItem("munim_user_id", user.id);
          console.log("Workspace initialized/synchronized successfully.");

          // Dispatch event to trigger state updates in components
          window.dispatchEvent(new Event("munim-db-changed"));
        }
      } catch (err) {
        console.error("Failed to initialize user session:", err);
      }
    };

    initUserSession();

    // Listen for PWA install prompt
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log("Munim App was installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if running in standalone mode (installed)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && window.navigator.standalone === true)
    ) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [router]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      console.log("User accepted PWA installation");
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("munim_user_id");
    // Purge local database to enforce Row Level Security isolation offline
    await Promise.all([
      db.transactions.clear(),
      db.parties.clear(),
      db.categories.clear(),
      db.budgets.clear(),
      db.reports.clear(),
      db.settings.clear(),
      db.syncQueue.clear()
    ]);
    router.refresh();
    router.push("/login");
  };

  const navLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Transactions", href: "/transactions", icon: ReceiptText },
    { name: "AI Munim", href: "/ai-munim", icon: Bot, isCenter: true },
    { name: "Parties", href: "/parties", icon: Users },
    { name: "Reports", href: "/reports", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-slate-200">
      
      {/* 2. Top Header Navigation */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-brand-border bg-brand-bg/70 px-4 md:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Glowing Vector Logo */}
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-brand-emerald to-brand-mint p-[2px] shadow-[0_0_10px_rgba(52,211,153,0.3)]">
            <div className="flex h-full w-full items-center justify-center rounded-md bg-brand-bg">
              <span className="font-display text-lg font-bold text-brand-mint">M</span>
            </div>
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold tracking-wide text-white md:text-xl">
              Munim <span className="text-xs font-normal text-brand-mint uppercase bg-brand-emerald/10 px-2 py-0.5 rounded border border-brand-emerald/20 ml-1">Beta</span>
            </h1>
          </div>
        </div>

        {/* Header Action Items */}
        <div className="flex items-center gap-3">
          {/* PWA Install Button */}
          {mounted && deferredPrompt && !isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-indigo to-brand-violet px-3.5 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 active:scale-95"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Connection & Sync Pill */}
          {mounted ? (
            <button
              onClick={() => isOnline && syncNow()}
              disabled={isSyncing || !isOnline}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border ${
                isOnline
                  ? "bg-brand-emerald/10 border-brand-emerald/20 text-brand-mint"
                  : "bg-brand-rose/10 border-brand-rose/25 text-brand-rose"
              }`}
              title={isOnline ? "You are online. Click to sync." : "Offline mode active."}
            >
              {isOnline ? (
                <>
                  <Wifi size={14} className="animate-pulse" />
                  <span className="hidden sm:inline">Online</span>
                  {pendingCount > 0 && (
                    <span className="flex h-5 items-center justify-center rounded-full bg-brand-indigo px-1.5 text-[10px] font-bold text-white min-w-5">
                      {pendingCount}
                    </span>
                  )}
                  <RefreshCw
                    size={12}
                    className={`ml-0.5 ${isSyncing ? "animate-spin text-brand-mint" : "opacity-60"}`}
                  />
                </>
              ) : (
                <>
                  <WifiOff size={14} className="animate-pulse-slow" />
                  <span>Offline</span>
                  {pendingCount > 0 && (
                    <span className="flex h-5 items-center justify-center rounded-full bg-brand-rose px-1.5 text-[10px] font-bold text-white min-w-5">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </button>
          ) : (
            <div className="h-7 w-20 rounded-full bg-slate-800/40 animate-pulse border border-slate-700/50"></div>
          )}

          {/* Dev/Sandbox Pill */}
          <div className="hidden items-center gap-1 rounded-full border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-400 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span>Sandbox Mode</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Switch Accounts / Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 3. Left Sidebar (Desktop Only) */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-brand-border bg-brand-bg/20 p-4 lg:flex">
          <nav className="flex flex-1 flex-col gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-brand-emerald/10 to-brand-mint/5 border border-brand-emerald/20 text-white"
                      : "border border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-white"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`transition-colors ${
                      isActive ? "text-brand-mint" : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  <span>{link.name}</span>
                  {link.isCenter && (
                    <Sparkles size={12} className="ml-auto text-brand-mint animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer Details */}
          <div className="rounded-xl border border-brand-border bg-brand-card/50 p-4 backdrop-blur-md">
            <p className="text-xs text-slate-400">Offline Ledger Size</p>
            <p className="mt-0.5 text-sm font-semibold text-white">Local-First (IndexedDB)</p>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-800">
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-brand-emerald to-brand-mint glow-mint" style={{ width: "100%" }}></div>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">Auto-syncs to cloud when online</p>
          </div>
        </aside>

        {/* 4. Page Contents Area */}
        <main className="flex-1 pb-24 lg:pb-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* 5. Bottom Navigation (Mobile & Tablet Only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 w-full items-center justify-around border-t border-brand-border bg-brand-bg/85 backdrop-blur-lg lg:hidden px-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          if (link.isCenter) {
            // Floating layout for the AI Munim page link
            return (
              <Link
                key={link.name}
                href={link.href}
                className="relative -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-brand-emerald to-brand-mint text-brand-bg shadow-[0_0_20px_rgba(52,211,153,0.45)] hover:scale-105 active:scale-95 z-40 transition-transform"
                title="AI voice entry & chat"
              >
                <Icon size={24} className="stroke-[2.5]" />
              </Link>
            );
          }

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 w-14 h-full text-center transition-all ${
                isActive ? "text-brand-mint" : "text-slate-500"
              }`}
            >
              <Icon size={18} className={isActive ? "scale-110" : ""} />
              <span className="text-[10px] font-medium tracking-tight truncate max-w-full">
                {link.name === "Dashboard" ? "Home" : link.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
