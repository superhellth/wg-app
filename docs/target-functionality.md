# WG App — Target Functionality

why dist-tsnode in /web

> Functional specification for a shared-living (Wohngemeinschaft) management app.
> Scope of this document: **what** the app does. Technical choices (framework, backend, storage) are deliberately out of scope and decided later.

## 0. Foundational decisions

| Decision | Choice |
|----------|--------|
| Platform | React web PWA |
| Scope | **Single WG** — one household, no multi-group/group-switching |
| Permission model | **Flat** — all members equal, no admin role |
| Currency | EUR only (no multi-currency) |
| UI language | German |
| Identity | Invite-link grants **WG access**; identity is a **local pick** from the member roster (switchable, unverified), **no password account** |
| First run | First person creates the WG (names it), adds the member roster, invites the rest via link |

---

## 1. Membership (add / remove users)

- **What a user is:** a member in the shared roster. The invite link grants **WG access** (membership), not a specific identity; each device **picks who it is** from the roster locally and can switch anytime (unverified, trust-based). No username/password, no classic account.
- **Join flow:** existing member generates an invite link → new person opens it within 24h → device stores the WG access token → picks their name from the roster → receives their own push notifications, acts as themselves.
- **Invite link:** expires after **24h**, **reusable** within that window (one link, the whole WG joins). A leaked link = outsider access, hence the short expiry.
- **Add:** anyone can invite, and anyone can add member names to the roster (flat model).
- **Remove:** **soft-remove / archive**.
  - Removed member is hidden from active lists (chores rotation, shopping, RSVP, etc.).
  - They remain in financial history and the ledger; **open debts persist**.
  - Settlement with an archived member is still possible at any time.
  - No hard delete, no debt absorption.
- **Roles:** none. Every member can add/remove members and edit shared data.

---

## 2. Money splitting (Splid-like)

The core shared ledger. One-off and recurring expenses feed the same balances.

### Expenses
- Create expense: **payer**, **total amount**, **participants** (subset of members).
- **Split types:**
  - Equal among selected participants
  - Exact amounts per person
  - Shares (e.g. couple counts 2×)
  - Percentage
- **Fields:** description (required), category (optional, from preset list).
- **Edit / delete:** anyone can edit or delete any expense (hard delete). **Changes are logged to the activity feed** — create/edit/delete each write a feed entry with a full before/after snapshot, so edit history is visible there.
- No receipt photos in v1.

### Settling up
- **Debt simplification:** app computes the minimal set of transactions to clear all balances (netting across members). Tap a suggested payment to see the underlying breakdown.
- **Recording a settlement:** manual. A member logs that a payment happened (full or **partial** amount); balances update accordingly.
- App is a **ledger only** — no real money moves through it (no bank/PayPal integration).
- **No receiver confirmation** — trust-based, instant (consistent with flat model).
- **Editable / deletable:** settlements can be edited or deleted (hard delete); the change is logged to the activity feed. Balances recompute automatically (computed on read).

### Notifications
- **No push** for money events (expense involving you, settlement received). Money changes appear in the activity feed only.

---

## 3. Financial Overview (fixed-cost board)

A **standalone, informational** module. **Not connected** to the money/ledger system (§2) — the two views are independent.

- Purpose: transparency — "who pays for electricity/gas/internet/rent…, how much?"
- A **static cost board**: a list of fixed/recurring costs. Per cost entry:
  - Name (e.g. Strom, Gas, Internet, Miete)
  - Total amount
  - Billing cycle
  - Contract holder (who holds/pays the contract)
  - Split rule → **per-person share displayed**
- Manually maintained. Pure reference — **no settlement math, no balances, no debt tracking** here.

---

## 4. Shopping list

- **One shared list** for the whole WG.
- **Item fields:** name only.
- **Bought items:** move to a **history** (not deleted) for easy re-add.
- No categories, no separate lists, no favorites/staples list (history covers quick re-add).
- **Money bridge (convenience only):** select one or more list items → action **"Create expense entry"** → opens the money/expense form prefilled. The list itself tracks no money and is not otherwise linked to the ledger.

---

## 5. Chore management

- **Model:** recurring chores with **rotation** only (no ad-hoc task pool in v1).
- **Per chore configuration:**
  - Frequency (weekly / biweekly / custom)
  - Participant set
  - Rotation order
- **Turn advancement:** **on completion** — the next person is assigned only after the current turn is marked done. A turn does not pass on until done.
- **Due date per turn:** yes, tied to the cycle boundary (e.g. end of this week / next week).
- **Overdue handling:** visible overdue flag + **push notification** to the assignee.
- **Swap / skip:** members can swap a turn with someone, or mark themselves away (skipped in rotation, e.g. vacation).
- **Mark done:** anyone can mark a chore done (flat trust).
- **No scorekeeping** — no points, no leaderboard, no completed-count stats.

### Notifications
- **Push:** your turn started + your turn overdue.

---

## 6. Meeting / event organization

- **Event types:**
  - **Fixed** event (creator sets date/time)
  - **Recurring** event (e.g. weekly game night)
  - **Poll mode** — propose several time options, members vote, pick the winner
- **RSVP:** **yes / no** per member; attendee list visible.
- **Reminder:** **push notification** before the event.
- **Extras:** none in v1 (no location, notes, or "who brings what").

### Notifications
- **Push:** new meeting / new poll invite + event reminder.

---

## 7. Cross-cutting

### Push notifications — summary
| Domain | Push? |
|--------|-------|
| Chores (turn started, overdue) | ✅ |
| Meetings/polls (invite, reminder) | ✅ |
| Money (expenses, settlements) | ❌ |
| Shopping (item added) | ❌ |

### Activity feed
- In-app chronological feed logging **everything**: expenses added/edited, settlements, chores done, member joins/removals, meetings created, etc.
- Single screen, transparency for the whole WG.

---

## 8. Out of scope for v1
- Recurring / auto-repeating expenses (the `recurring` flag was dropped; fixed recurring costs live in the standalone Financial Overview, §3)
- Single-use invite links (links are reusable for 24h instead)
- Multi-WG / group switching
- Admin roles & permissions
- Multi-currency
- Receipt photo attachments
- Real payment integration (bank / PayPal)
- Receiver confirmation of settlements
- Ad-hoc one-off chore tasks
- Chore gamification / scorekeeping
- Shopping categories, multiple lists, favorites
- Meeting location / notes / bring-list
- Push for money & shopping events
- Linking Financial Overview to the ledger
