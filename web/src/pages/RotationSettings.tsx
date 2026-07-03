import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMembersMap } from "../api/members.js";
import { useUpdateWgConfig, useWgConfig } from "../api/wg.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SectionLabel } from "../components/SectionLabel.js";

const GRACE_OPTIONS = [
  { value: 0, label: "Sonntag (keine Karenz)" },
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
];

export function RotationSettings() {
  const navigate = useNavigate();
  const config = useWgConfig();
  const members = useMembersMap();
  const update = useUpdateWgConfig();

  const [rotation, setRotation] = useState<string[]>([]);
  const [graceDays, setGraceDays] = useState(2);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !config.data) return;
    setRotation(config.data.rotation);
    setGraceDays(config.data.graceDays);
    seeded.current = true;
  }, [config.data]);

  const move = (i: number, dir: -1 | 1) => {
    setRotation((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const save = () => {
    update.mutate(
      { rotation, graceDays },
      { onSuccess: () => navigate("/putzplan", { replace: true }) },
    );
  };

  return (
    <Box sx={{ p: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h5">Reihenfolge & Karenz</Typography>
      </Stack>

      <Stack spacing={2.5}>
        <Box>
          <SectionLabel>Reihenfolge</SectionLabel>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Alle Aufgaben werden in dieser Reihenfolge reihum weitergegeben.
          </Typography>
          <Card sx={{ px: 1 }}>
            {rotation.map((mid, i) => (
              <Stack key={mid} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
                <MemberAvatar memberId={mid} size={30} />
                <Typography sx={{ flex: 1 }}>{members.get(mid)?.displayName ?? "—"}</Typography>
                <Typography variant="caption" color="text.secondary">{i + 1}.</Typography>
                <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUpwardRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={i === rotation.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDownwardRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {rotation.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1.5, px: 1 }}>
                Noch keine Mitglieder.
              </Typography>
            )}
          </Card>
        </Box>

        <Box>
          <SectionLabel>Karenz bis</SectionLabel>
          <TextField
            select
            value={graceDays}
            onChange={(e) => setGraceDays(Number(e.target.value))}
            fullWidth
            helperText="Wer bis dahin erledigt, gibt normal weiter. Danach wird die nächste Person übersprungen."
          >
            {GRACE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        <Divider />
        <Button
          variant="contained"
          size="large"
          disabled={update.isPending || !config.data}
          onClick={save}
        >
          {update.isPending ? "Wird gespeichert…" : "Speichern"}
        </Button>
      </Stack>
    </Box>
  );
}
