import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useMeetings } from "../api/meetings.js";
import { AddFab } from "../components/Fab.js";
import { EmptyState } from "../components/EmptyState.js";
import { ParticipationChips } from "../components/ParticipationChips.js";
import { formatDateTime } from "../lib/format.js";

const MODE = {
  fixed: { label: "Termin", icon: <EventRoundedIcon fontSize="small" /> },
  recurring: { label: "Wiederkehrend", icon: <RepeatRoundedIcon fontSize="small" /> },
  poll: { label: "Umfrage", icon: <HowToVoteRoundedIcon fontSize="small" /> },
};

export function Termine() {
  const navigate = useNavigate();
  const meetings = useMeetings();

  const sorted = [...(meetings.data ?? [])].sort((a, b) => {
    const ta = a.startsAt ? dayjs(a.startsAt).valueOf() : Infinity;
    const tb = b.startsAt ? dayjs(b.startsAt).valueOf() : Infinity;
    return ta - tb;
  });

  return (
    <Box sx={{ p: 2 }}>
      {sorted.length > 0 ? (
        <Stack spacing={1.5}>
          {sorted.map((m) => {
            const mode = MODE[m.mode];
            return (
              <Card key={m.id}>
                <CardActionArea sx={{ p: 2 }} onClick={() => navigate(`/termine/${m.id}`)}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6" sx={{ flex: 1 }}>{m.title}</Typography>
                    <Chip icon={mode.icon} label={mode.label} size="small" variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {m.startsAt ? formatDateTime(m.startsAt) : "Noch kein Termin — abstimmen"}
                  </Typography>
                  {m.startsAt && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <ParticipationChips rsvps={m.rsvps} />
                    </>
                  )}
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <EmptyState title="Keine Termine" hint="Plane ein Treffen oder starte eine Umfrage." />
      )}

      <AddFab label="Termin hinzufügen" onClick={() => navigate("/termine/neu")} />
    </Box>
  );
}
