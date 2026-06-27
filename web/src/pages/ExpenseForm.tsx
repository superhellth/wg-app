import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { resolveShares, type SplitType } from "@wg/shared";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIdentity } from "../api/identity.js";
import { useCreateExpense } from "../api/expenses.js";
import { useMembers } from "../api/members.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { MoneyText } from "../components/MoneyText.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { parseEurToCents } from "../lib/format.js";

const CATEGORIES = ["Lebensmittel", "Haushalt", "Miete", "Freizeit", "Sonstiges"];
const SPLITS: { value: SplitType; label: string }[] = [
  { value: "equal", label: "Gleich" },
  { value: "exact", label: "Betrag" },
  { value: "shares", label: "Anteile" },
  { value: "percent", label: "Prozent" },
];

export function ExpenseForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { memberId } = useIdentity();
  const { data: members } = useMembers();
  const create = useCreateExpense();

  const shoppingItemIds = useMemo(() => {
    const raw = params.get("items");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params]);

  const [description, setDescription] = useState(params.get("desc") ?? "");
  const [amountStr, setAmountStr] = useState("");
  const [payerId, setPayerId] = useState<string>(memberId ?? "");
  const [category, setCategory] = useState<string>("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});

  // default payer + all-active participants once members load
  const active = members ?? [];
  useMemo(() => {
    if (active.length && selected.size === 0) {
      setSelected(new Set(active.map((m) => m.id)));
      if (!payerId && memberId) setPayerId(memberId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  const amount = parseEurToCents(amountStr) ?? 0;
  const participants = active.filter((m) => selected.has(m.id));

  const shares = participants.map((m) => {
    const v = values[m.id] ?? "";
    let value = 0;
    if (splitType === "exact") value = parseEurToCents(v) ?? 0;
    else if (splitType === "shares") value = Math.max(0, parseInt(v || "1", 10) || 0);
    else if (splitType === "percent") value = parseFloat(v || "0") || 0;
    return { memberId: m.id, value };
  });

  const preview =
    amount > 0 && participants.length > 0
      ? safeResolve(amount, splitType, shares)
      : [];

  const splitError = validateSplit(splitType, amount, shares);
  const canSubmit =
    description.trim().length > 0 &&
    amount > 0 &&
    payerId &&
    participants.length > 0 &&
    !splitError &&
    !create.isPending;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = () => {
    create.mutate(
      {
        payerId,
        amount,
        description: description.trim(),
        category: category || undefined,
        splitType,
        shares,
        ...(shoppingItemIds.length ? { shoppingItemIds } : {}),
      },
      { onSuccess: () => navigate("/geld", { replace: true }) },
    );
  };

  return (
    <Box sx={{ p: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h5">Neue Ausgabe</Typography>
      </Stack>

      <Stack spacing={2.5}>
        {shoppingItemIds.length > 0 && (
          <Alert severity="info">
            {shoppingItemIds.length} Artikel werden als gekauft markiert.
          </Alert>
        )}

        <TextField
          label="Beschreibung"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          autoFocus
        />
        <TextField
          label="Betrag"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
          fullWidth
        />
        <TextField
          select
          label="Wer hat bezahlt?"
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          fullWidth
        >
          {active.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.displayName}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <SectionLabel>Kategorie (optional)</SectionLabel>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c}
                variant={category === c ? "filled" : "outlined"}
                color={category === c ? "primary" : "default"}
                onClick={() => setCategory(category === c ? "" : c)}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <SectionLabel>Teilnehmer</SectionLabel>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {active.map((m) => (
              <Chip
                key={m.id}
                avatar={<MemberAvatar memberId={m.id} size={24} />}
                label={m.displayName}
                variant={selected.has(m.id) ? "filled" : "outlined"}
                onClick={() => toggle(m.id)}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <SectionLabel>Aufteilung</SectionLabel>
          <ToggleButtonGroup
            value={splitType}
            exclusive
            onChange={(_, v) => v && setSplitType(v)}
            fullWidth
            size="small"
          >
            {SPLITS.map((s) => (
              <ToggleButton key={s.value} value={s.value}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {splitType !== "equal" && (
          <Stack spacing={1.5}>
            {participants.map((m) => (
              <Stack key={m.id} direction="row" alignItems="center" spacing={1.5}>
                <MemberAvatar memberId={m.id} size={32} />
                <Typography sx={{ flex: 1 }}>{m.displayName}</Typography>
                <TextField
                  size="small"
                  value={values[m.id] ?? ""}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, [m.id]: e.target.value }))
                  }
                  inputMode={splitType === "shares" ? "numeric" : "decimal"}
                  placeholder={splitType === "shares" ? "1" : "0"}
                  sx={{ width: 110 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {splitType === "exact" ? "€" : splitType === "percent" ? "%" : "×"}
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            ))}
          </Stack>
        )}

        {/* Live preview from the shared resolveShares math */}
        {preview.length > 0 && (
          <Box sx={{ bgcolor: "background.default", borderRadius: 3, p: 2 }}>
            <SectionLabel>Vorschau</SectionLabel>
            <Stack spacing={0.75}>
              {preview.map((r) => {
                const m = active.find((x) => x.id === r.memberId);
                return (
                  <Stack key={r.memberId} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{m?.displayName}</Typography>
                    <MoneyText cents={r.amount} size="0.875rem" />
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}

        {splitError && <Alert severity="warning">{splitError}</Alert>}
        {create.isError && <Alert severity="error">Konnte nicht gespeichert werden.</Alert>}

        <Divider />
        <Button variant="contained" size="large" disabled={!canSubmit} onClick={submit}>
          {create.isPending ? "Wird gespeichert…" : "Ausgabe speichern"}
        </Button>
      </Stack>
    </Box>
  );
}

function safeResolve(
  amount: number,
  type: SplitType,
  shares: { memberId: string; value: number }[],
) {
  try {
    return resolveShares(amount, type, shares);
  } catch {
    return [];
  }
}

function validateSplit(
  type: SplitType,
  amount: number,
  shares: { memberId: string; value: number }[],
): string | null {
  if (amount <= 0 || shares.length === 0) return null;
  const sum = shares.reduce((a, s) => a + s.value, 0);
  if (type === "exact" && sum !== amount)
    return "Die Beträge müssen in der Summe dem Gesamtbetrag entsprechen.";
  if (type === "percent" && Math.round(sum) !== 100)
    return "Die Prozente müssen zusammen 100 ergeben.";
  if (type === "shares" && shares.some((s) => s.value <= 0))
    return "Jeder Anteil muss mindestens 1 sein.";
  return null;
}
