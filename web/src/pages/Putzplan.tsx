import EditRoundedIcon from "@mui/icons-material/EditRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { formatDate } from "../lib/format.js";
import { useNavigate } from "react-router-dom";
import {
  useChores,
  useChoreDone,
  useChoreRemind,
  useChoreSkip,
  type ChoreWithTurn,
} from "../api/chores.js";
import { useMembersMap } from "../api/members.js";
import { AddFab } from "../components/Fab.js";
import { useConfirm } from "../components/ConfirmDialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { MemberAvatar } from "../components/MemberAvatar.js";

export function Putzplan() {
  const navigate = useNavigate();
  const chores = useChores();
  const members = useMembersMap();
  const done = useChoreDone();
  const skip = useChoreSkip();
  const remind = useChoreRemind();
  const confirm = useConfirm();

  const handleDone = async (c: ChoreWithTurn) => {
    const ok = await confirm({
      title: "Aufgabe erledigt?",
      body: `„${c.name}“ als erledigt markieren? Die Rotation rückt zur nächsten Person weiter.`,
      confirmLabel: "Erledigt",
    });
    if (ok) done.mutate(c.id);
  };

  const handleSkip = async (c: ChoreWithTurn) => {
    const ok = await confirm({
      title: "Runde überspringen?",
      body: `Diese Runde von „${c.name}“ überspringen? Die Rotation rückt zur nächsten Person weiter, ohne dass die Aufgabe erledigt wird.`,
      confirmLabel: "Überspringen",
    });
    if (ok) skip.mutate(c.id);
  };

  return (
    <Box sx={{ p: 2 }}>
      {chores.data && chores.data.length > 0 ? (
        <Stack spacing={1.5}>
          {chores.data.map((c) => {
            const turn = c.currentTurn;
            const overdue = turn && dayjs(turn.dueAt).isBefore(dayjs());
            return (
              <Card key={c.id} sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h6" sx={{ flex: 1 }}>{c.name}</Typography>
                  {overdue && <Chip label="Überfällig" color="error" size="small" />}
                  <IconButton
                    size="small"
                    aria-label="Erinnern"
                    disabled={!turn}
                    onClick={() => remind.mutate(c.id)}
                  >
                    <NotificationsActiveRoundedIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Bearbeiten"
                    onClick={() => navigate(`/putzplan/${c.id}/bearbeiten`)}
                  >
                    <EditRoundedIcon />
                  </IconButton>
                </Stack>

                {turn ? (
                  <Box sx={{ mt: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <MemberAvatar memberId={turn.assigneeId} size={32} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>
                          {members.get(turn.assigneeId)?.displayName ?? "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Fällig {formatDate(turn.dueAt)}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
                      <Button size="small" onClick={() => handleSkip(c)}>
                        Überspringen
                      </Button>
                      <Button variant="contained" size="small" onClick={() => handleDone(c)}>
                        Erledigt
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Keine offene Runde.
                  </Typography>
                )}
              </Card>
            );
          })}
        </Stack>
      ) : (
        <EmptyState
          title="Noch kein Putzplan"
          hint="Erstelle eine wiederkehrende Aufgabe mit Rotation."
        />
      )}

      <AddFab label="Aufgabe hinzufügen" onClick={() => navigate("/putzplan/neu")} />
    </Box>
  );
}
