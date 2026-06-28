import type { CreateExpense, Expense, UpdateExpense } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export interface ExpenseShareRow {
  id: string;
  expenseId: string;
  memberId: string;
  amount: number;
  /** raw split input (exact=cents, shares=count, percent=points; null=equal) */
  inputValue: number | null;
}
export type ExpenseDetail = Expense & { shares: ExpenseShareRow[] };

export const expensesApi = {
  list: () => http<Expense[]>("/api/expenses"),
  get: (id: string) => http<ExpenseDetail>(`/api/expenses/${id}`),
  create: (body: CreateExpense) =>
    http<Expense>("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateExpense) =>
    http<Expense>(`/api/expenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    http<void>(`/api/expenses/${id}`, { method: "DELETE" }),
};

export function useExpenses() {
  return useQuery({ queryKey: qk.expenses, queryFn: expensesApi.list });
}
export function useExpense(id?: string) {
  return useQuery({
    queryKey: qk.expense(id ?? ""),
    queryFn: () => expensesApi.get(id!),
    enabled: !!id,
  });
}

function useExpenseMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.expenses });
      qc.invalidateQueries({ queryKey: qk.balances });
      qc.invalidateQueries({ queryKey: qk.activity });
      qc.invalidateQueries({ queryKey: qk.shoppingAll }); // bridge may mark bought
    },
  });
}

export const useCreateExpense = () => useExpenseMutation(expensesApi.create);
export const useUpdateExpense = () =>
  useExpenseMutation(({ id, body }: { id: string; body: UpdateExpense }) =>
    expensesApi.update(id, body),
  );
export const useDeleteExpense = () => useExpenseMutation(expensesApi.remove);
