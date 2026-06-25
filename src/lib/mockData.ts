import { db, type Category, type Party, type Transaction } from "./db";

export const defaultCategories: Category[] = [
  // Income Categories
  { id: "cat_sales", name: "Sales", type: "income", icon: "TrendingUp", color: "emerald" },
  { id: "cat_services", name: "Services", type: "income", icon: "Briefcase", color: "mint" },
  { id: "cat_interest", name: "Interest Income", type: "income", icon: "Percent", color: "teal" },
  { id: "cat_other_inc", name: "Other Income", type: "income", icon: "PlusCircle", color: "indigo" },
  
  // Expense Categories
  { id: "cat_salary", name: "Salary", type: "expense", icon: "Users", color: "indigo" },
  { id: "cat_rent", name: "Rent", type: "expense", icon: "Home", color: "rose" },
  { id: "cat_utilities", name: "Utilities", type: "expense", icon: "Zap", color: "amber" },
  { id: "cat_purchase", name: "Purchase", type: "expense", icon: "ShoppingBag", color: "violet" },
  { id: "cat_marketing", name: "Marketing", type: "expense", icon: "Megaphone", color: "pink" },
  { id: "cat_travel", name: "Travel", type: "expense", icon: "Car", color: "cyan" },
  { id: "cat_office", name: "Office Supplies", type: "expense", icon: "Paperclip", color: "slate" },
  { id: "cat_other_exp", name: "Other Expense", type: "expense", icon: "MinusCircle", color: "orange" },
];

export const mockParties: Party[] = [
  { id: "p_amit", name: "Amit Kumar", phone: "9876543210", email: "amit@gmail.com", type: "customer", balance: 15000, status: "synced" },
  { id: "p_rajesh", name: "Rajesh Sharma", phone: "8765432109", email: "rajesh@sharma-traders.com", type: "vendor", balance: -8500, status: "synced" },
  { id: "p_neha", name: "Neha Gupta", phone: "7654321098", email: "neha.g@outlook.com", type: "customer", balance: 22000, status: "synced" },
  { id: "p_vikram", name: "Vikram Singh", phone: "6543210987", email: "vikram@singh-distributors.com", type: "vendor", balance: -12000, status: "synced" },
  { id: "p_priya", name: "Priya Patel", phone: "9123456789", email: "priya@patel-associates.com", type: "customer", balance: 0, status: "synced" },
];

const getPastDateStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

export const mockTransactions = (): Transaction[] => [
  {
    id: "tx_1",
    amount: 25000,
    type: "income",
    category: "Sales",
    partyId: "p_amit",
    date: getPastDateStr(12),
    description: "Sold bulk inventory batch A1",
    status: "synced",
    createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx_2",
    amount: 15000,
    type: "expense",
    category: "Purchase",
    partyId: "p_rajesh",
    date: getPastDateStr(10),
    description: "Raw material procurement",
    status: "synced",
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx_3",
    amount: 12000,
    type: "expense",
    category: "Rent",
    date: getPastDateStr(8),
    description: "Office space monthly lease",
    status: "synced",
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx_4",
    amount: 18000,
    type: "income",
    category: "Services",
    partyId: "p_neha",
    date: getPastDateStr(6),
    description: "Consultancy fee milestone 1",
    status: "synced",
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx_5",
    amount: 3200,
    type: "expense",
    category: "Utilities",
    date: getPastDateStr(4),
    description: "High-speed internet + electricity bill",
    status: "synced",
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx_6",
    amount: 10000,
    type: "income",
    category: "Sales",
    partyId: "p_amit",
    date: getPastDateStr(2),
    description: "Advance received for order B3",
    status: "synced",
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx_7",
    amount: 6500,
    type: "expense",
    category: "Purchase",
    partyId: "p_vikram",
    date: getPastDateStr(1),
    description: "Packaging boxes supply",
    status: "synced",
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
];

export async function seedDatabase() {
  // 1. Seed Categories
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkPut(defaultCategories);
    console.log("Categories seeded successfully.");
  }

  // 2. Seed Parties
  const partyCount = await db.parties.count();
  if (partyCount === 0) {
    await db.parties.bulkPut(mockParties);
    console.log("Parties seeded successfully.");
  }

  // 3. Seed Transactions
  const transactionCount = await db.transactions.count();
  if (transactionCount === 0) {
    await db.transactions.bulkPut(mockTransactions());
    console.log("Transactions seeded successfully.");
  }
}
