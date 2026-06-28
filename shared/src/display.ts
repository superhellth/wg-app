import { z } from "zod";

/**
 * Physical Raspberry-Pi display: 4 colored buttons + a 16x2 I2C LCD. Users map
 * each button to a display function and pick the default function (shown when no
 * button was pressed recently). The button→GPIO wiring is fixed in hardware.
 */
export const DISPLAY_FUNCTIONS = [
  "shopping",
  "chores",
  "saldo",
  "appointment",
  "activity",
] as const;
export const displayFunction = z.enum(DISPLAY_FUNCTIONS);
export type DisplayFunction = z.infer<typeof displayFunction>;

/** German labels for the settings UI. */
export const DISPLAY_FUNCTION_LABELS: Record<DisplayFunction, string> = {
  shopping: "Einkaufsliste",
  chores: "Putzplan (wer dran ist)",
  saldo: "Geld-Saldo",
  appointment: "Nächster Termin",
  activity: "Letzte Aktivitäten",
};

/** Button colors, in wiring order. The GPIO pins are fixed in hardware. */
export const BUTTON_COLORS = ["blue", "yellow", "red", "green"] as const;
export const buttonColor = z.enum(BUTTON_COLORS);
export type ButtonColor = z.infer<typeof buttonColor>;

/** Fixed wiring: blue→12, yellow→16, red→20, green→21 (BCM). */
export const BUTTON_GPIO: Record<ButtonColor, number> = {
  blue: 12,
  yellow: 16,
  red: 20,
  green: 21,
};

export const BUTTON_LABELS: Record<ButtonColor, string> = {
  blue: "Blau",
  yellow: "Gelb",
  red: "Rot",
  green: "Grün",
};

/** Per-button function mapping; null = button does nothing. */
export const displayButtonsSchema = z.object({
  blue: displayFunction.nullable(),
  yellow: displayFunction.nullable(),
  red: displayFunction.nullable(),
  green: displayFunction.nullable(),
});
export type DisplayButtons = z.infer<typeof displayButtonsSchema>;

export const displayConfigSchema = z.object({
  /** shown when no button was pressed within idleTimeoutSeconds */
  defaultFunction: displayFunction,
  /** seconds of inactivity before reverting to the default function */
  idleTimeoutSeconds: z.number().int().min(5).max(3600),
  buttons: displayButtonsSchema,
});
export type DisplayConfig = z.infer<typeof displayConfigSchema>;

/** PUT body — full replace. */
export const updateDisplayConfigSchema = displayConfigSchema;
export type UpdateDisplayConfig = DisplayConfig;

/**
 * Render payload for the 16x2 daemon: pre-formatted lines (each ≤16 chars). The
 * daemon shows two rows at a time and pages through longer content on a timer.
 */
export const displayRenderSchema = z.object({
  function: displayFunction,
  title: z.string(),
  lines: z.array(z.string()),
});
export type DisplayRender = z.infer<typeof displayRenderSchema>;
