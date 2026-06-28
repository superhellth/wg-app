import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useChores,
  useChoreDone,
  useChoreRemind,
  useChoreSkip,
  useChoreSwap,
  type ChoreWithTurn,
} from "../api/chores.js";
import { useMembers, useMembersMap } from "../api/members.js";
import { AddFab } from "../components/Fab.js";
import { EmptyState } from "../components/EmptyState.js";
import { MemberAvatar } from "../components/MemberAvatar.js";

export function Putzplan() {
  const navigate = useNavigate();
  const chores = useChores();
  const members = useMembersMap();
  const activeMembers = useMembers();
  const done = useChoreDone();
  const skip = useChoreSkip();
  const remind = useChoreRemind();

  const [menu, setMenu] = useState<{ el: HTMLElement; chore: ChoreWithTurn } | null>(null);
  const [swapFor, setSwapFor] = useState<ChoreWithTurn | null>(null);

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
                  <IconButton size="small" onClick={(e) => setMenu({ el: e.currentTarget, chore: c })}>
                    <MoreVertRoundedIcon />
                  </IconButton>
                </Stack>

                {turn ? (
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1.5 }}>
                    <MemberAvatar memberId={turn.assigneeId} size={32} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {members.get(turn.assigneeId)?.displayName ?? "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Fällig {dayjs(turn.dueAt).format("dd, DD.MM.")}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => skip.mutate(c.id)}>
                        Überspringen
                      </Button>
                      <Button variant="contained" size="small" onClick={() => done.mutate(c.id)}>
                        Erledigt
                      </Button>
                    </Stack>
                  </Stack>
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

      {/* per-chore action menu */}
      <Menu anchorEl={menu?.el} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) navigate(`/putzplan/${menu.chore.id}/bearbeiten`);
            setMenu(null);
          }}
        >
          Bearbeiten
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) setSwapFor(menu.chore);
            setMenu(null);
          }}
        >
          Tauschen
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) remind.mutate(menu.chore.id);
            setMenu(null);
          }}
        >
          Erinnern
        </MenuItem>
      </Menu>

      <SwapDialog
        chore={swapFor}
        onClose={() => setSwapFor(null)}
        memberOptions={(activeMembers.data ?? []).map((m) => m.id)}
      />

      <AddFab label="Aufgabe hinzufügen" onClick={() => navigate("/putzplan/neu")} />
    </Box>
  );
}

function SwapDialog({
  chore,
  onClose,
  memberOptions,
}: {
  chore: ChoreWithTurn | null;
  onClose: () => void;
  memberOptions: string[];
}) {
  const swap = useChoreSwap();
  const members = useMembersMap();
  if (!chore) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Runde tauschen</DialogTitle>
      <List>
        {memberOptions
          .filter((id) => id !== chore.currentTurn?.assigneeId)
          .map((id) => (
            <ListItemButton
              key={id}
              onClick={() =>
                swap.mutate({ id: chore.id, body: { assigneeId: id } }, { onSuccess: onClose })
              }
            >
              <ListItemAvatar>
                <MemberAvatar memberId={id} />
              </ListItemAvatar>
              <ListItemText primary={members.get(id)?.displayName} />
            </ListItemButton>
          ))}
      </List>
    </Dialog>
  );
}
