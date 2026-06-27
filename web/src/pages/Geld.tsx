import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBalances } from "../api/balances.js";
import { useExpenses } from "../api/expenses.js";
import { useMembersMap } from "../api/members.js";
import { AddFab } from "../components/Fab.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { MemberChip } from "../components/MemberChip.js";
import { MoneyText } from "../components/MoneyText.js";
import { SectionLabel } from "../components/SectionLabel.js";
import { SettlementDialog } from "../components/SettlementDialog.js";
import { EmptyState } from "../components/EmptyState.js";
import { formatCents, fromNow } from "../lib/format.js";

export function Geld() {
  const navigate = useNavigate();
  const members = useMembersMap();
  const balances = useBalances();
  const expenses = useExpenses();
  const [dialog, setDialog] = useState<{
    open: boolean;
    prefill?: { fromMemberId: string; toMemberId: string; amount: number };
  }>({ open: false });

  const entries = Object.entries(balances.data?.balances ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const transfers = balances.data?.suggestedTransfers ?? [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2.5}>
        {/* Salden */}
        <Box>
          <SectionLabel>Salden</SectionLabel>
          <Card sx={{ px: 2 }}>
            {entries.map(([id, bal], i) => (
              <Stack
                key={id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ py: 1.25, borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider" }}
              >
                <MemberAvatar memberId={id} size={32} />
                <Typography sx={{ flex: 1 }}>{members.get(id)?.displayName ?? "—"}</Typography>
                <MoneyText cents={bal} signed />
              </Stack>
            ))}
            {entries.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Noch keine Ausgaben.
              </Typography>
            )}
          </Card>
        </Box>

        {/* Ausgleichen */}
        {transfers.length > 0 && (
          <Box>
            <SectionLabel>Ausgleichen</SectionLabel>
            <Stack spacing={1}>
              {transfers.map((t, i) => (
                <Card key={i} sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <MemberChip memberId={t.fromMemberId} />
                    <ArrowForwardRoundedIcon fontSize="small" color="action" />
                    <MemberChip memberId={t.toMemberId} />
                    <Box sx={{ flex: 1 }} />
                    <MoneyText cents={t.amount} size="0.95rem" />
                  </Stack>
                  <Button
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() =>
                      setDialog({
                        open: true,
                        prefill: {
                          fromMemberId: t.fromMemberId,
                          toMemberId: t.toMemberId,
                          amount: t.amount,
                        },
                      })
                    }
                  >
                    Als bezahlt markieren
                  </Button>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        <Button variant="outlined" onClick={() => setDialog({ open: true })}>
          Zahlung erfassen
        </Button>

        <Divider />

        {/* Ausgaben */}
        <Box>
          <SectionLabel>Ausgaben</SectionLabel>
          {expenses.data && expenses.data.length > 0 ? (
            <Stack spacing={1}>
              {expenses.data.map((e) => (
                <Card key={e.id} sx={{ p: 1.75 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <MemberAvatar memberId={e.payerId} size={36} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 600 }}>
                        {e.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {members.get(e.payerId)?.displayName} · {fromNow(e.createdAt)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {formatCents(e.amount)}
                    </Typography>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : (
            <EmptyState title="Noch keine Ausgaben" hint="Erfasse die erste mit dem +." />
          )}
        </Box>
      </Stack>

      <AddFab label="Ausgabe hinzufügen" onClick={() => navigate("/geld/neu")} />
      <SettlementDialog
        open={dialog.open}
        prefill={dialog.prefill}
        onClose={() => setDialog({ open: false })}
      />
    </Box>
  );
}
