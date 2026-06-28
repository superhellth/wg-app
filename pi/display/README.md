# Pi display daemon

Drives the 16x2 I2C LCD and reads the four buttons, showing WG data. Runs as the
`display` service in `docker-compose.yml`.

## Hardware

| Button | Color  | GPIO (BCM) |
| ------ | ------ | ---------- |
| 1      | blue   | 12         |
| 2      | yellow | 16         |
| 3      | red    | 20         |
| 4      | green  | 21         |

Buttons wire to their GPIO pin and ground (internal pull-ups, active-low).
LCD: PCF8574 I2C backpack at `0x27` on bus 0 (`/dev/i2c-0`, SDA0/SCL0).

## Setup on the Pi

1. Enable I2C: `sudo raspi-config` → Interface Options → I2C → enable. Bus 0
   on the SDA0/SCL0 pins may also need `dtparam=i2c_vc=on` (or `dtoverlay=i2c0`)
   in `/boot/firmware/config.txt`, then reboot.
2. Confirm bus + address: `i2cdetect -y 0` should show `27`. If it differs, set
   `LCD_PORT` / `LCD_ADDRESS` on the `display` service in compose.

## Config

Button→function mapping, the default function, and the idle timeout are all set
**in the app** (Profil → Pi-Anzeige) and stored in `display_config`. The daemon
polls `/api/display/config` for them and `/api/display/render/<function>` for the
already-formatted 16-char lines — the API owns all formatting. Auth is the shared
`WG_TOKEN_SECRET` (from `api/.env`).

Functions: `shopping`, `chores`, `saldo`, `appointment`, `activity`.

## Behavior

- Press a mapped button → switch to that function immediately.
- No press for `idleTimeoutSeconds` → revert to the default function.
- Content longer than two rows pages automatically (`PAGE_SECONDS`).
