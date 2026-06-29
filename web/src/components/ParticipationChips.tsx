import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import type { MeetingRsvp } from "../api/meetings.js";
import { useMembers } from "../api/members.js";

type Status = "yes" | "no" | "pending";

/** Chip is tinted by RSVP status — green / red / yellow — not by member color. */
const STATUS = {
  yes: {
    Icon: CheckCircleRoundedIcon,
    bg: "#E2F1EA",
    ink: "#0E6B49",
    icon: "#0E8A5F",
    title: "Zugesagt",
  },
  no: {
    Icon: CancelRoundedIcon,
    bg: "#F7E5E0",
    ink: "#9E3D2B",
    icon: "#C8553D",
    title: "Abgesagt",
  },
  pending: {
    Icon: HelpRoundedIcon,
    bg: "#FBF0D6",
    ink: "#8A6A12",
    icon: "#D9A406",
    title: "Keine Antwort",
  },
} as const;

function ParticipationChip({ name, status }: { name: string; status: Status }) {
  const { Icon, bg, ink, icon, title } = STATUS[status];
  return (
    <Box
      component="span"
      title={`${name}: ${title}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        pl: 0.5,
        pr: 1,
        py: 0.25,
        borderRadius: 9,
        bgcolor: bg,
        color: ink,
        fontSize: "0.8125rem",
        fontWeight: 600,
        lineHeight: 1.6,
      }}
    >
      <Icon sx={{ fontSize: 16, color: icon }} />
      {name}
    </Box>
  );
}

/**
 * One chip per active member showing their RSVP state: confirmed (green check),
 * denied (red cross) or no answer yet (yellow question mark).
 */
export function ParticipationChips({ rsvps }: { rsvps: MeetingRsvp[] }) {
  const members = useMembers();
  const byMember = new Map(rsvps.map((r) => [r.memberId, r.value]));
  const list = members.data ?? [];
  if (list.length === 0) return null;
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {list.map((m) => {
        const v = byMember.get(m.id);
        const status: Status = v === "yes" ? "yes" : v === "no" ? "no" : "pending";
        return <ParticipationChip key={m.id} name={m.displayName} status={status} />;
      })}
    </Stack>
  );
}
