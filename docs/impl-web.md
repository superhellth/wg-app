# Implementation — `web/` (`@wg/web`)

> Locked implementation decisions for the web PWA. Companion to `impl-shared.md`
> and `impl-api.md`. Stack is fixed: Vite + React 18 + MUI (Emotion) + TanStack
> Query + React Router. German UI throughout.

## Design direction — "Mitbewohner"

People-first: **the household is its people**, so per-member color is the
signature, threaded through every attributed thing (avatars, activity-feed
left-bars, chips, balance rows). Grounded in the flat-trust model — everyone
equal, attribution everywhere.

- **Palette:** warm paper base `#FBFAF7`, ink `#15151F`, indigo accent `#5B4FE9`;
  money semantics green `#0E8A5F` (owed/positive) / warm red `#C8553D`
  (owes/negative).
- **Type:** Bricolage Grotesque (display, headings) + Inter (body). Loaded via
  Google Fonts in `index.html`.
- **Shape:** friendly, rounded (cards radius 18, buttons 12), hairline borders
  over heavy shadows. All in `theme.ts` (heavily themed MUI, not default Material).

### Member color system (the signature)

`theme/memberColors.ts` + `theme/useMemberColor.ts`.
- A curated 8-color palette, each with `{ main, soft, ink }` (strong / tint bg /
  readable-on-tint).
- **Derived, not stored** — assigned by index into the roster **sorted by
  `createdAt`** (uses the archived-inclusive `useMembers(true)` so archived members
  keep their color in the ledger/feed). Guarantees distinct colors for a small WG;
  repeats only past 8 members.
- Consumed via `useMemberColor(id)` and the `<MemberAvatar>` / `<MemberChip>`
  components. A `color` column on `members` is an easy future add if members ever
  pick their own.

## Navigation & IA

- **5 bottom tabs** (`AppShell.tsx`): `Start` · `Geld` · `Putzplan` · `Einkaufen`
  · `Termine` — the four high-frequency actions plus a dashboard home.
- **`Start` dashboard** surfaces the daily glance + gives the activity feed a home:
  your balance, your current chore turn, next meeting, recent activity.
- **App-bar profile menu** (current-identity avatar) holds the low-frequency /
  reference pages: `Aktivität`, `Fixkosten`, `Mitbewohner`, `Profil &
  Einstellungen`, and "Identität wechseln".

## Identity gate & onboarding

Three-state gate, identity in `localStorage` (`src/api/identity.ts`, reactive via
`useIdentity`/`useSyncExternalStore`). Guards in `src/app/guards.tsx`:

- **No `wgToken`** → `/willkommen` landing → **Create WG** (`POST /api/wg`, 409 → use
  an invite) or **Join** (`/join/:token` auto-redeem, or paste link).
- **`wgToken`, no `memberId`** → `/wer-bin-ich` identity picker: pick from the
  roster (members are created here inline if empty). **Identity is a pure local
  pick** — no server claim state; switching = `setMemberId(null)` re-runs the gate.
- **Both** → the app (`AppShell` + tabs).

## Data layer — `src/api/`

- **`identity.ts`** — `wgToken`/`memberId` storage + `useIdentity`.
- **`client.ts`** — `http<T>()`: injects `Authorization: Bearer <wgToken>` +
  `X-Member-Id`, parses the `apiErrorSchema` envelope into a thrown `ApiError`,
  handles 204, and on **401 clears the token → bounces to onboarding**.
- **`keys.ts`** — central query-key factory.
- **`<domain>.ts`** — typed calls (against `@wg/shared`) **plus co-located** Query
  hooks (`useExpenses`, `useCreateExpense`, …).
- **Invalidate-on-success, no optimistic updates** (spec: mutations require
  network, data is tiny). Cross-domain invalidation lives in the mutation hooks —
  e.g. create expense → `expenses` + `balances` + `activity` + `shopping` (bridge).
- Query config: `refetchOnWindowFocus`, 30s `staleTime` (pull-based per spec).

## Expense form & split (`ExpenseForm.tsx`)

- Full-screen route `/geld/neu` (splits need room on mobile).
- Fields: Beschreibung, Betrag (€→cents via `parseEurToCents`), payer (**defaults to
  current identity**), category chips, participant chips (**default all active**).
- **Segmented split control** Gleich/Betrag/Anteile/Prozent → per-type inputs.
- **Live preview** runs `resolveShares` from `@wg/shared` → identical to what the
  server persists (the signature payoff of shared math). Client mirrors the
  `superRefine` rules (exact sums to total, percent to 100, shares positive int) to
  gate submit.
- **Shopping bridge:** opened from Einkaufen with `?items=…&desc=…`; carries
  `shoppingItemIds` so the server marks them bought atomically on create.

## Push & service worker

- `vite-plugin-pwa` in **`injectManifest`** mode with custom **`src/sw.ts`**
  (app-shell cache + `push` → `showNotification` + `notificationclick` → focus/open
  the payload `url`). `src/sw.ts` is **excluded from the app tsconfig** and compiled
  by the plugin.
- `lib/push.ts` — `registerPush(memberId)`: permission → subscribe with
  `VITE_VAPID_PUBLIC_KEY` → `POST /api/devices`. No-ops gracefully if VAPID unset.
- **iOS:** if iOS Safari and not standalone, Profil shows the "Zum Home-Bildschirm
  hinzufügen" guide instead of the enable button (push needs the installed PWA on
  iOS 16.4+).

## Pages (all under `AppShell`)

`Start` (dashboard) · `Geld` + `ExpenseForm` + `SettlementDialog` · `Putzplan` +
`ChoreForm` (reorderable rotation) · `Einkaufen` (multi-select → bridge, Verlauf) ·
`Termine` + `MeetingDetail` (approval poll vote/resolve, RSVP) + `MeetingForm`
(3 modes, MUI date pickers) · `Fixkosten` (computed per-person share) ·
`Mitbewohner` (roster, away, archive/restore, invite link copy/share) · `Profil`
(identity switch, push, away) · `Aktivität` (cursor-paginated infinite feed,
client-side name join, per-`kind` German strings in `lib/activityText.ts`).

Shared components in `src/components/`: `MemberAvatar`, `MemberChip`, `MoneyText`
(tabular, signed coloring), `SectionLabel`, `EmptyState`, `ActivityRow`, `AddFab`.

## Known deferrals
- **Edit-expense** not built (stored resolved shares can't reconstruct the original
  split type); create + delete only. Settlements/fixed-costs/members are editable.
- PWA icons (`/public/icon-192.png`, `icon-512.png`) referenced but not yet added.
- No optimistic updates; no automated tests.
