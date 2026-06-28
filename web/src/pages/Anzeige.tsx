import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  BUTTON_COLORS,
  BUTTON_GPIO,
  BUTTON_LABELS,
  DISPLAY_FUNCTIONS,
  DISPLAY_FUNCTION_LABELS,
  type ButtonColor,
  type DisplayButtons,
  type DisplayFunction,
} from "@wg/shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDisplayConfig, useUpdateDisplayConfig } from "../api/display.js";
import { SectionLabel } from "../components/SectionLabel.js";

const NONE = "none";
const DOT: Record<ButtonColor, string> = {
  blue: "#2563eb",
  yellow: "#eab308",
  red: "#dc2626",
  green: "#16a34a",
};

export function Anzeige() {
  const navigate = useNavigate();
  const config = useDisplayConfig();
  const update = useUpdateDisplayConfig();

  const [buttons, setButtons] = useState<DisplayButtons>({
    blue: null,
    yellow: null,
    red: null,
    green: null,
  });
  const [defaultFn, setDefaultFn] = useState<DisplayFunction>("saldo");
  const [idle, setIdle] = useState("30");

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !config.data) return;
    setButtons(config.data.buttons);
    setDefaultFn(config.data.defaultFunction);
    setIdle(String(config.data.idleTimeoutSeconds));
    seeded.current = true;
  }, [config.data]);

  const setButton = (color: ButtonColor, value: string) =>
    setButtons((b) => ({
      ...b,
      [color]: value === NONE ? null : (value as DisplayFunction),
    }));

  const idleNum = Number(idle);
  const valid = idleNum >= 5 && idleNum <= 3600;

  const save = () =>
    update.mutate({
      defaultFunction: defaultFn,
      idleTimeoutSeconds: idleNum,
      buttons,
    });

  return (
    <Box sx={{ p: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton edge="start" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h5">Anzeige (Display)</Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Ordne den vier Tasten am Raspberry Pi je eine Funktion zu. Die
        Standard-Funktion erscheint, wenn länger keine Taste gedrückt wurde.
      </Typography>

      <Stack spacing={2.5}>
        <Box>
          <SectionLabel>Tasten</SectionLabel>
          <Card sx={{ p: 2 }}>
            <Stack spacing={2}>
              {BUTTON_COLORS.map((color) => (
                <Stack key={color} direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      bgcolor: DOT[color],
                      flex: "0 0 auto",
                    }}
                  />
                  <Box sx={{ width: 84, flex: "0 0 auto" }}>
                    <Typography sx={{ fontWeight: 600, lineHeight: 1.1 }}>
                      {BUTTON_LABELS[color]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      GPIO {BUTTON_GPIO[color]}
                    </Typography>
                  </Box>
                  <TextField
                    select
                    size="small"
                    value={buttons[color] ?? NONE}
                    onChange={(e) => setButton(color, e.target.value)}
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value={NONE}>
                      <em>Keine</em>
                    </MenuItem>
                    {DISPLAY_FUNCTIONS.map((fn) => (
                      <MenuItem key={fn} value={fn}>
                        {DISPLAY_FUNCTION_LABELS[fn]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              ))}
            </Stack>
          </Card>
        </Box>

        <Box>
          <SectionLabel>Standard</SectionLabel>
          <TextField
            select
            fullWidth
            label="Standard-Funktion"
            value={defaultFn}
            onChange={(e) => setDefaultFn(e.target.value as DisplayFunction)}
          >
            {DISPLAY_FUNCTIONS.map((fn) => (
              <MenuItem key={fn} value={fn}>
                {DISPLAY_FUNCTION_LABELS[fn]}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TextField
          label="Zurück zur Standard-Funktion nach (Sekunden)"
          value={idle}
          onChange={(e) => setIdle(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          error={idle !== "" && !valid}
          helperText={idle !== "" && !valid ? "5–3600 Sekunden" : undefined}
          sx={{ maxWidth: 320 }}
        />

        {update.isError && (
          <Alert severity="error">Konnte nicht gespeichert werden.</Alert>
        )}
        {update.isSuccess && !update.isPending && (
          <Alert severity="success">Gespeichert ✓</Alert>
        )}

        <Divider />
        <Button
          variant="contained"
          size="large"
          disabled={!valid || update.isPending}
          onClick={save}
        >
          {update.isPending ? "Wird gespeichert…" : "Speichern"}
        </Button>
      </Stack>
    </Box>
  );
}
