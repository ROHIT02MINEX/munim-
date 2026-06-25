"use client";

import React, { useState, useEffect } from "react";
import { db, type Transaction, type Party, type Category } from "@/lib/db";
import { useSync } from "@/lib/sync";
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  Upload, 
  X,
  FileImage,
  ImageIcon
} from "lucide-react";

export default function TransactionsPage() {
  const { queueAction } = useSync();
  
  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Form States
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [formCategory, setFormCategory] = useState("");
  const [formPartyId, setFormPartyId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formReceipt, setFormReceipt] = useState<string>("");
  const [formReceiptName, setFormReceiptName] = useState("");

  // Load Initial Data
  const loadData = async () => {
    try {
      const txs = await db.transactions.orderBy("date").reverse().toArray();
      const pts = await db.parties.toArray();
      const cats = await db.categories.toArray();
      setTransactions(txs);
      setParties(pts);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load transactions data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Form Modal Open
  const openAddModal = () => {
    setEditingTx(null);
    setFormAmount("");
    setFormType("income");
    setFormCategory(categories.find(c => c.type === "income")?.name || "Sales");
    setFormPartyId("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDescription("");
    setFormReceipt("");
    setFormReceiptName("");
    setIsModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setFormAmount(tx.amount.toString());
    setFormType(tx.type);
    setFormCategory(tx.category);
    setFormPartyId(tx.partyId || "");
    setFormDate(tx.date);
    setFormDescription(tx.description);
    setFormReceipt(tx.receiptImage || "");
    setFormReceiptName(tx.receiptImage ? "Receipt Attached" : "");
    setIsModalOpen(true);
  };

  // Convert uploaded image to Base64 for offline IndexedDB storage
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert("File is too large. Please select a receipt under 1.5MB.");
      return;
    }

    setFormReceiptName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormReceipt(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Save Transaction (Add / Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (!formCategory) {
      alert("Please select a category.");
      return;
    }

    try {
      if (editingTx) {
        // --- EDIT TRANSACTION ---
        // 1. Reverse old transaction's impact on old party balance
        if (editingTx.partyId) {
          const oldParty = await db.parties.get(editingTx.partyId);
          if (oldParty) {
            const reversedBalance = oldParty.balance - (editingTx.type === "expense" ? editingTx.amount : -editingTx.amount);
            await db.parties.update(editingTx.partyId, { balance: reversedBalance, status: "pending-update" });
            await queueAction("update", "party", editingTx.partyId, { ...oldParty, balance: reversedBalance });
          }
        }

        // 2. Build updated transaction object
        const updatedTx: Transaction = {
          ...editingTx,
          amount: amountNum,
          type: formType,
          category: formCategory,
          partyId: formPartyId || undefined,
          date: formDate,
          description: formDescription,
          receiptImage: formReceipt || undefined,
          status: "pending-update",
        };

        // 3. Save to database
        await db.transactions.put(updatedTx);
        await queueAction("update", "transaction", updatedTx.id, updatedTx);

        // 4. Apply new transaction's impact on new party balance
        if (formPartyId) {
          const newParty = await db.parties.get(formPartyId);
          if (newParty) {
            const newBalance = newParty.balance + (formType === "expense" ? amountNum : -amountNum);
            await db.parties.update(formPartyId, { balance: newBalance, status: "pending-update" });
            await queueAction("update", "party", formPartyId, { ...newParty, balance: newBalance });
          }
        }

      } else {
        // --- ADD TRANSACTION ---
        const newTxId = "tx_" + Date.now();
        const newTx: Transaction = {
          id: newTxId,
          amount: amountNum,
          type: formType,
          category: formCategory,
          partyId: formPartyId || undefined,
          date: formDate,
          description: formDescription,
          receiptImage: formReceipt || undefined,
          status: "pending-insert",
          createdAt: Date.now(),
        };

        // 1. Save transaction
        await db.transactions.add(newTx);
        await queueAction("insert", "transaction", newTxId, newTx);

        // 2. Adjust party balance
        if (formPartyId) {
          const party = await db.parties.get(formPartyId);
          if (party) {
            const newBalance = party.balance + (formType === "expense" ? amountNum : -amountNum);
            await db.parties.update(formPartyId, { balance: newBalance, status: "pending-update" });
            await queueAction("update", "party", formPartyId, { ...party, balance: newBalance });
          }
        }
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Failed to save transaction:", err);
      alert("Error saving transaction, check database size.");
    }
  };

  // Delete Transaction
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ledger entry?")) return;

    try {
      const tx = await db.transactions.get(id);
      if (tx) {
        // 1. Reverse party balance
        if (tx.partyId) {
          const party = await db.parties.get(tx.partyId);
          if (party) {
            const reversedBalance = party.balance - (tx.type === "expense" ? tx.amount : -tx.amount);
            await db.parties.update(tx.partyId, { balance: reversedBalance, status: "pending-update" });
            await queueAction("update", "party", tx.partyId, { ...party, balance: reversedBalance });
          }
        }

        // 2. Delete transaction locally
        await db.transactions.delete(id);
        await queueAction("delete", "transaction", id, null);
        
        loadData();
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  };

  // Filtered List
  const filteredTxs = transactions.filter((tx) => {
    const linkedParty = parties.find((p) => p.id === tx.partyId);
    const searchString = `${tx.description} ${tx.category} ${linkedParty ? linkedParty.name : "cash"}`.toLowerCase();
    
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || tx.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

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
        
        {/* Header Section */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Ledger Book
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage cashflow items, attach receipts, and reconcile accounts.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint px-4 py-2.5 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-95 self-start"
          >
            <Plus size={16} />
            <span>Record Entry</span>
          </button>
        </div>

        {/* 1. Filter Panel */}
        <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-4 backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4">
            
            {/* Search */}
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description, categories, parties..."
                className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/25"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Filter size={14} />
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}
                className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 pl-9 pr-4 text-xs text-white outline-none focus:border-brand-emerald"
              >
                <option value="all">All Flows (In/Out)</option>
                <option value="income">Inflow (Income)</option>
                <option value="expense">Outflow (Expense)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-4 text-xs text-white outline-none focus:border-brand-emerald"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* 2. Ledger Transaction Table / Cards */}
        <div className="rounded-2xl border border-brand-border bg-brand-card/20 overflow-hidden backdrop-blur-md">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-12 w-full animate-pulse rounded bg-slate-900/50"></div>
              ))}
            </div>
          ) : filteredTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-slate-900/50 p-4 border border-brand-border mb-3">
                <Filter size={24} className="text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">No matching transactions found in your ledger.</p>
              <button
                onClick={() => { setSearchTerm(""); setTypeFilter("all"); setCategoryFilter("all"); }}
                className="mt-2 text-xs text-brand-mint hover:underline font-semibold"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              
              {/* Desktop Table View */}
              <table className="w-full border-collapse text-left text-sm text-slate-300 hidden md:table">
                <thead className="bg-[#0b0f19]/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-brand-border">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Party / Ledger</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-center">Receipt</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border bg-transparent">
                  {filteredTxs.map((tx) => {
                    const party = parties.find((p) => p.id === tx.partyId);
                    const isInc = tx.type === "income";
                    return (
                      <tr key={tx.id} className="hover:bg-slate-900/35 transition-colors">
                        <td className="p-4 font-mono text-xs whitespace-nowrap">{tx.date}</td>
                        <td className="p-4">
                          <span className="font-semibold text-white">
                            {party ? party.name : "Cash Account"}
                          </span>
                          {party && (
                            <span className="ml-1.5 rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 border border-slate-700 capitalize">
                              {party.type}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="rounded bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 max-w-[200px] truncate" title={tx.description}>
                          {tx.description || "-"}
                        </td>
                        <td className="p-4 text-center">
                          {tx.receiptImage ? (
                            <button
                              onClick={() => {
                                const w = window.open();
                                w?.document.write(`<img src="${tx.receiptImage}" style="max-width:100%; border-radius:10px; box-shadow: 0 0 20px rgba(0,0,0,0.5)" />`);
                              }}
                              className="text-brand-indigo hover:text-white transition-colors"
                              title="View receipt attachment"
                            >
                              <FileImage size={16} className="mx-auto" />
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className={`p-4 text-right font-bold whitespace-nowrap ${isInc ? "text-brand-mint" : "text-brand-rose"}`}>
                          {isInc ? "+" : "-"} {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(tx)}
                              className="rounded border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                              title="Edit Ledger Entry"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="rounded border border-slate-800 p-1.5 text-slate-400 hover:bg-brand-rose/10 hover:text-brand-rose hover:border-brand-rose/20"
                              title="Delete Entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Card List View */}
              <div className="divide-y divide-brand-border md:hidden">
                {filteredTxs.map((tx) => {
                  const party = parties.find((p) => p.id === tx.partyId);
                  const isInc = tx.type === "income";
                  return (
                    <div key={tx.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">{party ? party.name : "Cash Account"}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{tx.date}</p>
                        </div>
                        <p className={`text-sm font-bold ${isInc ? "text-brand-mint" : "text-brand-rose"}`}>
                          {isInc ? "+" : "-"} {formatCurrency(tx.amount)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 border border-slate-700">
                          {tx.category}
                        </span>
                        <p className="text-slate-400 text-right truncate max-w-[180px]">{tx.description}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 text-xs">
                        <div>
                          {tx.receiptImage && (
                            <button
                              onClick={() => {
                                const w = window.open();
                                w?.document.write(`<img src="${tx.receiptImage}" style="max-width:100%; border-radius:10px;" />`);
                              }}
                              className="text-brand-indigo flex items-center gap-1"
                            >
                              <ImageIcon size={12} />
                              <span>View Receipt</span>
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(tx)}
                            className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800/40 rounded border border-slate-700/50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="text-brand-rose hover:text-red-300 px-2 py-1 bg-brand-rose/5 rounded border border-brand-rose/10"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>

        {/* 3. Record / Edit Ledger Entry Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl backdrop-blur-xl animate-float">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-brand-border pb-4">
                <h3 className="font-display text-lg font-bold text-white">
                  {editingTx ? "Edit Ledger Record" : "Record Book Entry"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Amount */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Amount (INR)
                    </label>
                    <div className="relative mt-1.5">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="Enter transaction amount"
                        className="block w-full rounded-xl border border-brand-border bg-slate-900/60 py-3 pl-8 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/30 font-bold text-base"
                      />
                    </div>
                  </div>

                  {/* Flow Type */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Transaction Type
                    </label>
                    <div className="mt-1.5 flex rounded-xl border border-brand-border bg-slate-900/50 p-1">
                      <button
                        type="button"
                        onClick={() => { setFormType("income"); setFormCategory(categories.find(c => c.type === "income")?.name || "Sales"); }}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                          formType === "income" ? "bg-brand-emerald text-brand-bg shadow" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Inflow (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormType("expense"); setFormCategory(categories.find(c => c.type === "expense")?.name || "Purchase"); }}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                          formType === "expense" ? "bg-brand-rose text-white shadow" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Outflow (-)
                      </button>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-3 text-xs text-white outline-none focus:border-brand-emerald"
                    />
                  </div>

                  {/* Category Selection */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-3 text-xs text-white outline-none focus:border-brand-emerald"
                    >
                      {categories
                        .filter((c) => c.type === formType)
                        .map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Party Association */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Linked Party (Optional)
                    </label>
                    <select
                      value={formPartyId}
                      onChange={(e) => setFormPartyId(e.target.value)}
                      className="mt-1.5 block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-3 text-xs text-white outline-none focus:border-brand-emerald"
                    >
                      <option value="">Cash Sale / General</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type === "customer" ? "Cust" : "Vend"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Description / Remarks
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                      placeholder="Add items detail, invoice number etc."
                      className="mt-1.5 block w-full rounded-xl border border-brand-border bg-slate-900/60 py-2 px-3 text-xs text-white outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/25"
                    />
                  </div>

                  {/* Receipt Photo Upload */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Attach Receipt Image
                    </label>
                    <div className="mt-1.5 flex items-center gap-3">
                      <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-900 hover:border-slate-500 transition-colors">
                        <Upload size={14} />
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-slate-500 truncate max-w-[250px]">
                        {formReceiptName || "No file chosen (Limit: 1.5MB)"}
                      </span>
                      {formReceipt && (
                        <button
                          type="button"
                          onClick={() => { setFormReceipt(""); setFormReceiptName(""); }}
                          className="text-xs text-brand-rose hover:underline font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* Modal Footer Actions */}
                <div className="mt-6 flex justify-end gap-3 border-t border-brand-border pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint px-5 py-2.5 text-xs font-semibold text-brand-bg shadow hover:opacity-90 active:scale-95"
                  >
                    Save Entry
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
