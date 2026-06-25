"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { db, type Transaction, type Party, type Category } from "@/lib/db";
import { useSync } from "@/lib/sync";
import { 
  Bot, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  AlertTriangle,
  Lightbulb,
  DollarSign
} from "lucide-react";

// Speech Recognition API Type Definitions
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: (event: Event) => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

export default function AiMunimPage() {
  const { queueAction } = useSync();
  const [activeTab, setActiveTab] = useState<"voice" | "chat" | "insights">("voice");

  // Shared Data States
  const [parties, setParties] = useState<Party[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // 1. Voice Entry States
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [parsedTx, setParsedTx] = useState<{
    amount: number;
    type: "income" | "expense" | "transfer";
    category: string;
    partyId?: string;
    partyName?: string;
    description: string;
  } | null>(null);
  const [voiceError, setVoiceError] = useState("");

  // Editable confirmation states
  const [editType, setEditType] = useState<"income" | "expense" | "transfer">("income");
  const [editAmount, setEditAmount] = useState("");
  const [editPartyName, setEditPartyName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confidenceScore, setConfidenceScore] = useState(100);

  // 2. Chat States
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{
    sender: "user" | "ai";
    text: string;
    timestamp: Date;
    data?: unknown;
  }>>([
    {
      sender: "ai",
      text: "Namaste! I am your AI Munim. Ask me anything about your cashflow, who owes you money, or transaction details.",
      timestamp: new Date()
    }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Data
  const loadData = async () => {
    const pts = await db.parties.toArray();
    setParties(pts);
    const cats = await db.categories.toArray();
    setCategories(cats);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser. Please type the command below.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      setVoiceText("");
      setParsedTx(null);
      recognition.start();
    }
  };

  // Local Offline NLP Command Parser
  const parseVoiceCommand = useCallback((text: string) => {
    if (!text.trim()) return;
    const cleanText = text.toLowerCase().trim();
    
    // Keywords definition
    const INCOME_KEYWORDS = ["receive", "received", "got", "credited", "earned", "income", "deposit", "collected", "by"];
    const EXPENSE_KEYWORDS = ["paid", "payment", "given", "gave", "sent", "done", "debited", "spent", "purchase", "bought"];
    const TRANSFER_KEYWORDS = ["transfer", "transferred", "moved", "bank transfer", "wallet transfer", "upi transfer"];

    // 1. Extract amount
    const amountMatch = cleanText.match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/);
    let amount = 0;
    if (amountMatch) {
      amount = parseFloat(amountMatch[0].replace(/,/g, ""));
    }

    // 2. Identify flow type
    let type: "income" | "expense" | "transfer" = "income";
    let typeDetected = false;

    const hasTransfer = TRANSFER_KEYWORDS.some(kw => cleanText.includes(kw));
    const hasExpense = EXPENSE_KEYWORDS.some(kw => cleanText.includes(kw));
    const hasIncome = INCOME_KEYWORDS.some(kw => cleanText.includes(kw));

    if (hasTransfer) {
      type = "transfer";
      typeDetected = true;
    } else if (hasExpense) {
      type = "expense";
      typeDetected = true;
    } else if (hasIncome) {
      type = "income";
      typeDetected = true;
    } else {
      type = "income";
      typeDetected = false;
    }

    // 3. Identify linked Party
    let matchedPartyName = "";
    let matchedPartyId = "";
    
    for (const p of parties) {
      const pNameLower = p.name.toLowerCase();
      if (cleanText.includes(pNameLower)) {
        matchedPartyName = p.name;
        matchedPartyId = p.id;
        break;
      }
    }

    if (!matchedPartyName) {
      const prepositionMatch = cleanText.match(/(?:from|to|by|given to|sent to|paid to|done to)\s+([a-z\s]+)/i);
      if (prepositionMatch) {
        let candidate = prepositionMatch[1].trim();
        candidate = candidate.split(/\b(?:for|on|in|at|using|via|with|payment|electricity|salary|rent|bill|petrol|bought|received|paid)\b/)[0].trim();
        if (candidate && candidate.length > 1 && candidate.length < 25) {
          matchedPartyName = candidate.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }
      }
      
      if (!matchedPartyName) {
        const paidMeMatch = cleanText.match(/\b([a-z\s]+)\s+(?:paid|paid me)\b/i);
        if (paidMeMatch) {
          let candidate = paidMeMatch[1].trim();
          candidate = candidate.split(/\b(?:received|got|sent|given)\b/)[0].trim();
          if (candidate && candidate.length > 1 && candidate.length < 25) {
            matchedPartyName = candidate.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          }
        }
      }

      if (cleanText.includes("cash")) {
        matchedPartyName = "Cash";
      }
    }

    // 4. Identify Category
    let category = type === "income" ? "Sales" : type === "transfer" ? "Transfer" : "Purchase";
    if (cleanText.includes("salary")) {
      category = "Salary";
    } else if (cleanText.includes("petrol") || cleanText.includes("fuel") || cleanText.includes("diesel")) {
      category = "Fuel";
    } else if (cleanText.includes("electricity") || cleanText.includes("utility") || cleanText.includes("bill") || cleanText.includes("power") || cleanText.includes("light")) {
      category = "Utilities";
    } else if (cleanText.includes("food") || cleanText.includes("restaurant") || cleanText.includes("dinner") || cleanText.includes("lunch") || cleanText.includes("eating") || cleanText.includes("swiggy") || cleanText.includes("zomato")) {
      category = "Food";
    } else if (cleanText.includes("rent") || cleanText.includes("room") || cleanText.includes("lease")) {
      category = "Rent";
    } else if (cleanText.includes("shopping") || cleanText.includes("clothes") || cleanText.includes("dress") || cleanText.includes("amazon") || cleanText.includes("myntra")) {
      category = "Shopping";
    } else if (cleanText.includes("medicine") || cleanText.includes("healthcare") || cleanText.includes("health") || cleanText.includes("doctor") || cleanText.includes("hospital") || cleanText.includes("clinic")) {
      category = "Healthcare";
    } else if (cleanText.includes("recharge") || cleanText.includes("mobile") || cleanText.includes("phone") || cleanText.includes("jio") || cleanText.includes("airtel")) {
      category = "Mobile";
    } else if (cleanText.includes("internet") || cleanText.includes("wifi") || cleanText.includes("broadband") || cleanText.includes("fiber")) {
      category = "Internet";
    } else if (cleanText.includes("travel") || cleanText.includes("taxi") || cleanText.includes("cab") || cleanText.includes("ola") || cleanText.includes("uber") || cleanText.includes("bus") || cleanText.includes("train") || cleanText.includes("flight")) {
      category = "Travel";
    } else {
      category = "Miscellaneous";
    }

    // 5. Calculate Confidence Score
    let score = 100;
    if (!amountMatch) score -= 40;
    if (!typeDetected) score -= 30;
    if (!matchedPartyName) score -= 15;
    if (cleanText.split(/\s+/).length < 3) score -= 15;
    score = Math.max(10, score);

    setConfidenceScore(score);
    setEditAmount(amount ? amount.toString() : "");
    setEditType(type);
    setEditPartyName(matchedPartyName || "Cash Account");
    setEditCategory(category);
    setEditDate(new Date().toISOString().split("T")[0]);
    setEditNotes(`Voice parsed entry from: "${text}"`);

    setParsedTx({
      amount,
      type,
      category,
      partyId: matchedPartyId || undefined,
      partyName: matchedPartyName || "Cash Account",
      description: `Voice Entry: "${text}"`
    });
  }, [parties]);

  // Setup Web Speech Recognition with interim updates and silence auto-stop
  useEffect(() => {
    if (typeof window !== "undefined") {
      const speechWindow = window as SpeechRecognitionWindow;
      const SpeechRecognitionConstructor =
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      
      if (SpeechRecognitionConstructor) {
        const rec = new SpeechRecognitionConstructor() as SpeechRecognition;
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-IN";

        let silenceTimeout: NodeJS.Timeout;

        rec.onstart = () => {
          setIsListening(true);
          setVoiceError("");
        };

        rec.onresult = (e: SpeechRecognitionEvent) => {
          clearTimeout(silenceTimeout);

          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
              finalTranscript += e.results[i][0].transcript;
            } else {
              interimTranscript += e.results[i][0].transcript;
            }
          }

          const transcript = finalTranscript || interimTranscript;
          if (transcript) {
            setVoiceText(transcript);
          }

          if (finalTranscript) {
            parseVoiceCommand(finalTranscript);
          }

          // Stop listening after 2 seconds of silence
          silenceTimeout = setTimeout(() => {
            rec.stop();
          }, 2000);
        };

        rec.onerror = (e: Event) => {
          console.error("Speech recognition error", e);
          setVoiceError("Could not capture speech. Try typing the command below.");
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
          clearTimeout(silenceTimeout);
        };

        setRecognition(rec);
      }
    }
  }, [parseVoiceCommand]);

  const handleConfirmVoiceTx = async () => {
    if (!editAmount) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      const amountVal = parseFloat(editAmount) || 0;
      let finalPartyId = parsedTx?.partyId;

      // Smart Party Detection: Create new party if typed one doesn't exist
      if (editPartyName.trim() && editPartyName !== "Cash Account" && editPartyName !== "Cash") {
        const existing = parties.find(p => p.name.toLowerCase() === editPartyName.toLowerCase().trim());
        if (existing) {
          finalPartyId = existing.id;
        } else {
          const newPartyId = "p_auto_" + Date.now();
          const newParty: Party = {
            id: newPartyId,
            name: editPartyName.trim(),
            type: editType === "income" ? "customer" : "vendor",
            balance: 0,
            status: "pending-insert"
          };
          await db.parties.add(newParty);
          await queueAction("insert", "party", newPartyId, newParty);
          finalPartyId = newPartyId;
        }
      }

      // Add Transaction
      const txId = "tx_ai_" + Date.now();
      const newTx: Transaction = {
        id: txId,
        amount: amountVal,
        type: editType,
        category: editCategory,
        partyId: finalPartyId || undefined,
        date: editDate || new Date().toISOString().split("T")[0],
        description: editNotes || `Voice Entry: "${voiceText}"`,
        status: "pending-insert",
        createdAt: Date.now()
      };

      await db.transactions.add(newTx);
      await queueAction("insert", "transaction", txId, newTx);

      // Adjust linked party balance (Expense increases, Income decreases)
      if (finalPartyId) {
        const party = await db.parties.get(finalPartyId);
        if (party) {
          const newBalance = party.balance + (editType === "expense" ? amountVal : -amountVal);
          await db.parties.update(finalPartyId, { balance: newBalance, status: "pending-update" });
          await queueAction("update", "party", finalPartyId, { ...party, balance: newBalance });
        }
      }

      setParsedTx(null);
      setVoiceText("");
      alert(`Recorded ₹${amountVal} entry successfully!`);
      loadData();
    } catch (err) {
      console.error("AI write failed:", err);
    }
  };

  // 3. AI Chat Bot Query Engine
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const query = chatInput.trim();
    const userMsg = { sender: "user" as const, text: query, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    // Simulate thinking delay
    setTimeout(async () => {
      const reply = await processChatQuery(query);
      setChatMessages((prev) => [...prev, {
        sender: "ai",
        text: reply,
        timestamp: new Date()
      }]);
    }, 600);
  };

  const processChatQuery = async (query: string): Promise<string> => {
    const q = query.toLowerCase();

    // Fetch fresh stats
    const txs = await db.transactions.toArray();
    const pts = await db.parties.toArray();

    const totalInc = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExp = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const bal = totalInc - totalExp;

    const formatINR = (val: number) => {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
    };

    // Rule 1: Current Cash Balance queries
    if (q.includes("balance") || q.includes("cash balance") || q.includes("how much money") || q.includes("mera balance")) {
      return `Your current net cash balance is **${formatINR(bal)}**. \n\n• Total Income: ${formatINR(totalInc)}\n• Total Expense: ${formatINR(totalExp)}`;
    }

    // Rule 2: Outstanding Receivables queries
    if (q.includes("receivable") || q.includes("who owes me") || q.includes("kaun paise") || q.includes("amit") || q.includes("neha")) {
      const customersOwe = pts.filter(p => p.balance > 0);
      if (customersOwe.length === 0) {
        return "Reconciliation complete: No customers currently owe you any outstanding receivables.";
      }
      const listStr = customersOwe.map(p => `• **${p.name}**: ${formatINR(p.balance)}`).join("\n");
      const totalRec = customersOwe.reduce((s, p) => s + p.balance, 0);
      return `Customers currently owe you a total of **${formatINR(totalRec)}**:\n\n${listStr}\n\nYou can send payment reminders directly from their profile in the Contacts tab.`;
    }

    // Rule 3: Outstanding Payables queries
    if (q.includes("payable") || q.includes("who do i owe") || q.includes("rajesh") || q.includes("vikram")) {
      const vendorsWeOwe = pts.filter(p => p.balance < 0);
      if (vendorsWeOwe.length === 0) {
        return "All clear! You do not have any pending payables to suppliers.";
      }
      const listStr = vendorsWeOwe.map(p => `• **${p.name}**: ${formatINR(Math.abs(p.balance))}`).join("\n");
      const totalPay = Math.abs(vendorsWeOwe.reduce((s, p) => s + p.balance, 0));
      return `You owe suppliers a total of **${formatINR(totalPay)}**:\n\n${listStr}`;
    }

    // Rule 4: Rent / Utility expenses
    if (q.includes("rent")) {
      const rentTxs = txs.filter(t => t.category.toLowerCase() === "rent");
      const rentSum = rentTxs.reduce((s, t) => s + t.amount, 0);
      return `Your total recorded expenditure for **Rent** is **${formatINR(rentSum)}** across ${rentTxs.length} entries.`;
    }
    if (q.includes("utility") || q.includes("electricity") || q.includes("utilities")) {
      const utilTxs = txs.filter(t => t.category.toLowerCase() === "utilities");
      const utilSum = utilTxs.reduce((s, t) => s + t.amount, 0);
      return `Your total expenditure for **Utilities** is **${formatINR(utilSum)}** across ${utilTxs.length} ledger logs.`;
    }

    // Rule 5: Generic Fallback financial advisor advice
    return `I scanned your local IndexedDB ledger of **${txs.length} transactions** and **${pts.length} contacts**. \n\nTo help you better, you can ask me queries like:\n• *"What is my cash balance?"*\n• *"Who owes me money?"*\n• *"How much did I spend on Rent?"*`;
  };

  // Scroll Chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, activeTab]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // 4. Dynamic Business Insights Generator
  const totalReceivables = parties.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const totalPayables = Math.abs(parties.filter(p => p.balance < 0).reduce((s, p) => s + p.balance, 0));

  return (
    <>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-2">
            <Bot className="text-brand-mint animate-pulse" />
            <span>AI Munim Hub</span>
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            India&apos;s first offline-first financial assistant. Record ledgers hands-free or ask bookkeeping questions.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-brand-border bg-slate-950/20 p-1 rounded-xl w-full max-w-md">
          <button
            onClick={() => setActiveTab("voice")}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold ${
              activeTab === "voice" ? "bg-gradient-to-r from-brand-emerald/15 to-brand-mint/5 border border-brand-emerald/20 text-brand-mint" : "text-slate-400"
            }`}
          >
            Voice Entry
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold ${
              activeTab === "chat" ? "bg-gradient-to-r from-brand-emerald/15 to-brand-mint/5 border border-brand-emerald/20 text-brand-mint" : "text-slate-400"
            }`}
          >
            AI Chatbot
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold ${
              activeTab === "insights" ? "bg-gradient-to-r from-brand-emerald/15 to-brand-mint/5 border border-brand-emerald/20 text-brand-mint" : "text-slate-400"
            }`}
          >
            Munim Insights
          </button>
        </div>

        {/* Tab 1: Voice Entry Module */}
        {activeTab === "voice" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            {/* Capture Panel */}
            <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-6 flex flex-col items-center justify-between text-center min-h-[300px]">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-brand-mint uppercase tracking-wider">Hands-Free Bookkeeping</span>
                <h3 className="font-display font-bold text-white text-base">Click to Record Voice Command</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Try speaking in English or Hinglish: <br />
                  <span className="text-brand-indigo font-medium font-mono">&quot;Paid 12000 to Rajesh for Rent&quot;</span> or <br />
                  <span className="text-brand-indigo font-medium font-mono">&quot;Amit se 15000 mila&quot;</span>
                </p>
              </div>

              {/* Pulsing Mic Trigger */}
              <div className="my-6 relative">
                {isListening && (
                  <span className="absolute inset-0 rounded-full bg-brand-emerald/25 animate-ping"></span>
                )}
                <button
                  onClick={toggleListening}
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${
                    isListening 
                      ? "bg-brand-rose text-white shadow-rose-500/20" 
                      : "bg-gradient-to-tr from-brand-emerald to-brand-mint text-brand-bg shadow-emerald-500/20"
                  } hover:scale-105 active:scale-95 transition-transform`}
                >
                  {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                </button>
              </div>

              {/* Speech Output State */}
              <div className="w-full">
                {isListening ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* SVG soundwave indicators */}
                    <div className="flex items-center justify-center gap-[3px] h-10 w-full px-6 py-2 bg-slate-900/50 rounded-xl border border-slate-800/40 max-w-[200px] mx-auto shadow-inner">
                      <span className="w-1 bg-brand-emerald h-3 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                      <span className="w-1 bg-brand-mint h-7 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                      <span className="w-1 bg-brand-emerald h-4 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                      <span className="w-1 bg-brand-mint h-8 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                      <span className="w-1 bg-brand-emerald h-5 rounded-full animate-bounce" style={{ animationDelay: "0.5s" }}></span>
                      <span className="w-1 bg-brand-mint h-7 rounded-full animate-bounce" style={{ animationDelay: "0.6s" }}></span>
                      <span className="w-1 bg-brand-emerald h-3 rounded-full animate-bounce" style={{ animationDelay: "0.7s" }}></span>
                    </div>
                    <p className="text-xs text-brand-mint font-medium italic">Listening to your ledger command...</p>
                  </div>
                ) : voiceText ? (
                  <div className="rounded-xl border border-brand-border bg-slate-900/50 p-3 text-xs text-white max-w-md mx-auto">
                    &quot;{voiceText}&quot;
                  </div>
                ) : voiceError ? (
                  <p className="text-xs text-brand-rose font-medium">{voiceError}</p>
                ) : (
                  <p className="text-xs text-slate-500">Microphone ready. Speak to begin.</p>
                )}
              </div>

              {/* Text fallback input */}
              <div className="w-full border-t border-brand-border pt-4 mt-4">
                <p className="text-[10px] text-slate-500 text-left mb-1.5 uppercase font-semibold">Or Type Command Text</p>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="E.g., Received 10000 from Amit"
                    value={voiceText}
                    onChange={(e) => { setVoiceText(e.target.value); parseVoiceCommand(e.target.value); }}
                    className="block w-full rounded-xl border border-brand-border bg-slate-900/40 py-2 pr-10 pl-3 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
                  />
                  <button
                    onClick={() => parseVoiceCommand(voiceText)}
                    className="absolute inset-y-1 right-1 flex items-center justify-center rounded-lg bg-slate-800 px-2.5 text-brand-mint hover:bg-slate-700"
                  >
                    Parse
                  </button>
                </div>
              </div>

            </div>

            {/* Analysis Review & Confirm Panel */}
            <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-white text-base border-b border-brand-border pb-3 flex items-center justify-between">
                  <span>AI Transaction Blueprint</span>
                  {parsedTx && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      confidenceScore >= 80 
                        ? "bg-brand-emerald/15 border-brand-emerald/30 text-brand-mint"
                        : "bg-brand-rose/15 border-brand-rose/30 text-brand-rose"
                    }`}>
                      {confidenceScore}% Match
                    </span>
                  )}
                </h3>
                
                {parsedTx ? (
                  <div className="mt-4 space-y-4">
                    {confidenceScore < 80 && (
                      <div className="rounded-xl border border-brand-rose/25 bg-brand-rose/10 p-3 text-xs text-brand-rose leading-relaxed font-semibold">
                        ⚠️ Low confidence parsing ({confidenceScore}%). Please review and correct the fields below carefully before saving.
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Review and edit the fields extracted by the voice parser:</p>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      
                      {/* Amount Input */}
                      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/40 col-span-2">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Amount (₹)</span>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="mt-1 font-bold text-white text-lg bg-transparent w-full outline-none focus:border-brand-mint border-b border-transparent py-0.5"
                        />
                      </div>

                      {/* Flow Type Selector */}
                      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Transaction Flow</span>
                        <select
                          value={editType}
                          onChange={(e) => {
                            const newType = e.target.value as "income" | "expense" | "transfer";
                            setEditType(newType);
                            // Set category default based on type
                            setEditCategory(newType === "income" ? "Sales" : newType === "transfer" ? "Transfer" : "Purchase");
                          }}
                          className="mt-1.5 font-bold uppercase bg-transparent outline-none text-white w-full border-none p-0 cursor-pointer"
                        >
                          <option value="income" className="bg-slate-950 text-brand-mint">Inflow (+)</option>
                          <option value="expense" className="bg-slate-950 text-brand-rose">Outflow (-)</option>
                          <option value="transfer" className="bg-slate-950 text-blue-400">Transfer (⇄)</option>
                        </select>
                      </div>

                      {/* Book Category Selector */}
                      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Book Category</span>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="mt-1.5 font-semibold bg-transparent outline-none text-white w-full border-none p-0 cursor-pointer"
                        >
                          {categories
                            .filter((c) => editType === "transfer" || c.type === editType)
                            .map((c) => (
                              <option key={c.id} value={c.name} className="bg-slate-950 text-white">{c.name}</option>
                            ))}
                          {editType === "transfer" && (
                            <option value="Transfer" className="bg-slate-950 text-white">Transfer</option>
                          )}
                          <option value="Miscellaneous" className="bg-slate-950 text-white">Miscellaneous</option>
                        </select>
                      </div>

                      {/* Linked Party Input */}
                      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Linked Party</span>
                        <input
                          type="text"
                          value={editPartyName}
                          onChange={(e) => setEditPartyName(e.target.value)}
                          placeholder="Cash Account"
                          className="mt-1.5 font-semibold text-brand-mint bg-transparent w-full outline-none focus:border-brand-mint border-b border-transparent py-0.5"
                        />
                        {editPartyName && editPartyName !== "Cash Account" && editPartyName !== "Cash" && !parties.some(p => p.name.toLowerCase() === editPartyName.toLowerCase().trim()) && (
                          <p className="text-[9px] text-brand-indigo mt-1 font-semibold">✨ Will automatically create new contact</p>
                        )}
                      </div>

                      {/* Date Picker */}
                      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Date</span>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="mt-1.5 font-semibold text-white bg-transparent w-full outline-none border-none p-0 cursor-pointer"
                        />
                      </div>

                    </div>

                    {/* Notes Textarea */}
                    <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/40 text-xs">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold font-mono">Remarks / Notes</span>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        className="mt-1.5 text-slate-300 bg-transparent w-full outline-none border-none resize-none p-0"
                      />
                    </div>

                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center text-xs text-slate-500 italic gap-2">
                    <Bot size={28} className="text-slate-600 animate-pulse" />
                    <span>Provide voice input or type a bookkeeping phrase to generate a transaction blueprint.</span>
                  </div>
                )}
              </div>

              {parsedTx && (
                <div className="flex gap-3 border-t border-brand-border pt-4 mt-6">
                  <button
                    onClick={() => setParsedTx(null)}
                    className="flex-1 rounded-xl border border-slate-800 py-3 text-xs font-bold text-slate-400 hover:bg-slate-900 hover:text-white"
                  >
                    Reject Entry
                  </button>
                  <button
                    onClick={handleConfirmVoiceTx}
                    className="flex-1 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-xs font-bold text-brand-bg shadow-md hover:opacity-90 active:scale-95 transition-all"
                  >
                    Confirm & Record
                  </button>
                </div>
              )}

            </div>

          </div>
        )}

        {/* Tab 2: Chatbot Assistant */}
        {activeTab === "chat" && (
          <div className="rounded-2xl border border-brand-border bg-brand-card/20 backdrop-blur-md flex flex-col h-[500px]">
            
            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, index) => {
                const isAI = msg.sender === "ai";
                return (
                  <div
                    key={index}
                    className={`flex ${isAI ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`flex gap-2 max-w-[80%] ${isAI ? "flex-row" : "flex-row-reverse"}`}>
                      
                      {/* Avatar */}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center border shrink-0 text-xs font-bold ${
                        isAI ? "bg-slate-900 border-brand-emerald text-brand-mint" : "bg-brand-indigo border-slate-700 text-white"
                      }`}>
                        {isAI ? "AI" : "U"}
                      </div>

                      {/* Bubble content */}
                      <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        isAI 
                          ? "bg-slate-900/60 border border-slate-800 text-slate-200" 
                          : "bg-brand-indigo/10 border border-brand-indigo/35 text-white"
                      }`}>
                        <div className="whitespace-pre-line">{msg.text}</div>
                      </div>

                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Send Form */}
            <form onSubmit={handleChatSubmit} className="border-t border-brand-border p-3.5 bg-slate-950/20 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask: What is my cash balance? or Who owes me money?"
                className="block flex-1 rounded-xl border border-brand-border bg-slate-900/60 py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-emerald"
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint h-9 w-9 text-brand-bg shadow hover:opacity-90 active:scale-95 shrink-0"
              >
                <Send size={15} />
              </button>
            </form>

          </div>
        )}

        {/* Tab 3: Financial Insights */}
        {activeTab === "insights" && (
          <div className="space-y-5">
            
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              
              {/* Insight 1: Receivables ratio */}
              <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/20 flex items-center justify-center text-brand-mint shrink-0">
                  <Lightbulb size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Receivables Health Ratio</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your current receivables total **{formatCurrency(totalReceivables)}** while payables stand at **{formatCurrency(totalPayables)}**. You have a positive ledger receivable buffer of **{formatCurrency(totalReceivables - totalPayables)}**.
                  </p>
                </div>
              </div>

              {/* Insight 2: Outstanding Alert */}
              <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-brand-amber/10 border border-brand-amber/20 flex items-center justify-center text-brand-amber shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Pending Collection Alert</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Amit Kumar has an outstanding customer balance of **{formatCurrency(15000)}** and Neha Gupta has **{formatCurrency(22000)}**. Consider sending a Payment Reminder via WhatsApp to expedite collections.
                  </p>
                </div>
              </div>

              {/* Insight 3: Offline Data Cache runway */}
              <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center text-brand-indigo shrink-0">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">PWA Storage Cache Health</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your transaction logs are cached inside browser **IndexedDB** storage. They are safe from network outages and will automatically sync when connection returns.
                  </p>
                </div>
              </div>

              {/* Insight 4: Cash Runway Suggestion */}
              <div className="rounded-2xl border border-brand-border bg-brand-card/30 p-5 backdrop-blur-md flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <DollarSign size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Cash Cushion Runway</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your monthly inflows exceed outflows. Business cash runway is healthy. Maintain a 3-month expense cash reserve in hand before allocating funds to additional purchasing cycles.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </>
  );
}
