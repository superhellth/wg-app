import Box from "@mui/material/Box";
import { useMemberColor } from "../theme/useMemberColor.js";
import { useMembersMap } from "../api/members.js";

interface Props {
  memberId: string | null | undefined;
  name?: string;
}

/** Small pill showing a member's name in their signature color. */
export function MemberChip({ memberId, name }: Props) {
  const color = useMemberColor(memberId);
  const members = useMembersMap();
  const display =
    name ?? (memberId ? members.get(memberId)?.displayName : undefined) ?? "Unbekannt";

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: 9,
        bgcolor: color.soft,
        color: color.ink,
        fontSize: "0.8125rem",
        fontWeight: 600,
        lineHeight: 1.6,
      }}
    >
      <Box
        component="span"
        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color.main }}
      />
      {display}
    </Box>
  );
}
