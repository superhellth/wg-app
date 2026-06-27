/** Central query-key factory so invalidation stays consistent across hooks. */
export const qk = {
  members: (includeArchived = false) => ["members", { includeArchived }] as const,
  membersAll: ["members"] as const,
  balances: ["balances"] as const,
  expenses: ["expenses"] as const,
  expense: (id: string) => ["expenses", id] as const,
  settlements: ["settlements"] as const,
  shopping: (history = false) => ["shopping", { history }] as const,
  shoppingAll: ["shopping"] as const,
  chores: ["chores"] as const,
  meetings: ["meetings"] as const,
  meeting: (id: string) => ["meetings", id] as const,
  fixedCosts: ["fixedCosts"] as const,
  activity: ["activity"] as const,
};
