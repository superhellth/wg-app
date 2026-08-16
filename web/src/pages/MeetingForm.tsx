import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import type { CreateMeeting, UpdateMeeting } from "@wg/shared";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useEffect, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — pickers operate in Berlin regardless of device tz. */
const WG_TZ = "Europe/Berlin";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateMeeting,
  useDeleteMeeting,
  useMeeting,
  useUpdateMeeting,
} from "../api/meetings.js";
import { useConfirm } from "../components/ConfirmDialog.js";

export function MeetingForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const create = useCreateMeeting();
  const update = useUpdateMeeting();
  const remove = useDeleteMeeting();
  const confirm = useConfirm();
  const existing = useMeeting(id);

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState<Dayjs | null>(
    dayjs().tz(WG_TZ).add(1, "day").hour(19).minute(0).second(0),
  );

  // Prefill from the existing meeting when editing.
  const meeting = existing.data;
  useEffect(() => {
    if (!isEdit || !meeting) return;
    setTitle(meeting.title);
    setStartsAt(dayjs(meeting.startsAt).tz(WG_TZ));
  }, [isEdit, meeting]);

  const pending = create.isPending || update.isPending || remove.isPending;
  const valid = title.trim() && Boolean(startsAt) && !pending;

  const submit = () => {
    if (isEdit) {
      const body: UpdateMeeting = { title: title.trim(), startsAt: startsAt!.toISOString() };
      update.mutate(
        { id: id!, body },
        { onSuccess: () => navigate("/termine", { replace: true }) },
      );
      return;
    }
    const body: CreateMeeting = { title: title.trim(), startsAt: startsAt!.toISOString() };
    create.mutate(body, { onSuccess: () => navigate("/termine", { replace: true }) });
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "Termin löschen?",
      body: "Diesen Termin wirklich löschen?",
      confirmLabel: "Löschen",
      confirmColor: "error",
    });
    if (!ok) return;
    remove.mutate(id, { onSuccess: () => navigate("/termine", { replace: true }) });
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

          <DateTimePicker
            label="Wann?"
            value={startsAt}
            onChange={setStartsAt}
            timezone={WG_TZ}
            ampm={false}
          />

          <Divider />
          <Button variant="contained" size="large" disabled={!valid} onClick={submit}>
            {pending
              ? "Wird gespeichert…"
              : isEdit
                ? "Termin Speichern"
                : "Termin erstellen"}
          </Button>
          {isEdit && (
            <Button color="error" disabled={pending} onClick={handleDelete}>
              Termin löschen
            </Button>
          )}
        </Stack>
      </Box>
    </LocalizationProvider>
  );
}
