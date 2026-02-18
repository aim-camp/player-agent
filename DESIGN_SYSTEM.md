# Player Agent — Design System Reference

> **App:** aim.camp Player Agent (Tauri Desktop App)  
> **Theme Engine:** Dynamic CSS injection via `THEMES[]` array in `main.ts`  
> **Source files:** `src/style.css` (3613 lines) · `src/main.ts` (5641 lines)

---

## 1. Color Tokens

### 1.1 CSS Custom Properties (`:root`)

```css
:root {
  color-scheme: dark;

  /* Backgrounds */
  --bg-deep:      #030712;                         /* page background */
  --bg-card:      rgba(8, 12, 28, 0.92);           /* card surface */

  /* Borders */
  --border-glow:  rgba(0, 255, 170, 0.12);         /* accent-tinted border */
  --border-dim:   rgba(255, 255, 255, 0.04);        /* subtle neutral border */

  /* Accent / Semantic */
  --accent:       #00ffaa;                          /* primary action color */
  --danger:       #ff4444;                          /* destructive / error */

  /* Text */
  --text-main:    #e2e8f0;                          /* primary text */
  --text-muted:   #64748b;                          /* secondary / label text */

  /* Neon Palette */
  --neon-green:   #00ffaa;                          /* primary accent (remapped per theme) */
  --neon-cyan:    #22d3ee;                          /* secondary accent (remapped per theme) */
  --neon-purple:  #a855f7;                          /* tertiary / advisor features */

  /* Glow Shadows */
  --glow-sm:      0 0 6px rgba(0, 255, 170, 0.3);
  --glow-md:      0 0 14px rgba(0, 255, 170, 0.25), 0 0 40px rgba(0, 255, 170, 0.08);
}
```

### 1.2 Hard-coded Semantic Colors

| Token / Hex | Usage |
|---|---|
| `#020617` | Button text on primary gradient (near-black) |
| `#1e293b` | Unchecked toggle background |
| `#475569` | Unchecked toggle knob |
| `#111827` | LED inactive background |
| `#3b82f6` | LED active (blue), import button base |
| `#93c5fd` | Import button text |
| `#fb923c` | Run button warm orange |
| `#ef4444` | Run button end red, danger states |
| `#f59e0b` | Info badge amber, warning states |
| `#eab308` | Ping "ok" warning yellow |
| `#fbbf24` | Star rating, pending indicator |
| `#84cc16` | Tooltip FPS impact color |
| `#4ade80` | Save button / success green |
| `#a78bfa` | Copy button / purple accent |
| `#c084fc` | Advisor button text |
| `rgba(245, 158, 11, …)` | Info-row amber background tints |
| `rgba(168, 85, 247, …)` | Advisor feature purple tints |

### 1.3 Opacity Conventions

Backgrounds use an alpha-channel scale based on the theme primary color (`pc`):

| Alpha | Usage |
|---|---|
| `0.02` | Row resting background |
| `0.04` | Subtle surface tint, counters |
| `0.06` | Row hover background |
| `0.08` | Active selection light |
| `0.10` | Sidebar active background |
| `0.12` | Border glow, separators |
| `0.15` | Input borders, status toast bg |
| `0.18` | Card hover border |
| `0.20` | Checked toggle background |
| `0.25` | Import button border |
| `0.30` | Glow shadows, active dot |
| `0.40` | Toast border, name text-shadow |
| `0.50` | Checked toggle border |

---

## 2. Typography

### 2.1 Font Families

```css
/* Google Fonts import */
@import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;600;700&display=swap");
```

| Font | Role | Fallback Stack |
|---|---|---|
| **Orbitron** | Headlines, labels, buttons, badges | `monospace` |
| **Rajdhani** | Body text, inputs, descriptions, signatures | `"Segoe UI", system-ui, sans-serif` or `monospace` |
| **Cascadia Code / Fira Code** | Code editor areas (textarea, autoexec) | `monospace` |

### 2.2 Font Size Scale

| Size | Usage |
|---|---|
| `5.5px` | Sidebar section labels |
| `7px` | Sidebar button labels |
| `8px` | Tooltip badges, dropdown arrows |
| `9px` | Info badge, signature community, impact label, tooltip via/method |
| `10px` | Header subtitle, tips heading, textarea code, helper text |
| `11px` | Tip text, tooltip title/desc, advisor buttons, cfg counter |
| `12px` | Card headings (12.5px), sub-tab buttons, inputs, action buttons, signature, theme names, dropdown items |
| `13px` | Base body text, toggle/input row labels, impact pct/fps, signature name |
| `14px` | Minimize button icon |
| `18px` | App title (h1) |

