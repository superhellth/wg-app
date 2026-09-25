import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Fab from "@mui/material/Fab";

/** Floating add button, parked above the bottom nav. */
export function AddFab({
  onClick,
  label,
  bottom = 80,
}: {
  onClick: () => void;
  label: string;
  bottom?: number;
}) {
  return (
    <Fab
      color="primary"
      aria-label={label}
      onClick={onClick}
      sx={{ position: "fixed", bottom, right: 16, zIndex: 1200 }}
    >
      <AddRoundedIcon />
    </Fab>
  );
}
