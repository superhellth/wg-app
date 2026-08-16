import EditRoundedIcon from "@mui/icons-material/EditRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { formatDate } from "../lib/format.js";
import { useNavigate } from "react-router-dom";
import {
  useChores,
  useChoreDone,
  useChoreRemind,
  type ChoreWithTurn,
} from "../api/chores.js";
import { useAbsences } from "../api/absences.js";
import { useMembersMap } from "../api/members.js";
import { AddFab } from "../components/Fab.js";
import { useConfirm } from "../components/ConfirmDialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SwapTurnDialog } from "../components/SwapTurnDialog.js";

/** Whole calendar days since dueAt, floored to at least 1. */
function overdueDays(dueAt: string): number {
  const days = dayjs().startOf("day").diff(dayjs(dueAt).startOf("day"), "day");
  return Math.max(1, days);
}

export function Putzplan() {
  const navigate = useNavigate();
  const chores = useChores();
  const members = useMembersMap();
  const absences = useAbsences();
  const done = useChoreDone();
  const remind = useChoreRemind();
  const confirm = useConfirm();
  const [swapTarget, setSwapTarget] = useState<ChoreWithTurn | null>(null);

  const awayMemberIds = useMemo(() => {
    const now = dayjs();
    const ids = new Set<string>();
    for (const a of absences.data ?? []) {
      if (!dayjs(a.from).isAfter(now) && !dayjs(a.until).isBefore(now)) {
        ids.add(a.memberId);
      }
    }
    return ids;
  }, [absences.data]);

  const handleDone = async (c: ChoreWithTurn) => {
    const ok = await confirm({
      title: "Aufgabe erledigt?",
      body: `„${c.name}“ als erledigt markieren? Die Rotation rückt zur nächsten Person weiter.`,
      confirmLabel: "Erledigt",
    });
    if (ok) done.mutate(c.id);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <Button
          size="small"
          startIcon={<TuneRoundedIcon fontSize="small" />}
          onClick={() => navigate("/putzplan/reihenfolge")}
          sx={{ color: "text.secondary" }}
        >
          Reihenfolge
        </Button>
      </Stack>
      {chores.data && chores.data.length > 0 ? (
        <Stack spacing={1.5}>
          {chores.data.map((c) => {
            const turn = c.currentTurn;
            const overdue = turn && dayjs(turn.dueAt).isBefore(dayjs()) ? overdueDays(turn.dueAt) : 0;
            const doerId = turn ? turn.executorId ?? turn.assigneeId : null;
            const covering = turn && turn.executorId && turn.executorId !== turn.assigneeId;
            // Can't tick done before the turn's own week starts (dueAt − 1 week).
            const opensAt = turn ? dayjs(turn.dueAt).subtract(1, "week") : null;
            const notYet = opensAt ? dayjs().isBefore(opensAt) : false;
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

                {turn && doerId ? (
                  <>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.5 }}>
                      <ButtonBase
                        onClick={() => setSwapTarget(c)}
                        sx={{ borderRadius: "50%" }}
                        aria-label="Vertretung ändern"
                      >
                        <MemberAvatar memberId={doerId} size={44} />
                      </ButtonBase>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <ButtonBase
                            onClick={() => setSwapTarget(c)}
                            sx={{ borderRadius: 1 }}
                          >
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              {members.get(doerId)?.displayName ?? "—"}
                            </Typography>
                          </ButtonBase>
                          {awayMemberIds.has(doerId) && (
                            <Chip label="Abwesend" size="small" color="warning" sx={{ height: 20 }} />
                          )}
                        </Stack>
                        {covering && (
                          <Typography variant="caption" color="text.secondary">
                            vertritt {members.get(turn.assigneeId)?.displayName ?? "—"}
                          </Typography>
                        )}
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
                            {overdue
                              ? `${overdue} Tag${overdue === 1 ? "" : "e"} überfällig`
                              : `Fällig ${formatDate(turn.dueAt)}`}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="flex-end"
                      sx={{ mt: 1.5 }}
                    >
                      {notYet && opensAt && (
                        <Typography variant="caption" color="text.secondary">
                          Erledigen ab {formatDate(opensAt.toISOString())}
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        disabled={notYet}
                        onClick={() => handleDone(c)}
                      >
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
          hint="Erstelle eine wiederkehrende Aufgabe."
        />
      )}

      <AddFab label="Aufgabe hinzufügen" onClick={() => navigate("/putzplan/neu")} />

      {swapTarget && swapTarget.currentTurn && (
        <SwapTurnDialog
          open
          onClose={() => setSwapTarget(null)}
          choreId={swapTarget.id}
          choreName={swapTarget.name}
          currentExecutorId={
            swapTarget.currentTurn.executorId ?? swapTarget.currentTurn.assigneeId
          }
        />
      )}
    </Box>
  );
}
