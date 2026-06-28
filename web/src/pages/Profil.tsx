import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setMemberId, useIdentity } from "../api/identity.js";
import { useMembersMap, useUpdateMember } from "../api/members.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SectionLabel } from "../components/SectionLabel.js";
import {
  isIOS,
  isStandalone,
  pushSupported,
  registerPush,
  type PushResult,
} from "../lib/push.js";

export function Profil() {
  const navigate = useNavigate();
  const { memberId } = useIdentity();
  const members = useMembersMap();
  const update = useUpdateMember();
  const me = memberId ? members.get(memberId) : undefined;

  const [pushState, setPushState] = useState<PushResult | "pending" | null>(null);
  const [away, setAway] = useState<Dayjs | null>(
    me?.awayUntil ? dayjs(me.awayUntil) : null,
  );

  const needsInstall = isIOS() && !isStandalone();

  const enablePush = async () => {
    if (!memberId) return;
    setPushState("pending");
    setPushState(await registerPush(memberId));
  };

  const saveAway = (value: Dayjs | null) => {
    setAway(value);
    if (!memberId) return;
    update.mutate({ id: memberId, body: { awayUntil: value ? value.endOf("day").toISOString() : null } });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Identity */}
        <Box>
          <SectionLabel>Angemeldet als</SectionLabel>
          <Card sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <MemberAvatar memberId={memberId} size={48} />
              <Typography variant="h6" sx={{ flex: 1 }}>{me?.displayName ?? "—"}</Typography>
              <Button onClick={() => setMemberId(null)}>Wechseln</Button>
            </Stack>
          </Card>
        </Box>

        {/* Notifications */}
        <Box>
          <SectionLabel>Benachrichtigungen</SectionLabel>
          <Card sx={{ p: 2 }}>
            {needsInstall ? (
              <Alert severity="info">
                Auf dem iPhone zuerst über „Teilen → Zum Home-Bildschirm" installieren,
                dann die App von dort öffnen, um Benachrichtigungen zu erlauben.
              </Alert>
            ) : !pushSupported() ? (
              <Typography variant="body2" color="text.secondary">
                Dieser Browser unterstützt keine Push-Benachrichtigungen.
              </Typography>
            ) : (
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="body2" color="text.secondary">
                  Erhalte Hinweise zu deinen Aufgaben und Terminen.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<NotificationsActiveRoundedIcon />}
                  onClick={enablePush}
                  disabled={pushState === "pending"}
                >
                  {pushState === "ok" ? "Aktiviert ✓" : "Benachrichtigungen aktivieren"}
                </Button>
                {pushState === "denied" && (
                  <Alert severity="warning">Im Browser blockiert. Bitte in den Einstellungen erlauben.</Alert>
                )}
                {pushState === "no-key" && (
                  <Alert severity="info">Push ist auf dem Server noch nicht eingerichtet.</Alert>
                )}
                {pushState === "error" && (
                  <Alert severity="error">Hat nicht geklappt. Nochmal versuchen?</Alert>
                )}
              </Stack>
            )}
          </Card>
        </Box>

        {/* Physical display */}
        <Box>
          <SectionLabel>Pi-Anzeige</SectionLabel>
          <Card>
            <CardActionArea onClick={() => navigate("/anzeige")} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <TvRoundedIcon color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>Tasten &amp; Display</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tasten den Anzeige-Funktionen zuordnen
                  </Typography>
                </Box>
                <ChevronRightRoundedIcon color="action" />
              </Stack>
            </CardActionArea>
          </Card>
        </Box>

        {/* Away */}
        <Box>
          <SectionLabel>Abwesenheit</SectionLabel>
          <Card sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Wenn du abwesend bist, wirst du im Putzplan übersprungen.
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
              <Stack direction="row" spacing={1} alignItems="center">
                <DatePicker
                  label="Abwesend bis"
                  value={away}
                  onChange={saveAway}
                  disablePast
                />
                {away && <Button onClick={() => saveAway(null)}>Zurücksetzen</Button>}
              </Stack>
            </LocalizationProvider>
          </Card>
        </Box>
      </Stack>
    </Box>
  );
}
