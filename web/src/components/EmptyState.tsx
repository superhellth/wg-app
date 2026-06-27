import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface Props {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}

/** Friendly empty screen — an invitation to act, not a dead end. */
export function EmptyState({ icon, title, hint, action }: Props) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 6,
        px: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      {icon && <Box sx={{ fontSize: 40, color: "text.secondary", mb: 1 }}>{icon}</Box>}
      <Typography variant="h6">{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
          {hint}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