### 2.3 Font Weights

| Weight | Usage |
|---|---|
| `400` | Body labels, muted text, `.sig-by` |
| `500` | Tip text, minor labels |
| `600` | Sub-tab buttons, toggle rows, dropdown items, sidebar labels, signature tag |
| `700` | Card headings, sidebar buttons, action buttons, inputs, signatures, toggle labels, toast |
| `900` | App title (h1), impact pct/fps, info badges |

### 2.4 Letter-Spacing Scale

| Value | Context |
|---|---|
| `0.04em` | Sub-tab buttons, subtitle |
| `0.05em` | Impact pct/fps |
| `0.06em` | Sidebar buttons, toast, impact labels |
| `0.08em` | Action buttons, signature |
| `0.10em` | Card h2 headings |
| `0.12em` | App title, sig-name, sig-community, tips heading, sidebar labels |
| `0.14em` | App title h1 |
| `0.3px` | Tooltip title, provider tags |
| `0.5px` | Tooltip badges |
| `1px` | Dropdown section headers |

---

## 3. Spacing & Layout

### 3.1 Container Structure

```
┌──────────────────────────────────────────────────┐
│  body (flex, 100vw × 100vh, overflow: hidden)    │
│  ┌────────┬───────────────────────────────────┐  │
│  │sidebar │  .app-container                    │  │
│  │ 56px   │  padding: 4px 12px                 │  │
│  │        │  gap: 3px                          │  │
│  │        │  ┌─ .app-header ──────────────┐   │  │
│  │        │  │  gap: 10px, pb: 2px        │   │  │
│  │        │  ├─ .sub-tab-bar ─────────────┤   │  │
│  │        │  │  padding: 0 8px            │   │  │
│  │        │  ├─ .app-main (grid) ─────────┤   │  │
│  │        │  │  gap: 4px, padding: 4px    │   │  │
│  │        │  │  minmax(280px, 1fr) cols    │   │  │
│  │        │  ├─ .actions ─────────────────┤   │  │
│  │        │  │  gap: 8px, min-h: 34px     │   │  │
│  │        │  └────────────────────────────┘   │  │
│  └────────┴───────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.2 Key Dimensions

| Element | Property | Value |
|---|---|---|
| Sidebar | width | `56px` |
| Sidebar button | min-height | `35px` |
| Sidebar button SVG | size | `20px × 20px` |
| Container | padding | `4px 12px` |
| Container | gap | `3px` |
| Grid | gap | `4px` |
| Grid column | min-width | `280px` |
| Action bar | gap | `8px` |
| Action bar | min-height | `34px` |
| Action buttons | padding | `0 18px` |
| Card | padding | `4px 6px` |
| Toggle row | padding | `0 5px` |
| Toggle row spacing | margin-top | `1px` (between rows) |
| Checkbox toggle | size | `26px × 14px` |
| Checkbox knob | size | `8px × 8px` |
| LED indicator | size | `6px × 6px` |
| Number input | width | `58px` |
| Sub-tab button | padding | `7px 16px 6px` |
| Minimize button | size | `28px × 22px` |
| Theme button | size | `28px × 22px` |
| Logo icon | size | `24px × 24px` (header), `22px × 22px` (inline) |
| Tooltip | max-width | `340px`, min-width `180px` |
| Tooltip | padding | `10px 14px` |
| Toast | padding | `10px 20px` |
| Impact bar | padding | `3px 12px` |

### 3.3 Gap Values Used

`0` · `2px` · `3px` · `4px` · `5px` · `6px` · `8px` · `10px` · `12px` · `18px`

### 3.4 Border-Radius Scale

| Value | Usage |
|---|---|
| `0` | Sidebar buttons |
| `1px` | Theme Raz badges |
| `2px` | Theme Raz cards |
| `3px` | Toggle/input rows, inputs, tooltip badges |
| `4px` | Action buttons, impact bar, tip items, toast, dropdowns |
| `5px` | Cards, provider links, dropdown items |
| `6px` | Card ::before, theme dropdown, advisor response, update modal |
| `8px` | Dropdown menu, tooltip, Space theme cards |
| `50%` | LED, checkbox knob, theme dot, info badge |
| `999px` | Checkbox track (pill shape) |

---

## 4. Component Patterns

### 4.1 Card (`.card`)

```css
.card {
  background: var(--bg-card);           /* rgba(8, 12, 28, 0.92) */
  border-radius: 5px;
  padding: 4px 6px;
  border: 1px solid var(--border-dim);  /* rgba(255,255,255,0.04) */
  position: relative;
  transition: border-color 0.2s;
  display: flex;
  flex-direction: column;
}
/* Gradient overlay */
.card::before {
  background: linear-gradient(180deg, rgba(0,255,170,0.03) 0%, transparent 40%);
}
/* Hover glow */
.card:hover {
  border-color: rgba(0, 255, 170, 0.18);
}
/* Card title */
.card h2 {
  font-family: "Orbitron", monospace;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--neon-green);
  border-bottom: 1px solid rgba(0,255,170,0.08);
}
```

### 4.2 Toggle Row (`.toggle-row`)

```css
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 3px;
  flex: 1;                              /* stretches to fill card evenly */
  background: rgba(0, 255, 170, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.02);
  transition: background 0.15s, border-color 0.15s;
}
.toggle-row:hover {
  background: rgba(0, 255, 170, 0.06);
  border-color: rgba(0, 255, 170, 0.12);
}
```

**Custom Toggle Checkbox:**
- Track: `26px × 14px`, pill (`border-radius: 999px`), bg `#1e293b`
- Knob: `8px × 8px`, circle, bg `#475569`
- Checked track: `rgba(0,255,170,0.2)`, border `rgba(0,255,170,0.5)`, glow `var(--glow-sm)`
- Checked knob: `translateX(10px)`, bg `var(--neon-green)`, glow `0 0 6px var(--neon-green)`

