import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBalances } from "../api/balances.js";
import { useExpenses } from "../api/expenses.js";
import { useMembersMap } from "../api/members.js";
import { AddFab } from "../components/Fab.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entries = Object.entries(balances.data?.balances ?? {})
    .filter(([id, bal]) => bal !== 0 || !members.get(id)?.archivedAt)
    .sort((a, b) => b[1] - a[1]);
  const transfers = balances.data?.suggestedTransfers ?? [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2.5}>
        {/* Salden */}
        <Box>
          <SectionLabel>Salden</SectionLabel>
          <Card sx={{ px: 2 }}>
            {entries.map(([id, bal], i) => {
              const isExpanded = expandedId === id;
              const memberTransfers = transfers.filter(
                (t) => t.fromMemberId === id || t.toMemberId === id
              );
              return (
                <Box key={id} sx={{ borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider" }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ py: 1.25, cursor: "pointer" }}
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                  >
                    <MemberAvatar memberId={id} size={32} />
                    <Typography sx={{ flex: 1 }}>{members.get(id)?.displayName ?? "—"}</Typography>
                    <MoneyText cents={bal} signed />
                    <ExpandMoreRoundedIcon
                      fontSize="small"
                      sx={{
                        color: "action.disabled",
                        transform: isExpanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s",
                      }}
                    />
                  </Stack>
                  <Collapse in={isExpanded}>
                    <Stack spacing={0.5} sx={{ pb: 1.25, pl: "44px" }}>
                      {memberTransfers.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Keine Überweisung nötig.
                        </Typography>
                      )}
                      {memberTransfers.map((t, i) => {
                        const outgoing = t.fromMemberId === id;
                        const counterpartId = outgoing ? t.toMemberId : t.fromMemberId;
                        return (
                          <Stack key={i} direction="row" alignItems="center" spacing={1}>
                            <MemberAvatar memberId={counterpartId} size={22} />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {outgoing ? "zahlt an " : "erhält von "}
                              {members.get(counterpartId)?.displayName ?? "—"}
                            </Typography>
                            <MoneyText
                              cents={outgoing ? -t.amount : t.amount}
                              signed
                              size="0.85rem"
                            />
                            <IconButton
                              size="small"
                              aria-label="Als bezahlt markieren"
                              sx={{ flexShrink: 0, color: "primary.main" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDialog({
                                  open: true,
                                  prefill: {
                                    fromMemberId: t.fromMemberId,
                                    toMemberId: t.toMemberId,
                                    amount: t.amount,
                                  },
                                });
                              }}
                            >
                              <CheckRoundedIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Collapse>
                </Box>
              );
            })}
            {entries.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Noch keine Ausgaben.
              </Typography>
            )}
          </Card>
        </Box>

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
                <Card
                  key={e.id}
                  sx={{ p: 1.75, cursor: "pointer" }}
                  onClick={() => navigate(`/geld/${e.id}/bearbeiten`)}
                >
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
            <EmptyState title="Noch keine Ausgaben" hint="Erfasse die erste mit dem +" />
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
