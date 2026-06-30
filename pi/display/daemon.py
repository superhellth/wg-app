"""
WG physical display daemon.

Drives a 16x2 I2C LCD (PCF8574 backpack) and reads four buttons:
    blue=GPIO12, yellow=GPIO16, red=GPIO20, green=GPIO21 (BCM).

Each button is mapped (in the app) to a display function. Pressing a button
switches the LCD to that function; after `idleTimeoutSeconds` of no presses it
reverts to the configured default function. Config + the 16x2-ready content are
polled from the app API (the API owns all formatting).

Env:
    API_URL            base url of the api service (default http://api:3000)
    WG_TOKEN_SECRET    shared WG bearer token (same as the app)
    LCD_ADDRESS        I2C address, e.g. 0x3f (default 0x3f)
    LCD_PORT           I2C bus (default 1)
    LCD_COLS / LCD_ROWS  geometry (default 16 / 2)
    POLL_SECONDS       how often to refetch the active function's content (10)
    CONFIG_SECONDS     how often to refetch config (30)
    PAGE_SECONDS       seconds per page when content > 2 rows (3)
    SCROLL_STEP_SECONDS  seconds per character when scrolling a wide line (0.35)
    SCROLL_HOLD_SECONDS  pause held at the start and end of a scroll (1.2)
"""
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

# gpiozero's default RPi.GPIO backend fails edge detection on recent Pi OS
# (Bookworm) and inside containers ("Failed to add edge detection"). The lgpio
# backend uses the gpiochip char device and works on Pi 4/5. Must be set before
# importing gpiozero.
os.environ.setdefault("GPIOZERO_PIN_FACTORY", "lgpio")

import requests
import smbus2
from gpiozero import Button
from RPLCD.i2c import CharLCD

API_URL = os.environ.get("API_URL", "http://api:3000").rstrip("/")
WG_TOKEN = os.environ.get("WG_TOKEN_SECRET", "")
LCD_ADDRESS = int(os.environ.get("LCD_ADDRESS", "0x3f"), 16)
LCD_PORT = int(os.environ.get("LCD_PORT", "1"))  # /dev/i2c-1 (SDA1/SCL1)
LCD_CHARMAP = os.environ.get("LCD_CHARMAP", "A00")
COLS = int(os.environ.get("LCD_COLS", "16"))
ROWS = int(os.environ.get("LCD_ROWS", "2"))
POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "10"))
CONFIG_SECONDS = float(os.environ.get("CONFIG_SECONDS", "30"))
PAGE_SECONDS = float(os.environ.get("PAGE_SECONDS", "3"))
# Horizontal scrolling for lines wider than the panel: seconds per character
# step, plus a pause held at both the start and the end so the line is readable.
SCROLL_STEP_SECONDS = float(os.environ.get("SCROLL_STEP_SECONDS", "0.35"))
SCROLL_HOLD_SECONDS = float(os.environ.get("SCROLL_HOLD_SECONDS", "1.2"))
# How often to retry the LCD after an I2C error (e.g. breadboard power switched
# off). The daemon stays alive and re-inits the display when power returns.
LCD_RETRY_SECONDS = float(os.environ.get("LCD_RETRY_SECONDS", "5"))
# How long to flash "Taste nicht belegt" when an unmapped button is pressed.
FLASH_SECONDS = float(os.environ.get("FLASH_SECONDS", "1.5"))

# Fixed wiring: color -> BCM pin. Mirrors BUTTON_GPIO in @wg/shared.
BUTTON_PINS = {"blue": 12, "yellow": 16, "red": 20, "green": 21}

# Single German WG — the on/off schedule is wall-clock Berlin, like the rest of
# the app (web dayjs.tz, api dayjs.tz). Pin it so a UTC container host doesn't
# shift the window by 2h. zoneinfo needs the tz database (tzdata in requirements).
BERLIN = ZoneInfo("Europe/Berlin")

# HD44780 has no umlauts — transliterate so names stay readable.
TRANSLIT = str.maketrans(
    {"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss", "€": "EUR", "–": "-", "—": "-", "„": '"', "“": '"', "”": '"'}
)


def to_ascii(s):
    """Transliterate umlauts/symbols and drop anything the HD44780 can't show.
    No width clamp — scrolling needs the full-length string."""
    return s.translate(TRANSLIT).encode("ascii", "replace").decode("ascii")


def ascii16(s):
    return to_ascii(s)[:COLS].ljust(COLS)