### 4.3 Action Buttons

**Export (Primary Action) — `.btn-export`:**
```css
.btn-export {
  background: linear-gradient(135deg, #00ffaa, #00cc88);
  color: #020617;
  box-shadow: 0 0 12px rgba(0,255,170,0.3), 0 4px 20px rgba(0,255,170,0.15);
}
.btn-export:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 20px rgba(0,255,170,0.5), 0 6px 30px rgba(0,255,170,0.2);
  filter: brightness(1.1);
}
```

**Import (Secondary) — `.btn-import`:**
```css
.btn-import {
  background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.1));
  border: 1px solid rgba(59,130,246,0.25);
  color: #93c5fd;
  box-shadow: 0 0 8px rgba(59,130,246,0.15);
}
```

**Run (Danger/Warm) — `.btn-run`:**
```css
.btn-run {
  background: linear-gradient(135deg, #fb923c, #ef4444);
  color: #1c0800;
  box-shadow: 0 0 12px rgba(251,146,60,0.3), 0 4px 20px rgba(251,146,60,0.15);
}
```

**Advisor Button — `.btn-adv`:**
```css
.btn-adv {
  background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.1));
  border: 1px solid rgba(168,85,247,0.25);
  color: #c084fc;
  padding: 5px 12px;
  border-radius: 4px;
  font-family: "Rajdhani", monospace;
  font-size: 11px;
  font-weight: 700;
}
```

**Common Button Traits:**
- All action buttons: `font-family: "Orbitron", monospace; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;`
- Hover: `transform: translateY(-1px); filter: brightness(1.1);`
- Active: `transform: translateY(0);`
- Border-radius: `4px`

### 4.4 Sidebar Button (`.sidebar-btn`)

```css
.sidebar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 35px;
  flex: 1;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text-muted);
  font-family: "Orbitron", monospace;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  padding: 4px 0;
}
.sidebar-btn svg { width: 20px; height: 20px; }
.sidebar-btn:hover {
  background: rgba(0, 255, 170, 0.06);
  color: var(--text-main);
}
.sidebar-btn.active {
  background: rgba(0, 255, 170, 0.1);
  border-left-color: var(--neon-green);
  color: var(--neon-green);
}
```

**Sidebar Label (`.sidebar-label`):**
```css
.sidebar-label {
  font-family: "Orbitron", monospace;
  font-size: 5.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.25);
  padding: 4px 0;
  text-align: center;
}
```

