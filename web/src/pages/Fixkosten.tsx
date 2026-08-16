import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import type { BillingCycle, FixedCostView } from "@wg/shared";
import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { useEffect, useState } from "react";
import {
  useCreateFixedCost,
  useDeleteFixedCost,
  useFixedCosts,
  useUpdateFixedCost,
} from "../api/fixedCosts.js";
import { useMembers } from "../api/members.js";
import { AddFab } from "../components/Fab.js";
import { EmptyState } from "../components/EmptyState.js";
import { MemberChip } from "../components/MemberChip.js";
import { MoneyText } from "../components/MoneyText.js";
import { formatCents, formatDate, parseEurToCents } from "../lib/format.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — pickers operate in Berlin regardless of device tz. */
const WG_TZ = "Europe/Berlin";

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Vierteljährlich" },
  { value: "yearly", label: "Jährlich" },
];
const cycleLabel = (c: BillingCycle) => CYCLES.find((x) => x.value === c)?.label ?? c;

export function Fixkosten() {
  const costs = useFixedCosts();
  const remove = useDeleteFixedCost();
  const [edit, setEdit] = useState<FixedCostView | "new" | null>(null);

  return (
    <Box sx={{ p: 2 }}>
      {costs.data && costs.data.length > 0 ? (
        <Stack spacing={1.5}>
          {costs.data.map((c) => (
            <Card key={c.id} sx={{ opacity: c.active ? 1 : 0.5 }}>
              <Stack direction="row" alignItems="center">
                <CardActionArea sx={{ p: 2 }} onClick={() => setEdit(c)}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6" sx={{ flex: 1 }}>{c.name}</Typography>
                    <MoneyText cents={c.amount} />
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {cycleLabel(c.cycle)} · Vertrag:
                    </Typography>
                    <MemberChip memberId={c.contractHolderId} />
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      pro Person {formatCents(c.perPersonShare)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Fällig: {formatDate(c.nextDueAt)}
                    </Typography>
                    {!c.active && <Chip label="Pausiert" size="small" />}
                  </Stack>
                </CardActionArea>
                <IconButton sx={{ mr: 1 }} onClick={() => remove.mutate(c.id)}>
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <EmptyState title="Keine Fixkosten" hint="Trage Miete, Strom, Internet … ein." />
      )}

      <AddFab label="Fixkosten hinzufügen" onClick={() => setEdit("new")} />
      {edit && <FixedCostDialog value={edit} onClose={() => setEdit(null)} />}
    </Box>
  );
}

function FixedCostDialog({
  value,
  onClose,
}: {
  value: FixedCostView | "new";
  onClose: () => void;
}) {
  const { data: members } = useMembers();
  const createM = useCreateFixedCost();
  const updateM = useUpdateFixedCost();
  const isNew = value === "new";

  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [holder, setHolder] = useState("");
  const [nextDueAt, setNextDueAt] = useState<Dayjs | null>(
    dayjs().tz(WG_TZ).add(1, "month"),
  );
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (value !== "new") {
      setName(value.name);
      setAmountStr((value.amount / 100).toFixed(2).replace(".", ","));
      setCycle(value.cycle);
      setHolder(value.contractHolderId);
      setNextDueAt(dayjs(value.nextDueAt).tz(WG_TZ));
      setActive(value.active);
    }
  }, [value]);

  const amount = parseEurToCents(amountStr) ?? 0;
  const valid = name.trim() && amount > 0 && holder && Boolean(nextDueAt);

  const submit = () => {
    const body = {
      name: name.trim(),
      amount,
      cycle,
      contractHolderId: holder,
      nextDueAt: nextDueAt!.toISOString(),
      active,
    };
    if (isNew) createM.mutate(body, { onSuccess: onClose });
    else updateM.mutate({ id: (value as FixedCostView).id, body }, { onSuccess: onClose });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
      <Dialog open onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>{isNew ? "Neue Fixkosten" : "Fixkosten bearbeiten"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              label="Betrag"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              inputMode="decimal"
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
              fullWidth
            />
            <TextField select label="Abrechnung" value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} fullWidth>
              {CYCLES.map((c) => (
                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Vertragspartner:in" value={holder} onChange={(e) => setHolder(e.target.value)} fullWidth>
              {(members ?? []).map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>
              ))}
            </TextField>
            <DatePicker
              label="Nächste Fälligkeit"
              value={nextDueAt}
              onChange={setNextDueAt}
              timezone={WG_TZ}
            />
            <FormControlLabel
              control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
              label={active ? "Aktiv" : "Pausiert"}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="contained" disabled={!valid} onClick={submit}>Speichern</Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
