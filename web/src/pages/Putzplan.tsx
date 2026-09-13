import EditRoundedIcon from "@mui/icons-material/EditRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
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
  const [menu, setMenu] = useState<{ el: HTMLElement; chore: ChoreWithTurn } | null>(null);

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
            // dueAt is Sunday 23:59:59.999, so opensAt lands 1ms before Monday —
            // display the Monday date itself, not the Sunday-night instant.
            const opensAtDisplay = turn ? dayjs(turn.dueAt).subtract(6, "day") : null;
            const dueText = overdue
              ? `${overdue} Tag${overdue === 1 ? "" : "e"} überfällig`
              : turn
                ? `Fällig ${formatDate(turn.dueAt)}`
                : null;
            const captionParts = [
              doerId ? members.get(doerId)?.displayName ?? "—" : null,
              doerId && awayMemberIds.has(doerId) ? "abwesend" : null,
              covering ? `vertritt ${members.get(turn!.assigneeId)?.displayName ?? "—"}` : null,
              dueText,
            ].filter(Boolean);
            return (
              <Card
                key={c.id}
                sx={{
                  p: 1.75,
                  borderLeft: overdue ? "3px solid" : "3px solid transparent",
                  borderLeftColor: overdue ? "error.main" : "transparent",
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  {turn && doerId ? (
                    <ButtonBase
                      onClick={() => setSwapTarget(c)}
                      sx={{ borderRadius: "50%", mt: 0.25 }}
                      aria-label="Vertretung ändern"
                    >
                      <MemberAvatar memberId={doerId} size={40} />
                    </ButtonBase>
                  ) : null}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                        {c.name}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label="Weitere Aktionen"
                        onClick={(e) => setMenu({ el: e.currentTarget, chore: c })}
                        sx={{ color: "text.disabled", mt: -0.75, mr: -0.75 }}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                      sx={{ mt: 0.25 }}
                    >
                      <Typography
                        noWrap
                        variant="caption"
                        sx={{
                          minWidth: 0,
                          color: overdue ? "error.main" : "text.secondary",
                          fontWeight: overdue ? 700 : 400,
                        }}
                      >
                        {captionParts.length > 0 ? captionParts.join(" · ") : "Keine offene Runde"}
                      </Typography>
                      {turn && doerId ? (
                        notYet && opensAtDisplay ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ flexShrink: 0 }}
                          >
                            ab {formatDate(opensAtDisplay.toISOString())}
                          </Typography>
                        ) : (
                          <Button
                            variant="contained"
                            size="small"
                            sx={{ flexShrink: 0 }}
                            onClick={() => handleDone(c)}
                          >
                            Erledigt
                          </Button>
                        )
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>
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

      <Menu
        anchorEl={menu?.el}
        open={!!menu}
        onClose={() => setMenu(null)}
      >
        <MenuItem
          disabled={!menu?.chore.currentTurn}
          onClick={() => {
            if (menu) remind.mutate(menu.chore.id);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <NotificationsActiveRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Erinnern</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) navigate(`/putzplan/${menu.chore.id}/bearbeiten`);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bearbeiten</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
