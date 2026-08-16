import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAbsences } from "../api/absences.js";
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
            navigate("/termine/abwesenheit/neu");
          }}
        />
      </SpeedDial>
    </Box>
  );
}

function CalendarView() {
  const navigate = useNavigate();
  const allAbsences = useAbsences();
  const meetings = useMeetings();
  const members = useMembers();
  const now = dayjs();
  const [selected, setSelected] = useState<Dayjs | null>(dayjs().tz(WG_TZ));

  const upcomingAbsences = [...(allAbsences.data ?? [])]
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
                onClick={() => navigate(`/termine/${m.id}/bearbeiten`)}
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
              <CardActionArea
                key={a.id}
                onClick={() => navigate(`/termine/abwesenheit/${a.id}/bearbeiten`)}
                sx={{
                  py: 1,
                  px: 1,
                  borderTop: i === 0 && dayMeetings.length === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
                  <FlightTakeoffRoundedIcon fontSize="small" />
                  <Box sx={{ flex: 1 }}>
                    <Typography>
                      {members.data?.find((m) => m.id === a.memberId)?.displayName ?? "Unbekannt"}{" "}
                      abwesend
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(a.from)} – {formatDate(a.until)}
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
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
                <Card
                  key={m.id}
                  sx={{
                    bgcolor: "rgba(91,79,233,0.07)",
                    border: "1px solid rgba(91,79,233,0.16)",
                  }}
                >
                  <CardActionArea
                    sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}
                    onClick={() => navigate(`/termine/${m.id}/bearbeiten`)}
                  >
                    <EventRoundedIcon sx={{ color: "primary.main", fontSize: 34 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{m.title}</Typography>
                      <Typography color="text.secondary">
                        {formatDateTime(m.startsAt)}
                      </Typography>
                    </Box>
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
          {upcomingAbsences.length > 0 ? (
            <Stack spacing={1.5}>
              {upcomingAbsences.map((a) => (
                <Card
                  key={a.id}
                  sx={{
                    bgcolor: "rgba(91,79,233,0.07)",
                    border: "1px solid rgba(91,79,233,0.16)",
                  }}
                >
                  <CardActionArea
                    sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}
                    onClick={() => navigate(`/termine/abwesenheit/${a.id}/bearbeiten`)}
                  >
                    <FlightTakeoffRoundedIcon sx={{ color: "primary.main", fontSize: 34 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {members.data?.find((m) => m.id === a.memberId)?.displayName ??
                          "Unbekannt"}
                      </Typography>
                      <Typography color="text.secondary">
                        {formatDate(a.from)} – {formatDate(a.until)}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          ) : (
            <EmptyState title="Keine Abwesenheiten" hint="Plane eine Abwesenheit." />
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
