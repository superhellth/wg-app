import { useMemo } from "react";
import { useMembers } from "../api/members.js";
import { buildColorMap, FALLBACK_COLOR, type MemberColor } from "./memberColors.js";

/** Stable id → color map, ordered by the (archived-inclusive) roster. */
export function useColorMap(): Map<string, MemberColor> {
  const { data } = useMembers(true);
  return useMemo(
    () => buildColorMap((data ?? []).map((m) => m.id)),
    [data],
  );
}

export function useMemberColor(memberId: string | null | undefined): MemberColor {
  const map = useColorMap();
  if (!memberId) return FALLBACK_COLOR;
  return map.get(memberId) ?? FALLBACK_COLOR;
}
