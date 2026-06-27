import Box from "@mui/material/Box";
import { MEMBER_PALETTE } from "../theme/memberColors.js";

/** Centered, nav-free layout for onboarding, with the people-first brand mark. */
export function OnboardingLayout({
  children,
  showMark = true,
}: {
  children: React.ReactNode;
  showMark?: boolean;
}) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 3,
        p: 3,
        maxWidth: 460,
        mx: "auto",
      }}
    >
      {showMark && <BrandMark />}
      {children}
    </Box>
  );
}

/** Overlapping colored dots — the household is its people. */
export function BrandMark() {
  return (
    <Box sx={{ display: "flex" }}>
      {MEMBER_PALETTE.slice(0, 5).map((c, i) => (
        <Box
          key={i}
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: c.main,
            border: "3px solid #FBFAF7",
            ml: i === 0 ? 0 : -1.25,
          }}
        />
      ))}
    </Box>
  );
}