class Daemon:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {WG_TOKEN}"
        # LCD is created lazily and re-created after I2C errors, so cutting the
        # breadboard power rail doesn't take the daemon down.
        self.lcd = None
        self.last_lcd_attempt = 0.0
        self._backlight_on = True  # physical backlight state (fresh LCD = on)
        self.config = {
            "defaultFunction": "saldo",
            "idleTimeoutSeconds": 30,
            "buttons": {"blue": None, "yellow": None, "red": None, "green": None},
            "scheduleEnabled": False,
            "onTime": "07:00",
            "offTime": "23:00",
        }
        self.active_fn = None
        self.last_press = 0.0
        self.render = None            # {"title": str, "lines": [str]}
        self.render_fetched_at = 0.0
        self.config_fetched_at = 0.0
        self.page = 0
        self.page_started_at = 0.0
        self._last_rows = None
        self.flash_until = 0.0  # transient "button not mapped" message

        # Button init is non-fatal: a GPIO problem must not take the LCD down.
        self.buttons = {}
        for color, pin in BUTTON_PINS.items():
            try:
                b = Button(pin, pull_up=True, bounce_time=0.05)
                b.when_pressed = self._make_handler(color)
                self.buttons[color] = b
            except Exception as e:  # noqa: BLE001
                print(f"[gpio] button {color} (pin {pin}) failed: {e}", flush=True)

    def _make_handler(self, color):
        def handler():
            now = time.monotonic()
            fn = self.config.get("buttons", {}).get(color)
            if fn:
                self.active_fn = fn
                self.last_press = now
                self.render = None  # force immediate refetch for the new function
            else:
                # Unmapped button — brief feedback, idle timer untouched.
                self.flash_until = now + FLASH_SECONDS
        return handler

    def fetch_config(self):
        try:
            r = self.session.get(f"{API_URL}/api/display/config", timeout=5)
            r.raise_for_status()
            self.config = r.json()
            self.config_fetched_at = time.monotonic()
            if self.active_fn is None:
                self.active_fn = self.config["defaultFunction"]
        except Exception as e:  # noqa: BLE001 — keep running on transient errors
            print(f"[config] {e}", flush=True)

    def fetch_render(self):
        try:
            r = self.session.get(f"{API_URL}/api/display/render/{self.active_fn}", timeout=5)
            r.raise_for_status()
            data = r.json()
            self.render = {"title": data.get("title", ""), "lines": data.get("lines", [])}
            self.render_fetched_at = time.monotonic()
        except Exception as e:  # noqa: BLE001
            print(f"[render] {e}", flush=True)
            self.render = {"title": "Verbindung...", "lines": [""]}

    def _i2c_present(self):
        """Cheap ACK probe with a context-closed bus handle. CharLCD opens the
        i2c fd *then* writes init bytes; if the display is unpowered that write
        raises mid-__init__ and leaks the fd (no reference to close it), so a
        retry loop eventually hits EMFILE ([Errno 24]) and never recovers. Only
        build CharLCD once the device actually ACKs."""
        try:
            with smbus2.SMBus(LCD_PORT) as bus:
                bus.write_quick(LCD_ADDRESS)
            return True
        except OSError:
            return False

    def ensure_lcd(self, now):
        """Return a live LCD, (re)initializing it if needed. None if the display
        is currently unreachable (e.g. powered off) — retried on a throttle."""
        if self.lcd is not None:
            return self.lcd
        if now - self.last_lcd_attempt < LCD_RETRY_SECONDS:
            return None
        self.last_lcd_attempt = now
        if not self._i2c_present():
            print("[lcd] no device at i2c (powered off?)", flush=True)
            return None
        try:
            self.lcd = CharLCD(
                i2c_expander="PCF8574", address=LCD_ADDRESS, port=LCD_PORT,
                cols=COLS, rows=ROWS, auto_linebreaks=False, charmap=LCD_CHARMAP,
            )
            self._last_rows = None  # force a full redraw on the fresh screen
            self._backlight_on = True  # a fresh panel powers up with backlight on
            print("[lcd] connected", flush=True)
        except Exception as e:  # noqa: BLE001 — display absent/unpowered
            self._drop_lcd()  # close any half-open fd from a partial init
            print(f"[lcd] init failed: {e}", flush=True)
        return self.lcd

    def _drop_lcd(self):
        try:
            if self.lcd is not None:
                self.lcd.close(clear=False)
        except Exception:  # noqa: BLE001
            pass
        self.lcd = None
        self._last_rows = None

    def _scheduled_on(self, wall):
        """Is the display meant to be on right now? `wall` is a Berlin-aware
        datetime. Window is [onTime, offTime), wrapping midnight (off 23:00 / on
        07:00 works). Equal times = always on."""
        cfg = self.config
        if not cfg.get("scheduleEnabled"):
            return True
        on = cfg.get("onTime", "07:00")
        off = cfg.get("offTime", "23:00")
        t = wall.strftime("%H:%M")
        if on == off:
            return True
        if on < off:
            return on <= t < off          # same-day window
        return t >= on or t < off          # window wraps midnight

    def _set_backlight(self, on, now):
        """Drive the panel backlight, writing only on a state change. Off also
        clears the screen; on forces a redraw so content reappears immediately."""
        lcd = self.ensure_lcd(now)
        if lcd is None or self._backlight_on == on:
            return
        try:
            lcd.backlight_enabled = on
            if on:
                self._last_rows = None  # redraw whatever content we hold
            else:
                lcd.clear()
                self._last_rows = None
            self._backlight_on = on
            print(f"[lcd] backlight {'on' if on else 'off'}", flush=True)
        except OSError as e:
            print(f"[lcd] backlight failed: {e}", flush=True)
            self._drop_lcd()

    def write(self, now, row0, row1):
        lcd = self.ensure_lcd(now)
        if lcd is None:
            return
        rows = (ascii16(row0), ascii16(row1))
        if rows == self._last_rows:
            return
        try:
            lcd.cursor_pos = (0, 0)
            lcd.write_string(rows[0])
            lcd.cursor_pos = (1, 0)
            lcd.write_string(rows[1])
            self._last_rows = rows
        except OSError as e:
            # I2C error — display lost power. Drop it; ensure_lcd re-inits later.
            print(f"[lcd] write failed: {e}", flush=True)
            self._drop_lcd()

    def _render_page(self, now, raw0, raw1):
        """Window the two rows for the current page. If either is wider than the
        panel, scroll horizontally (hold at start, step through, hold at end).
        Returns (row0, row1, done) where `done` means it's time for the next
        page — after PAGE_SECONDS for short rows, or after the scroll finished."""
        a0, a1 = to_ascii(raw0), to_ascii(raw1)
        elapsed = now - self.page_started_at
        extra = max(len(a0), len(a1)) - COLS

        if extra <= 0:
            return a0.ljust(COLS), a1.ljust(COLS), elapsed >= PAGE_SECONDS

        scroll_time = extra * SCROLL_STEP_SECONDS
        if elapsed <= SCROLL_HOLD_SECONDS:
            offset = 0
        elif elapsed >= SCROLL_HOLD_SECONDS + scroll_time:
            offset = extra
        else:
            offset = min(extra, int((elapsed - SCROLL_HOLD_SECONDS) / SCROLL_STEP_SECONDS))
        done = elapsed >= SCROLL_HOLD_SECONDS + scroll_time + SCROLL_HOLD_SECONDS

        def window(s):
            # Each row clamps to its own end, so a shorter row stops scrolling
            # once fully shown while a longer one keeps going.
            if len(s) <= COLS:
                return s.ljust(COLS)
            return s[min(offset, len(s) - COLS):][:COLS]

        return window(a0), window(a1), done

    def loop(self):
        self.write(time.monotonic(), "WG", "Starte...")
        self.fetch_config()
        self.fetch_render()

        while True:
            now = time.monotonic()

            if now - self.config_fetched_at > CONFIG_SECONDS:
                self.fetch_config()

            # Time control: outside the on-window, blank the panel and skip
            # render fetches. Config is still polled above, so re-enabling the
            # schedule (or disabling it) is picked up within CONFIG_SECONDS.
            if not self._scheduled_on(datetime.now(BERLIN)):
                self._set_backlight(False, now)
                time.sleep(0.2)
                continue
            self._set_backlight(True, now)

            # Revert to the default function after the idle timeout.
            idle = float(self.config.get("idleTimeoutSeconds", 30))
            default_fn = self.config.get("defaultFunction", "saldo")
            if now - self.last_press > idle and self.active_fn != default_fn:
                self.active_fn = default_fn
                self.render = None

            if self.render is None or now - self.render_fetched_at > POLL_SECONDS:
                self.fetch_render()
                self.page = 0
                self.page_started_at = now

            # Buffer = [title] + content lines; page through it two rows at a time.
            buf = [self.render["title"]] + (self.render["lines"] or [""])
            pages = max(1, (len(buf) + 1) // 2)
            i = self.page * 2
            row0, row1, page_done = self._render_page(
                now,
                buf[i] if i < len(buf) else "",
                buf[i + 1] if i + 1 < len(buf) else "",
            )

            if now < self.flash_until:
                self.write(now, "Taste", "nicht belegt")
            else:
                self.write(now, row0, row1)

            # Advance only once the current page is fully read (long rows scroll
            # to the end first); single-page content just holds.
            if pages > 1 and page_done:
                self.page = (self.page + 1) % pages
                self.page_started_at = now

            time.sleep(0.05)


if __name__ == "__main__":
    Daemon().loop()
