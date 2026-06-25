"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { db, type Transaction, type Party } from "@/lib/db";
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Plus, 
  Mic, 
  ChevronRight,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertCircle
} from "lucide-react";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load local records
  useEffect(() => {
    const fetchData = async () => {
      try {
        const txList = await db.transactions.orderBy("date").reverse().toArray();
        const partyList = await db.parties.toArray();
        setTransactions(txList);
        setParties(partyList);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. Financial Computations
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const cashBalance = totalIncome - totalExpense;

  // Net Receivable (parties that owe us money, positive balance)
  const netReceivable = parties
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  // Net Payable (parties we owe money to, negative balance stored as negative)
  const netPayable = Math.abs(
    parties
      .filter((p) => p.balance < 0)
      .reduce((sum, p) => sum + p.balance, 0)
  );

  // Format currency in Indian Rupees format (e.g. ₹1,50,000)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // 3. Custom SVG Chart calculations (Last 5 Months)
  // Let's create mock data points based on seeded transactions or fallback monthly data
  const chartMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const incomePoints = [42000, 38000, 52000, 48000, 60000, totalIncome > 0 ? totalIncome : 53000];
  const expensePoints = [28000, 31000, 29000, 34000, 38000, totalExpense > 0 ? totalExpense : 31700];

  const maxVal = Math.max(...incomePoints, ...expensePoints, 10000) * 1.15;

  // Helper to convert data values to SVG coordinates (width: 500, height: 200)
  const getSvgCoordinates = (points: number[]) => {
    const width = 500;
    const height = 180;
    const padding = 20;
    
    return points.map((p, index) => {
      const x = padding + (index * (width - padding * 2)) / (points.length - 1);
      const y = height - padding - (p * (height - padding * 2)) / maxVal;
      return { x, y };
    });
  };

  const incCoords = getSvgCoordinates(incomePoints);
  const expCoords = getSvgCoordinates(expensePoints);

  // Helper to convert coordinate arrays to SVG Path strings
  const getBezierPath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return "";
    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 2;
      const cpY1 = curr.y;
      const cpX2 = curr.x + (next.x - curr.x) / 2;
      const cpY2 = next.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const getAreaPath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return "";
    const linePath = getBezierPath(coords);
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${linePath} L ${last.x} 160 L ${first.x} 160 Z`;
  };

  const incLine = getBezierPath(incCoords);
  const incArea = getAreaPath(incCoords);
  const expLine = getBezierPath(expCoords);
  const expArea = getAreaPath(expCoords);

  return (
    <>
      <div className="space-y-8">
        
        {/* Welcome Headers */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Financial Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Real-time cashflow management, client ledger accounts, and AI insights.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/ai-munim"
              className="flex items-center gap-1.5 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 px-4 py-2.5 text-sm font-semibold text-brand-mint shadow-lg shadow-emerald-500/5 hover:bg-brand-emerald/20 active:scale-95"
            >
              <Mic size={15} />
              <span>Voice Entry</span>
            </Link>
            <Link
              href="/transactions"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint px-4 py-2.5 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-95"
            >
              <Plus size={16} />
              <span>Add Transaction</span>
            </Link>
          </div>
        </div>

        {/* 1. Core Financial Metric Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 w-full animate-pulse rounded-2xl bg-slate-900/60 border border-brand-border"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            
            {/* Card 1: Cash Balance */}
            <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-card/50 p-6 backdrop-blur-md glow-mint">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Cash Balance</span>
                <div className="rounded-lg bg-brand-emerald/10 p-2 text-brand-mint">
                  <DollarSign size={18} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-white">
                {formatCurrency(cashBalance)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                <span className="flex items-center gap-0.5 font-semibold text-brand-mint">
                  <TrendingUp size={12} />
                  Active
                </span>
                <span className="text-slate-500">IndexedDB local-first database</span>
              </div>
            </div>

            {/* Card 2: Net Receivable */}
            <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-card/50 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Receivables</span>
                <div className="rounded-lg bg-indigo-500/10 p-2 text-brand-indigo">
                  <ArrowDownLeft size={18} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-brand-mint">
                {formatCurrency(netReceivable)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-brand-indigo">Customers owe you</span>
                <span className="text-slate-500">across parties</span>
              </div>
            </div>

            {/* Card 3: Net Payable */}
            <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-card/50 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Payables</span>
                <div className="rounded-lg bg-rose-500/10 p-2 text-brand-rose">
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-brand-rose">
                {formatCurrency(netPayable)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-brand-rose">You owe vendors</span>
                <span className="text-slate-500">across suppliers</span>
              </div>
            </div>

          </div>
        )}

        {/* 2. Visual Charts & Quick Analytics */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Cashflow Chart (SVG-based) */}
          <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-6 backdrop-blur-md lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-white">Cashflow Analytics</h3>
                <p className="text-xs text-slate-400">Compare incoming revenues against expenditures</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-brand-mint">
                  <span className="h-2 w-2 rounded-full bg-brand-emerald"></span>
                  <span>Inflow</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-brand-rose">
                  <span className="h-2 w-2 rounded-full bg-brand-rose"></span>
                  <span>Outflow</span>
                </div>
              </div>
            </div>

            {/* Custom Responsive SVG Chart */}
            <div className="mt-6 flex h-48 w-full items-end justify-center">
              <svg viewBox="0 0 500 180" width="100%" height="100%" className="overflow-visible">
                <defs>
                  {/* Gradients for Chart Areas */}
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.00} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.00} />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <g stroke="#ffffff" strokeOpacity={0.05} strokeDasharray="3 3">
                  <line x1="20" y1="30" x2="480" y2="30" />
                  <line x1="20" y1="75" x2="480" y2="75" />
                  <line x1="20" y1="120" x2="480" y2="120" />
                </g>

                {/* Draw Areas */}
                <path d={incArea} fill="url(#incGrad)" />
                <path d={expArea} fill="url(#expGrad)" />

                {/* Draw Line Paths */}
                <path d={incLine} fill="none" stroke="#10B981" strokeWidth={3} strokeLinecap="round" />
                <path d={expLine} fill="none" stroke="#F43F5E" strokeWidth={3} strokeLinecap="round" />

                {/* Draw Coordinates Circles on Hover Points */}
                {incCoords.map((c, i) => (
                  <g key={`inc-dot-${i}`}>
                    <circle cx={c.x} cy={c.y} r="5" fill="#10B981" />
                    <circle cx={c.x} cy={c.y} r="2" fill="#ffffff" />
                  </g>
                ))}
                {expCoords.map((c, i) => (
                  <g key={`exp-dot-${i}`}>
                    <circle cx={c.x} cy={c.y} r="5" fill="#F43F5E" />
                    <circle cx={c.x} cy={c.y} r="2" fill="#ffffff" />
                  </g>
                ))}

                {/* X Axis Labels */}
                <g fill="#94A3B8" fontSize={10} textAnchor="middle" fontFamily="var(--font-sans)">
                  {chartMonths.map((m, i) => {
                    const x = 20 + (i * 460) / 5;
                    return <text key={m} x={x} y="175">{m}</text>;
                  })}
                </g>
              </svg>
            </div>
          </div>

          {/* AI Munim Insights Widget */}
          <div className="rounded-2xl border border-brand-border bg-brand-card/50 p-6 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-brand-mint animate-pulse" />
                <h3 className="font-display text-base font-bold text-white">AI Munim Assistant</h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">Intelligent review of your transactions</p>

              {/* Mock AI Insight Card */}
              <div className="mt-4 rounded-xl border border-brand-indigo/15 bg-brand-indigo/5 p-4">
                <p className="text-xs font-semibold text-brand-indigo uppercase tracking-wider">Cash Flow Summary</p>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  Your revenues increased by <span className="text-brand-mint font-semibold">12%</span> this month. Amit Kumar cleared part of his ledger. Total payables are low, resulting in a healthy cash cushion.
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-brand-amber/15 bg-brand-amber/5 p-4 flex gap-2.5">
                <AlertCircle size={15} className="text-brand-amber shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-300">
                  <span className="font-semibold text-brand-amber">Payment Reminder:</span> Rajesh Sharma has an outstanding payment of ₹8,500 due.
                </div>
              </div>
            </div>

            <Link
              href="/ai-munim"
              className="mt-6 flex w-full items-center justify-center gap-1 rounded-xl border border-brand-border bg-slate-900/60 py-2.5 text-xs font-semibold text-brand-mint hover:bg-slate-900 hover:text-white"
            >
              <span>Ask AI Munim</span>
              <ChevronRight size={14} />
            </Link>
          </div>

        </div>

        {/* 3. Recent Transaction Ledgers */}
        <div className="rounded-2xl border border-brand-border bg-brand-card/20 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-white">Recent Transactions</h3>
              <p className="text-xs text-slate-400">View latest book entries from your local ledger</p>
            </div>
            <Link
              href="/transactions"
              className="flex items-center gap-1 text-xs font-semibold text-brand-mint hover:underline"
            >
              <span>View All Ledgers</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-brand-border bg-[#0b0f19]/40">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 w-full animate-pulse rounded bg-slate-900"></div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-slate-500">No transactions recorded yet.</p>
                <Link
                  href="/transactions"
                  className="mt-3 text-xs font-semibold text-brand-mint hover:underline"
                >
                  Create your first transaction
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {transactions.slice(0, 4).map((tx) => {
                  const linkedParty = parties.find((p) => p.id === tx.partyId);
                  const isIncome = tx.type === "income";

                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-900/40">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 ${isIncome ? "bg-brand-emerald/10 text-brand-mint" : "bg-brand-rose/10 text-brand-rose"}`}>
                          {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {linkedParty ? linkedParty.name : "Cash Account"}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-slate-400">
                              {tx.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              {tx.date}
                            </span>
                            {tx.status !== "synced" && (
                              <span className="text-[10px] text-brand-amber font-medium italic">
                                Unsynced
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isIncome ? "text-brand-mint" : "text-brand-rose"}`}>
                          {isIncome ? "+" : "-"} {formatCurrency(tx.amount)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 truncate max-w-[150px] sm:max-w-[250px]">
                          {tx.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
