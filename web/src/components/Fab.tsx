import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Fab from "@mui/material/Fab";

/** Floating add button, parked above the bottom nav. */
export function AddFab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Fab
      color="primary"
      aria-label={label}
      onClick={onClick}
      sx={{ position: "fixed", bottom: 80, right: 16, zIndex: 1200 }}
    >
      <AddRoundedIcon />
    </Fab>
  );
}