**Sidebar Separator (`.sidebar-sep`):**
```css
.sidebar-sep {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
}
```

### 4.5 Sub-Tab Bar (`.sub-tab-bar`, `.sub-tab-btn`)

```css
.sub-tab-bar {
  display: flex;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-glow);
  background: rgba(0, 0, 0, 0.15);
  overflow-x: auto;
}
.sub-tab-btn {
  background: transparent;
  color: var(--text-muted);
  font-family: "Rajdhani", monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 7px 16px 6px;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.2s, background 0.15s;
  white-space: nowrap;
}
.sub-tab-btn:hover {
  color: var(--text-main);
  background: rgba(255,255,255,0.03);
}
.sub-tab-btn.active {
  color: var(--neon-green);          /* remapped to theme primary */
  border-bottom-color: var(--neon-green);
  background: rgba(255,255,255,0.04);
}
```

### 4.6 Tooltip System (`.ac-tooltip`)

```css
.ac-tooltip {
  position: fixed;
  z-index: 99999;
  max-width: 340px;
  min-width: 180px;
  padding: 10px 14px;
  background: rgba(13, 17, 23, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  font-family: "Rajdhani", system-ui, sans-serif;
}
.ac-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Tooltip sub-elements:**

| Class | Font | Size | Color |
|---|---|---|---|
| `.tt-title` | Orbitron | 11px / 700 | `var(--neon-green)` |
| `.tt-desc` | (inherit) | 11px | `rgba(255,255,255,0.75)` |
| `.tt-via` | Rajdhani mono | 9px | `rgba(255,255,255,0.35)` |
| `.tt-method` | (inherit) | 9px | `rgba(255,255,255,0.3)` |
| `.tt-impact` | Orbitron | 10px / 700 | `#84cc16` on `rgba(132,204,22,0.08)` bg |
| `.tt-badge.auto` | Orbitron | 8px / 700 | `#4ade80` on green bg |
| `.tt-badge.manual` | Orbitron | 8px / 700 | `#fbbf24` on amber bg |
| `.tt-badge.info` | Orbitron | 8px / 700 | `#60a5fa` on blue bg |

### 4.7 Dropdown Menu (`.cfg-dropdown-wrap`)

```css
.cfg-dropdown-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  min-width: 200px;
  background: rgba(13, 17, 23, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(16px);
  padding: 4px;
  z-index: 9000;
  max-height: 400px;
  overflow-y: auto;
  /* closed state */
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity 0.15s, transform 0.15s;
}
.cfg-dropdown-menu.open {
  opacity: 1;
  transform: translateY(-4px);
  pointer-events: auto;
}
.cfg-dd-item {
  padding: 6px 10px;
  border-radius: 5px;
  font-family: "Rajdhani", sans-serif;
  font-size: 12px;
  font-weight: 600;
}
.cfg-dd-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
```

### 4.8 Status Toast (`.status-toast`)

```css
.status-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999;
  padding: 10px 20px;
  border-radius: 4px;
  font-family: "Orbitron", monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: rgba(0, 255, 170, 0.15);
  border: 1px solid rgba(0, 255, 170, 0.4);
  color: var(--neon-green);
  box-shadow: var(--glow-md);
  animation: toastIn 0.3s ease-out, toastOut 0.3s 2.5s ease-in forwards;
}
.status-toast.toast-error {
  background: rgba(255, 68, 68, 0.15);
  border-color: rgba(255, 68, 68, 0.4);
  color: var(--danger);
}
```

### 4.9 LED Indicator (`.led`)

```css
.led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.5s ease;
}
.led.active {
  background: #3b82f6;
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 4px #3b82f6, 0 0 10px rgba(59, 130, 246, 0.35);
}
```

---

## 5. Effects

### 5.1 Box-Shadow Patterns

| Token / Pattern | Value |
|---|---|
| `--glow-sm` | `0 0 6px rgba(0,255,170,0.3)` |
| `--glow-md` | `0 0 14px rgba(0,255,170,0.25), 0 0 40px rgba(0,255,170,0.08)` |
| Button primary | `0 0 12px rgba(pc,0.3), 0 4px 20px rgba(pc,0.15)` |
| Button hover | `0 0 20px rgba(pc,0.5), 0 6px 30px rgba(pc,0.2)` |
| LED active | `0 0 4px color, 0 0 10px rgba(color,0.35)` |
| Dropdown/Tooltip | `0 8px 32px rgba(0,0,0,0.6)` |
| Toast | `var(--glow-md)` |
| Space theme card | `0 0 20px -8px rgba(126,184,255,0.04)` |
| Space active sidebar | `inset 3px 0 12px -4px rgba(126,184,255,0.15)` |

