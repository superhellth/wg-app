import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { ChoreFrequency } from "@wg/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useChores,
  useCreateChore,
  useDeleteChore,
  useUpdateChore,
} from "../api/chores.js";
import { useMembers } from "../api/members.js";
import { useConfirm } from "../components/ConfirmDialog.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SectionLabel } from "../components/SectionLabel.js";

const FREQS: { value: ChoreFrequency; label: string }[] = [
  { value: "weekly", label: "Wöchentlich" },
  { value: "biweekly", label: "Zweiwöchentlich" },
  { value: "custom", label: "Eigene" },
];

export function ChoreForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const { data: members } = useMembers();
  const create = useCreateChore();
  const update = useUpdateChore();
  const remove = useDeleteChore();
  const confirm = useConfirm();
  const chores = useChores();
  const existing = editing ? chores.data?.find((c) => c.id === id) : undefined;

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<ChoreFrequency>("weekly");
  const [intervalDays, setIntervalDays] = useState("10");
  const [rotation, setRotation] = useState<string[]>([]);
  const [firstAssignee, setFirstAssignee] = useState("");

  // Seed once: from the existing chore when editing, else all active members.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (editing) {
      if (!existing) return;
      setName(existing.name);
      setFrequency(existing.frequency);
      setIntervalDays(String(existing.intervalDays ?? 10));
      setRotation(existing.rotation);
      seeded.current = true;
    } else if (members) {
      const ids = members.map((m) => m.id);
      setRotation(ids);
      setFirstAssignee(ids[0] ?? "");
      seeded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, existing, members]);

  const nameById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.displayName])),
    [members],
  );

  const move = (i: number, dir: -1 | 1) => {
    setRotation((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };
  const toggle = (id: string) => {
    setRotation((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const inRotation = rotation;
  const notInRotation = (members ?? [])
    .map((m) => m.id)
    .filter((id) => !rotation.includes(id));

  const busy = create.isPending || update.isPending || remove.isPending;
  const valid =
    name.trim() &&
    rotation.length > 0 &&
    (editing || (firstAssignee && rotation.includes(firstAssignee))) &&
    (frequency !== "custom" || Number(intervalDays) > 0) &&
    !busy;

  const submit = () => {
    const base = {
      name: name.trim(),
      frequency,
      ...(frequency === "custom" ? { intervalDays: Number(intervalDays) } : {}),
      rotation,
    };
    const onSuccess = () => navigate("/putzplan", { replace: true });
    if (editing && id) {
      update.mutate({ id, body: base }, { onSuccess });
    } else {
      create.mutate({ ...base, firstAssigneeId: firstAssignee }, { onSuccess });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "Aufgabe löschen?",
      body: "Diese Aufgabe wirklich löschen?",
      confirmLabel: "Löschen",
      confirmColor: "error",
    });
    if (!ok) return;
    remove.mutate(id, { onSuccess: () => navigate("/putzplan", { replace: true }) });
  };

  return (
    <Box sx={{ p: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h5">
          {editing ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
        </Typography>
      </Stack>

      <Stack spacing={2.5}>
        <TextField
          label="Name"
          placeholder="z. B. Bad putzen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          fullWidth
        />

        <Box>
          <SectionLabel>Häufigkeit</SectionLabel>
          <ToggleButtonGroup
            value={frequency}
            exclusive
            onChange={(_, v) => v && setFrequency(v)}
            fullWidth
            size="small"
          >
            {FREQS.map((f) => (
              <ToggleButton key={f.value} value={f.value}>{f.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {frequency === "custom" && (
          <TextField
            label="Intervall (Tage)"
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            sx={{ width: 180 }}
          />
        )}

        <Box>
          <SectionLabel>Reihenfolge</SectionLabel>
          <Card sx={{ px: 1 }}>
            {inRotation.map((id, i) => (
              <Stack key={id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
                <Checkbox checked onChange={() => toggle(id)} />
                <MemberAvatar memberId={id} size={30} />
                <Typography sx={{ flex: 1 }}>{nameById.get(id)}</Typography>
                <Typography variant="caption" color="text.secondary">{i + 1}.</Typography>
                <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUpwardRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={i === inRotation.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDownwardRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {notInRotation.map((id) => (
              <Stack key={id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, opacity: 0.6 }}>
                <Checkbox checked={false} onChange={() => toggle(id)} />
                <MemberAvatar memberId={id} size={30} />
                <Typography sx={{ flex: 1 }}>{nameById.get(id)}</Typography>
              </Stack>
            ))}
          </Card>
        </Box>

        {!editing && (
          <TextField
            select
            label="Erste:r dran"
            value={firstAssignee}
            onChange={(e) => setFirstAssignee(e.target.value)}
            fullWidth
          >
            {rotation.map((id) => (
              <MenuItem key={id} value={id}>{nameById.get(id)}</MenuItem>
            ))}
          </TextField>
        )}

        <Divider />
        <Button variant="contained" size="large" disabled={!valid} onClick={submit}>
          {busy ? "Wird gespeichert…" : editing ? "Änderungen speichern" : "Aufgabe erstellen"}
        </Button>
        {editing && (
          <Button color="error" disabled={busy} onClick={handleDelete}>
            Aufgabe löschen
          </Button>
        )}
      </Stack>
    </Box>
  );
}
