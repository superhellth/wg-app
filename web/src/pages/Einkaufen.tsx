import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAddShoppingItem,
  useDeleteShoppingItem,
  useMarkBought,
  useShopping,
} from "../api/shopping.js";
import { EmptyState } from "../components/EmptyState.js";

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

  const items = tab === "active" ? active.data ?? [] : history.data ?? [];

  const toggleSel = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const submitAdd = () => {
    const n = name.trim();
    if (!n) return;
    add.mutate({ name: n });
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
        <Stack
          component="form"
          direction="row"
          spacing={1}
          sx={{ mb: 2 }}
          onSubmit={(e) => {
            e.preventDefault();
            submitAdd();
          }}
        >
          <TextField
            placeholder="Artikel hinzufügen…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton type="submit" size="small" disabled={!name.trim()}>
                    <AddRoundedIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Stack>
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
                  <IconButton size="small" onClick={() => add.mutate({ name: item.name })}>
                    <ReplayRoundedIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Stack>
          ))}
        </Card>
      )}

      {/* selection action bar */}
      {selected.size > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 76,
            p: 1.5,
            borderRadius: 4,
            display: "flex",
            gap: 1,
            zIndex: 1200,
          }}
        >
          <Button variant="outlined" fullWidth onClick={markSelectedBought}>
            Eingekauft ({selected.size})
          </Button>
          <Button variant="contained" fullWidth onClick={createExpense}>
            Ausgabe erstellen
          </Button>
        </Paper>
      )}
    </Box>
  );
}
