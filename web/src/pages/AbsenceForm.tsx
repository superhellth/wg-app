import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { CreateAbsence, UpdateAbsence } from "@wg/shared";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useAbsence,
  useCreateAbsence,
  useDeleteAbsence,
  useUpdateAbsence,
} from "../api/absences.js";
import { useIdentity } from "../api/identity.js";
import { useMembers } from "../api/members.js";
import { useConfirm } from "../components/ConfirmDialog.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — pickers operate in Berlin regardless of device tz. */
const WG_TZ = "Europe/Berlin";

export function AbsenceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { memberId } = useIdentity();
  const members = useMembers();
  const create = useCreateAbsence();
  const update = useUpdateAbsence();
  const remove = useDeleteAbsence();
  const confirm = useConfirm();
  const existing = useAbsence(id);

  const [selectedMember, setSelectedMember] = useState(memberId ?? "");
  const [from, setFrom] = useState<Dayjs | null>(dayjs().tz(WG_TZ));
  const [until, setUntil] = useState<Dayjs | null>(dayjs().tz(WG_TZ).add(7, "day"));

  const absence = existing.data;
  useEffect(() => {
    if (!isEdit || !absence) return;
    setSelectedMember(absence.memberId);
    setFrom(dayjs(absence.from).tz(WG_TZ));
    setUntil(dayjs(absence.until).tz(WG_TZ));
  }, [isEdit, absence]);

  const pending = create.isPending || update.isPending || remove.isPending;
  const valid =
    selectedMember &&
    from &&
    until &&
    !until.startOf("day").isBefore(from.startOf("day")) &&
    !pending;

  const submit = () => {
    if (!valid || !from || !until) return;
    if (isEdit) {
      const body: UpdateAbsence = {
        memberId: selectedMember,
        from: from.tz(WG_TZ).startOf("day").toISOString(),
        until: until.tz(WG_TZ).endOf("day").toISOString(),
      };
      update.mutate(
        { id: id!, body },
        { onSuccess: () => navigate("/termine", { replace: true }) },
      );
      return;
    }
    const body: CreateAbsence = {
      memberId: selectedMember,
      from: from.tz(WG_TZ).startOf("day").toISOString(),
      until: until.tz(WG_TZ).endOf("day").toISOString(),
    };
    create.mutate(body, { onSuccess: () => navigate("/termine", { replace: true }) });
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "Abwesenheit löschen?",
      body: "Diese Abwesenheit wirklich löschen?",
      confirmLabel: "Löschen",
      confirmColor: "error",
    });
    if (!ok) return;
    remove.mutate(id, { onSuccess: () => navigate("/termine", { replace: true }) });
  };

  if (isEdit && !absence) return <Box sx={{ p: 2 }}>Lädt…</Box>;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
      <Box sx={{ p: 2, pb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography variant="h5">
            {isEdit ? "Abwesenheit bearbeiten" : "Neue Abwesenheit"}
          </Typography>
        </Stack>

        <Stack spacing={2.5}>
          <TextField
            select
            label="Mitbewohner:in"
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            fullWidth
          >
            {(members.data ?? []).map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.displayName}
              </MenuItem>
            ))}
          </TextField>

          <DatePicker label="Von" value={from} onChange={setFrom} timezone={WG_TZ} />
          <DatePicker
            label="Bis"
            value={until}
            onChange={setUntil}
            timezone={WG_TZ}
            minDate={from ?? undefined}
          />

          <Divider />
          <Button variant="contained" size="large" disabled={!valid} onClick={submit}>
            {pending
              ? "Wird gespeichert…"
              : isEdit
                ? "Abwesenheit Speichern"
                : "Abwesenheit erstellen"}
          </Button>
          {isEdit && (
            <Button color="error" disabled={pending} onClick={handleDelete}>
              Abwesenheit löschen
            </Button>
          )}
        </Stack>
      </Box>
    </LocalizationProvider>
  );
}
