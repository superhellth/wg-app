import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { ShoppingScope } from "@wg/shared";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteShoppingItem, useMarkBought, useShopping } from "../api/shopping.js";
import { AddItemDialog } from "../components/AddItemDialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { AddFab } from "../components/Fab.js";
import { fromNow } from "../lib/format.js";

export function Einkaufen() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<ShoppingScope>("wg");
  const list = useShopping(scope);
  const bought = useMarkBought();
  const remove = useDeleteShoppingItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = list.data ?? [];

  const toggleSel = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectedItems = items.filter((i) => selected.has(i.id));

  const [expenseLink, setExpenseLink] = useState<string | null>(null);

  const markSelectedBought = () => {
    if (scope === "wg") {
      const ids = selectedItems.map((i) => i.id).join(",");
      const desc = selectedItems.map((i) => i.name).join(", ");
      setExpenseLink(`/geld/neu?items=${ids}&desc=${encodeURIComponent(desc)}`);
    }
    selectedItems.forEach((i) => bought.mutate(i.id));
    setSelected(new Set());
  };

  return (
    <Box sx={{ p: 2, pb: selected.size ? 12 : 2 }}>
      <Tabs
        value={scope}
        onChange={(_, v) => {
          setScope(v);
          setSelected(new Set()); // a personal id must never reach "Ausgabe"
          setExpenseLink(null);
        }}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab value="wg" label="WG" />
        <Tab value="personal" label="Privat" />
      </Tabs>

      {items.length === 0 ? (
        <EmptyState
          title="Liste ist leer"
          hint="Tippe auf + und füge den ersten Artikel hinzu."
        />
      ) : (
        <Stack spacing={1}>
          {items.map((item) => {
            const isSel = selected.has(item.id);
            return (
              <Card
                key={item.id}
                sx={{
                  py: 0.75,
                  pl: 0.75,
                  pr: 1.5,
                  borderColor: isSel ? "primary.main" : undefined,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Checkbox checked={isSel} onChange={() => toggleSel(item.id)} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fromNow(item.createdAt)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label="Löschen"
                    onClick={() => remove.mutate(item.id)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}

      <AddFab
        label="Artikel hinzufügen"
        bottom={selected.size ? 140 : 80}
        onClick={() => setDialogOpen(true)}
      />
      <AddItemDialog
        open={dialogOpen}
        scope={scope}
        onClose={() => setDialogOpen(false)}
      />

      <Snackbar
        open={expenseLink !== null}
        autoHideDuration={8000}
        onClose={(_, reason) => reason !== "clickaway" && setExpenseLink(null)}
        message="Als eingekauft markiert"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 72 } }}
        action={
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              const link = expenseLink;
              setExpenseLink(null);
              if (link) navigate(link);
            }}
          >
            Ausgabe erfassen
          </Button>
        }
      />

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
          </Box>
        </Box>
      )}
    </Box>
  );
}
