# Keypad override — diagnosis and fix

## First: separate wiring from logic

Press `*` on the keypad. It toggles the OLED between the reading page and the
ADC raw page in **every** mode, with no policy attached to it.

- **Page does not change** → the matrix is not being read. This is wiring, not
  firmware. Skip to "If `*` does nothing" at the bottom.
- **Page changes** → the keypad works fine and you were hitting the three
  control-ownership bugs described below.

The patched firmware also echoes the last key pressed in the bottom-right
corner of the OLED for 1.5 s, so any keypress is now visible immediately.

## What was actually wrong

### 1. A–D were gated behind local mode, with a hint you could miss

`A`/`B`/`C`/`D` only drive the LEDs when `localDemo` is true. In dashboard mode
they did nothing except print `A-D NEED LOCAL MODE` on the OLED footer for two
seconds — and that hint was not drawn at all on the raw (`*`) page. Pressing
`0` first was always required; nothing said so clearly enough.

*Fixed:* the hint now reads `PRESS 0 = LOCAL MODE`, is drawn on both pages, and
stays up until you act on it instead of expiring after two seconds.

### 2. Entering local mode tore down the USB link — and reset the board

`src/services/serial.ts` rejected any telemetry packet whose `control_mode` was
not `DASHBOARD`. So the first sample after you pressed `0` threw
`device left dashboard mode`, which called `fault()` → latched closure →
`disconnect()`. Closing a Web Serial port toggles DTR/RTS, and most ESP32 dev
boards auto-reset on that transition. The board rebooted, `localDemo` went back
to `false`, and `A`–`D` were dead again.

That is the loop you were in: press `0`, board resets, press `A`, nothing.

*Fixed:* the dashboard now accepts `LOCAL_LED_TEST` telemetry, stops sending
commands, suspends the acknowledgement watchdog, and shows
`LOCAL KEYPAD OVERRIDE • dashboard commands suspended` in the existing status
line. The link stays open, so the board does not reset. Press `0` again and
control returns to the dashboard.

### 3. Dashboard commands extinguished the LEDs once per second

`invalidateCommand()` called `outputs(false,false)` unconditionally. While
`localDemo` was true the firmware answered every incoming command with reason
`LOCAL_LED_TEST` and then ran `invalidateCommand()` — and the dashboard sends a
command on every sample, about once per second. An LED lit by `C` was
extinguished within a second.

Reproduced in the native harness before the fix:

```
handleKey('0'); handleKey('C');   // mainOpen == true
command(50,"CLOSED","CLOSED");    // mainOpen == false   <-- stomped
```

*Fixed:* `invalidateCommand()` leaves the outputs alone while `localDemo` is
true. The same guard was applied to the `calibrate` branch, which also closed
the outputs before checking whether local mode was active.

### 4. Minor

`handleKey()` ran on every loop iteration with `NO_KEY`. `keypadTick()` now
returns early.

## Ownership rules after the fix

| Situation | Who owns the outputs |
|---|---|
| Dashboard connected, `localDemo` false | Dashboard, subject to the sensor/freshness gate |
| `0` pressed | Keypad. Host commands are acknowledged and refused; TTL sweep is suspended |
| `0` pressed again | Outputs close, dashboard resumes with the closed-only handshake |
| Host sends `hello` | Local override is revoked and outputs close |

Both mode transitions start from closed, in both directions.

`0` is still ignored unless `LED_EMULATOR` is true, so a commissioned
valve driver build cannot be put into local mode from the keypad at all. That
guard was already there and is unchanged.

## Pin reference (unchanged)

```
rows  19, 18, 15, 14
cols  13, 12, 26, 25
```

## If `*` does nothing

The firmware fixes will not help; check these in order.

1. **Ribbon offset by one.** The commonest fault. An 8-pin membrane keypad
   plugged one position across makes every key read as nothing. Count from the
   marked pin 1.
2. **Rows and columns swapped.** The library still returns keys if you swap
   them wholesale, but the *mapping* transposes — `A` becomes `*`, etc. If keys
   register but do the wrong thing, swap `rowPins` and `colPins`.
3. **GPIO 12 at boot.** GPIO 12 is a strapping pin (MTDI). If a key in that
   column is held down during power-up, the pulled-up row pulls GPIO 12 high
   and the ESP32 comes up with the wrong flash voltage. Do not hold keys while
   resetting; if the board is unreliable at boot, move that column to a free
   GPIO such as 16.
4. **Continuity.** With the board off, put a meter across the header pins and
   press a key; you should see a short between one row pin and one column pin.

## Verification

- `sh tests/native/run.sh` — native firmware integration, including the new
  local-override isolation cases.
- `npm test` — 38 tests, including the rewritten serial contract.
- `npm run build` — clean.

Not verified: ESP32 target compilation and the physical keypad. Neither the
Arduino toolchain nor the hardware was available here, so the LED behaviour on
your bench is the real test.
