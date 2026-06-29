import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useState } from "react";
import { usePwaInstall } from "../lib/usePwaInstall.js";

const DISMISS_KEY = "pwaInstallDismissed";

/**
 * Gentle nudge to install the PWA — only shown in a browser tab (never when
 * already running standalone), and only until the user dismisses it once.
 * Uses the native prompt on Chrome/Android; shows Share-sheet steps on iOS.
 */
export function InstallPrompt() {
  const { isStandalone, canInstall, isIOS, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1",
  );

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  // Nothing to show when installed, already dismissed, or the platform offers
  // no path to install (e.g. desktop browser without the prompt event).
  if (isStandalone || dismissed || (!canInstall && !isIOS)) return null;

  return (
    <Box sx={{ px: 2, pt: 2 }}>
      <Alert
        severity="info"
        icon={<IosShareRoundedIcon fontSize="inherit" />}
        onClose={dismiss}
        action={
          canInstall ? (
            <Button color="inherit" size="small" onClick={() => void promptInstall()}>
              Installieren
            </Button>
          ) : undefined
        }
      >
        {canInstall ? (
          <>WG-App als App installieren — schneller Zugriff &amp; Push-Mitteilungen.</>
        ) : (
          <>
            Zum Installieren: <strong>Teilen</strong>-Symbol{" "}
            <IosShareRoundedIcon sx={{ fontSize: 14, verticalAlign: "text-bottom" }} />{" "}
            antippen, dann <strong>„Zum Home-Bildschirm“</strong>.
          </>
        )}
      </Alert>
    </Box>
  );
}
