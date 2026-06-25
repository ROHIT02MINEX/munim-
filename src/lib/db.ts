import Dexie, { type Table } from "dexie";

export interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  partyId?: string;
  date: string;
  description: string;
  receiptImage?: string; // Base64 data URL for offline image persistence
  status: "synced" | "pending-insert" | "pending-update" | "pending-delete";
  createdAt: number;
}

export interface Party {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  type: "customer" | "vendor";
  balance: number; // Positive = receivable (they owe us), Negative = payable (we owe them)
  status: "synced" | "pending-insert" | "pending-update" | "pending-delete";
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string; // Lucide icon identifier
  color: string; // Tailwind tint class e.g., 'emerald', 'indigo'
}

export interface SyncQueueItem {
  id?: number;
  action: "insert" | "update" | "delete";
  entity: "transaction" | "party";
  entityId: string;
  payload: Transaction | Party | null;
  timestamp: number;
}

class MunimDatabase extends Dexie {
  transactions!: Table<Transaction>;
  parties!: Table<Party>;
  categories!: Table<Category>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super("MunimDatabase");
    this.version(1).stores({
      transactions: "id, amount, type, category, partyId, date, status, createdAt",
      parties: "id, name, type, balance, status",
      categories: "id, name, type",
      syncQueue: "++id, action, entity, entityId, timestamp",
    });
  }
}

export const db = new MunimDatabase();
export default db;
