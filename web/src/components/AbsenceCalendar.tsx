import Box from "@mui/material/Box";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay, type PickersDayProps } from "@mui/x-date-pickers/PickersDay";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useAbsences } from "../api/absences.js";
import { useMeetings } from "../api/meetings.js";
import { useMembers } from "../api/members.js";
import { useColorMap } from "../theme/useMemberColor.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — operate on Berlin days regardless of device tz. */
const WG_TZ = "Europe/Berlin";

function DayCell(
  props: PickersDayProps<Dayjs> & {
    meetingsByDay: Map<string, string[]>;
    absenceBarsByDay: Map<string, string[]>;
    colors: Map<string, { main: string; soft: string; ink: string }>;
  },
) {
  const { meetingsByDay, absenceBarsByDay, colors, day, outsideCurrentMonth, ...other } = props;
  const key = day.tz(WG_TZ).format("YYYY-MM-DD");
  const bars = outsideCurrentMonth ? [] : (absenceBarsByDay.get(key) ?? []);
  const meetingDots = outsideCurrentMonth ? [] : (meetingsByDay.get(key) ?? []);
  const isSelected = other.selected;

  return (
    <Box sx={{ position: "relative" }}>
      <PickersDay {...other} day={day} outsideCurrentMonth={outsideCurrentMonth} />
      <Box
        sx={{
          position: "absolute",
          bottom: 2,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1px",
          pointerEvents: "none",
        }}
      >
        {meetingDots.length > 0 && (
          <Box sx={{ display: "flex", gap: "1px" }}>
            {meetingDots.slice(0, 4).map((id) => (
              <Box
                key={id}
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  bgcolor: isSelected ? "primary.contrastText" : "primary.main",
                }}
              />
            ))}
          </Box>
        )}
        {bars.length > 0 && (
          <Box sx={{ display: "flex", gap: "1px" }}>
            {bars.slice(0, 4).map((memberId) => (
              <Box
                key={memberId}
                sx={{
                  width: 3,
                  height: 3,
                  bgcolor: colors.get(memberId)?.main ?? "text.disabled",
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Calendar overview of meetings (dots) + member absences (colored bars). */
export function AbsenceCalendar({
  value,
  onChange,
}: {
  value?: Dayjs | null;
  onChange?: (day: Dayjs) => void;
}) {
  const absences = useAbsences();
  const meetings = useMeetings();
  const members = useMembers();
  const colors = useColorMap();

  const activeMemberIds = new Set((members.data ?? []).map((m) => m.id));

  const meetingsByDay = new Map<string, string[]>();
  for (const m of meetings.data ?? []) {
    if (!m.startsAt) continue;
    const key = dayjs(m.startsAt).tz(WG_TZ).format("YYYY-MM-DD");
    const existing = meetingsByDay.get(key) ?? [];
    existing.push(m.id);
    meetingsByDay.set(key, existing);
  }

  const absenceBarsByDay = new Map<string, string[]>();
  for (const a of absences.data ?? []) {
    if (!activeMemberIds.has(a.memberId)) continue;
    let d = dayjs(a.from).tz(WG_TZ).startOf("day");
    const end = dayjs(a.until).tz(WG_TZ).startOf("day");
    while (d.isSame(end) || d.isBefore(end)) {
      const key = d.format("YYYY-MM-DD");
      const existing = absenceBarsByDay.get(key) ?? [];
      if (!existing.includes(a.memberId)) existing.push(a.memberId);
      absenceBarsByDay.set(key, existing);
      d = d.add(1, "day");
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
      <DateCalendar
        timezone={WG_TZ}
        value={value}
        onChange={(d) => d && onChange?.(d)}
        slots={{ day: DayCell as unknown as typeof PickersDay }}
        slotProps={{
          day: { meetingsByDay, absenceBarsByDay, colors } as never,
        }}
      />
    </LocalizationProvider>
  );
}
