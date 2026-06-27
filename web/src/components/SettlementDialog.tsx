import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import { useCreateSettlement } from "../api/settlements.js";
import { useMembers } from "../api/members.js";
import { formatCents, parseEurToCents } from "../lib/format.js";

interface Props {
  open: boolean;
  onClose: () => void;
  prefill?: { fromMemberId: string; toMemberId: string; amount: number };
}

/** Record a real-world payment (ledger only). Used by suggested transfers + manual. */
export function SettlementDialog({ open, onClose, prefill }: Props) {
  const { data: members } = useMembers(true);
  const create = useCreateSettlement();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amountStr, setAmountStr] = useState("");

  useEffect(() => {
    if (open) {
      setFrom(prefill?.fromMemberId ?? "");
      setTo(prefill?.toMemberId ?? "");
      setAmountStr(prefill ? (prefill.amount / 100).toFixed(2).replace(".", ",") : "");
    }
  }, [open, prefill]);

  const amount = parseEurToCents(amountStr) ?? 0;
  const valid = from && to && from !== to && amount > 0 && !create.isPending;

  const submit = () => {
    create.mutate(
      { fromMemberId: from, toMemberId: to, amount },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Zahlung erfassen</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Von" value={from} onChange={(e) => setFrom(e.target.value)} fullWidth>
            {(members ?? []).map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>
            ))}
          </TextField>
          <TextField select label="An" value={to} onChange={(e) => setTo(e.target.value)} fullWidth>
            {(members ?? []).map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Betrag"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
            InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" disabled={!valid} onClick={submit}>
          {amount > 0 ? `${formatCents(amount)} erfassen` : "Erfassen"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
