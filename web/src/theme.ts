import { createTheme } from "@mui/material/styles";

/**
 * "Mitbewohner" design system. Warm paper base, friendly rounded shapes,
 * Bricolage Grotesque display + Inter body. The signature — per-member colors —
 * lives in ./theme/memberColors.ts, not here.
 */

const ink = "#15151F";
const accent = "#5B4FE9";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: accent, contrastText: "#FFFFFF" },
    success: { main: "#0E8A5F" }, // money: is owed / positive
    error: { main: "#C8553D" }, // money: owes / negative (warm red)
    background: { default: "#FBFAF7", paper: "#FFFFFF" },
    text: { primary: ink, secondary: "#6B6B78" },
    divider: "rgba(21,21,31,0.10)",
  },

  shape: { borderRadius: 14 },

  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, letterSpacing: "-0.02em" },
    h2: { fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, letterSpacing: "-0.02em" },
    h3: { fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { fontWeight: 700, letterSpacing: "0.08em" },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#FBFAF7" },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: {
        root: {
          backgroundColor: "rgba(251,250,247,0.85)",
          backdropFilter: "saturate(180%) blur(8px)",
          borderBottom: "1px solid rgba(21,21,31,0.08)",
          color: ink,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid rgba(21,21,31,0.08)",
          borderRadius: 18,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, paddingInline: 18 },
        sizeLarge: { paddingBlock: 12, fontSize: "1rem" },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, borderRadius: 9 } },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid rgba(21,21,31,0.08)",
          height: 64,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { "&.Mui-selected": { color: accent } },
        label: { fontSize: "0.7rem", "&.Mui-selected": { fontSize: "0.7rem", fontWeight: 600 } },
      },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
  },
});
