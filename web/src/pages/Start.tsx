import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useIdentity } from "../api/identity.js";
import { useBalances } from "../api/balances.js";
import { useChores, useChoreDone } from "../api/chores.js";
import { useMeeting, useMeetings, useRsvp } from "../api/meetings.js";
import { useMembersMap } from "../api/members.js";
import { useRecentActivity } from "../api/activity.js";
import { ActivityRow } from "../components/ActivityRow.js";
import { MoneyText } from "../components/MoneyText.js";
import { ParticipationChips } from "../components/ParticipationChips.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { formatDate, formatDateTime } from "../lib/format.js";

export function Start() {
  const navigate = useNavigate();
  const { memberId } = useIdentity();
  const members = useMembersMap();
  const balances = useBalances();
  const chores = useChores();
  const meetings = useMeetings();
  const activity = useRecentActivity(8);
  const choreDone = useChoreDone();
  const rsvp = useRsvp();

  const me = memberId ? members.get(memberId) : undefined;
  const myBalance = (memberId && balances.data?.balances[memberId]) || 0;

  const myTurn = chores.data?.find((c) => c.currentTurn?.assigneeId === memberId);
  const nextMeeting = (meetings.data ?? [])
    .filter((m) => m.startsAt && dayjs(m.startsAt).isAfter(dayjs()))
    .sort((a, b) => dayjs(a.startsAt!).valueOf() - dayjs(b.startsAt!).valueOf())[0];

  // Pull the next meeting's detail so the Ja/Nein buttons reflect my current RSVP
  // (the meetings list carries no rsvps). The rsvp mutation invalidates the
  // meetings key by prefix, so this refetches and restyles on change.
  const nextDetail = useMeeting(nextMeeting?.id);
  const myRsvp = nextDetail.data?.rsvps.find((r) => r.memberId === memberId)?.value;

  return (
    <Stack spacing={2.5} sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mt: 1 }}>
        Hallo{me ? `, ${me.displayName}` : ""} 👋
      </Typography>

      {/* Saldo */}
      <Card>
        <CardActionArea onClick={() => navigate("/geld")} sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <SectionLabel>Dein Saldo</SectionLabel>
              <MoneyText cents={myBalance} signed size="2rem" />
              <Typography variant="body2" color="text.secondary">
                {myBalance > 0
                  ? "Dir wird Geld geschuldet"
                  : myBalance < 0
                    ? "Du schuldest noch"
                    : "Alles ausgeglichen"}
              </Typography>
            </Box>
            <ChevronRightRoundedIcon color="action" />
          </Stack>
        </CardActionArea>
      </Card>

      {/* Deine Aufgabe */}
      {myTurn?.currentTurn && (
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <SectionLabel>Deine Aufgabe</SectionLabel>
            {dayjs(myTurn.currentTurn.dueAt).isBefore(dayjs()) && (
              <Chip label="Überfällig" color="error" size="small" />
            )}
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6">{myTurn.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Fällig {formatDate(myTurn.currentTurn.dueAt)}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => choreDone.mutate(myTurn.id)}
              disabled={choreDone.isPending}
            >
              Erledigt
            </Button>
          </Stack>
        </Card>
      )}

      {/* Nächster Termin */}
      {nextMeeting && (
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
            <SectionLabel>Nächster Termin</SectionLabel>
            <Stack direction="row" spacing={0.5} sx={{ mt: -0.5 }}>
              <IconButton
                size="small"
                aria-label="Zusagen"
                onClick={() => rsvp.mutate({ id: nextMeeting.id, body: { value: "yes" } })}
                sx={{ color: myRsvp === "yes" ? "#0E8A5F" : "text.disabled" }}
              >
                <CheckCircleRoundedIcon />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Absagen"
                onClick={() => rsvp.mutate({ id: nextMeeting.id, body: { value: "no" } })}
                sx={{ color: myRsvp === "no" ? "#C8553D" : "text.disabled" }}
              >
                <CancelRoundedIcon />
              </IconButton>
            </Stack>
          </Stack>
          <Typography variant="h6">{nextMeeting.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {nextMeeting.startsAt ? formatDateTime(nextMeeting.startsAt) : ""}
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <ParticipationChips rsvps={nextDetail.data?.rsvps ?? []} />
        </Card>
      )}

      {/* Aktivität */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <SectionLabel>Aktivität</SectionLabel>
          <Button size="small" onClick={() => navigate("/aktivitaet")}>
            Alle anzeigen
          </Button>
        </Stack>
        <Card sx={{ px: 2, py: 0.5 }}>
          {activity.data && activity.data.length > 0 ? (
            activity.data.map((a, i) => (
              <Box
                key={a.id}
                sx={{ borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider" }}
              >
                <ActivityRow item={a} />
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Noch nichts passiert. Leg los!
            </Typography>
          )}
        </Card>
      </Box>
    </Stack>
  );
}
