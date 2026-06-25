"use client";

import React, { useState, useEffect } from "react";
import { db, type Transaction, type Party } from "@/lib/db";
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Printer, 
  PieChart as PieIcon,
  BarChart4,
} from "lucide-react";

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const txs = await db.transactions.toArray();
      const pts = await db.parties.toArray();
      setTransactions(txs);
      setParties(pts);
    } catch (err) {
      console.error("Failed to load reports data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener("munim-db-changed", loadData);
    return () => window.removeEventListener("munim-db-changed", loadData);
  }, []);

  // Calculations
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // Group Expenses by Category
  const expenseByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const categoryList = Object.entries(expenseByCategory)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Categories Color Scheme
  const catColors = [
    "#8B5CF6", // Violet
    "#EF4444", // Rose/Red
    "#F59E0B", // Amber
    "#3B82F6", // Blue
    "#EC4899", // Pink
    "#10B981", // Emerald
    "#6B7280", // Slate
  ];

  // Group Transactions by Month dynamically (Last 6 Months)
  const getLast6Months = () => {
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const label = targetDate.toLocaleString("default", { month: "short" });
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      months.push({ label, year, monthIndex });
    }
    return months;
  };

  const dynamicMonths = getLast6Months();
  const monthlyData = dynamicMonths.map(m => {
    const income = transactions
      .filter(t => t.type === "income" && new Date(t.date).getMonth() === m.monthIndex && new Date(t.date).getFullYear() === m.year)
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter(t => t.type === "expense" && new Date(t.date).getMonth() === m.monthIndex && new Date(t.date).getFullYear() === m.year)
      .reduce((sum, t) => sum + t.amount, 0);
    return { month: m.label, income, expense };
  });

  const maxMonthVal = Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1000) * 1.1;

  // Custom SVG Donut Chart logic
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // 314.16

  const donutSegments = categoryList.map((cat, index) => {
    const accumulatedPercent = categoryList
      .slice(0, index)
      .reduce((sum, item) => sum + item.percentage, 0);
    const percent = cat.percentage;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = `${circumference - (accumulatedPercent / 100) * circumference}`;
    return {
      ...cat,
      strokeDasharray,
      strokeDashoffset,
      color: catColors[index % catColors.length],
    };
  });

  // Export CSV Helper
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert("No data available to export.");
      return;
    }

    let csvContent = "Transaction ID,Date,Type,Category,Party Name,Amount (INR),Description,Status\n";

    transactions.forEach((tx) => {
      const party = parties.find((p) => p.id === tx.partyId);
      const partyName = party ? party.name : "Cash Account";
      const cleanedDesc = tx.description ? tx.description.replace(/"/g, '""') : "";
      
      csvContent += `"${tx.id}","${tx.date}","${tx.type}","${tx.category}","${partyName}",${tx.amount},"${cleanedDesc}","${tx.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Munim_Ledger_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <div className="space-y-6">
        
        {/* Header Options */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center no-print">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Reports & Financials
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Download audits, check category breakdowns, and export spreadsheet files.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl border border-brand-border bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              <Printer size={15} />
              <span>Print Statement</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint px-4 py-2.5 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-95"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* PRINT ONLY HEADER */}
        <div className="hidden print:block text-center border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-black">Munim Ledger Statement</h1>
          <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* 1. Core Summary cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          
          <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md print-card">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cash Inflow</span>
            <p className="mt-2 text-2xl font-bold text-brand-mint">{formatCurrency(totalIncome)}</p>
            <div className="mt-2 text-[10px] text-brand-mint flex items-center gap-1">
              <TrendingUp size={12} /> Revenues & Cash Deposits
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md print-card">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cash Outflow</span>
            <p className="mt-2 text-2xl font-bold text-brand-rose">{formatCurrency(totalExpense)}</p>
            <div className="mt-2 text-[10px] text-brand-rose flex items-center gap-1">
              <TrendingDown size={12} /> Expenditures & Supplier Payments
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md print-card">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Accounting Cashflow</span>
            <p className={`mt-2 text-2xl font-bold ${totalIncome - totalExpense >= 0 ? "text-brand-mint" : "text-brand-rose"}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
            <div className="mt-2 text-[10px] text-slate-500">
              Net balance inside cash account
            </div>
          </div>

        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-card/20 p-12 text-center backdrop-blur-md">
            <p className="text-sm font-semibold text-slate-300">No transactions yet.</p>
            <p className="text-xs text-slate-400 mt-1">No transactions yet. Add your first transaction to get started.</p>
          </div>
        ) : (
          <>
            {/* 2. Visual Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              
              {/* Expenses Category Distribution Donut Chart */}
              <div className="rounded-2xl border border-brand-border bg-brand-card/25 p-6 backdrop-blur-md print-card">
                <div className="flex items-center gap-2 mb-4">
                  <PieIcon size={16} className="text-brand-indigo" />
                  <h3 className="font-display text-base font-bold text-white">Expense Category Breakdown</h3>
                </div>

                {isLoading ? (
                  <div className="h-48 w-full animate-pulse rounded bg-slate-900/50"></div>
                ) : categoryList.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                    No expense data recorded.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                    
                    {/* SVG Donut */}
                    <div className="relative h-40 w-40 shrink-0">
                      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="transparent" stroke="#1e293b" strokeWidth="12" />
                        {donutSegments.map((seg) => (
                          <circle
                            key={seg.name}
                            cx="60"
                            cy="60"
                            r="50"
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth="12"
                            strokeDasharray={seg.strokeDasharray}
                            strokeDashoffset={seg.strokeDashoffset}
                            strokeLinecap="round"
                          />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Expenses</span>
                        <span className="text-sm font-bold text-white mt-0.5">{formatCurrency(totalExpense)}</span>
                      </div>
                    </div>

                    {/* Legends */}
                    <div className="flex-1 space-y-2">
                      {donutSegments.slice(0, 5).map((seg) => (
                        <div key={seg.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }}></span>
                            <span className="text-slate-300 font-medium">{seg.name}</span>
                          </div>
                          <span className="text-slate-400 font-semibold">{seg.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                      {donutSegments.length > 5 && (
                        <p className="text-[10px] text-slate-500 italic pl-4.5">+{donutSegments.length - 5} more categories</p>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Side-by-side Monthly Inflow vs Outflow Bar Chart */}
              <div className="rounded-2xl border border-brand-border bg-brand-card/25 p-6 backdrop-blur-md print-card">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart4 size={16} className="text-brand-indigo" />
                  <h3 className="font-display text-base font-bold text-white">Monthly Cashflow Comparisons</h3>
                </div>

                {/* Custom SVG Bar Chart */}
                <div className="h-48 w-full flex items-end justify-center py-2">
                  <svg viewBox="0 0 500 160" width="100%" height="100%" className="overflow-visible">
                    <g stroke="#ffffff" strokeOpacity={0.04} strokeDasharray="2 2">
                      <line x1="20" y1="20" x2="480" y2="20" />
                      <line x1="20" y1="65" x2="480" y2="65" />
                      <line x1="20" y1="110" x2="480" y2="110" />
                    </g>

                    {/* Draw side-by-side rects for each month */}
                    {monthlyData.map((d, index) => {
                      const xGroup = 25 + (index * 450) / 6;
                      
                      const incHeight = (d.income / maxMonthVal) * 110;
                      const expHeight = (d.expense / maxMonthVal) * 110;

                      const yInc = 130 - incHeight;
                      const yExp = 130 - expHeight;

                      return (
                        <g key={d.month}>
                          {/* Income Bar (Emerald) */}
                          <rect
                            x={xGroup}
                            y={yInc}
                            width="18"
                            height={incHeight}
                            rx="4"
                            fill="#10B981"
                            opacity="0.85"
                          />
                          
                          {/* Expense Bar (Rose) */}
                          <rect
                            x={xGroup + 22}
                            y={yExp}
                            width="18"
                            height={expHeight}
                            rx="4"
                            fill="#F43F5E"
                            opacity="0.85"
                          />

                          {/* Month Text */}
                          <text
                            x={xGroup + 20}
                            y="150"
                            fill="#94A3B8"
                            fontSize={10}
                            textAnchor="middle"
                            fontFamily="var(--font-sans)"
                          >
                            {d.month}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

            </div>

            {/* 3. Detailed Audit Ledger Log Table */}
            <div className="rounded-2xl border border-brand-border bg-brand-card/15 overflow-hidden backdrop-blur-md print-card">
              <div className="p-4 border-b border-brand-border">
                <h3 className="font-display text-base font-bold text-white">Full Transaction Audit Log</h3>
                <p className="text-xs text-slate-400">Chronological history of all bookkeeping records</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs text-slate-300">
                  <thead className="bg-[#0b0f19]/60 font-semibold uppercase tracking-wider text-slate-400 border-b border-brand-border">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Amount (INR)</th>
                      <th className="p-3 text-center no-print">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border bg-transparent">
                    {transactions.map((tx) => {
                      const isInc = tx.type === "income";
                      return (
                        <tr key={tx.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-3 font-mono whitespace-nowrap">{tx.date}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 font-bold uppercase text-[9px] border ${
                              isInc 
                                ? "bg-brand-emerald/10 border-brand-emerald/20 text-brand-mint" 
                                : "bg-brand-rose/10 border-brand-rose/20 text-brand-rose"
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-white">{tx.category}</td>
                          <td className="p-3 text-slate-400 truncate max-w-[200px]" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className={`p-3 text-right font-bold whitespace-nowrap ${isInc ? "text-brand-mint" : "text-brand-rose"}`}>
                            {isInc ? "+" : "-"} {formatCurrency(tx.amount)}
                          </td>
                          <td className="p-3 text-center no-print font-mono text-[9px] text-slate-500 capitalize">
                            {tx.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </>
  );
}
