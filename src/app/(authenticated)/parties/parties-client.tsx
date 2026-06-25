"use client";

import React, { useState, useEffect } from "react";
import { db, type Party, type Transaction } from "@/lib/db";
import { useSync } from "@/lib/sync";
import { 
  Plus, 
  Search, 
  Users, 
  Phone, 
  Mail, 
  Trash2, 
  MessageSquare, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Share2,
} from "lucide-react";

export default function PartiesPage() {
  const { queueAction } = useSync();

  // Data States
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "vendor">("all");

  // Selection state for detailed ledger view
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; partyId: string }>({ isOpen: false, partyId: "" });

  // Form States
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formType, setFormType] = useState<"customer" | "vendor">("customer");
  const [formOpeningBalance, setFormOpeningBalance] = useState("");

  const loadData = async () => {
    try {
      const partyList = await db.parties.toArray();
      const txList = await db.transactions.toArray();
      setParties(partyList);
      setTransactions(txList);
    } catch (err) {
      console.error("Failed to load parties:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener("munim-db-changed", loadData);
    return () => window.removeEventListener("munim-db-changed", loadData);
  }, []);

  // Handle Add Party
  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) {
      alert("Name is required.");
      return;
    }

    const openingBal = parseFloat(formOpeningBalance) || 0;
    // For vendors, opening balance is typically payable, i.e. negative. We automatically convert positive balance to negative if vendor.
    const adjustedBalance = formType === "vendor" ? -Math.abs(openingBal) : Math.abs(openingBal);

    try {
      const newPartyId = "p_" + Date.now();
      const newParty: Party = {
        id: newPartyId,
        name: formName,
        phone: formPhone || undefined,
        email: formEmail || undefined,
        type: formType,
        balance: adjustedBalance,
        status: "pending-insert",
      };

      // 1. Add party record
      await db.parties.add(newParty);
      await queueAction("insert", "party", newPartyId, newParty);

      // 2. If there's an opening balance, log a transaction for historical record
      if (adjustedBalance !== 0) {
        const txId = "tx_opening_" + Date.now();
        const tx: Transaction = {
          id: txId,
          amount: Math.abs(adjustedBalance),
          type: adjustedBalance > 0 ? "income" : "expense",
          category: adjustedBalance > 0 ? "Sales" : "Purchase",
          partyId: newPartyId,
          date: new Date().toISOString().split("T")[0],
          description: "Opening balance",
          status: "pending-insert",
          createdAt: Date.now(),
        };
        await db.transactions.add(tx);
        await queueAction("insert", "transaction", txId, tx);
      }

      // Reset Form
      setFormName("");
      setFormPhone("");
      setFormEmail("");
      setFormType("customer");
      setFormOpeningBalance("");
      setIsAddModalOpen(false);
      
      loadData();
      window.dispatchEvent(new Event("munim-db-changed"));
    } catch (err) {
      console.error("Failed to add party:", err);
    }
  };

  // Delete Party
  const handleDeleteParty = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening detailed ledger
    setDeleteConfirm({ isOpen: true, partyId: id });
  };

  const executeDeleteParty = async (id: string) => {
    try {
      await db.parties.delete(id);
      await queueAction("delete", "party", id, null);
      if (selectedParty?.id === id) {
        setSelectedParty(null);
      }
      loadData();
      window.dispatchEvent(new Event("munim-db-changed"));
    } catch (err) {
      console.error("Failed to delete party:", err);
      alert("Failed to delete party.");
    }
  };

  // Generate WhatsApp Payment Reminder link
  const getWhatsAppReminderLink = (party: Party) => {
    if (!party.phone) return "#";
    const bal = party.balance;
    let message = "";
    
    if (bal > 0) {
      // Customer owes us
      message = `Dear ${party.name},\n\nThis is a friendly reminder that you have an outstanding balance of ₹${new Intl.NumberFormat("en-IN").format(bal)} due in your account with us.\n\nPlease clear the dues at your earliest convenience.\n\nThank you,\nMunim Ledger System`;
    } else if (bal < 0) {
      // We owe vendor (just in case they want to confirm ledger status)
      message = `Dear ${party.name},\n\nWe wanted to share our ledger balance status. The current payable balance on our account with you is ₹${new Intl.NumberFormat("en-IN").format(Math.abs(bal))}.\n\nPlease let us know if this matches your books.\n\nThank you!`;
    } else {
      message = `Dear ${party.name},\n\nWe have reconciled our ledger accounts. Your outstanding balance is currently nil (₹0). Thank you for being a valued business partner!`;
    }

    return `https://api.whatsapp.com/send?phone=91${party.phone}&text=${encodeURIComponent(message)}`;
  };

  // Filtered Parties
  const filteredParties = parties.filter((p) => {
    const searchString = `${p.name} ${p.phone || ""} ${p.email || ""}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate totals
  const totalReceivables = parties
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  const totalPayables = Math.abs(
    parties
      .filter((p) => p.balance < 0)
      .reduce((sum, p) => sum + p.balance, 0)
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Selected party transactions list
  const selectedPartyTxs = selectedParty 
    ? transactions.filter((t) => t.partyId === selectedParty.id).sort((a,b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <div className="space-y-6">
        
        {/* Header Title Section */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Contacts & Parties
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage client receivables, supplier payables, and send instant payment links.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint px-4 py-2.5 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-95 self-start"
          >
            <Plus size={16} />
            <span>Create Contact</span>
          </button>
        </div>

        {/* 1. Quick Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Customer Receivables</p>
              <p className="mt-1.5 text-2xl font-bold text-brand-mint">{formatCurrency(totalReceivables)}</p>
            </div>
            <div className="rounded-full bg-brand-emerald/10 p-3 text-brand-mint">
              <TrendingUp size={22} />
            </div>
          </div>
          
          <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Supplier Payables</p>
              <p className="mt-1.5 text-2xl font-bold text-brand-rose">{formatCurrency(totalPayables)}</p>
            </div>
            <div className="rounded-full bg-brand-rose/10 p-3 text-brand-rose">
              <TrendingDown size={22} />
            </div>
          </div>
        </div>

        {/* 2. Directory Layout (Left Panel: List, Right Panel: Ledger Details) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Left / Middle: Contacts List */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Filters */}
            <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-4 flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search contact by name or number..."
                  className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | "customer" | "vendor")}
                className="block rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-3 text-xs text-white outline-none focus:border-brand-emerald"
              >
                <option value="all">All Contacts</option>
                <option value="customer">Customers Only</option>
                <option value="vendor">Vendors Only</option>
              </select>
            </div>

            {/* Contacts Table/Directory */}
            <div className="rounded-2xl border border-brand-border bg-brand-card/15 overflow-hidden backdrop-blur-md">
              {isLoading ? (
                <div className="p-8 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-14 w-full animate-pulse rounded bg-slate-900/50"></div>
                  ))}
                </div>
          ) : parties.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-300">No Parties Yet.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Keep track of your clients, suppliers, or other relationships. Click &quot;Create Contact&quot; to begin.
              </p>
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-slate-500">No matching contacts found in your database.</p>
            </div>
              ) : (
                <div className="divide-y divide-brand-border">
                  {filteredParties.map((party) => {
                    const isSelect = selectedParty?.id === party.id;
                    const isReceivable = party.balance > 0;
                    const isPayable = party.balance < 0;

                    return (
                      <div
                        key={party.id}
                        onClick={() => setSelectedParty(party)}
                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-900/40 transition-colors ${
                          isSelect ? "bg-slate-900/55 border-l-2 border-brand-emerald" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold uppercase ${
                            party.type === "customer" ? "text-brand-mint" : "text-brand-indigo"
                          }`}>
                            {party.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white text-sm">{party.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold border ${
                                party.type === "customer" 
                                  ? "bg-brand-emerald/10 border-brand-emerald/20 text-brand-mint"
                                  : "bg-brand-indigo/10 border-brand-indigo/20 text-brand-indigo"
                              }`}>
                                {party.type}
                              </span>
                            </div>
                            <div className="mt-0.5 flex gap-3 text-xs text-slate-400">
                              {party.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone size={11} /> {party.phone}
                                </span>
                              )}
                              {party.email && (
                                <span className="hidden items-center gap-1 sm:flex">
                                  <Mail size={11} /> {party.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Balance Column */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`text-sm font-bold ${
                              isReceivable ? "text-brand-mint" : isPayable ? "text-brand-rose" : "text-slate-400"
                            }`}>
                              {isReceivable ? "+" : ""}{formatCurrency(party.balance)}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase font-semibold">
                              {isReceivable ? "Receivable" : isPayable ? "Payable" : "Settled"}
                            </p>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteParty(party.id, e)}
                            className="rounded p-1.5 border border-transparent text-slate-500 hover:text-brand-rose hover:bg-slate-900 transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Detailed Ledger */}
          <div>
            {selectedParty ? (
              <div className="rounded-2xl border border-brand-border bg-brand-card/50 p-6 backdrop-blur-md sticky top-24 space-y-6 glow-indigo">
                
                {/* Close detail panel */}
                <div className="flex justify-between items-start border-b border-brand-border pb-4">
                  <div>
                    <h3 className="font-display font-bold text-white text-base leading-tight">{selectedParty.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">{selectedParty.type} Ledger</p>
                  </div>
                  <button
                    onClick={() => setSelectedParty(null)}
                    className="rounded-full border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Balance & WhatsApp Action */}
                <div className="rounded-xl border border-slate-800 bg-[#080d15] p-4 text-center">
                  <span className="text-xs text-slate-400 font-medium">Outstanding Account Balance</span>
                  <p className={`mt-2 text-2xl font-black ${
                    selectedParty.balance > 0 ? "text-brand-mint" : selectedParty.balance < 0 ? "text-brand-rose" : "text-slate-400"
                  }`}>
                    {formatCurrency(selectedParty.balance)}
                  </p>
                  
                  {selectedParty.phone && (
                    <a
                      href={getWhatsAppReminderLink(selectedParty)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-brand-emerald px-4 py-2 text-xs font-bold text-brand-bg shadow-md hover:bg-brand-mint active:scale-95 transition-transform"
                    >
                      <MessageSquare size={13} className="stroke-[2.5]" />
                      <span>Send Payment Reminder</span>
                      <Share2 size={12} />
                    </a>
                  )}
                </div>

                {/* Historical Ledger List */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ledger Entries</h4>
                  <div className="mt-3.5 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {selectedPartyTxs.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">No transaction records associated with this contact.</p>
                    ) : (
                      selectedPartyTxs.map((t) => {
                        const isIncome = t.type === "income";
                        return (
                          <div key={t.id} className="flex justify-between items-center bg-[#0b0f19]/40 p-3 rounded-lg border border-slate-800/40 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-200">{t.category}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{t.date}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{t.description}</p>
                            </div>
                            <span className={`font-bold ${isIncome ? "text-brand-mint" : "text-brand-rose"}`}>
                              {isIncome ? "+" : "-"} {formatCurrency(t.amount)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="rounded-2xl border border-brand-border border-dashed bg-slate-900/10 p-12 text-center text-xs text-slate-500 lg:sticky lg:top-24">
                <Users size={24} className="mx-auto mb-2 text-slate-600" />
                <span>Select a contact from the directory to review their detailed transaction ledger and send WhatsApp payment notifications.</span>
              </div>
            )}
          </div>

        </div>

        {/* 3. Add Contact Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl backdrop-blur-xl animate-float">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-brand-border pb-4">
                <h3 className="font-display text-lg font-bold text-white">Create New Contact</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-full border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleAddParty} className="mt-4 space-y-4">
                
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="E.g. Amit Kumar"
                    className="mt-1.5 block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    WhatsApp Phone Number
                  </label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs text-slate-400 font-semibold border-r border-slate-700/80 pr-1.5 pr-2">+91</span>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 pl-16 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="E.g. amit@gmail.com"
                    className="mt-1.5 block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
                  />
                </div>

                {/* Party Type */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contact Type
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-brand-border bg-slate-900/50 p-1">
                    <button
                      type="button"
                      onClick={() => setFormType("customer")}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                        formType === "customer" ? "bg-brand-emerald text-brand-bg shadow" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Customer (Receivable)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("vendor")}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                        formType === "vendor" ? "bg-brand-indigo text-white shadow" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Vendor (Payable)
                    </button>
                  </div>
                </div>

                {/* Opening Balance */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Opening Ledger Balance (Optional)
                  </label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">₹</span>
                    <input
                      type="number"
                      value={formOpeningBalance}
                      onChange={(e) => setFormOpeningBalance(e.target.value)}
                      placeholder="E.g. 5000"
                      className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 pl-7 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Will record a transaction automatically for accounts setup.
                  </p>
                </div>

                {/* Modal Footer */}
                <div className="mt-6 flex justify-end gap-3 border-t border-brand-border pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint px-5 py-2.5 text-xs font-semibold text-brand-bg shadow hover:opacity-90 active:scale-95"
                  >
                    Save Contact
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

        {/* Simplified Deletion Modal */}
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl backdrop-blur-xl animate-float">
              <h3 className="font-display text-lg font-bold text-white">Delete Party?</h3>
              <p className="mt-2 text-xs text-slate-400">This action cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-3 border-t border-brand-border pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ isOpen: false, partyId: "" })}
                  className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = deleteConfirm.partyId;
                    setDeleteConfirm({ isOpen: false, partyId: "" });
                    await executeDeleteParty(id);
                  }}
                  className="rounded-xl bg-brand-rose px-5 py-2.5 text-xs font-semibold text-white shadow hover:opacity-90 active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
