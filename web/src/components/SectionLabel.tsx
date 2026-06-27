import Typography from "@mui/material/Typography";

/** Small uppercase eyebrow label above a content group. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: "text.secondary", display: "block", mb: 1 }}
    >
      {children}
    </Typography>
  );
}
