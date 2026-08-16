import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
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
import { EmptyState } from "../components/EmptyState.js";
import { formatDate, formatDateTime } from "../lib/format.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — operate on Berlin days regardless of device tz. */
const WG_TZ = "Europe/Berlin";

export function Termine() {
  const navigate = useNavigate();
  const [planOpen, setPlanOpen] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);

  return (
    <Box sx={{ p: 2 }}>
      <CalendarView />

      <SpeedDial
        ariaLabel="Neu"
        icon={<AddRoundedIcon />}
        open={dialOpen}
        onOpen={() => setDialOpen(true)}
        onClose={() => setDialOpen(false)}
        sx={{ position: "fixed", bottom: 80, right: 16, zIndex: 1200 }}
      >
        <SpeedDialAction
          icon={<EventRoundedIcon />}
          tooltipTitle="Termin"
          tooltipOpen
          onClick={() => {
            setDialOpen(false);
            navigate("/termine/neu");
          }}
        />
        <SpeedDialAction
          icon={<FlightTakeoffRoundedIcon />}
          tooltipTitle="Abwesenheit"
          tooltipOpen
          onClick={() => {
            setDialOpen(false);
            setPlanOpen(true);
          }}
        />
      </SpeedDial>

      <PlanAbsenceDialog open={planOpen} onClose={() => setPlanOpen(false)} />
    </Box>
  );
}

function CalendarView() {
  const navigate = useNavigate();
  const { memberId } = useIdentity();
  const absences = useAbsences(memberId ?? undefined);
  const allAbsences = useAbsences();
  const meetings = useMeetings();
  const members = useMembers();
  const remove = useDeleteAbsence();
  const now = dayjs();
  const [selected, setSelected] = useState<Dayjs | null>(dayjs().tz(WG_TZ));

  const mine = [...(absences.data ?? [])]
    .filter((a) => dayjs(a.until).isAfter(now))
    .sort((a, b) => dayjs(a.from).valueOf() - dayjs(b.from).valueOf());

  const sortedMeetings = [...(meetings.data ?? [])].sort(
    (a, b) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf(),
  );

  const selectedDay = selected?.tz(WG_TZ).startOf("day");
  const dayMeetings = selectedDay
    ? (meetings.data ?? []).filter((m) => dayjs(m.startsAt).tz(WG_TZ).isSame(selectedDay, "day"))
    : [];
  const dayAbsences = selectedDay
    ? (allAbsences.data ?? []).filter(
        (a) =>
          !selectedDay.isBefore(dayjs(a.from).tz(WG_TZ).startOf("day")) &&
          !selectedDay.isAfter(dayjs(a.until).tz(WG_TZ).startOf("day")),
      )
    : [];

  return (
    <Box>
      <Card sx={{ p: 1 }}>
        <AbsenceCalendar value={selected} onChange={setSelected} />
      </Card>

      {selectedDay && (dayMeetings.length > 0 || dayAbsences.length > 0) && (
        <>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mt: 3, mb: 1 }}>
            {formatDate(selectedDay.toISOString())}
          </Typography>
          <Card sx={{ px: 1 }}>
            {dayMeetings.map((m, i) => (
              <CardActionArea
                key={m.id}
                onClick={() => navigate(`/termine/${m.id}`)}
                sx={{
                  py: 1,
                  px: 1,
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <EventRoundedIcon fontSize="small" />
                  <Box sx={{ flex: 1 }}>
                    <Typography>{m.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(m.startsAt)}
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            ))}
            {dayAbsences.map((a, i) => (
              <Stack
                key={a.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  py: 1,
                  px: 1,
                  borderTop: i === 0 && dayMeetings.length === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography sx={{ flex: 1 }}>
                  {members.data?.find((m) => m.id === a.memberId)?.displayName ?? "Unbekannt"}{" "}
                  abwesend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(a.from)} – {formatDate(a.until)}
                </Typography>
              </Stack>
            ))}
          </Card>
        </>
      )}

      <Accordion disableGutters sx={{ mt: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography sx={{ fontWeight: 600 }}>Termine</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pb: 2 }}>
          {sortedMeetings.length > 0 ? (
            <Stack spacing={1.5}>
              {sortedMeetings.map((m) => (
                <Card key={m.id}>
                  <CardActionArea sx={{ p: 2 }} onClick={() => navigate(`/termine/${m.id}`)}>
                    <Typography variant="h6">{m.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {formatDateTime(m.startsAt)}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          ) : (
            <EmptyState title="Keine Termine" hint="Plane ein Treffen." />
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography sx={{ fontWeight: 600 }}>Abwesenheiten</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pb: 2 }}>
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
        </AccordionDetails>
      </Accordion>
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

  const valid =
    selectedMember &&
    from &&
    until &&
    !until.startOf("day").isBefore(from.startOf("day")) &&
    !create.isPending;

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
