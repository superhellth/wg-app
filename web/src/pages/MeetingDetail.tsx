import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIdentity } from "../api/identity.js";
import {
  useDeleteMeeting,
  useMeeting,
  useResolvePoll,
  useRsvp,
  useUnvote,
  useVote,
} from "../api/meetings.js";
import { useConfirm } from "../components/ConfirmDialog.js";
import { ParticipationChips } from "../components/ParticipationChips.js";
import { SectionLabel } from "../components/SectionLabel.js";
import {
  formatDateTime,
  formatDayMonth,
  formatTime,
  formatWeekday,
} from "../lib/format.js";

/** Human label for a recurring meeting's cadence. */
function recurrenceLabel(days: number | null): string | null {
  if (!days) return null;
  if (days === 7) return "Wöchentlich";
  if (days === 14) return "Alle 2 Wochen";
  return `Alle ${days} Tage`;
}

export function MeetingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { memberId } = useIdentity();
  const detail = useMeeting(id);
  const vote = useVote();
  const unvote = useUnvote();
  const resolve = useResolvePoll();
  const rsvp = useRsvp();
  const del = useDeleteMeeting();
  const confirm = useConfirm();
  const [resolveOpen, setResolveOpen] = useState(false);

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Termin löschen?",
      body: "Diesen Termin wirklich löschen?",
      confirmLabel: "Löschen",
      confirmColor: "error",
    });
    if (!ok) return;
    del.mutate(id, { onSuccess: () => navigate("/termine", { replace: true }) });
  };

  if (!detail.data) return <Box sx={{ p: 2 }}>Lädt…</Box>;
  const { meeting, options, votes, rsvps } = detail.data;
  const isPoll = meeting.mode === "poll" && !meeting.startsAt;
  const recurLabel =
    meeting.mode === "recurring" ? recurrenceLabel(meeting.recurEveryDays) : null;

  const myRsvp = rsvps.find((r) => r.memberId === memberId)?.value;
  const attendees = rsvps.filter((r) => r.value === "yes").map((r) => r.memberId);
  const votesByOption = (optId: string) => votes.filter((v) => v.optionId === optId);
  const iVoted = (optId: string) =>
    votes.some((v) => v.optionId === optId && v.memberId === memberId);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={() => navigate(`/termine/${id}/bearbeiten`)}>
          <EditRoundedIcon />
        </IconButton>
        <IconButton onClick={handleDelete} disabled={del.isPending}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
      </Stack>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, lineHeight: 1.2 }}>
        {meeting.title}
      </Typography>

      {!isPoll && meeting.startsAt && (
        <Card
          sx={{
            p: 2,
            mb: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            bgcolor: "rgba(91,79,233,0.07)",
            border: "1px solid rgba(91,79,233,0.16)",
          }}
        >
          <CalendarMonthRoundedIcon sx={{ color: "primary.main", fontSize: 34 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {formatWeekday(meeting.startsAt)}
            </Typography>
            <Typography color="text.secondary">
              {formatDayMonth(meeting.startsAt)} · {formatTime(meeting.startsAt)} Uhr
            </Typography>
          </Box>
          {recurLabel && (
            <Chip
              icon={<RepeatRoundedIcon />}
              label={recurLabel}
              size="small"
              sx={{ bgcolor: "background.paper" }}
            />
          )}
        </Card>
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
                  </Stack>
                </Card>
              );
            })}
          </Stack>
          <Button
            variant="contained"
            color="success"
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => setResolveOpen(true)}
          >
            Zeit festlegen
          </Button>
          <Divider sx={{ my: 3 }} />
        </Box>
      )}

      {/* Resolve dialog: pick the winning option → meeting gets a fixed time. */}
      <Dialog open={resolveOpen} onClose={() => setResolveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Zeit festlegen</DialogTitle>
        <List>
          {options.map((o) => (
            <ListItemButton
              key={o.id}
              onClick={() =>
                resolve.mutate(
                  { id, body: { optionId: o.id } },
                  { onSuccess: () => setResolveOpen(false) },
                )
              }
            >
              <ListItemText
                primary={formatDateTime(o.optionTime)}
                secondary={`${votesByOption(o.id).length} Stimme${
                  votesByOption(o.id).length === 1 ? "" : "n"
                }`}
              />
            </ListItemButton>
          ))}
        </List>
      </Dialog>

      {/* RSVP — only once the time is fixed (no point committing to a poll). */}
      <SectionLabel>Deine Antwort</SectionLabel>
      {isPoll ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Zusagen sind möglich, sobald die Zeit festgelegt ist.
        </Typography>
      ) : (
        <Card sx={{ p: 1.5, mb: 3 }}>
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant={myRsvp === "yes" ? "contained" : "outlined"}
              disabled={myRsvp === "yes"}
              onClick={() => rsvp.mutate({ id, body: { value: "yes" } })}
            >
              Ja
            </Button>
            <Button
              fullWidth
              variant={myRsvp === "no" ? "contained" : "outlined"}
              color="inherit"
              disabled={myRsvp === "no"}
              onClick={() => rsvp.mutate({ id, body: { value: "no" } })}
            >
              Nein
            </Button>
          </Stack>
        </Card>
      )}

      <SectionLabel>Teilnahme ({attendees.length} zugesagt)</SectionLabel>
      <Card sx={{ p: 1.5 }}>
        <ParticipationChips rsvps={rsvps} />
      </Card>
    </Box>
  );
}