### 5.2 Backdrop-Filter Blur Values

| Value | Usage |
|---|---|
| `blur(4px)` | Light overlays, feedback context, modals |
| `blur(12px)` | Theme dropdown |
| `blur(16px)` | Cfg dropdown menu, tooltip, feedback detail modal |

### 5.3 Transitions

**Standard durations:**

| Duration | Easing | Usage |
|---|---|---|
| `0.1s` | linear | Button `transform`, dropdown item hover |
| `0.12s` | ease-out | Context menu animation, minor hovers |
| `0.15s` | ease / ease-out | **Most common** — background, color, border-color, opacity, transform |
| `0.2s` | ease | Border-color, checkbox states, sub-tab border |
| `0.3s` | ease-out / ease-in | Toast in/out |
| `0.5s` | ease | LED state change |
| `3s` | ease-in-out | Signature pulse loop |

### 5.4 Animations / Keyframes

```css
@keyframes sig-pulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.85; }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes toastOut {
  from { opacity: 1; }
  to   { opacity: 0; transform: translateY(-10px); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fdbkCtxIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

### 5.5 Border Glow & Gradient Effects

- **Card top gradient:** `linear-gradient(180deg, rgba(pc,0.03) 0%, transparent 40%)`
- **Body background:** Triple radial gradient with subtle primary/secondary tints over `#030712 → #060a1a → #030712`
- **Body grid pattern:** SVG triangular grid at `60px × 60px`, stroke opacity `0.03`
- **Header title:** `linear-gradient(135deg, primary, secondary, tertiary)` with `-webkit-background-clip: text` + `drop-shadow`
- **Button hover:** `filter: brightness(1.1)` + enhanced `box-shadow`
- **Sidebar separator:** `linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)`

---

## 6. Icon System

### 6.1 SVG Icons (Sidebar)

All sidebar icons are **inline SVG**, `20px × 20px`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`.

| Tab | Label | Icon Description |
|---|---|---|
| System | `SYS` | Gear/settings cog |
| CFG Manager | `CFG` | Server rack |
| Hardware | `HW` | Chip/CPU |
| Drivers | `DRV` | Package/box |
| Processes | `PROC` | Lightning bolt |
| Network | `NET` | WiFi signal |
| Demo Review | `DEMO` | Play circle |
| Feedback | `FDBK` | Chat bubble |
| Benchmark | `BNCH` | Bar chart |
| Rankings | `RANK` | Trophy/scroll |
| Servers | `SRVS` | Server stack |
| Market | `MRKT` | Shopping cart |
| Hub | `HUB` | Home |

### 6.2 Icon Sizes Used

| Size | Context |
|---|---|
| `12px × 12px` | X (Twitter) social icon, copy icon |
| `14px × 14px` | Inline action icons, hardware detail icons, advisor button icon |
| `16px × 16px` | Theme palette icon |
| `20px × 20px` | Sidebar tab icons |
| `22px × 22px` | Header logo icon |
| `24px × 24px` | Header logo feather container |

### 6.3 Emoji Usage

Emojis are used for:
- **Tip icons** (`.tip-icon`) — contextual hints
- **Dropdown item icons** (`.cfg-dd-icon` at 13px)
- **Info badges** — "ℹ" character in `.info-badge`
- **Pending indicator** — `⬤ pendente` pseudo-element

---

## 7. Theme System

### 7.1 Architecture

1. **`THEMES` array** in `main.ts` defines 13 themes, each with `name`, `primary`, and `secondary` hex colors.
2. **`applyTheme(idx)`** is called on selection:
   - Updates CSS custom properties: `--neon-green`, `--accent`, `--neon-cyan`, `--border-glow`, `--glow-sm`, `--glow-md`
   - Injects a `<style id="dynamic-theme-css">` element with ~120 CSS overrides using `!important`
   - Helper functions: `hexToRgba()`, `darken()`, `blend()`
   - Special body classes for `Raz` and `Space` themes
3. Default theme index: **11** (Raz)

### 7.2 Theme Palette

| # | Name | Primary | Secondary | Character |
|---|---|---|---|---|
| 0 | **Matrix** | `#00ffaa` | `#3b82f6` | Default neon green + blue |
| 1 | **Cyberpunk** | `#ff00ff` | `#00ffff` | Magenta + cyan |
| 2 | **Sunset** | `#ff6b35` | `#f7c948` | Orange + gold |
| 3 | **Arctic** | `#00d4ff` | `#a78bfa` | Ice blue + lavender |
| 4 | **Crimson** | `#ff2d55` | `#ff9500` | Hot pink + orange |
| 5 | **Emerald** | `#10b981` | `#06b6d4` | Green + teal |
| 6 | **Phantom** | `#a855f7` | `#ec4899` | Purple + pink |
| 7 | **Amber** | `#f59e0b` | `#ef4444` | Gold + red |
| 8 | **Frost** | `#60a5fa` | `#34d399` | Soft blue + mint |
| 9 | **Volcano** | `#dc2626` | `#fb923c` | Deep red + orange |
| 10 | **Neon Lime** | `#84cc16` | `#22d3ee` | Lime + cyan |
| 11 | **Raz** | `#00ff6a` | `#44ff99` | Bright green duo (default) |
| 12 | **Space** | `#7eb8ff` | `#b4a0ff` | Soft blue + lavender |

