import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import type { CreateMeeting, MeetingMode, UpdateMeeting } from "@wg/shared";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateMeeting,
  useMeeting,
  useUpdateMeeting,
} from "../api/meetings.js";
import { SectionLabel } from "../components/SectionLabel.js";

const MODES: { value: MeetingMode; label: string }[] = [
  { value: "fixed", label: "Fest" },
  { value: "recurring", label: "Wiederkehrend" },
  { value: "poll", label: "Umfrage" },
];

export function MeetingForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const create = useCreateMeeting();
  const update = useUpdateMeeting();
  const existing = useMeeting(id);

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<MeetingMode>("fixed");
  const [startsAt, setStartsAt] = useState<Dayjs | null>(dayjs().add(1, "day").hour(19).minute(0));
  const [recurEveryDays, setRecurEveryDays] = useState("7");
  const [options, setOptions] = useState<(Dayjs | null)[]>([
    dayjs().add(1, "day").hour(19).minute(0),
    dayjs().add(2, "day").hour(19).minute(0),
  ]);

  // Prefill from the existing meeting when editing.
  const meeting = existing.data?.meeting;
  useEffect(() => {
    if (!isEdit || !meeting) return;
    setTitle(meeting.title);
    setMode(meeting.mode);
    if (meeting.startsAt) setStartsAt(dayjs(meeting.startsAt));
    if (meeting.recurEveryDays) setRecurEveryDays(String(meeting.recurEveryDays));
  }, [isEdit, meeting]);

  // An unresolved poll has no fixed time yet — only the title is editable.
  const isUnresolvedPoll = mode === "poll" && !meeting?.startsAt;
  const editableTimeFields = !isEdit || !isUnresolvedPoll;

  const pending = create.isPending || update.isPending;
  const valid =
    title.trim() &&
    (isEdit
      ? isUnresolvedPoll || Boolean(startsAt)
      : mode === "poll"
        ? options.filter(Boolean).length >= 2
        : Boolean(startsAt)) &&
    (mode !== "recurring" || Number(recurEveryDays) > 0) &&
    !pending;

  const submit = () => {
    if (isEdit) {
      const body: UpdateMeeting = {
        title: title.trim(),
        ...(isUnresolvedPoll ? {} : { startsAt: startsAt!.toISOString() }),
        ...(mode === "recurring" ? { recurEveryDays: Number(recurEveryDays) } : {}),
      };
      update.mutate(
        { id: id!, body },
        { onSuccess: () => navigate(`/termine/${id}`, { replace: true }) },
      );
      return;
    }
    const body: CreateMeeting = {
      title: title.trim(),
      mode,
      ...(mode === "poll"
        ? { options: options.filter(Boolean).map((d) => d!.toISOString()) }
        : { startsAt: startsAt!.toISOString() }),
      ...(mode === "recurring" ? { recurEveryDays: Number(recurEveryDays) } : {}),
    };
    create.mutate(body, { onSuccess: () => navigate("/termine", { replace: true }) });
  };

  if (isEdit && !meeting) return <Box sx={{ p: 2 }}>Lädt…</Box>;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
      <Box sx={{ p: 2, pb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography variant="h5">{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</Typography>
        </Stack>

        <Stack spacing={2.5}>
          <TextField
            label="Titel"
            placeholder="z. B. WG-Abend"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            fullWidth
          />

          <Box>
            <SectionLabel>Art</SectionLabel>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              fullWidth
              size="small"
              disabled={isEdit}
            >
              {MODES.map((m) => (
                <ToggleButton key={m.value} value={m.value}>{m.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {mode !== "poll" && (
            <DateTimePicker
              label="Wann?"
              value={startsAt}
              onChange={setStartsAt}
              ampm={false}
            />
          )}

          {mode === "recurring" && (
            <TextField
              label="Wiederholung alle (Tage)"
              value={recurEveryDays}
              onChange={(e) => setRecurEveryDays(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              sx={{ width: 220 }}
            />
          )}

          {mode === "poll" && !editableTimeFields && (
            <Typography variant="body2" color="text.secondary">
              Die Vorschläge einer Umfrage lassen sich nicht ändern. Lege die Zeit
              fest oder erstelle eine neue Umfrage.
            </Typography>
          )}

          {mode === "poll" && editableTimeFields && !isEdit && (
            <Box>
              <SectionLabel>Vorschläge</SectionLabel>
              <Stack spacing={1.5}>
                {options.map((opt, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <DateTimePicker
                      value={opt}
                      onChange={(v) =>
                        setOptions((p) => p.map((o, j) => (j === i ? v : o)))
                      }
                      ampm={false}
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}
                      disabled={options.length <= 2}
                    >
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  startIcon={<AddRoundedIcon />}
                  onClick={() =>
                    setOptions((p) => [...p, dayjs().add(p.length + 1, "day").hour(19).minute(0)])
                  }
                  sx={{ alignSelf: "flex-start" }}
                >
                  Vorschlag hinzufügen
                </Button>
              </Stack>
            </Box>
          )}

          <Divider />
          <Button variant="contained" size="large" disabled={!valid} onClick={submit}>
            {pending
              ? "Wird gespeichert…"
              : isEdit
                ? "Speichern"
                : "Termin erstellen"}
          </Button>
        </Stack>
      </Box>
    </LocalizationProvider>
  );
}
