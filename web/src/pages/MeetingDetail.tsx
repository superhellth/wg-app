import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate, useParams } from "react-router-dom";
import { useDeleteMeeting, useMeeting } from "../api/meetings.js";
import { useConfirm } from "../components/ConfirmDialog.js";
import { formatDayMonth, formatTime, formatWeekday } from "../lib/format.js";

export function MeetingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const detail = useMeeting(id);
  const del = useDeleteMeeting();
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Termin löschen?",
      body: "Diesen Termin wirklich löschen?",
      confirmLabel: "Löschen",
      confirmColor: "error",
    });
    if (!ok) return;
    del.mutate(id, { onSuccess: () => navigate("/termine", { replace: true }) });
  };

  if (!detail.data) return <Box sx={{ p: 2 }}>Lädt…</Box>;
  const meeting = detail.data;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={() => navigate(`/termine/${id}/bearbeiten`)}>
          <EditRoundedIcon />
        </IconButton>
        <IconButton onClick={handleDelete} disabled={del.isPending}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
      </Stack>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, lineHeight: 1.2 }}>
        {meeting.title}
      </Typography>

      <Card
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
          bgcolor: "rgba(91,79,233,0.07)",
          border: "1px solid rgba(91,79,233,0.16)",
        }}
      >
        <CalendarMonthRoundedIcon sx={{ color: "primary.main", fontSize: 34 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatWeekday(meeting.startsAt)}
          </Typography>
          <Typography color="text.secondary">
            {formatDayMonth(meeting.startsAt)} · {formatTime(meeting.startsAt)} Uhr
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}