### 7.3 Special Theme Overrides

**Raz** (`body.theme-raz`):
- Flat black background: `#0a0a0a`, sidebar `#0d0d0d`, cards `#111111`
- Removes body grid pattern (`background: none`)
- Reduces border-radius to `1px`–`2px` (sharp, minimal aesthetic)
- Adds inset glow on active sidebar: `inset 3px 0 12px -4px rgba(0,255,106,0.15)`
- Tighter letter-spacing: `0.1em`–`0.15em`

**Space** (`body.theme-space`):
- Cosmic background: triple radial gradient with blues/purples over `#030510`
- Star-field pattern via SVG circles (replaces triangular grid)
- Increases border-radius to `6px`–`8px` (softer, rounded aesthetic)
- Cards get subtle outer glow: `box-shadow: 0 0 20px -8px rgba(126,184,255,0.04)`
- Hover amplifies glow: `box-shadow: 0 0 24px -6px rgba(126,184,255,0.08)`

### 7.4 Dynamic CSS Injection (excerpt)

The `applyTheme()` function uses template literals to generate CSS with the theme's `primary` (`pc`) and `secondary` (`sc`) colors. Run button color is computed via `blend(pc, "#fb923c", 0.25)`. Key pattern:

```typescript
function applyTheme(idx: number) {
  const t = THEMES[idx];
  const pc = t.primary;
  const sc = t.secondary;

  // Update CSS custom properties
  s.setProperty("--neon-green", pc);
  s.setProperty("--accent", pc);
  s.setProperty("--neon-cyan", sc);
  s.setProperty("--border-glow", hexToRgba(pc, 0.12));
  s.setProperty("--glow-sm", `0 0 6px ${hexToRgba(pc, 0.3)}`);
  s.setProperty("--glow-md", `0 0 14px ${hexToRgba(pc, 0.25)}, 0 0 40px ${hexToRgba(pc, 0.08)}`);

  // Inject <style> with ~120 selectors using pc/sc + !important
  el.textContent = `
    .card:hover { border-color: ${hexToRgba(pc, 0.18)} !important; }
    .btn-export { background: linear-gradient(135deg, ${pc}, ${darken(pc, 30)}) !important; }
    /* ... ~120 more rules ... */
  `;
}
```

---

## 8. Responsive Breakpoints

```css
@media (max-width: 900px) {
  .app-main, .cfg-grid, .hw-grid, .net-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .proc-grid, .demo-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .app-container { padding: 8px; }
  .app-header { flex-direction: column; align-items: flex-start; }
  .app-main, .cfg-grid, .hw-grid, .net-grid, .demo-body {
    grid-template-columns: 1fr;
  }
}
```

---

## 9. Z-Index Layers

| Value | Element |
|---|---|
| `0` | Body grid pattern (`::before`) |
| `1` | `#app` container |
| `10` | Sidebar |
| `100` | Theme dropdown |
| `999` | Status toast |
| `9000` | CFG dropdown menu |
| `99999` | Tooltip |
