import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAbsences, useCreateAbsence, useDeleteAbsence } from "../api/absences.js";
import { useIdentity } from "../api/identity.js";
import { useMeetings } from "../api/meetings.js";
import { useMembers } from "../api/members.js";
import { AbsenceCalendar } from "../components/AbsenceCalendar.js";
import { AddFab } from "../components/Fab.js";
import { EmptyState } from "../components/EmptyState.js";
import { ParticipationChips } from "../components/ParticipationChips.js";
import { formatDate, formatDateTime } from "../lib/format.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — operate on Berlin days regardless of device tz. */
const WG_TZ = "Europe/Berlin";

const MODE = {
  fixed: { label: "Termin", icon: <EventRoundedIcon fontSize="small" /> },
  recurring: { label: "Wiederkehrend", icon: <RepeatRoundedIcon fontSize="small" /> },
  poll: { label: "Umfrage", icon: <HowToVoteRoundedIcon fontSize="small" /> },
};

export function Termine() {
  const navigate = useNavigate();
  const meetings = useMeetings();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [planOpen, setPlanOpen] = useState(false);

  const sorted = [...(meetings.data ?? [])].sort((a, b) => {
    const ta = a.startsAt ? dayjs(a.startsAt).valueOf() : Infinity;
    const tb = b.startsAt ? dayjs(b.startsAt).valueOf() : Infinity;
    return ta - tb;
  });

  return (
    <Box sx={{ p: 2 }}>
      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_e, v) => v && setView(v)}
        size="small"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="list">Liste</ToggleButton>
        <ToggleButton value="calendar">Kalender</ToggleButton>
      </ToggleButtonGroup>

      {view === "list" ? (
        sorted.length > 0 ? (
          <Stack spacing={1.5}>
            {sorted.map((m) => {
              const mode = MODE[m.mode];
              return (
                <Card key={m.id}>
                  <CardActionArea sx={{ p: 2 }} onClick={() => navigate(`/termine/${m.id}`)}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="h6" sx={{ flex: 1 }}>{m.title}</Typography>
                      <Chip icon={mode.icon} label={mode.label} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {m.startsAt ? formatDateTime(m.startsAt) : "Noch kein Termin — abstimmen"}
                    </Typography>
                    {m.startsAt && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <ParticipationChips rsvps={m.rsvps} />
                      </>
                    )}
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        ) : (
          <EmptyState title="Keine Termine" hint="Plane ein Treffen oder starte eine Umfrage." />
        )
      ) : (
        <CalendarView onPlan={() => setPlanOpen(true)} />
      )}

      {view === "list" && (
        <AddFab label="Termin hinzufügen" onClick={() => navigate("/termine/neu")} />
      )}
      {view === "calendar" && (
        <Fab
          color="primary"
          aria-label="Abwesenheit planen"
          onClick={() => setPlanOpen(true)}
          sx={{ position: "fixed", bottom: 80, right: 16, zIndex: 1200 }}
        >
          <EventRoundedIcon />
        </Fab>
      )}

      <PlanAbsenceDialog open={planOpen} onClose={() => setPlanOpen(false)} />
    </Box>
  );
}

function CalendarView({ onPlan }: { onPlan: () => void }) {
  const { memberId } = useIdentity();
  const absences = useAbsences(memberId ?? undefined);
  const remove = useDeleteAbsence();
  const now = dayjs();

  const mine = [...(absences.data ?? [])]
    .filter((a) => dayjs(a.until).isAfter(now))
    .sort((a, b) => dayjs(a.from).valueOf() - dayjs(b.from).valueOf());

  return (
    <Box>
      <Card sx={{ p: 1 }}>
        <AbsenceCalendar />
      </Card>

      <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mt: 3, mb: 1 }}>
        Meine Abwesenheiten
      </Typography>
      {mine.length > 0 ? (
        <Card sx={{ px: 1 }}>
          {mine.map((a, i) => (
            <Stack
              key={a.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                py: 1,
                borderTop: i === 0 ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography sx={{ flex: 1 }}>
                {formatDate(a.from)} – {formatDate(a.until)}
              </Typography>
              <IconButton size="small" onClick={() => remove.mutate(a.id)}>
                <DeleteRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Card>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Keine geplanten Abwesenheiten.
        </Typography>
      )}

      <Box sx={{ mt: 2 }}>
        <Button onClick={onPlan}>Abwesenheit planen</Button>
      </Box>
    </Box>
  );
}

function PlanAbsenceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { memberId } = useIdentity();
  const members = useMembers();
  const create = useCreateAbsence();
  const [selectedMember, setSelectedMember] = useState(memberId ?? "");
  const [from, setFrom] = useState<Dayjs | null>(dayjs().tz(WG_TZ));
  const [until, setUntil] = useState<Dayjs | null>(dayjs().tz(WG_TZ).add(7, "day"));

  const valid = selectedMember && from && until && from.isBefore(until) && !create.isPending;

  const submit = () => {
    if (!valid || !from || !until) return;
    create.mutate(
      {
        memberId: selectedMember,
        from: from.tz(WG_TZ).startOf("day").toISOString(),
        until: until.tz(WG_TZ).endOf("day").toISOString(),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Abwesenheit planen</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Mitbewohner:in"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              fullWidth
            >
              {(members.data ?? []).map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>
              ))}
            </TextField>
            <DatePicker label="Von" value={from} onChange={setFrom} timezone={WG_TZ} />
            <DatePicker label="Bis" value={until} onChange={setUntil} timezone={WG_TZ} minDate={from ?? undefined} />
          </Stack>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" disabled={!valid} onClick={submit}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
