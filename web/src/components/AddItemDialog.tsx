import AddRoundedIcon from "@mui/icons-material/AddRounded";
import type { ShoppingScope } from "@wg/shared";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { ApiError } from "../api/client.js";
import { useAddShoppingItem, useShopping } from "../api/shopping.js";

type Toast = { msg: string; severity: "success" | "info" | "warning" };

/** FAB dialog: free-text add + history suggestion cards. Stays open until "Fertig". */
export function AddItemDialog({
  open,
  scope,
  onClose,
}: {
  open: boolean;
  scope: ShoppingScope;
  onClose: () => void;
}) {
  const active = useShopping(scope, false);
  const history = useShopping(scope, true);
  const add = useAddShoppingItem();
  const [text, setText] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const activeNames = new Set(
    (active.data ?? []).map((i) => i.name.trim().toLowerCase()),
  );

  // Bought names of this scope, deduped case-insensitively (query is createdAt
  // desc → most recent first), minus names already active, filtered by input.
  const needle = text.trim().toLowerCase();
  const suggestions: string[] = [];
  const seen = new Set<string>();
  for (const i of history.data ?? []) {
    const n = i.name.trim();
    const k = n.toLowerCase();
    if (!n || seen.has(k) || activeNames.has(k)) continue;
    seen.add(k);
    if (needle && !k.includes(needle)) continue;
    suggestions.push(n);
  }

  const addItem = (raw: string, fromInput: boolean) => {
    const n = raw.trim();
    if (!n) return;
    if (activeNames.has(n.toLowerCase())) {
      setToast({ msg: `„${n}" steht schon auf der Liste`, severity: "info" });
      return;
    }
    add.mutate(
      { name: n, personal: scope === "personal" },
      {
        onSuccess: () => {
          setToast({ msg: `„${n}" hinzugefügt`, severity: "success" });
          if (fromInput) setText("");
        },
        onError: (e) =>
          setToast({
            msg:
              e instanceof ApiError && e.code === "conflict"
                ? `„${n}" steht schon auf der Liste`
                : "Konnte nicht hinzugefügt werden",
            severity: "warning",
          }),
      },
    );
  };

  const close = () => {
    setText("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>
        Artikel hinzufügen
        <Typography variant="caption" color="text.secondary" display="block">
          zu: {scope === "wg" ? "WG" : "Privat"}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Artikel…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem(text, true);
            }
          }}
          sx={{ mt: 1, mb: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Hinzufügen"
                  disabled={!text.trim()}
                  onClick={() => addItem(text, true)}
                >
                  <AddRoundedIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {suggestions.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Vorschläge
            </Typography>
            {suggestions.map((n) => (
              <Card key={n.toLowerCase()} sx={{ py: 0 }}>
                <CardActionArea onClick={() => addItem(n, false)} sx={{ py: 1, px: 1.5 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>
                    {n}
                  </Typography>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Fertig</Button>
      </DialogActions>
      <Snackbar
        open={!!toast}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Dialog>
  );
}
