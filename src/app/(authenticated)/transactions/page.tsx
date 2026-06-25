import TransactionsClient from "./transactions-client";
import { requireUser } from "@/lib/auth/require-user";

export default async function TransactionsPage() {
  await requireUser("/transactions");
  return <TransactionsClient />;
}
