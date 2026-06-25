"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { db, type Party, type Transaction } from "./db";

type SyncPayload = Transaction | Party | null;

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  queueAction: (
    action: "insert" | "update" | "delete",
    entity: "transaction" | "party",
    entityId: string,
    payload: SyncPayload
  ) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await db.syncQueue.count();
      setPendingCount(count);
    } catch (err) {
      console.error("Error reading sync queue count:", err);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    const count = await db.syncQueue.count();
    if (count === 0) return;

    setIsSyncing(true);
    console.log(`Starting sync of ${count} pending operations...`);

    try {
      const queueItems = await db.syncQueue.orderBy("timestamp").toArray();

      for (const item of queueItems) {
        if (!navigator.onLine) {
          setIsOnline(false);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
        console.log(`Successfully synced ${item.entity} [${item.action}] ID: ${item.entityId}`);

        if (item.entity === "transaction" && item.action !== "delete") {
          await db.transactions.update(item.entityId, { status: "synced" });
        } else if (item.entity === "party" && item.action !== "delete") {
          await db.parties.update(item.entityId, { status: "synced" });
        }

        if (item.id !== undefined) {
          await db.syncQueue.delete(item.id);
        }

        await updatePendingCount();
      }
    } catch (err) {
      console.error("Sync operation encountered an error:", err);
    } finally {
      setIsSyncing(false);
      await updatePendingCount();
    }
  }, [isSyncing, updatePendingCount]);

  const triggerAutoSync = useCallback(() => {
    setTimeout(() => {
      syncNow().catch((err) => console.error("Auto-sync error:", err));
    }, 2000);
  }, [syncNow]);

  // 1. Initialise connection status & event listeners
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      
      const handleOnline = () => {
        setIsOnline(true);
        triggerAutoSync();
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Regularly update sync queue counter
      const interval = setInterval(updatePendingCount, 1500);

      updatePendingCount();

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        clearInterval(interval);
      };
    }
  }, [triggerAutoSync, updatePendingCount]);

  // 2. Queue an action when database changes
  const queueAction = async (
    action: "insert" | "update" | "delete",
    entity: "transaction" | "party",
    entityId: string,
    payload: SyncPayload
  ) => {
    await db.syncQueue.add({
      action,
      entity,
      entityId,
      payload,
      timestamp: Date.now(),
    });
    await updatePendingCount();
    
    // If online, immediately try to sync the action
    if (navigator.onLine) {
      triggerAutoSync();
    }
  };

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, syncNow, isSyncing, queueAction }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
