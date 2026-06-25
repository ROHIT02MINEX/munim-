import { db, type Category } from "./db";

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

export async function seedDatabase() {
  // Seed Categories
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkPut(defaultCategories);
    console.log("Categories seeded successfully.");
  }
}

