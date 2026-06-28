import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client.js";
import {
  useAddShoppingItem,
  useDeleteShoppingItem,
  useMarkBought,
  useShopping,
} from "../api/shopping.js";
import { EmptyState } from "../components/EmptyState.js";

type Toast = { msg: string; severity: "success" | "info" | "warning" };

export function Einkaufen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"active" | "history">("active");
  const active = useShopping(false);
  const history = useShopping(true);
  const add = useAddShoppingItem();
  const bought = useMarkBought();
  const remove = useDeleteShoppingItem();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);

  const activeNames = new Set(
    (active.data ?? []).map((i) => i.name.trim().toLowerCase()),
  );

  // History deduped by name (case-insensitive) — each article appears once,
  // most recent first (the query is createdAt desc).
  const histSeen = new Set<string>();
  const historyItems = (history.data ?? []).filter((i) => {
    const k = i.name.trim().toLowerCase();
    if (histSeen.has(k)) return false;
    histSeen.add(k);
    return true;
  });

  const items = tab === "active" ? active.data ?? [] : historyItems;

  // History names (deduped, case-insensitive) that aren't already on the list —
  // suggested while typing.
  const suggestions: string[] = [];
  const seen = new Set<string>();
  for (const i of history.data ?? []) {
    const n = i.name.trim();
    const k = n.toLowerCase();
    if (!n || seen.has(k) || activeNames.has(k)) continue;
    seen.add(k);
    suggestions.push(n);
  }

  const toggleSel = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Add an item with feedback. Guards duplicates client-side; the server is the
  // backstop (409 → same message). Used by the input and the history re-add.
  const addItem = (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    if (activeNames.has(n.toLowerCase())) {
      setToast({ msg: `„${n}" steht schon auf der Liste`, severity: "info" });
      return;
    }
    add.mutate(
      { name: n },
      {
        onSuccess: () => setToast({ msg: `„${n}" hinzugefügt`, severity: "success" }),
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

  const submitAdd = () => {
    addItem(name);
    setName("");
  };

  const selectedItems = (active.data ?? []).filter((i) => selected.has(i.id));

  const createExpense = () => {
    const ids = selectedItems.map((i) => i.id).join(",");
    const desc = selectedItems.map((i) => i.name).join(", ");
    navigate(`/geld/neu?items=${ids}&desc=${encodeURIComponent(desc)}`);
  };

  const markSelectedBought = () => {
    selectedItems.forEach((i) => bought.mutate(i.id));
    setSelected(new Set());
  };

  return (
    <Box sx={{ p: 2, pb: selected.size ? 12 : 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="active" label="Liste" />
        <Tab value="history" label="Verlauf" />
      </Tabs>

      {tab === "active" && (
        <Autocomplete
          freeSolo
          options={suggestions}
          inputValue={name}
          onInputChange={(_, v) => setName(v)}
          onChange={(_, v) => {
            // Picking a suggestion (or Enter on free text) adds immediately.
            if (typeof v === "string" && v.trim()) addItem(v);
          }}
          clearOnBlur={false}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Artikel hinzufügen…"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" disabled={!name.trim()} onClick={submitAdd}>
                      <AddRoundedIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          title={tab === "active" ? "Liste ist leer" : "Noch nichts gekauft"}
          hint={tab === "active" ? "Füge oben den ersten Artikel hinzu." : undefined}
        />
      ) : (
        <Card sx={{ px: 1 }}>
          {items.map((item, i) => (
            <Stack
              key={item.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ py: 0.5, borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider" }}
            >
              {tab === "active" ? (
                <>
                  <Checkbox
                    checked={selected.has(item.id)}
                    onChange={() => toggleSel(item.id)}
                  />
                  <Typography sx={{ flex: 1 }}>{item.name}</Typography>
                  <IconButton size="small" onClick={() => remove.mutate(item.id)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <>
                  <Typography sx={{ flex: 1, color: "text.secondary" }}>{item.name}</Typography>
                  <IconButton
                    size="small"
                    onClick={() => addItem(item.name)}
                    disabled={activeNames.has(item.name.trim().toLowerCase())}
                  >
                    <ReplayRoundedIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Stack>
          ))}
        </Card>
      )}

      {/* selection action bar — sits just above the bottom nav */}
      {selected.size > 0 && (
        <Box
          sx={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 56,
            zIndex: 1101,
            bgcolor: "background.paper",
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              maxWidth: 640,
              mx: "auto",
              px: 2,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Button variant="contained" fullWidth onClick={markSelectedBought}>
              Eingekauft ({selected.size})
            </Button>
            <Button variant="text" onClick={createExpense}>
              Ausgabe
            </Button>
          </Box>
        </Box>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
