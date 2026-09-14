import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useChores,
  useCreateChore,
  useDeleteChore,
  useUpdateChore,
} from "../api/chores.js";
import { useAbsences } from "../api/absences.js";
import { useMembersMap } from "../api/members.js";
import { useWgConfig } from "../api/wg.js";
import { useConfirm } from "../components/ConfirmDialog.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { SwapTurnDialog } from "../components/SwapTurnDialog.js";
import { formatDate } from "../lib/format.js";

export function ChoreForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const members = useMembersMap();
  const config = useWgConfig();
  const create = useCreateChore();
  const update = useUpdateChore();
  const remove = useDeleteChore();
  const confirm = useConfirm();
  const chores = useChores();
  const absences = useAbsences();
  const existing = editing ? chores.data?.find((c) => c.id === id) : undefined;

  const [name, setName] = useState("");
  const [firstAssignee, setFirstAssignee] = useState("");
  const [swapOpen, setSwapOpen] = useState(false);

  const turn = existing?.currentTurn ?? null;
  const doerId = turn ? turn.executorId ?? turn.assigneeId : null;
  const covering = Boolean(turn && turn.executorId && turn.executorId !== turn.assigneeId);
  const doerAway = useMemo(() => {
    if (!doerId) return false;
    const now = dayjs();
    return (absences.data ?? []).some(
      (a) => a.memberId === doerId && !dayjs(a.from).isAfter(now) && !dayjs(a.until).isBefore(now),
    );
  }, [absences.data, doerId]);

  const rotation = useMemo(() => config.data?.rotation ?? [], [config.data]);

  // Seed once: from the existing chore when editing, else first in rotation.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (editing) {
      if (!existing) return;
      setName(existing.name);
      seeded.current = true;
    } else if (rotation.length > 0) {
      setFirstAssignee(rotation[0] ?? "");
      seeded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, existing, rotation]);

  const busy = create.isPending || update.isPending || remove.isPending;
  const valid =
    name.trim() &&
    (editing || (firstAssignee && rotation.includes(firstAssignee))) &&
    !busy;

  const submit = () => {
    const onSuccess = () => navigate("/putzplan", { replace: true });
    if (editing && id) {
      update.mutate({ id, body: { name: name.trim() } }, { onSuccess });
    } else {
      create.mutate({ name: name.trim(), firstAssigneeId: firstAssignee }, { onSuccess });
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
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
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

        {editing && turn && doerId && (
          <Box>
            <SectionLabel>Aktuelle Runde</SectionLabel>
            <Card sx={{ p: 1.75 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <MemberAvatar memberId={doerId} size={40} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>
                    {members.get(doerId)?.displayName ?? "—"}
                  </Typography>
                  <Typography noWrap variant="caption" color="text.secondary">
                    {[
                      doerAway ? "abwesend" : null,
                      covering ? `vertritt ${members.get(turn.assigneeId)?.displayName ?? "—"}` : null,
                      `fällig ${formatDate(turn.dueAt)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                <Button size="small" onClick={() => setSwapOpen(true)}>
                  Vertretung
                </Button>
              </Stack>
            </Card>
          </Box>
        )}

        {!editing && (
          <Box>
            <SectionLabel>Erste:r dran</SectionLabel>
            <TextField
              select
              value={firstAssignee}
              onChange={(e) => setFirstAssignee(e.target.value)}
              fullWidth
              helperText="Die Aufgabe wird danach reihum weitergegeben (Reihenfolge im Putzplan)."
            >
              {rotation.map((mid) => (
                <MenuItem key={mid} value={mid}>
                  {members.get(mid)?.displayName ?? "—"}
                </MenuItem>
              ))}
            </TextField>
          </Box>
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

      {editing && id && turn && doerId && (
        <SwapTurnDialog
          open={swapOpen}
          onClose={() => setSwapOpen(false)}
          choreId={id}
          choreName={name}
          currentExecutorId={doerId}
        />
      )}
    </Box>
  );
}
