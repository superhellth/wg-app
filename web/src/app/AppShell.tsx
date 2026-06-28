import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useIdentity, setMemberId } from "../api/identity.js";
import { useMembersMap } from "../api/members.js";
import { MemberAvatar } from "../components/MemberAvatar.js";

const TABS = [
  { path: "/", label: "Start", icon: <HomeRoundedIcon /> },
  { path: "/geld", label: "Ausgaben", icon: <PaymentsRoundedIcon /> },
  { path: "/putzplan", label: "Putzplan", icon: <CleaningServicesRoundedIcon /> },
  { path: "/einkaufen", label: "Einkaufen", icon: <ShoppingCartRoundedIcon /> },
  { path: "/termine", label: "Termine", icon: <EventRoundedIcon /> },
];

const TITLES: Record<string, string> = {
  "/": "Start",
  "/geld": "Ausgaben",
  "/putzplan": "Putzplan",
  "/einkaufen": "Einkaufen",
  "/termine": "Termine",
  "/fixkosten": "Fixkosten",
  "/mitbewohner": "Mitbewohner",
  "/profil": "Profil",
  "/aktivitaet": "Aktivität",
};

function activeTab(pathname: string): string {
  const match = TABS.map((t) => t.path)
    .filter((p) => p !== "/" && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? "/";
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { memberId } = useIdentity();
  const members = useMembersMap();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const title = TITLES[location.pathname] ?? "WG";
  const me = memberId ? members.get(memberId) : undefined;

  const go = (path: string) => {
    setAnchor(null);
    navigate(path);
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            {title}
          </Typography>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
            <MemberAvatar memberId={memberId} size={34} />
          </IconButton>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem disabled sx={{ opacity: "1 !important" }}>
              <ListItemText
                primary={me?.displayName ?? "Unbekannt"}
                secondary="Angemeldet als"
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => go("/aktivitaet")}>Aktivität</MenuItem>
            <MenuItem onClick={() => go("/fixkosten")}>Fixkosten</MenuItem>
            <MenuItem onClick={() => go("/mitbewohner")}>Mitbewohner</MenuItem>
            <MenuItem onClick={() => go("/profil")}>Profil & Einstellungen</MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setMemberId(null);
                setAnchor(null);
              }}
            >
              Identität wechseln
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, pb: 9, maxWidth: 640, width: "100%", mx: "auto" }}>
        <Outlet />
      </Box>

      <BottomNavigation
        value={activeTab(location.pathname)}
        onChange={(_, v) => navigate(v)}
        showLabels
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1100 }}
      >
        {TABS.map((t) => (
          <BottomNavigationAction
            key={t.path}
            value={t.path}
            label={t.label}
            icon={t.icon}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
}
