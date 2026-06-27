import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import { useIdentity } from "../api/identity.js";
import {
  useMeeting,
  useResolvePoll,
  useRsvp,
  useUnvote,
  useVote,
} from "../api/meetings.js";
import { MemberChip } from "../components/MemberChip.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { formatDateTime } from "../lib/format.js";

export function MeetingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { memberId } = useIdentity();
  const detail = useMeeting(id);
  const vote = useVote();
  const unvote = useUnvote();
  const resolve = useResolvePoll();
  const rsvp = useRsvp();

  if (!detail.data) return <Box sx={{ p: 2 }}>Lädt…</Box>;
  const { meeting, options, votes, rsvps } = detail.data;
  const isPoll = meeting.mode === "poll" && !meeting.startsAt;

  const myRsvp = rsvps.find((r) => r.memberId === memberId)?.value;
  const attendees = rsvps.filter((r) => r.value === "yes").map((r) => r.memberId);
  const votesByOption = (optId: string) => votes.filter((v) => v.optionId === optId);
  const iVoted = (optId: string) =>
    votes.some((v) => v.optionId === optId && v.memberId === memberId);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>{meeting.title}</Typography>
      </Stack>

      {!isPoll && meeting.startsAt && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {formatDateTime(meeting.startsAt)}
        </Typography>
      )}

      {/* Poll */}
      {isPoll && (
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Stimm ab</SectionLabel>
          <Stack spacing={1}>
            {options.map((o) => {
              const count = votesByOption(o.id).length;
              const mine = iVoted(o.id);
              return (
                <Card key={o.id} sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>{formatDateTime(o.optionTime)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {count} Stimme{count === 1 ? "" : "n"}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant={mine ? "contained" : "outlined"}
                      onClick={() =>
                        mine
                          ? unvote.mutate({ id, body: { optionId: o.id } })
                          : vote.mutate({ id, body: { optionId: o.id } })
                      }
                    >
                      {mine ? "Gewählt" : "Wählen"}
                    </Button>
                    <Button
                      size="small"
                      color="success"
                      onClick={() => resolve.mutate({ id, body: { optionId: o.id } })}
                    >
                      Auflösen
                    </Button>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
          <Divider sx={{ my: 3 }} />
        </Box>
      )}

      {/* RSVP */}
      <SectionLabel>Bist du dabei?</SectionLabel>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant={myRsvp === "yes" ? "contained" : "outlined"}
          onClick={() => rsvp.mutate({ id, body: { value: "yes" } })}
        >
          Ja
        </Button>
        <Button
          variant={myRsvp === "no" ? "contained" : "outlined"}
          color="inherit"
          onClick={() => rsvp.mutate({ id, body: { value: "no" } })}
        >
          Nein
        </Button>
      </Stack>

      <SectionLabel>Zusagen ({attendees.length})</SectionLabel>
      {attendees.length > 0 ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {attendees.map((mid) => (
            <MemberChip key={mid} memberId={mid} />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Noch keine Zusagen.
        </Typography>
      )}
    </Box>
  );
}
