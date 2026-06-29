import EditRoundedIcon from "@mui/icons-material/EditRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
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
              <Card
                key={c.id}
                sx={{
                  p: 2,
                  borderLeft: overdue ? "3px solid" : "3px solid transparent",
                  borderLeftColor: overdue ? "error.main" : "transparent",
                }}
              >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {c.name}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: -0.5, mr: -0.5 }}>
                    <IconButton
                      size="small"
                      aria-label="Erinnern"
                      disabled={!turn}
                      onClick={() => remind.mutate(c.id)}
                      sx={{ color: "text.disabled" }}
                    >
                      <NotificationsActiveRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Bearbeiten"
                      onClick={() => navigate(`/putzplan/${c.id}/bearbeiten`)}
                      sx={{ color: "text.disabled" }}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>

                {turn ? (
                  <>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.5 }}>
                      <MemberAvatar memberId={turn.assigneeId} size={44} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {members.get(turn.assigneeId)?.displayName ?? "—"}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                          <ScheduleRoundedIcon
                            sx={{ fontSize: 15, color: overdue ? "error.main" : "text.secondary" }}
                          />
                          <Typography
                            variant="body2"
                            sx={{
                              color: overdue ? "error.main" : "text.secondary",
                              fontWeight: overdue ? 700 : 400,
                            }}
                          >
                            {overdue ? "Überfällig · " : "Fällig "}
                            {formatDate(turn.dueAt)}
                          </Typography>
                        </Stack>
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
                  </>
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
