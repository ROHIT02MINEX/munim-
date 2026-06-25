"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/mockData";
import {
  Trash2, 
  RefreshCw, 
  Database, 
  Download, 
  Upload, 
  Info, 
  ShieldCheck, 
  Check
} from "lucide-react";

export default function SettingsPage() {
  const [swStatus, setSwStatus] = useState("Checking...");
  const [isResetting, setIsResetting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setSwStatus(`Active (${reg.scope})`);
        } else {
          setSwStatus("Not registered (PWA works on standard port hosts)");
        }
      });
    } else {
      setSwStatus("Unsupported in this browser");
    }
  }, []);

  // JSON Backup Export
  const handleExportBackup = async () => {
    try {
      const txs = await db.transactions.toArray();
      const pts = await db.parties.toArray();
      const cats = await db.categories.toArray();

      const backupData = {
        app: "Munim by Rohit",
        version: 1.0,
        exportedAt: new Date().toISOString(),
        data: {
          transactions: txs,
          parties: pts,
          categories: cats
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Munim_Backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      triggerSuccess("JSON backup file downloaded successfully!");
    } catch (err) {
      console.error("Backup export failed:", err);
      alert("Failed to export backup. Database query error.");
    }
  };

  // JSON Backup Import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.app !== "Munim by Rohit" || !parsed.data) {
          alert("Invalid backup file format. Must be a valid Munim Backup JSON file.");
          return;
        }

        const confirmRestore = confirm("Are you sure you want to restore this backup? This will overwrite your existing local database!");
        if (!confirmRestore) return;

        setIsResetting(true);
        
        // Clear collections
        await db.transactions.clear();
        await db.parties.clear();
        await db.categories.clear();

        // Load data from file
        if (parsed.data.categories && parsed.data.categories.length > 0) {
          await db.categories.bulkPut(parsed.data.categories);
        }
        if (parsed.data.parties && parsed.data.parties.length > 0) {
          await db.parties.bulkPut(parsed.data.parties);
        }
        if (parsed.data.transactions && parsed.data.transactions.length > 0) {
          await db.transactions.bulkPut(parsed.data.transactions);
        }

        setIsResetting(false);
        triggerSuccess("Ledger backup restored successfully!");
      } catch (err) {
        setIsResetting(false);
        console.error("Failed to restore backup:", err);
        alert("Failed to parse JSON file or restore records.");
      }
    };
    reader.readAsText(file);
  };

  // Database Reset
  const handleResetDatabase = async () => {
    const confirmReset = confirm("CRITICAL ACTION: This will completely wipe all local transactions and contacts in IndexedDB! Do you want to proceed?");
    if (!confirmReset) return;

    setIsResetting(true);
    try {
      await db.transactions.clear();
      await db.parties.clear();
      await db.categories.clear();
      await db.syncQueue.clear();
      
      triggerSuccess("Database cleared successfully!");
    } catch (err) {
      console.error("Reset database error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  // Seed Default Data
  const handleSeedMockData = async () => {
    setIsResetting(true);
    try {
      await db.transactions.clear();
      await db.parties.clear();
      await db.categories.clear();
      await db.syncQueue.clear();

      await seedDatabase();
      triggerSuccess("Database re-seeded with mock ledger accounts!");
    } catch (err) {
      console.error("Failed to seed database:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  return (
    <>
      <div className="space-y-6 max-w-3xl">
        
        {/* Header Title */}
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            Settings & Backup
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Reconcile configuration settings, back up databases, and manage offline data layers.
          </p>
        </div>

        {/* Success Alert */}
        {isSuccess && (
          <div className="rounded-xl border border-brand-emerald/25 bg-brand-emerald/10 p-4 text-xs font-semibold text-brand-mint flex items-center gap-2">
            <Check size={16} className="text-brand-mint shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Database Operations Card */}
        <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-6 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2 border-b border-brand-border pb-4">
            <Database size={16} className="text-brand-indigo" />
            <h3 className="font-display font-bold text-white text-base">Local IndexedDB Utilities</h3>
          </div>

          <div className="space-y-4">
            
            {/* Backup JSON */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/40 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Back Up Ledger Data</p>
                <p className="text-xs text-slate-400 mt-0.5">Download all local entries as a backup JSON file.</p>
              </div>
              <button
                onClick={handleExportBackup}
                disabled={isResetting}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Download size={13} />
                <span>Download Backup</span>
              </button>
            </div>

            {/* Restore JSON */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/40 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Restore Ledger Backup</p>
                <p className="text-xs text-slate-400 mt-0.5">Restore and overwrite your local books using a previously saved JSON file.</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 self-start sm:self-center">
                <Upload size={13} />
                <span>Upload JSON</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  disabled={isResetting}
                  className="hidden"
                />
              </label>
            </div>

            {/* Reset Database */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/40 pb-4">
              <div>
                <p className="text-sm font-semibold text-white text-rose-400">Clear All Accounts</p>
                <p className="text-xs text-slate-400 mt-0.5">Delete all transaction ledgers and contact directories. Permanent action.</p>
              </div>
              <button
                onClick={handleResetDatabase}
                disabled={isResetting}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-brand-rose/25 bg-brand-rose/5 px-4 py-2 text-xs font-semibold text-brand-rose hover:bg-brand-rose/15"
              >
                <Trash2 size={13} />
                <span>Wipe Database</span>
              </button>
            </div>

            {/* Seed Mock Data */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Restore Seed Mock Data</p>
                <p className="text-xs text-slate-400 mt-0.5">Wipe database and re-seed with clean default categories, parties, and historical records.</p>
              </div>
              <button
                onClick={handleSeedMockData}
                disabled={isResetting}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-brand-emerald/25 bg-brand-emerald/5 px-4 py-2 text-xs font-semibold text-brand-mint hover:bg-brand-emerald/15"
              >
                <RefreshCw size={13} className={isResetting ? "animate-spin" : ""} />
                <span>Re-seed Database</span>
              </button>
            </div>

          </div>

        </div>

        {/* 2. System Architecture / Status Card */}
        <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 border-b border-brand-border pb-4">
            <Info size={16} className="text-brand-indigo" />
            <h3 className="font-display font-bold text-white text-base">PWA System Status</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs text-slate-300">
            
            <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Service Worker</p>
              <p className="mt-1 font-semibold text-white">{swStatus}</p>
            </div>

            <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">IndexedDB Cache</p>
              <p className="mt-1 font-semibold text-white">Active (v1 schema initialized)</p>
            </div>

            <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">PWA Environment</p>
              <p className="mt-1 font-semibold text-white">Standalone-Capable (W3C Standard Manifest)</p>
            </div>

            <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Security Layer</p>
              <p className="mt-1 font-semibold text-brand-mint flex items-center gap-1">
                <ShieldCheck size={14} />
                <span>AES Local Encryption Ready</span>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
