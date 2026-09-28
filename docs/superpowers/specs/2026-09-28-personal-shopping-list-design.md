# Personal shopping list — design

Date: 2026-09-28

## Goal

Each member gets a private shopping list next to the shared WG list. The Einkaufen tab shows two tabs, "WG" and "Privat". The Verlauf tab is removed. Items are added through a FAB-triggered dialog that offers history suggestions as cards.

Reverses the non-goal "multiple lists" in `docs/target-functionality.md`.

## Decisions

- One table `shopping_items` with nullable `ownerMemberId`. `null` means WG item. (Rejected: separate `personal_items` table, because it duplicates dedupe, bought, delete and suggestion logic.)
- Personal items are hidden, not secret. Identity is trust-based (`X-Member-Id` is unverified), so impersonation can read them. Document this.
- Personal add, bought and delete write no `activity` row. The feed is shared.
- Personal list has no "Ausgabe" button. Only "Eingekauft". The expense bridge rejects personal items.
- Bought items stay soft-deleted (`boughtAt`) because they feed suggestions. Only the Verlauf UI is removed.
- Suggestions come from bought items on the same list only. Personal names never leak to the WG list.
- Active-name uniqueness (case-insensitive) applies per owner.

## Data and shared

- `shopping_items.ownerMemberId`: uuid, nullable, FK to `members`. New migration via `pnpm db:generate`.
- `ShoppingItem` gains `ownerMemberId: uuid | null`.
- `createShoppingItemSchema` gains `personal: boolean` (default false). Server sets `ownerMemberId = actor.id` when true.
- `shoppingQuerySchema` gains `scope: "wg" | "personal"` (default `wg`). `history` param stays.

## API (`api/src/routes/shopping.ts`)

- `GET`: `requireMember`. `scope=wg` filters `ownerMemberId IS NULL`. `scope=personal` filters `ownerMemberId = actor.id`.
- `POST`: dupe check scoped to the same owner. `logActivity` only for WG items.
- `PATCH /:id/bought` and `DELETE /:id`: `requireMember`. If the item has an owner that is not the actor, respond 404. `logActivity` on bought only for WG items.
- Expense create: reject `shoppingItemIds` that reference personal items.

## Web

- `Einkaufen.tsx`: tabs "WG" / "Privat". Remove the Verlauf tab, inline `Autocomplete`, and the re-add button. "Ausgabe" renders only on the WG tab.
- `useShopping(scope, history)`; query keys include `scope`. Mutations invalidate `shoppingAll`.
- New `components/AddItemDialog.tsx`, opened by the FAB, scope-aware ("zu: WG" / "zu: Privat"):
  - Text field at top. Enter or plus button adds free text.
  - Suggestions as cards (same style as list items), filtered by typed text. Deduped bought names for the scope, minus names already active.
  - Tap card adds the item, card leaves the suggestions, toast confirms.
  - Dialog stays open. "Fertig" closes it.
- Empty-state hint points at the FAB.

## Docs to update

`docs/target-functionality.md`, `docs/impl-api.md` (Shopping), `docs/impl-web.md`, `docs/target-technical.md` (table line), `CLAUDE.md` if the shopping description changes.

## Verification

No test runner exists. Run `pnpm typecheck` and `pnpm build`. Live check needs Postgres and generated migrations.
