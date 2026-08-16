import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import { useChoreSwap } from "../api/chores.js";
import { useMembers } from "../api/members.js";

interface Props {
  open: boolean;
  onClose: () => void;
  choreId: string;
  choreName: string;
  currentExecutorId: string;
}

/** Pick who actually does the current turn (rotation position unchanged). */
export function SwapTurnDialog({ open, onClose, choreId, choreName, currentExecutorId }: Props) {
  const { data: members } = useMembers(false);
  const swap = useChoreSwap();
  const [executorId, setExecutorId] = useState("");

  useEffect(() => {
    if (open) setExecutorId(currentExecutorId);
  }, [open, currentExecutorId]);

  const valid = executorId && executorId !== currentExecutorId && !swap.isPending;

  const submit = () => {
    swap.mutate(
      { id: choreId, body: { executorId } },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Vertretung für „{choreName}“</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Wer übernimmt?"
          value={executorId}
          onChange={(e) => setExecutorId(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
        >
          {(members ?? []).map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.displayName}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" disabled={!valid} onClick={submit}>
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
