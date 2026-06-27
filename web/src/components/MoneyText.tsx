import Box from "@mui/material/Box";
import { formatSignedCents, formatCents } from "../lib/format.js";

interface Props {
  cents: number;
  /** show +/− sign and color by sign (for balances) */
  signed?: boolean;
  size?: string | number;
  weight?: number;
}

/** Money in tabular figures; green when owed, red when owing (if signed). */
export function MoneyText({ cents, signed = false, size = "1rem", weight = 700 }: Props) {
  const color = !signed
    ? "text.primary"
    : cents > 0
      ? "success.main"
      : cents < 0
        ? "error.main"
        : "text.secondary";
  return (
    <Box
      component="span"
      sx={{ color, fontWeight: weight, fontSize: size, fontVariantNumeric: "tabular-nums" }}
    >
      {signed ? formatSignedCents(cents) : formatCents(cents)}
    </Box>
  );
}
