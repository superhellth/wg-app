import type { Activity } from "@wg/shared";
import { formatCents } from "./format.js";

function money(cents: unknown): string {
  return typeof cents === "number" ? formatCents(cents) : "";
}

/**
 * Render one feed entry as a German predicate ("hat … gemacht"). The subject
 * (member name) is rendered separately by ActivityRow. Data shapes come from the
 * server snapshots; we read defensively.
 */
export function activityText(a: Activity): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = a.data as any;
  switch (a.kind) {
    case "member.added":
      return `hat ${d?.snapshot?.displayName ?? "ein Mitglied"} hinzugefügt`;
    case "member.updated":
      return "hat ein Profil bearbeitet";
    case "member.archived":
      return `hat ${d?.after?.displayName ?? "ein Mitglied"} entfernt`;
    case "member.restored":
      return `hat ${d?.after?.displayName ?? "ein Mitglied"} zurückgeholt`;
    case "expense.created":
      return `hat „${d?.snapshot?.description ?? "Ausgabe"}" erfasst · ${money(d?.snapshot?.amount)}`;
    case "expense.updated":
      return `hat „${d?.after?.description ?? "Ausgabe"}" bearbeitet`;
    case "expense.deleted":
      return `hat „${d?.snapshot?.description ?? "Ausgabe"}" gelöscht`;
    case "settlement.created":
      return `hat eine Zahlung erfasst · ${money(d?.snapshot?.amount)}`;
    case "settlement.updated":
      return "hat eine Zahlung bearbeitet";
    case "settlement.deleted":
      return "hat eine Zahlung gelöscht";
    case "shopping.added":
      return `hat „${d?.snapshot?.name ?? "etwas"}" auf die Einkaufsliste gesetzt`;
    case "shopping.bought":
      return "hat eingekauft";
    case "chore.created":
      return `hat die Aufgabe „${d?.snapshot?.chore?.name ?? ""}" erstellt`;
    case "chore.updated":
      return `hat die Aufgabe „${d?.after?.name ?? ""}" bearbeitet`;
    case "chore.deleted":
      return `hat die Aufgabe „${d?.snapshot?.name ?? ""}" gelöscht`;
    case "chore.done":
      return "hat eine Aufgabe erledigt";
    case "chore.swapped":
      return "hat eine Aufgabe getauscht";
    case "chore.skipped":
      return "hat eine Aufgabe übersprungen";
    case "chore.reminded":
      return "hat an eine Aufgabe erinnert";
    case "meeting.created":
      return `hat „${d?.snapshot?.title ?? "Termin"}" erstellt`;
    case "meeting.deleted":
      return `hat „${d?.snapshot?.title ?? "Termin"}" gelöscht`;
    case "poll.created":
      return `hat die Umfrage „${d?.snapshot?.title ?? ""}" gestartet`;
    case "poll.resolved":
      return "hat eine Umfrage aufgelöst";
    case "fixedcost.added":
      return `hat „${d?.snapshot?.name ?? "Fixkosten"}" zu den Fixkosten hinzugefügt`;
    case "fixedcost.updated":
      return "hat Fixkosten bearbeitet";
    case "fixedcost.deleted":
      return "hat Fixkosten gelöscht";
    default:
      return a.kind;
  }
}
