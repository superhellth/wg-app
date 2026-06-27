/**
 * The signature of the app: every member has a stable, distinct color, derived
 * from their position in the roster (sorted by createdAt). No schema/state —
 * recomputed from the cached members list. See useMemberColor.
 */

export interface MemberColor {
  /** strong color — avatars, bars, accents */
  main: string;
  /** soft tint — chip/row backgrounds */
  soft: string;
  /** readable text on the soft tint */
  ink: string;
}

export const MEMBER_PALETTE: MemberColor[] = [
  { main: "#E5604D", soft: "#FCE9E5", ink: "#9C3322" }, // coral
  { main: "#1FA39B", soft: "#E0F4F2", ink: "#0F5C57" }, // teal
  { main: "#E0A02E", soft: "#FBF0DA", ink: "#8A5E10" }, // amber
  { main: "#7A5AF0", soft: "#ECE7FD", ink: "#46329E" }, // violet
  { main: "#2F9E5B", soft: "#E2F3E8", ink: "#1A5D35" }, // green
  { main: "#3B82C4", soft: "#E3EEF8", ink: "#1F4D78" }, // blue
  { main: "#D6589A", soft: "#FBE6F1", ink: "#8C2F61" }, // pink
  { main: "#7E8A2E", soft: "#F0F2DC", ink: "#4E5616" }, // olive
];

const FALLBACK: MemberColor = { main: "#6B6B78", soft: "#ECECEF", ink: "#3A3A44" };

/** Map an ordered list of member ids to colors by index. */
export function buildColorMap(orderedMemberIds: string[]): Map<string, MemberColor> {
  const map = new Map<string, MemberColor>();
  orderedMemberIds.forEach((id, i) => {
    map.set(id, MEMBER_PALETTE[i % MEMBER_PALETTE.length]!);
  });
  return map;
}

export function colorForIndex(index: number): MemberColor {
  if (index < 0) return FALLBACK;
  return MEMBER_PALETTE[index % MEMBER_PALETTE.length]!;
}

export { FALLBACK as FALLBACK_COLOR };
