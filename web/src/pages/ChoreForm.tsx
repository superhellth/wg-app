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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateChore } from "../api/chores.js";
import { useMembers } from "../api/members.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SectionLabel } from "../components/SectionLabel.js";

const FREQS: { value: ChoreFrequency; label: string }[] = [
  { value: "weekly", label: "Wöchentlich" },
  { value: "biweekly", label: "Zweiwöchentlich" },
  { value: "custom", label: "Eigene" },
];

export function ChoreForm() {
  const navigate = useNavigate();
  const { data: members } = useMembers();
  const create = useCreateChore();

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<ChoreFrequency>("weekly");
  const [intervalDays, setIntervalDays] = useState("10");
  const [rotation, setRotation] = useState<string[]>([]);
  const [firstAssignee, setFirstAssignee] = useState("");

  // seed rotation with all active members in roster order
  useEffect(() => {
    if (members && rotation.length === 0) {
      const ids = members.map((m) => m.id);
      setRotation(ids);
      setFirstAssignee(ids[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

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

  const valid =
    name.trim() &&
    rotation.length > 0 &&
    firstAssignee &&
    rotation.includes(firstAssignee) &&
    (frequency !== "custom" || Number(intervalDays) > 0) &&
    !create.isPending;

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        frequency,
        ...(frequency === "custom" ? { intervalDays: Number(intervalDays) } : {}),
        rotation,
        firstAssigneeId: firstAssignee,
      },
      { onSuccess: () => navigate("/putzplan", { replace: true }) },
    );
  };

  return (
    <Box sx={{ p: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h5">Neue Aufgabe</Typography>
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

        <Divider />
        <Button variant="contained" size="large" disabled={!valid} onClick={submit}>
          {create.isPending ? "Wird erstellt…" : "Aufgabe erstellen"}
        </Button>
      </Stack>
    </Box>
  );
}
