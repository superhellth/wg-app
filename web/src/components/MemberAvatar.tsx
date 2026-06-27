import Avatar from "@mui/material/Avatar";
import { useColorMap } from "../theme/useMemberColor.js";
import { useMembersMap } from "../api/members.js";

interface Props {
  memberId: string | null | undefined;
  size?: number;
  /** override the displayed name (else looked up from roster) */
  name?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return (first + second).toUpperCase();
}

/** Circular avatar tinted with the member's signature color + their initials. */
export function MemberAvatar({ memberId, size = 36, name }: Props) {
  const colors = useColorMap();
  const members = useMembersMap();
  const color = (memberId && colors.get(memberId)) || {
    main: "#6B6B78",
    soft: "#ECECEF",
    ink: "#3A3A44",
  };
  const display = name ?? (memberId ? members.get(memberId)?.displayName : undefined) ?? "?";

  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: color.soft,
        color: color.ink,
        fontSize: size * 0.4,
        fontWeight: 700,
        border: `2px solid ${color.main}`,
      }}
    >
      {initials(display)}
    </Avatar>
  );
}
