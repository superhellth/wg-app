import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import type { MeetingRsvp } from "../api/meetings.js";
import { useMembers } from "../api/members.js";
import { useMemberColor } from "../theme/useMemberColor.js";

type Status = "yes" | "no" | "pending";

const STATUS = {
  yes: { Icon: CheckCircleRoundedIcon, color: "success.main", title: "Zugesagt" },
  no: { Icon: CancelRoundedIcon, color: "error.main", title: "Abgesagt" },
  pending: { Icon: HelpRoundedIcon, color: "text.disabled", title: "Keine Antwort" },
} as const;

function ParticipationChip({
  memberId,
  name,
  status,
}: {
  memberId: string;
  name: string;
  status: Status;
}) {
  const color = useMemberColor(memberId);
  const { Icon, color: statusColor, title } = STATUS[status];
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
        bgcolor: color.soft,
        color: color.ink,
        fontSize: "0.8125rem",
        fontWeight: 600,
        lineHeight: 1.6,
        opacity: status === "pending" ? 0.65 : 1,
      }}
    >
      <Icon sx={{ fontSize: 16, color: statusColor }} />
      {name}
    </Box>
  );
}

/**
 * One chip per active member showing their RSVP state: confirmed (green check),
 * denied (red cross) or no answer yet (muted question mark).
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
        return (
          <ParticipationChip
            key={m.id}
            memberId={m.id}
            name={m.displayName}
            status={status}
          />
        );
      })}
    </Stack>
  );
}
