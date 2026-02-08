import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { open as shellOpen } from '@tauri-apps/api/shell';
import './style.css';

/* ================================================================
   TypeScript interfaces – mirrors Rust structs
   ================================================================ */

interface BiosConfig {
  disable_svm: boolean;
  disable_c_states: boolean;
  disable_cool_n_quiet: boolean;
  enable_xmp: boolean;
  enable_resize_bar: boolean;
  enable_above_4g: boolean;
}

interface WindowsConfig {
  ultimate_power_plan: boolean;
  disable_game_dvr: boolean;
  disable_game_bar: boolean;
  disable_game_mode: boolean;
  disable_hibernation: boolean;
  disable_mouse_accel: boolean;
  disable_fullscreen_optim: boolean;
  disable_visual_effects: boolean;
  disable_transparency: boolean;
  disable_background_apps: boolean;
  disable_notifications: boolean;
  disable_cortana: boolean;
  disable_search_indexing: boolean;
  hardware_gpu_scheduling: boolean;
  disable_hpet: boolean;
  disable_power_throttling: boolean;
  disable_core_parking: boolean;
  clean_temp_files: boolean;
  cs2_high_performance_gpu: boolean;
  disable_delivery_optim: boolean;
  disable_widgets: boolean;
  disable_memory_compression: boolean;
  disable_connected_ux: boolean;
  disable_spectre: boolean;
  disable_last_access: boolean;
  disable_8dot3: boolean;
  mmcss_gaming: boolean;
  disable_large_cache: boolean;
}

interface NetworkConfig {
  disable_nagle: boolean;
  optimize_tcp: boolean;
  flush_dns: boolean;
  disable_wifi_power_save: boolean;
  disable_network_throttle: boolean;
  disable_ecn: boolean;
  enable_rss: boolean;
  disable_netbios: boolean;
  disable_lmhosts: boolean;
  enable_ctcp: boolean;
}

interface NvidiaConfig {
  prefer_max_perf: boolean;
  disable_vsync: boolean;
  low_latency_ultra: boolean;
  threaded_optimization: boolean;
  disable_anisotropic: boolean;
  shader_cache_clear: boolean;
  force_reflex: boolean;
  disable_sharpening: boolean;
  texture_filter_perf: boolean;
  pre_rendered_frames_1: boolean;
  disable_ambient_occlusion: boolean;
  disable_fxaa: boolean;
}

interface ServicesConfig {
  disable_sysmain: boolean;
  disable_diagtrack: boolean;
  disable_wsearch: boolean;
  disable_print_spooler: boolean;
  disable_fax: boolean;
  disable_xbox_services: boolean;
  disable_cdp: boolean;
  disable_wpn: boolean;
  disable_diagnostic_policy: boolean;
  disable_remote_registry: boolean;
  disable_maps_broker: boolean;
  disable_phone_service: boolean;
  disable_retail_demo: boolean;
}

interface AutoexecConfig {
  enabled: boolean;
  fps_max: string;
  rate: string;
  cl_interp: string;
  cl_interp_ratio: string;
  cl_updaterate: string;
  cl_cmdrate: string;
  sensitivity: string;
  viewmodel_fov: string;
  m_rawinput: boolean;
  net_graph: boolean;
  custom_commands: string;
}

interface LaunchOptionsConfig {
  novid: boolean;
  tickrate_128: boolean;
  nojoy: boolean;
  high_priority: boolean;
  threads: string;
  exec_autoexec: boolean;
  custom_args: string;
}

interface ExtrasConfig {
  faceit_admin: boolean;
  disable_steam_overlay: boolean;
  disable_discord_overlay: boolean;
  system_responsiveness: boolean;
  gpu_priority: boolean;
  priority_separation: boolean;
  cs2_process_priority: boolean;
  disable_telemetry_tasks: boolean;
  timer_resolution: boolean;
  msi_mode_gpu: boolean;
  pcie_link_state_off: boolean;
  interrupt_moderation_off: boolean;
  enable_large_pages: boolean;
}

interface OptimizationConfig {
  bios: BiosConfig;
  windows: WindowsConfig;
  network: NetworkConfig;
  nvidia: NvidiaConfig;
  services: ServicesConfig;
  autoexec: AutoexecConfig;
  launch_options: LaunchOptionsConfig;
  extras: ExtrasConfig;
  theme_primary: string;
  theme_secondary: string;
}

/* ================================================================
   State
   ================================================================ */
let currentScriptPath = '';

/* ================================================================
   Color Themes
   ================================================================ */
interface Theme { name: string; primary: string; secondary: string; }

const THEMES: Theme[] = [
  { name: 'Matrix',       primary: '#00ffaa', secondary: '#3b82f6' },
  { name: 'Cyberpunk',    primary: '#ff00ff', secondary: '#00ffff' },
  { name: 'Sunset',       primary: '#ff6b35', secondary: '#f7c948' },
  { name: 'Arctic',       primary: '#00d4ff', secondary: '#a78bfa' },
  { name: 'Crimson',      primary: '#ff2d55', secondary: '#ff9500' },
  { name: 'Emerald',      primary: '#10b981', secondary: '#06b6d4' },
  { name: 'Phantom',      primary: '#a855f7', secondary: '#ec4899' },
  { name: 'Amber',        primary: '#f59e0b', secondary: '#ef4444' },
  { name: 'Frost',        primary: '#60a5fa', secondary: '#34d399' },
  { name: 'Volcano',      primary: '#dc2626', secondary: '#fb923c' },
  { name: 'Neon Lime',    primary: '#84cc16', secondary: '#22d3ee' },
];

let currentThemeIdx = 10;

/* ================================================================
   FPS Impact Map — % improvement per feature
   Based on community benchmarks (TechPowerUp, Tom's Hardware,
   Calypto, Reddit CS2 communities, FrameChasers, Battle(non)sense).
   Values represent FPS % gain on a mid-range system in CS2.
   Gains vary with hardware; these are averages.
   ================================================================ */
const IMPACT: Record<string, number> = {
  /* BIOS — informational only (manual BIOS settings), not in estimate */

  /* Windows */
  w_power:  3.0,  // Ultimate Performance plan — 2-5%
  w_dvr:    2.5,  // Game DVR off — 2-4% (encoder overhead)
  w_bar:    1.0,  // Game Bar off — 0.5-1.5% overlay overhead
  w_mode:   1.0,  // Game Mode off — 0-2% inconsistent
  w_hib:    0.5,  // Hibernation off — stability, <1% FPS
  w_mouse:  0.0,  // Mouse accel — aim quality, no FPS
  w_fso:    2.0,  // Fullscreen Optim off — 1-3% + input lag
  w_vis:    0.5,  // Visual Effects off — <1% in-game
  w_trans:  0.5,  // Transparency off — <1%
  w_bgapps: 2.0,  // Background apps off — 1-3%
  w_notif:  0.5,  // Notifications off — <0.5%
  w_cort:   0.5,  // Cortana off — <1%
  w_idx:    1.5,  // Search indexing off — 1-2% (disk I/O)
  w_hgs:    2.0,  // HAGS — 1-3% on RTX 30/40
  w_hpet:   3.0,  // HPET off — 2-5% DPC latency
  w_pthrot: 1.0,  // Power throttling off — 0.5-1.5%
  w_park:   1.5,  // Core parking off — 1-2%
  w_temp:   0.0,  // Cleanup — no FPS
  w_cs2gpu: 1.0,  // GPU preference — 0-2% (laptops)
  w_deliver: 1.0,  // Delivery Optimization off — reduces background bandwidth
  w_widgets: 0.5,  // Widgets off — saves RAM + CPU (Win11)
  w_memcomp: 1.0,  // Memory Compression off — reduces CPU for mem management
  w_uxuser:  0.5,  // Connected UX off — telemetry + background activity
  w_spectre: 8.0,  // CPU mitigations off — 5-30% (CPU-dependent, security risk)
  w_lastaccess: 0.5, // NTFS Last Access off — reduces disk writes
  w_8dot3:   0.5,  // 8.3 name creation off — reduces NTFS overhead
  w_mmcss:   1.5,  // MMCSS gaming priority — scheduler boost for games
  w_largecache: 1.0, // Large System Cache off — frees RAM for games

  /* Network — latency, not FPS */
  n_nagle: 0.0,
  n_tcp:   0.0,
  n_dns:   0.0,
  n_wifi:  0.0,
  n_throttle: 1.0,  // Network Throttling off — 10 default packets/ms → unlimited
  n_ecn:      0.0,  // ECN off — latency, not FPS
  n_rss:      0.0,  // RSS on — latency, not FPS
  n_netbios:  0.0,  // NetBIOS off — legacy protocol, latency only
  n_lmhosts:  0.0,  // LMHOSTS off — legacy DNS, latency only
  n_ctcp:     0.0,  // CTCP — congestion control, latency only

  /* NVIDIA */
  nv_perf:   3.0,  // Max perf — 2-5% prevents downclocking
  nv_vsync:  2.0,  // VSync off — removes frame cap, less queue
  nv_lat:    1.5,  // Ultra low latency — <1% FPS, big input lag win
  nv_thread: 1.5,  // Threaded optimization — 1-2%
  nv_aniso:  0.5,  // App-controlled AF — <1%
  nv_shader: 0.0,  // Cache clear — no lasting FPS gain
  nv_reflex: 1.5,  // Reflex On+Boost — input latency + slight FPS variance
  nv_sharp:  0.5,  // Image Sharpening off — frees GPU post-process
  nv_texfilt: 0.5,  // Texture filtering perf — less GPU filtering work
  nv_prerender: 1.0, // Pre-rendered frames 1 — lower input lag
  nv_ambient: 1.0,  // Ambient Occlusion off — saves GPU cycles
  nv_fxaa:    0.5,  // FXAA off — removes forced antialiasing

  /* Services */
  s_sys:   1.5,   // SysMain off — 1-2% (RAM/disk)
  s_diag:  0.5,   // DiagTrack off — <1%
  s_ws:    1.0,   // WSearch off — 0.5-1.5%
  s_print: 0.0,   // Print Spooler — 0%
  s_fax:   0.0,   // Fax — 0%
  s_xbox:  0.5,   // Xbox services — <1%
  s_cdp:   0.5,   // Connected Devices Platform — <1%
  s_wpn:   0.5,   // WpnUserService — push notifications <1%
  s_diagpol: 0.5, // Diagnostic Policy — <1%
  s_remote:  0.0,  // Remote Registry — security, 0 FPS
  s_maps:    0.5,  // MapsBroker — background data <1%
  s_phonesvc: 0.0, // Phone Service — 0 FPS
  s_retaildemo: 0.0, // RetailDemo — 0 FPS

  /* Autoexec — marginal in-game */
  ae_on:   0.0,
  ae_raw:  0.0,

  /* Launch options */
  lo_exec:  0.0,
  lo_nvid:  0.0,
  lo_joy:   0.5,
  lo_high:  2.0,   // -high priority — 1-3%
  lo_allow: 0.0,

  /* Extras */
  x_faceit: 0.0,
  x_steam:  1.5,  // Steam overlay off — 1-2%
  x_disc:   1.0,  // Discord overlay off — 0.5-1.5%
  x_resp:   2.0,  // SystemResponsiveness=0 — 1-3%
  x_gpup:   1.0,  // GPU priority — 0.5-1.5%
  x_prio:   1.5,  // PrioritySeparation — 1-2%
  x_cs2p:   1.5,  // CS2 high priority — 1-2%
  x_telem:  0.5,  // Telemetry tasks — <1%
  x_timer:  1.0,  // Timer resolution — 0.5-1.5% input lag improvement
  x_msimode: 1.5,  // MSI mode GPU — reduces DPC latency 50-200us
  x_pcie:    1.0,  // PCIe Link State off — prevents GPU bus downclocking
  x_ndis:    0.5,  // Interrupt Moderation off — lower network latency
  x_large:   1.0,  // Large Pages — reduces TLB misses
};

/* ================================================================
   Color helpers
   ================================================================ */

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, pct: number): string {
  const r = Math.max(0, Number.parseInt(hex.slice(1, 3), 16) - pct);
  const g = Math.max(0, Number.parseInt(hex.slice(3, 5), 16) - pct);
  const b = Math.max(0, Number.parseInt(hex.slice(5, 7), 16) - pct);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function blend(hex1: string, hex2: string, ratio: number): string {
  const r1 = Number.parseInt(hex1.slice(1, 3), 16);
  const g1 = Number.parseInt(hex1.slice(3, 5), 16);
  const b1 = Number.parseInt(hex1.slice(5, 7), 16);
  const r2 = Number.parseInt(hex2.slice(1, 3), 16);
  const g2 = Number.parseInt(hex2.slice(3, 5), 16);
  const b2 = Number.parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

/* ================================================================
   Apply theme: bg, cards, buttons, LEDs…
   ================================================================ */

function applyTheme(idx: number) {
  currentThemeIdx = idx;
  const t = THEMES[idx];
  const s = document.documentElement.style;
  const pc = t.primary;
  const sc = t.secondary;

  s.setProperty('--neon-green', pc);
  s.setProperty('--accent', pc);
  s.setProperty('--neon-cyan', sc);
  s.setProperty('--border-glow', hexToRgba(pc, 0.12));
  s.setProperty('--glow-sm', `0 0 6px ${hexToRgba(pc, 0.3)}`);
  s.setProperty('--glow-md', `0 0 14px ${hexToRgba(pc, 0.25)}, 0 0 40px ${hexToRgba(pc, 0.08)}`);

  const el = document.getElementById('dynamic-theme-css') || (() => {
    const e = document.createElement('style');
    e.id = 'dynamic-theme-css';
    document.head.appendChild(e);
    return e;
  })();

  const pcHex = pc.slice(1);
  const runWarm = blend(pc, '#fb923c', 0.25);
  const runEnd  = blend(pc, '#ef4444', 0.15);

  el.textContent = `
    body {
      background:
        radial-gradient(ellipse 80% 60% at 15% 20%, ${hexToRgba(pc, 0.05)}, transparent),
        radial-gradient(ellipse 60% 50% at 85% 80%, ${hexToRgba(sc, 0.04)}, transparent),
        linear-gradient(170deg, #030712 0%, #060a1a 40%, #030712 100%) !important;
    }
    body::before {
      background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23${pcHex}' stroke-opacity='0.03'/%3E%3C/svg%3E") !important;
    }
    .card::before { background: linear-gradient(180deg, ${hexToRgba(pc, 0.03)} 0%, transparent 40%) !important; }
    .card:hover { border-color: ${hexToRgba(pc, 0.18)} !important; }
    .card h2 { color: ${pc} !important; border-bottom-color: ${hexToRgba(pc, 0.08)} !important; }
    .header-left h1 {
      background: linear-gradient(135deg, ${pc}, ${sc}) !important;
      -webkit-background-clip: text !important; background-clip: text !important;
      filter: drop-shadow(0 0 8px ${hexToRgba(pc, 0.4)}) !important;
    }
    .app-header { border-bottom-color: ${hexToRgba(pc, 0.12)} !important; }
    .toggle-row, .input-row { background: ${hexToRgba(pc, 0.02)} !important; }
    .toggle-row:hover, .input-row:hover {
      background: ${hexToRgba(pc, 0.06)} !important;
      border-color: ${hexToRgba(pc, 0.12)} !important;
    }
    .toggle-row input[type='checkbox']:checked {
      background: ${hexToRgba(pc, 0.2)} !important;
      border-color: ${hexToRgba(pc, 0.5)} !important;
      box-shadow: 0 0 6px ${hexToRgba(pc, 0.3)} !important;
    }
    .toggle-row input[type='checkbox']:checked::after {
      background: ${pc} !important;
      box-shadow: 0 0 6px ${pc} !important;
    }
    .led.active {
      background: ${sc} !important;
      border-color: ${hexToRgba(sc, 0.6)} !important;
      box-shadow: 0 0 4px ${sc}, 0 0 10px ${hexToRgba(sc, 0.35)} !important;
    }
    .input-row input[type='number'], .input-row input[type='text'] {
      border-color: ${hexToRgba(pc, 0.15)} !important;
      color: ${pc} !important;
    }
    .input-row input:focus {
      border-color: ${pc} !important;
      box-shadow: 0 0 8px ${hexToRgba(pc, 0.25)} !important;
    }
    textarea { border-color: ${hexToRgba(pc, 0.12)} !important; color: ${pc} !important; }
    textarea:focus { border-color: ${pc} !important; box-shadow: 0 0 8px ${hexToRgba(pc, 0.2)} !important; }
    .btn-export {
      background: linear-gradient(135deg, ${pc}, ${darken(pc, 30)}) !important;
      box-shadow: 0 0 12px ${hexToRgba(pc, 0.3)}, 0 4px 20px ${hexToRgba(pc, 0.15)} !important;
      color: #020617 !important;
    }
    .btn-export:hover { box-shadow: 0 0 20px ${hexToRgba(pc, 0.5)}, 0 6px 30px ${hexToRgba(pc, 0.2)} !important; }
    .btn-import {
      background: linear-gradient(135deg, ${hexToRgba(sc, 0.2)}, ${hexToRgba(sc, 0.1)}) !important;
      border: 1px solid ${hexToRgba(sc, 0.25)} !important;
      color: ${sc} !important;
      box-shadow: 0 0 8px ${hexToRgba(sc, 0.15)} !important;
    }
    .btn-import:hover { box-shadow: 0 0 14px ${hexToRgba(sc, 0.3)} !important; }
    .btn-run {
      background: linear-gradient(135deg, ${runWarm}, ${runEnd}) !important;
      box-shadow: 0 0 12px ${hexToRgba(runWarm, 0.3)}, 0 4px 20px ${hexToRgba(runWarm, 0.15)} !important;
      color: #fef2f2 !important;
    }
    .btn-run:hover { box-shadow: 0 0 20px ${hexToRgba(runWarm, 0.5)}, 0 6px 30px ${hexToRgba(runWarm, 0.2)} !important; }
    .actions { border-top-color: ${hexToRgba(pc, 0.12)} !important; }
    .status-toast {
      background: ${hexToRgba(pc, 0.15)} !important;
      border-color: ${hexToRgba(pc, 0.4)} !important;
      color: ${pc} !important;
    }
    .impact-bar { border-color: ${hexToRgba(pc, 0.18)} !important; }
    .impact-pct { color: ${pc} !important; text-shadow: 0 0 8px ${hexToRgba(pc, 0.5)} !important; }
    .theme-dropdown { border-color: ${hexToRgba(pc, 0.2)} !important; }
    .theme-option:hover { background: ${hexToRgba(pc, 0.1)} !important; }
    .theme-option.active { background: ${hexToRgba(pc, 0.15)} !important; border-color: ${hexToRgba(pc, 0.3)} !important; }
    .theme-option.active .theme-dot { box-shadow: 0 0 6px ${pc} !important; }
    .logo-feather { color: ${pc} !important; filter: drop-shadow(0 0 6px ${hexToRgba(pc, 0.5)}) !important; }
    .sig-name { color: ${pc} !important; text-shadow: 0 0 8px ${hexToRgba(pc, 0.4)} !important; }
    .sig-tag { color: ${sc} !important; text-shadow: 0 0 6px ${hexToRgba(sc, 0.35)} !important; }
    .sig-by { color: ${hexToRgba(pc, 0.4)} !important; }
    .sig-community { color: ${pc} !important; opacity: 0.5 !important; }
    .header-community { color: ${pc} !important; border-color: ${hexToRgba(pc, 0.12)} !important; background: ${hexToRgba(pc, 0.04)} !important; }
    .app-sidebar { border-right-color: ${hexToRgba(pc, 0.12)} !important; }
    .sidebar-btn.active { background: ${hexToRgba(pc, 0.12)} !important; border-color: ${hexToRgba(pc, 0.3)} !important; color: ${pc} !important; }
    .sidebar-btn:hover { border-color: ${hexToRgba(pc, 0.2)} !important; color: ${sc} !important; }
    .sidebar-label { color: ${hexToRgba(pc, 0.2)} !important; }
    .placeholder-badge::before { background: ${pc} !important; }
    .placeholder-chip svg { stroke: ${pc} !important; }
    .placeholder-subtitle { color: ${hexToRgba(pc, 0.5)} !important; }
    .placeholder-section-label { color: ${hexToRgba(pc, 0.35)} !important; }
    .placeholder-integration { border-color: ${hexToRgba(pc, 0.15)} !important; color: ${hexToRgba(pc, 0.5)} !important; }
    .sub-tab-btn.active { color: ${pc} !important; border-bottom-color: ${pc} !important; }
    .sub-tab-btn:hover { color: ${sc} !important; }
    .sub-tab-bar { border-bottom-color: ${hexToRgba(pc, 0.12)} !important; }
    .cfg-counter { border-color: ${hexToRgba(pc, 0.18)} !important; background: ${hexToRgba(pc, 0.04)} !important; color: ${pc} !important; }
    .cfg-actions { border-top-color: ${hexToRgba(pc, 0.12)} !important; }
    .hw-row { border-bottom-color: ${hexToRgba(pc, 0.06)} !important; }
    .hw-status.on { background: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.3)} !important; }
    .hw-status.off { background: rgba(239,68,68,0.15) !important; color: #ef4444 !important; }
    .hw-value { color: ${sc} !important; }
    .drv-category-header { color: ${pc} !important; border-bottom-color: ${hexToRgba(pc, 0.12)} !important; }
    .drv-badge.manufacturer { background: ${hexToRgba(pc, 0.1)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.25)} !important; }
    .drv-badge.current { background: ${hexToRgba(pc, 0.08)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.2)} !important; }
    .drv-driver { color: ${sc} !important; }
    .drv-summary-val { color: ${pc} !important; }
    .drv-signed.yes { color: ${pc} !important; }
    .proc-item.flagged { border-color: ${hexToRgba('#eab308', 0.3)} !important; background: ${hexToRgba('#eab308', 0.06)} !important; }
    .proc-kill { background: linear-gradient(135deg, #ef4444, #b91c1c) !important; }
    .proc-header { border-bottom-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .ping-good { color: ${pc} !important; }
    .ping-ok { color: #eab308 !important; }
    .ping-bad { color: #ef4444 !important; }
    .ping-header { border-bottom-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .ping-row { border-bottom-color: ${hexToRgba(pc, 0.06)} !important; }
    .profile-bar select, .profile-bar input { border-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .profile-bar select:focus, .profile-bar input:focus { border-color: ${pc} !important; box-shadow: 0 0 6px ${hexToRgba(pc, 0.25)} !important; }
    .profile-bar button { background: ${hexToRgba(pc, 0.12)} !important; border-color: ${hexToRgba(pc, 0.2)} !important; color: ${pc} !important; }
    .profile-bar button:hover { background: ${hexToRgba(pc, 0.2)} !important; }
    .pro-select { border-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .pro-select:focus { border-color: ${pc} !important; box-shadow: 0 0 6px ${hexToRgba(pc, 0.25)} !important; }
    .xhair-preview { border-color: ${hexToRgba(pc, 0.12)} !important; }
    .net-status { color: ${hexToRgba(sc, 0.6)} !important; }
    .demo-item.selected { background: ${hexToRgba(pc, 0.08)} !important; border-color: ${hexToRgba(pc, 0.15)} !important; }
    .demo-item:hover { background: ${hexToRgba(pc, 0.05)} !important; }
    .demo-item .demo-map { color: ${sc} !important; }
    .di-value { color: ${pc} !important; }
    .demo-notes textarea:focus { border-color: ${pc} !important; box-shadow: 0 0 6px ${hexToRgba(pc, 0.15)} !important; }
    .demo-rating .star.filled { color: #fbbf24 !important; text-shadow: 0 0 6px rgba(251,191,36,0.4) !important; }
    .demo-tip.priority-critical { border-color: rgba(255,60,60,0.15) !important; }
    .demo-tip.priority-high { border-color: rgba(251,191,36,0.12) !important; }
    .demo-tip.priority-medium { border-color: ${hexToRgba(pc, 0.08)} !important; }
    .demo-list-header { color: ${pc} !important; border-bottom-color: ${hexToRgba(pc, 0.12)} !important; }
    .demo-path { border-color: ${hexToRgba(pc, 0.12)} !important; }
    .demo-empty { color: ${hexToRgba(sc, 0.5)} !important; }
    .ai-btn:hover { border-color: ${pc} !important; color: ${pc} !important; }
    .ai-modal h3 { color: ${pc} !important; }
    .ai-modal input:focus, .ai-modal select:focus { border-color: ${pc} !important; box-shadow: 0 0 6px ${hexToRgba(pc, 0.2)} !important; }
    .ai-modal-actions .ai-save { background: ${pc} !important; }
    .btn-ai { background: linear-gradient(135deg, ${hexToRgba(sc, 0.2)}, ${hexToRgba(sc, 0.1)}) !important; border-color: ${hexToRgba(sc, 0.25)} !important; color: ${sc} !important; }
    .btn-ai:hover { box-shadow: 0 0 12px ${hexToRgba(sc, 0.2)} !important; }
    .ai-response { border-color: ${hexToRgba(sc, 0.12)} !important; background: ${hexToRgba(sc, 0.04)} !important; }
    .ai-response strong { color: ${pc} !important; }
    .ai-response h3, .ai-response h4 { color: ${sc} !important; }
    .ai-loading { color: ${sc} !important; }
    .ai-loading::before { border-top-color: ${sc} !important; border-color: ${hexToRgba(sc, 0.2)} !important; border-top-color: ${sc} !important; }
    .ai-status.connected { background: ${pc} !important; box-shadow: 0 0 4px ${pc} !important; }
    .share-copy:hover { color: ${pc} !important; border-color: ${hexToRgba(pc, 0.3)} !important; background: ${hexToRgba(pc, 0.06)} !important; }
  `;

  /* Theme dropdown active state */
  document.querySelectorAll<HTMLElement>('.theme-option').forEach((o, i) => {
    o.classList.toggle('active', i === idx);
  });

  localStorage.setItem('csmooth_theme', String(idx));
}

/* ================================================================
   Impact calculator — excludes already-applied features
   A feature with an active LED means it’s already enabled
   on the system, so enabling it again brings 0 gain.
   Baseline FPS: ~250 FPS on a mid-range system (CS2 1080p low).
   ================================================================ */
const BASELINE_FPS = 250;

function updateImpact() {
  let total = 0;
  for (const [id, pct] of Object.entries(IMPACT)) {
    if (pct <= 0) continue;
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el || el.type !== 'checkbox' || !el.checked) continue;
    /* Skip if LED shows this is already applied on the system */
    const led = document.getElementById(`led_${id}`);
    if (led && led.classList.contains('active')) continue;
    total += pct;
  }
  const fpsGain = Math.round(BASELINE_FPS * total / 100);
  const pctDisplay = document.getElementById('impact-pct-val');
  const fpsDisplay = document.getElementById('impact-fps-val');
  if (pctDisplay) pctDisplay.textContent = `+${total.toFixed(1)}%`;
  if (fpsDisplay) fpsDisplay.textContent = `+${fpsGain} FPS`;
}

/* ================================================================
   UI helpers
   ================================================================ */

function toggle(id: string, label: string, isChecked: boolean, tooltip?: string, showLed = true): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'toggle-row';
  if (tooltip) row.title = tooltip;
  const lbl = document.createElement('label');
  lbl.htmlFor = id;
  lbl.textContent = label;
  if (showLed) {
    const led = document.createElement('span');
    led.className = 'led unknown';
    led.id = `led_${id}`;
    led.title = 'Checking system state…';
    row.appendChild(lbl);
    row.appendChild(led);
  } else {
    row.appendChild(lbl);
  }
  const inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.id = id;
  inp.checked = isChecked;
  inp.addEventListener('change', updateImpact);
  row.appendChild(inp);
  return row;
}

function infoRow(label: string, tooltip?: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'info-row';
  if (tooltip) row.title = tooltip;
  const badge = document.createElement('span');
  badge.className = 'info-badge';
  badge.textContent = '!';
  const lbl = document.createElement('span');
  lbl.className = 'info-label';
  lbl.textContent = label;
  row.appendChild(badge);
  row.appendChild(lbl);
  return row;
}

function numInput(id: string, label: string, value: string, tooltip?: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'input-row';
  if (tooltip) row.title = tooltip;
  const lbl = document.createElement('label');
  lbl.htmlFor = id;
  lbl.textContent = label;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.id = id;
  inp.value = value;
  row.appendChild(lbl);
  row.appendChild(inp);
  return row;
}

function textArea(id: string, placeholder: string): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.id = id;
  ta.placeholder = placeholder;
  ta.rows = 2;
  return ta;
}

function card(title: string, tooltip?: string): HTMLElement {
  const sec = document.createElement('section');
  sec.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  if (tooltip) h2.title = tooltip;
  sec.appendChild(h2);
  return sec;
}

function ck(id: string): boolean {
  return (document.getElementById(id) as HTMLInputElement).checked;
}

function vl(id: string, fb: string): string {
  return (document.getElementById(id) as HTMLInputElement).value || fb;
}

function setChecked(id: string, v: boolean) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.checked = v;
}

function setVal(id: string, v: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = v;
}

function toast(message: string, isError = false) {
  document.querySelectorAll('.status-toast').forEach(e => e.remove());
  const t = document.createElement('div');
  t.className = 'status-toast' + (isError ? ' toast-error' : '');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ================================================================
   Collect form state into config object
   ================================================================ */
function collectConfig(): OptimizationConfig {
  return {
    bios: {
      disable_svm: true, disable_c_states: true,
      disable_cool_n_quiet: true, enable_xmp: true,
      enable_resize_bar: true, enable_above_4g: true,
    },
    windows: {
      ultimate_power_plan: ck('w_power'), disable_game_dvr: ck('w_dvr'),
      disable_game_bar: ck('w_bar'), disable_game_mode: ck('w_mode'),
      disable_hibernation: ck('w_hib'), disable_mouse_accel: ck('w_mouse'),
      disable_fullscreen_optim: ck('w_fso'), disable_visual_effects: ck('w_vis'),
      disable_transparency: ck('w_trans'), disable_background_apps: ck('w_bgapps'),
      disable_notifications: ck('w_notif'), disable_cortana: ck('w_cort'),
      disable_search_indexing: ck('w_idx'), hardware_gpu_scheduling: ck('w_hgs'),
      disable_hpet: ck('w_hpet'), disable_power_throttling: ck('w_pthrot'),
      disable_core_parking: ck('w_park'), clean_temp_files: ck('w_temp'),
      cs2_high_performance_gpu: ck('w_cs2gpu'),
      disable_delivery_optim: ck('w_deliver'), disable_widgets: ck('w_widgets'),
      disable_memory_compression: ck('w_memcomp'), disable_connected_ux: ck('w_uxuser'),
      disable_spectre: ck('w_spectre'), disable_last_access: ck('w_lastaccess'),
      disable_8dot3: ck('w_8dot3'), mmcss_gaming: ck('w_mmcss'),
      disable_large_cache: ck('w_largecache'),
    },
    network: {
      disable_nagle: ck('n_nagle'), optimize_tcp: ck('n_tcp'),
      flush_dns: ck('n_dns'), disable_wifi_power_save: ck('n_wifi'),
      disable_network_throttle: ck('n_throttle'), disable_ecn: ck('n_ecn'),
      enable_rss: ck('n_rss'),
      disable_netbios: ck('n_netbios'), disable_lmhosts: ck('n_lmhosts'),
      enable_ctcp: ck('n_ctcp'),
    },
    nvidia: {
      prefer_max_perf: ck('nv_perf'), disable_vsync: ck('nv_vsync'),
      low_latency_ultra: ck('nv_lat'), threaded_optimization: ck('nv_thread'),
      disable_anisotropic: ck('nv_aniso'), shader_cache_clear: ck('nv_shader'),
      force_reflex: ck('nv_reflex'), disable_sharpening: ck('nv_sharp'),
      texture_filter_perf: ck('nv_texfilt'), pre_rendered_frames_1: ck('nv_prerender'),
      disable_ambient_occlusion: ck('nv_ambient'), disable_fxaa: ck('nv_fxaa'),
    },
    services: {
      disable_sysmain: ck('s_sys'), disable_diagtrack: ck('s_diag'),
      disable_wsearch: ck('s_ws'), disable_print_spooler: ck('s_print'),
      disable_fax: ck('s_fax'), disable_xbox_services: ck('s_xbox'),
      disable_cdp: ck('s_cdp'), disable_wpn: ck('s_wpn'),
      disable_diagnostic_policy: ck('s_diagpol'),
      disable_remote_registry: ck('s_remote'), disable_maps_broker: ck('s_maps'),
      disable_phone_service: ck('s_phonesvc'), disable_retail_demo: ck('s_retaildemo'),
    },
    autoexec: {
      enabled: ck('ae_on'), fps_max: vl('ae_fps', '400'),
      rate: vl('ae_rate', '786432'), cl_interp: vl('ae_int', '0'),
      cl_interp_ratio: vl('ae_ir', '1'), cl_updaterate: vl('ae_ur', '128'),
      cl_cmdrate: vl('ae_cr', '128'), m_rawinput: ck('ae_raw'),
      custom_commands: (document.getElementById('ae_custom') as HTMLTextAreaElement)?.value || '',
    },
    launch_options: {
      exec_autoexec: ck('lo_exec'), novid: ck('lo_nvid'),
      nojoy: ck('lo_joy'),
      high_priority: ck('lo_high'), allow_third_party: ck('lo_allow'),
      threads: vl('lo_thr', ''),
      custom_args: (document.getElementById('lo_custom') as HTMLTextAreaElement)?.value?.trim() || '',
    },
    extras: {
      faceit_admin: false, disable_steam_overlay: ck('x_steam'),
      disable_discord_overlay: ck('x_disc'), system_responsiveness: ck('x_resp'),
      gpu_priority: ck('x_gpup'), priority_separation: ck('x_prio'),
      cs2_process_priority: ck('x_cs2p'),
      disable_telemetry_tasks: ck('x_telem'), timer_resolution: ck('x_timer'),
      msi_mode_gpu: ck('x_msimode'), pcie_link_state_off: ck('x_pcie'),
      interrupt_moderation_off: ck('x_ndis'), enable_large_pages: ck('x_large'),
    },
    theme_primary: THEMES[currentThemeIdx].primary,
    theme_secondary: THEMES[currentThemeIdx].secondary,
  };
}

/* ================================================================
   PS1 Import
   ================================================================ */
function parsePs1AndSetToggles(content: string) {
  const has = (s: string) => content.includes(s);

  /* BIOS — informational only, no toggles to restore */

  setChecked('w_power', has('e9a42b02-d5df-448d-aa00-03f14749eb61'));
  setChecked('w_dvr', has('GameDVR_Enabled'));
  setChecked('w_bar', has('UseNexusForGameBarEnabled'));
  setChecked('w_mode', has('AutoGameModeEnabled'));
  setChecked('w_hib', has('powercfg -h off'));
  setChecked('w_mouse', has("'MouseSpeed'"));
  setChecked('w_fso', has('DISABLEDXMAXIMIZEDWINDOWEDMODE'));
  setChecked('w_vis', has('VisualFXSetting'));
  setChecked('w_trans', has('EnableTransparency'));
  setChecked('w_bgapps', has('GlobalUserDisabled'));
  setChecked('w_notif', has('ToastEnabled'));
  setChecked('w_cort', has('AllowCortana'));
  setChecked('w_idx', has("'WSearch'"));
  setChecked('w_hgs', has('HwSchMode'));
  setChecked('w_hpet', has('useplatformtick'));
  setChecked('w_pthrot', has('PowerThrottlingOff'));
  setChecked('w_park', has('CPMINCORES'));
  setChecked('w_temp', has(String.raw`TEMP\*`));
  setChecked('w_cs2gpu', has('GpuPreference=2'));
  setChecked('w_deliver', has("'DoSvc'"));
  setChecked('w_widgets', has('TaskbarDa'));
  setChecked('w_memcomp', has('Disable-MMAgent'));
  setChecked('w_uxuser', has('DiagTrack') && has('ConnectedUser'));
  setChecked('w_spectre', has('FeatureSettingsOverride'));
  setChecked('w_lastaccess', has('NtfsDisableLastAccessUpdate'));
  setChecked('w_8dot3', has('NtfsDisable8dot3NameCreation'));
  setChecked('w_mmcss', has('SystemProfile') && has('SystemResponsiveness'));
  setChecked('w_largecache', has('LargeSystemCache'));

  setChecked('n_nagle', has('TCPNoDelay'));
  setChecked('n_tcp', has('autotuninglevel'));
  setChecked('n_dns', has('flushdns'));
  setChecked('n_wifi', has('WakeOnMagicPacket'));
  setChecked('n_throttle', has('NetworkThrottlingIndex'));
  setChecked('n_ecn', has('ecncapability'));
  setChecked('n_rss', has('rss'));
  setChecked('n_netbios', has('NetbiosOptions'));
  setChecked('n_lmhosts', has('EnableLMHOSTS'));
  setChecked('n_ctcp', has('ctcp'));

  setChecked('nv_perf', has('PowerMizerLevel'));
  setChecked('nv_vsync', has('NVTweak'));
  setChecked('nv_lat', has('RMDelayCycles'));
  setChecked('nv_thread', has('ThreadedOptimization'));
  setChecked('nv_aniso', has('Anisotropic') || has('anisotropic'));
  setChecked('nv_shader', has('DXCache'));
  setChecked('nv_reflex', has('ReflexMode'));
  setChecked('nv_sharp', has('SharpenEnabled'));
  setChecked('nv_texfilt', has('TextureFilterQuality'));
  setChecked('nv_prerender', has('MaxFrameAllowed'));
  setChecked('nv_ambient', has('AmbientOcclusion'));
  setChecked('nv_fxaa', has('FXAAEnable'));

  setChecked('s_sys', has("'SysMain'"));
  setChecked('s_diag', has("'DiagTrack'"));
  setChecked('s_ws', has("'WSearch'") && has('Stop-Service'));
  setChecked('s_print', has("'Spooler'"));
  setChecked('s_fax', has("'Fax'"));
  setChecked('s_xbox', has('XblAuthManager'));
  setChecked('s_cdp', has("'CDPSvc'"));
  setChecked('s_wpn', has('WpnUserService'));
  setChecked('s_diagpol', has("'DPS'"));
  setChecked('s_remote', has("'RemoteRegistry'"));
  setChecked('s_maps', has("'MapsBroker'"));
  setChecked('s_phonesvc', has("'PhoneSvc'"));
  setChecked('s_retaildemo', has("'RetailDemo'"));

  setChecked('ae_on', has('autoexecLines'));
  const fpsMatch = content.match(/fps_max (\d+)/);
  if (fpsMatch) setVal('ae_fps', fpsMatch[1]);
  const rateMatch = content.match(/rate (\d+)/);
  if (rateMatch) setVal('ae_rate', rateMatch[1]);
  const interpMatch = content.match(/cl_interp (\S+)/);
  if (interpMatch) setVal('ae_int', interpMatch[1]);
  const irMatch = content.match(/cl_interp_ratio (\S+)/);
  if (irMatch) setVal('ae_ir', irMatch[1]);
  const urMatch = content.match(/cl_updaterate (\d+)/);
  if (urMatch) setVal('ae_ur', urMatch[1]);
  const crMatch = content.match(/cl_cmdrate (\d+)/);
  if (crMatch) setVal('ae_cr', crMatch[1]);
  const sensMatch = content.match(/sensitivity (\S+)/);
  if (sensMatch) setVal('ae_sns', sensMatch[1]);
  const fovMatch = content.match(/viewmodel_fov (\S+)/);
  if (fovMatch) setVal('ae_fov', fovMatch[1]);
  setChecked('ae_raw', has('m_rawinput 1'));

  setChecked('lo_exec', has('+exec autoexec'));
  setChecked('lo_nvid', has('-novid'));
  setChecked('lo_joy', has('-nojoy'));
  setChecked('lo_high', has('-high'));
  setChecked('lo_allow', has('-allow_third_party_software'));
  const threadMatch = content.match(/-threads (\d+)/);
  if (threadMatch) setVal('lo_thr', threadMatch[1]);

  setChecked('x_faceit', has('FACEITService'));
  setChecked('x_steam', has('GameOverlayDisabled'));
  setChecked('x_disc', has('DiscordHook'));
  setChecked('x_resp', has('SystemResponsiveness'));
  setChecked('x_gpup', has('GPU Priority'));
  setChecked('x_prio', has('Win32PrioritySeparation'));
  setChecked('x_cs2p', has("'cs2'"));
  setChecked('x_telem', has('CompatTelRunner'));
  setChecked('x_timer', has('TimeIncrement'));
  setChecked('x_msimode', has('MSISupported'));
  setChecked('x_pcie', has('ASPM'));
  setChecked('x_ndis', has('InterruptModeration'));
  setChecked('x_large', has('SeLockMemoryPrivilege'));

  updateImpact();
}

/* ================================================================
   Tauri bridge
   ================================================================ */

async function exportScript() {
  try {
    const config = collectConfig();
    const ps1 = await invoke<string>('generate_script', { config });
    await invoke('save_script', { scriptContent: ps1 });
    toast('Script exported successfully');
  } catch (e) {
    console.error(e);
    toast('Error generating script — check console (F12)', true);
  }
}

async function importScript() {
  try {
    const result = await invoke<{ path: string; content: string }>('import_script');
    currentScriptPath = result.path;
    parsePs1AndSetToggles(result.content);
    toast(`Imported: ${result.path.split('\\').pop()}`);
    refreshSystemState();
  } catch (e) {
    console.error(e);
  }
}

async function runConfigAsAdmin() {
  try {
    const config = collectConfig();
    toast('Generating & launching as Admin…');
    const msg = await invoke<string>('run_config_as_admin', { config });
    toast(msg);
  } catch (e) {
    console.error(e);
    toast('Failed to run config as admin', true);
  }
}

/* ================================================================
   System state LED refresh
   ================================================================ */

async function refreshSystemState() {
  try {
    const state = await invoke<Record<string, boolean | null>>('check_system_state');
    for (const [id, value] of Object.entries(state)) {
      const led = document.getElementById(`led_${id}`);
      if (!led) continue;
      led.classList.remove('active', 'unknown');
      if (value === true) {
        led.classList.add('active');
        led.title = '✔ Applied on this system (excluded from estimate)';
      } else if (value === false) {
        led.title = '✖ Not yet applied';
      } else {
        led.classList.add('unknown');
        led.title = '— Cannot determine';
      }
    }
    /* Recalculate impact now that LEDs are updated */
    updateImpact();
  } catch (e) {
    console.error('System state check failed:', e);
  }
}

/* ================================================================
   Tooltips
   ================================================================ */
const TIP: Record<string, string> = {
  /* BIOS — manual settings, the app only shows recommendations */
  b_svm:  '⚠ MANUAL BIOS: Navigate to BIOS → CPU Config → Disable SVM/VT-x. Eliminates hypervisor overhead. Impact: ~3% (+7 FPS). The app cannot change BIOS settings.',
  b_cst:  '⚠ MANUAL BIOS: Navigate to BIOS → Advanced → Disable C-States. Forces CPU 100% frequency. Impact: ~2.5% (+6 FPS). The app cannot change BIOS settings.',
  b_cool: "⚠ MANUAL BIOS: Navigate to BIOS → CPU Config → Disable Cool'n'Quiet / SpeedStep. Locks max turbo. Impact: ~1.5% (+4 FPS). The app cannot change BIOS settings.",
  b_xmp:  '⚠ MANUAL BIOS: Navigate to BIOS → OC/Memory → Enable XMP/DOCP profile. Runs RAM at rated speed. Impact: ~8% (+20 FPS). The app cannot change BIOS settings.',
  b_rbar: '⚠ MANUAL BIOS: Navigate to BIOS → PCI → Enable Resizable BAR / Smart Access Memory. Impact: ~1.5% (+4 FPS). The app cannot change BIOS settings.',
  b_4g:   '⚠ MANUAL BIOS: Navigate to BIOS → PCI → Enable Above 4G Decoding. Required for ReBAR. 0 FPS impact alone. The app cannot change BIOS settings.',

  /* Windows — auto-applied via registry/PowerShell when you Run or Export */
  w_power:  '✔ AUTO (Registry): Activates the hidden "Ultimate Performance" power plan. Minimizes CPU power management latency. +3.0% (+8 FPS).',
  w_dvr:    '✔ AUTO (Registry): Disables Game DVR background recording. Stops encoder overhead. +2.5% (+6 FPS).',
  w_bar:    '✔ AUTO (Registry): Disables Game Bar overlay (Win+G). Removes overlay hooks. +1.0% (+3 FPS).',
  w_mode:   '✔ AUTO (Registry): Disables Windows Game Mode. Can cause inconsistent frame pacing. +1.0% (+3 FPS).',
  w_hib:    '✔ AUTO (PowerShell): Disables Hibernation and Fast Startup via powercfg. +0.5% (+1 FPS). Stability improvement.',
  w_mouse:  '✔ AUTO (Registry): Disables mouse acceleration (MouseSpeed=0). Essential for consistent aim. 0 FPS — aim quality only.',
  w_fso:    '✔ AUTO (Registry): Disables Fullscreen Optimizations for CS2. Reduces input lag. +2.0% (+5 FPS).',
  w_vis:    '✔ AUTO (Registry): Sets Visual Effects to Best Performance. +0.5% (+1 FPS) in-game.',
  w_trans:  '✔ AUTO (Registry): Disables desktop transparency effects. +0.5% (+1 FPS).',
  w_bgapps: '✔ AUTO (Registry): Disables all background UWP app activity. +2.0% (+5 FPS).',
  w_notif:  '✔ AUTO (Registry): Disables toast notifications. +0.5% (+1 FPS).',
  w_cort:   '✔ AUTO (Registry): Disables Cortana. +0.5% (+1 FPS). Saves ~50-100MB RAM.',
  w_idx:    '✔ AUTO (Service): Disables Windows Search Indexing service. +1.5% (+4 FPS). Reduces disk I/O.',
  w_hgs:    '✔ AUTO (Registry): Enables Hardware-accelerated GPU Scheduling. +2.0% (+5 FPS) on RTX 30/40.',
  w_hpet:   '✔ AUTO (bcdedit): Disables HPET timer. +3.0% (+8 FPS). Reduces DPC latency.',
  w_pthrot: '✔ AUTO (Registry): Disables Power Throttling. +1.0% (+3 FPS).',
  w_park:   '✔ AUTO (powercfg): Disables CPU Core Parking. +1.5% (+4 FPS). Prevents core-wake hitches.',
  w_temp:   '✔ AUTO (PowerShell): Cleans TEMP directories. 0 FPS — maintenance only.',
  w_cs2gpu: '✔ AUTO (Registry): Forces CS2 to use dedicated GPU. +1.0% (+3 FPS). High impact on laptops.',
  w_deliver:'✔ AUTO (Service): Disables Delivery Optimization (Windows Update P2P). +1.0% (+3 FPS). Prevents background uploads.',
  w_widgets:'✔ AUTO (Registry): Disables Windows 11 Widgets. +0.5% (+1 FPS). Saves ~100MB RAM.',
  w_memcomp:'✔ AUTO (PowerShell): Disables Memory Compression. +1.0% (+3 FPS). Trades RAM for CPU overhead.',
  w_uxuser: '✔ AUTO (Registry): Disables Connected User Experiences and Telemetry. +0.5% (+1 FPS). Stops background data collection.',
  w_spectre: '✔ AUTO (Registry+bcdedit): Disables Spectre/Meltdown CPU mitigations. +8.0% (+20 FPS). Security risk — research before applying.',
  w_lastaccess: '✔ AUTO (fsutil): Disables NTFS Last Access timestamp. +0.5% (+1 FPS). Reduces disk write overhead.',
  w_8dot3:   '✔ AUTO (fsutil): Disables 8.3 short filename creation. +0.5% (+1 FPS). Reduces NTFS overhead on large directories.',
  w_mmcss:   '✔ AUTO (Registry): Sets MMCSS multimedia scheduler to gaming priority. +1.5% (+4 FPS). Higher scheduling priority for games.',
  w_largecache: '✔ AUTO (Registry): Disables Large System Cache. +1.0% (+3 FPS). Frees RAM for gaming.',

  /* Network — auto-applied via registry/netsh */
  n_nagle: "✔ AUTO (Registry): Disables Nagle's Algorithm (TcpNoDelay). Reduces latency 10-30ms. 0 FPS — latency only.",
  n_tcp:   '✔ AUTO (netsh): Optimizes TCP auto-tuning level. 0 FPS — latency improvement only.',
  n_dns:   '✔ AUTO (ipconfig): Flushes DNS resolver cache. 0 FPS — connectivity fix.',
  n_wifi:  '✔ AUTO (PowerShell): Disables Wi-Fi adapter power saving. 0 FPS — prevents WiFi latency spikes.',
  n_throttle:'✔ AUTO (Registry): Disables NetworkThrottlingIndex. +1.0% (+3 FPS). Removes 10 packets/ms limit.',
  n_ecn:    '✔ AUTO (netsh): Disables ECN Capability. 0 FPS — reduces packet overhead on some ISPs.',
  n_rss:    '✔ AUTO (netsh): Enables Receive Side Scaling across CPU cores. 0 FPS — distributes network I/O.',
  n_netbios: '✔ AUTO (Registry): Disables NetBIOS over TCP/IP on all adapters. 0 FPS — removes legacy SMB overhead.',
  n_lmhosts: '✔ AUTO (Registry): Disables LMHOSTS lookup on all adapters. 0 FPS — removes legacy name resolution delay.',
  n_ctcp:    '✔ AUTO (netsh): Enables Compound TCP congestion control. 0 FPS — better throughput under packet loss.',

  /* NVIDIA — auto-applied via registry */
  nv_perf:   '✔ AUTO (Registry): Sets NVIDIA to Max Performance mode. +3.0% (+8 FPS). Prevents GPU downclocking.',
  nv_vsync:  '✔ AUTO (Registry): Disables V-Sync globally. +2.0% (+5 FPS). Removes frame cap + input lag.',
  nv_lat:    '✔ AUTO (Registry): Sets Ultra Low Latency mode. +1.5% (+4 FPS). Reduces input-to-display latency 10-30ms.',
  nv_thread: '✔ AUTO (Registry): Enables Threaded Optimization. +1.5% (+4 FPS) on multi-core CPUs.',
  nv_aniso:  '✔ AUTO (Registry): Sets Anisotropic Filtering to app-controlled. +0.5% (+1 FPS).',
  nv_shader: '✔ AUTO (PowerShell): Clears Shader Cache files. 0 FPS — maintenance.',
  nv_reflex: '✔ AUTO (Registry): Forces NVIDIA Reflex On+Boost via profile. +1.5% (+4 FPS). Reduces render queue latency.',
  nv_sharp:  '✔ AUTO (Registry): Disables Image Sharpening filter. +0.5% (+1 FPS). Frees GPU post-processing.',
  nv_texfilt: '✔ AUTO (Registry): Sets Texture Filtering Quality to High Performance. +0.5% (+1 FPS). Reduces anisotropic overhead.',
  nv_prerender: '✔ AUTO (Registry): Sets Max Pre-Rendered Frames to 1. +1.0% (+3 FPS). Reduces CPU-side input lag by 1-2 frames.',
  nv_ambient: '✔ AUTO (Registry): Disables Ambient Occlusion globally. +1.0% (+3 FPS). Saves GPU shader cycles.',
  nv_fxaa:    '✔ AUTO (Registry): Disables global FXAA (forced antialiasing). +0.5% (+1 FPS). Lets CS2 handle AA.',

  /* Services — auto-applied via Stop-Service/Set-Service */
  s_sys:   '✔ AUTO (Service): Stops and disables SysMain (Superfetch). +1.5% (+4 FPS). Frees RAM + disk I/O.',
  s_diag:  '✔ AUTO (Service): Stops and disables DiagTrack telemetry. +0.5% (+1 FPS).',
  s_ws:    '✔ AUTO (Service): Stops and disables Windows Search. +1.0% (+3 FPS). Stops disk I/O spikes.',
  s_print: '✔ AUTO (Service): Stops and disables Print Spooler. 0 FPS — if not printing.',
  s_fax:   '✔ AUTO (Service): Stops and disables Fax service. 0 FPS.',
  s_xbox:  '✔ AUTO (Service): Stops and disables Xbox services (all). +0.5% (+1 FPS). Saves RAM.',
  s_cdp:   '✔ AUTO (Service): Stops and disables Connected Devices Platform. +0.5% (+1 FPS). Bluetooth/device sync.',
  s_wpn:   '✔ AUTO (Service): Stops and disables WpnUserService (push notifications). +0.5% (+1 FPS).',
  s_diagpol:'✔ AUTO (Service): Stops and disables Diagnostic Policy Service. +0.5% (+1 FPS). Diagnostic logging.',
  s_remote: '✔ AUTO (Service): Stops and disables Remote Registry. 0 FPS — security + attack surface reduction.',
  s_maps:   '✔ AUTO (Service): Stops and disables MapsBroker. +0.5% (+1 FPS). Prevents background map data downloads.',
  s_phonesvc: '✔ AUTO (Service): Stops and disables Phone Service. 0 FPS — unnecessary for gaming.',
  s_retaildemo: '✔ AUTO (Service): Stops and disables RetailDemo Service. 0 FPS — only used on demo kiosks.',

  /* autoexec.cfg — auto-generated by the app, written to CS2 cfg folder */
  ae_on:   '✔ AUTO (File): The app generates autoexec.cfg and writes it to your CS2 cfg folder when you Export or Run.',
  ae_raw:  '✔ AUTO (CFG): Sets m_rawinput 1 in autoexec.cfg. Raw mouse input for consistent aim. 0 FPS.',

  /* Launch Options — generated by the app, user must paste into Steam */
  lo_exec:  '⚠ MANUAL PASTE: Generates "+exec autoexec" for Steam Launch Options. You must paste this into Steam → CS2 → Properties → Launch Options.',
  lo_nvid:  '⚠ MANUAL PASTE: Generates "-novid" to skip intro video. 0 FPS. Paste into Steam Launch Options.',
  lo_joy:   '⚠ MANUAL PASTE: Generates "-nojoy" to disable controller polling. +0.5% (+1 FPS). Paste into Steam Launch Options.',
  lo_high:  '⚠ MANUAL PASTE: Generates "-high" for high process priority. +2.0% (+5 FPS). Paste into Steam Launch Options.',
  lo_allow: '⚠ MANUAL PASTE: Generates "-allow_third_party_software" for FACEIT/overlay compatibility. 0 FPS. Paste into Steam Launch Options.',

  /* Extras — mixed: registry tweaks are auto-applied, FACEIT is informational */
  x_faceit: 'ℹ INFO ONLY: Checks if FACEIT Anti-Cheat service is running on your system. The app does not modify FACEIT — this is a status check.',
  x_steam:  '✔ AUTO (Registry): Disables Steam Overlay via registry. +1.5% (+4 FPS). May need Steam restart.',
  x_disc:   '✔ AUTO (Registry): Disables Discord Overlay hook. +1.0% (+3 FPS). May need Discord restart.',
  x_resp:   '✔ AUTO (Registry): Sets SystemResponsiveness = 0. +2.0% (+5 FPS). Max CPU reservation for game.',
  x_gpup:   '✔ AUTO (Registry): Sets GPU Priority for gaming processes. +1.0% (+3 FPS).',
  x_prio:   '✔ AUTO (Registry): Tunes Win32PrioritySeparation for foreground apps. +1.5% (+4 FPS). Better frame pacing.',
  x_cs2p:   '✔ AUTO (Registry): Sets CS2 process to High priority class. +1.5% (+4 FPS).',
  x_telem:  '✔ AUTO (PowerShell): Disables Windows telemetry scheduled tasks. +0.5% (+1 FPS). Prevents periodic data collection.',
  x_timer:  '✔ AUTO (PowerShell): Sets global timer resolution to 0.5ms via bcdedit. +1.0% (+3 FPS). Reduces input processing delay.',
  x_msimode: '✔ AUTO (Registry): Enables MSI (Message Signaled Interrupts) for GPU. +1.5% (+4 FPS). Reduces DPC latency 50-200µs.',
  x_pcie:    '✔ AUTO (PowerShell): Disables PCIe Active State Power Management. +1.0% (+3 FPS). Prevents GPU bus downclocking.',
  x_ndis:    '✔ AUTO (Registry): Disables network adapter Interrupt Moderation. +0.5% (+1 FPS). Lower packet processing latency.',
  x_large:   '✔ AUTO (Registry): Enables Large Pages privilege for CS2. +1.0% (+3 FPS). Reduces TLB misses on large memory allocations.',
};

/* ================================================================
   CFG Manager — CS2 console commands by category
   ================================================================ */

interface CfgCmd {
  id: string; cmd: string; label: string;
  type: 'toggle' | 'value'; on: boolean; val: string; tip: string;
}
interface CfgCat { name: string; commands: CfgCmd[]; }

const CFG: CfgCat[] = [
  /* ── Performance & Rendering ──────────────────────────────── */
  { name: 'Performance', commands: [
    { id:'cf_fpsmax', cmd:'fps_max', label:'fps_max', type:'value', on:true, val:'400', tip:'Maximum framerate. 0 = unlimited.' },
    { id:'cf_fpsmaxui', cmd:'fps_max_ui', label:'fps_max_ui', type:'value', on:false, val:'120', tip:'Max FPS in menus. Saves GPU power.' },
    { id:'cf_particles', cmd:'r_drawparticles', label:'r_drawparticles', type:'toggle', on:false, val:'0', tip:'Disable particles for clarity/FPS.' },
    { id:'cf_tracers', cmd:'r_drawtracers', label:'r_drawtracers', type:'toggle', on:false, val:'0', tip:'Disable bullet tracers.' },
    { id:'cf_preload', cmd:'cl_forcepreload', label:'cl_forcepreload', type:'toggle', on:true, val:'1', tip:'Preload all resources. Reduces mid-game stutters.' },
    { id:'cf_lowlat', cmd:'engine_low_latency_sleep_after_client_tick', label:'Low Latency Sleep', type:'toggle', on:true, val:'1', tip:'Reflex-style low latency. Reduces input lag.' },
    { id:'cf_shadows', cmd:'cl_csm_enabled', label:'cl_csm_enabled', type:'toggle', on:true, val:'1', tip:'Cascaded shadow maps. Disable for FPS boost.' },
    { id:'cf_ragdolls', cmd:'cl_ragdoll_physics_enable', label:'cl_ragdoll_physics_enable', type:'toggle', on:true, val:'0', tip:'Disable ragdolls on death. Reduces GPU load.' },
    { id:'cf_nofocus', cmd:'engine_no_focus_sleep', label:'engine_no_focus_sleep', type:'value', on:false, val:'0', tip:'Sleep ms when alt-tabbed. 0=no throttle.' },
    { id:'cf_gamma', cmd:'r_fullscreen_gamma', label:'r_fullscreen_gamma', type:'value', on:false, val:'2.2', tip:'Fullscreen gamma. 1.6-2.6.' },
    { id:'cf_postproc', cmd:'r_csgo_postprocess_enable', label:'r_csgo_postprocess_enable', type:'toggle', on:false, val:'0', tip:'Post-processing (bloom, color correction). Disable for FPS.' },
    { id:'cf_dynimg', cmd:'cl_itemimages_dynamically_generated', label:'Dynamic item images', type:'toggle', on:false, val:'0', tip:'Disable dynamic item image generation. Saves GPU.' },
    { id:'cf_animavatar', cmd:'cl_allow_animated_avatars', label:'Animated avatars', type:'toggle', on:false, val:'0', tip:'Disable animated avatars for CPU savings.' },
    { id:'cf_newbob', cmd:'cl_usenewbob', label:'cl_usenewbob', type:'toggle', on:true, val:'1', tip:'Use new weapon bob system. More fluid.' },
    { id:'cf_timeout', cmd:'cl_timeout', label:'cl_timeout', type:'value', on:false, val:'30', tip:'Seconds before disconnect on no response. Default 30.' },
    { id:'cf_showbuild', cmd:'r_show_build_info', label:'r_show_build_info', type:'toggle', on:false, val:'0', tip:'Show build info overlay. Off for clean screen.' },
  ]},

  /* ── Crosshair ────────────────────────────────────────────── */
  { name: 'Crosshair', commands: [
    { id:'cf_xhstyle', cmd:'cl_crosshairstyle', label:'cl_crosshairstyle', type:'value', on:true, val:'4', tip:'0=default, 1=static, 2=classic, 3=classic dyn, 4=classic static, 5=hybrid.' },
    { id:'cf_xhsize', cmd:'cl_crosshairsize', label:'cl_crosshairsize', type:'value', on:true, val:'2.5', tip:'Crosshair line length.' },
    { id:'cf_xhgap', cmd:'cl_crosshairgap', label:'cl_crosshairgap', type:'value', on:true, val:'-1', tip:'Center gap. Negative = tighter.' },
    { id:'cf_xhthick', cmd:'cl_crosshairthickness', label:'cl_crosshairthickness', type:'value', on:true, val:'0.5', tip:'Line thickness.' },
    { id:'cf_xhcolor', cmd:'cl_crosshaircolor', label:'cl_crosshaircolor', type:'value', on:true, val:'1', tip:'0=red, 1=green, 2=yellow, 3=blue, 4=cyan, 5=custom.' },
    { id:'cf_xhcolorr', cmd:'cl_crosshaircolor_r', label:'cl_crosshaircolor_r', type:'value', on:false, val:'50', tip:'Red channel (0-255). Needs crosshaircolor 5.' },
    { id:'cf_xhcolorg', cmd:'cl_crosshaircolor_g', label:'cl_crosshaircolor_g', type:'value', on:false, val:'250', tip:'Green channel (0-255). Needs crosshaircolor 5.' },
    { id:'cf_xhcolorb', cmd:'cl_crosshaircolor_b', label:'cl_crosshaircolor_b', type:'value', on:false, val:'50', tip:'Blue channel (0-255). Needs crosshaircolor 5.' },
    { id:'cf_xhdot', cmd:'cl_crosshairdot', label:'cl_crosshairdot', type:'toggle', on:false, val:'0', tip:'Center dot on crosshair.' },
    { id:'cf_xhoutline', cmd:'cl_crosshair_drawoutline', label:'Draw outline', type:'toggle', on:true, val:'1', tip:'Draw crosshair outline for visibility.' },
    { id:'cf_xhoutthick', cmd:'cl_crosshair_outlinethickness', label:'Outline thickness', type:'value', on:true, val:'1', tip:'Crosshair outline thickness.' },
    { id:'cf_xhalpha', cmd:'cl_crosshairalpha', label:'cl_crosshairalpha', type:'value', on:true, val:'255', tip:'Transparency. 0-255.' },
    { id:'cf_xht', cmd:'cl_crosshair_t', label:'cl_crosshair_t', type:'toggle', on:false, val:'0', tip:'T-shaped crosshair (no top line).' },
    { id:'cf_xhsniper', cmd:'cl_crosshair_sniper_width', label:'Sniper width', type:'value', on:false, val:'1', tip:'Sniper scope crosshair width.' },
    { id:'cf_xhfriend', cmd:'cl_crosshair_friendly_warning', label:'Friendly warning', type:'value', on:true, val:'1', tip:'0=off, 1=icon, 2=both.' },
    { id:'cf_xhrecoil', cmd:'cl_crosshair_recoil', label:'cl_crosshair_recoil', type:'toggle', on:false, val:'0', tip:'Crosshair follows recoil pattern.' },
    { id:'cf_fixedgap', cmd:'cl_fixedcrosshairgap', label:'cl_fixedcrosshairgap', type:'value', on:false, val:'3', tip:'Gap for static crosshair styles.' },
    { id:'cf_xhgapwep', cmd:'cl_crosshairgap_useweaponvalue', label:'Gap per weapon', type:'toggle', on:false, val:'0', tip:'Adjust gap per weapon. 0=fixed gap.' },
  ]},

  /* ── Viewmodel ────────────────────────────────────────────── */
  { name: 'Viewmodel', commands: [
    { id:'cf_vmfov', cmd:'viewmodel_fov', label:'viewmodel_fov', type:'value', on:true, val:'68', tip:'Viewmodel FOV. 54-68.' },
    { id:'cf_vmx', cmd:'viewmodel_offset_x', label:'viewmodel_offset_x', type:'value', on:false, val:'2.5', tip:'Horizontal offset. -2.5 to 2.5.' },
    { id:'cf_vmy', cmd:'viewmodel_offset_y', label:'viewmodel_offset_y', type:'value', on:false, val:'0', tip:'Forward/back offset. -2 to 2.' },
    { id:'cf_vmz', cmd:'viewmodel_offset_z', label:'viewmodel_offset_z', type:'value', on:false, val:'-1.5', tip:'Vertical offset. -2 to 2.' },
    { id:'cf_rhand', cmd:'cl_righthand', label:'cl_righthand', type:'toggle', on:true, val:'1', tip:'0=left, 1=right hand.' },
    { id:'cf_bob', cmd:'cl_bob_lower_amt', label:'cl_bob_lower_amt', type:'value', on:false, val:'21', tip:'Weapon bob when running. 5-30.' },
    { id:'cf_vmsl', cmd:'cl_viewmodel_shift_left_amt', label:'Shift left amt', type:'value', on:false, val:'1.5', tip:'Move-left shift. 0.5-2.' },
    { id:'cf_vmsr', cmd:'cl_viewmodel_shift_right_amt', label:'Shift right amt', type:'value', on:false, val:'0.75', tip:'Move-right shift. 0.25-2.' },
    { id:'cf_vmpreset', cmd:'viewmodel_presetpos', label:'viewmodel_presetpos', type:'value', on:false, val:'0', tip:'0=custom, 1=Desktop, 2=Couch, 3=Classic.' },
  ]},

  /* ── HUD ──────────────────────────────────────────────────── */
  { name: 'HUD', commands: [
    { id:'cf_hudcolor', cmd:'cl_hud_color', label:'cl_hud_color', type:'value', on:false, val:'0', tip:'HUD color. 0=default, 1-10=presets.' },
    { id:'cf_hudalpha', cmd:'cl_hud_background_alpha', label:'HUD bg alpha', type:'value', on:false, val:'0.5', tip:'HUD background transparency. 0-1.' },
    { id:'cf_hudstyle', cmd:'cl_hud_healthammo_style', label:'Health/ammo style', type:'toggle', on:false, val:'0', tip:'0=default, 1=simplified.' },
    { id:'cf_hudscale', cmd:'hud_scaling', label:'hud_scaling', type:'value', on:false, val:'0.85', tip:'HUD size. 0.5-0.95.' },
    { id:'cf_showfps', cmd:'cl_showfps', label:'cl_showfps', type:'value', on:false, val:'1', tip:'0=off, 1=fps, 2=fps+smooth.' },
    { id:'cf_netgraph', cmd:'net_graph', label:'net_graph', type:'toggle', on:false, val:'1', tip:'Network stats overlay.' },
    { id:'cf_observer', cmd:'cl_show_observer_crosshair', label:'Observer crosshair', type:'value', on:false, val:'2', tip:'0=off, 1=friends, 2=all.' },
    { id:'cf_teamid', cmd:'cl_teamid_overhead_always', label:'Team ID overhead', type:'toggle', on:true, val:'1', tip:'Always show teammate info.' },
    { id:'cf_teamidmode', cmd:'cl_teamid_overhead_mode', label:'Team ID mode', type:'value', on:false, val:'2', tip:'0=pips, 1=names, 2=equipment.' },
    { id:'cf_teamidcolor', cmd:'cl_teamid_overhead_colors_show', label:'Team ID colors', type:'toggle', on:true, val:'1', tip:'Show teammate colors above heads.' },
    { id:'cf_loadout', cmd:'cl_showloadout', label:'cl_showloadout', type:'toggle', on:true, val:'1', tip:'Always show weapon loadout.' },
    { id:'cf_plcount', cmd:'cl_hud_playercount_pos', label:'Player count pos', type:'value', on:false, val:'0', tip:'0=top, 1=bottom.' },
    { id:'cf_plshow', cmd:'cl_hud_playercount_showcount', label:'Player count mode', type:'toggle', on:false, val:'1', tip:'0=avatars, 1=count only.' },
    { id:'cf_showpos', cmd:'cl_showpos', label:'cl_showpos', type:'toggle', on:false, val:'0', tip:'Show position/velocity overlay.' },
    { id:'cf_targetid', cmd:'hud_showtargetid', label:'hud_showtargetid', type:'toggle', on:true, val:'1', tip:'Show enemy name on hover.' },
    { id:'cf_deathnotice', cmd:'cl_drawhud_force_deathnotices', label:'Force killfeed', type:'value', on:false, val:'0', tip:'-1=never, 0=with HUD, 1=always.' },
    { id:'cf_tmcolors', cmd:'cl_teammate_colors_show', label:'Teammate colors', type:'toggle', on:true, val:'1', tip:'Unique colors per teammate on radar.' },
    { id:'cf_roundend', cmd:'cl_disable_round_end_report', label:'Disable round report', type:'toggle', on:false, val:'0', tip:'Hide round-end scoreboard.' },
    { id:'cf_hideavatar', cmd:'cl_hide_avatar_images', label:'Hide avatars', type:'value', on:false, val:'0', tip:'0=show, 1=hide all, 2=hide non-friends.' },
    { id:'cf_fastswitch', cmd:'hud_fastswitch', label:'hud_fastswitch', type:'toggle', on:true, val:'1', tip:'Fast weapon switching (no menu).' },
    { id:'cf_showequip', cmd:'+cl_show_team_equipment', label:'Show team equipment', type:'toggle', on:true, val:'', tip:'Always show teammate equipment above heads.' },
    { id:'cf_safex', cmd:'safezonex', label:'safezonex', type:'value', on:false, val:'1.0', tip:'HUD horizontal safe zone. 0.85-1.' },
    { id:'cf_safey', cmd:'safezoney', label:'safezoney', type:'value', on:false, val:'1.0', tip:'HUD vertical safe zone. 0.85-1.' },
  ]},

  /* ── Radar ────────────────────────────────────────────────── */
  { name: 'Radar', commands: [
    { id:'cf_radarscale', cmd:'cl_radar_scale', label:'cl_radar_scale', type:'value', on:false, val:'0.4', tip:'Radar zoom. 0.25-1. Lower = more map visible.' },
    { id:'cf_radarctr', cmd:'cl_radar_always_centered', label:'Radar centered', type:'toggle', on:false, val:'0', tip:'0=smart scroll, 1=always centered.' },
    { id:'cf_radaricon', cmd:'cl_radar_icon_scale_min', label:'Radar icon scale', type:'value', on:false, val:'0.6', tip:'Min radar icon size. 0.4-1.25.' },
    { id:'cf_radarrotate', cmd:'cl_radar_rotate', label:'cl_radar_rotate', type:'toggle', on:true, val:'1', tip:'Radar rotates with player view.' },
    { id:'cf_radarsquare', cmd:'cl_radar_square_with_scoreboard', label:'Square on scoreboard', type:'toggle', on:true, val:'1', tip:'Radar becomes square when scoreboard opens.' },
    { id:'cf_radarhudscale', cmd:'cl_hud_radar_scale', label:'cl_hud_radar_scale', type:'value', on:false, val:'1.0', tip:'Radar HUD size. 0.8-1.3.' },
  ]},

  /* ── Audio ────────────────────────────────────────────────── */
  { name: 'Audio', commands: [
    { id:'cf_vol', cmd:'volume', label:'volume', type:'value', on:false, val:'0.5', tip:'Master volume. 0-1.' },
    { id:'cf_musicvol', cmd:'snd_musicvolume', label:'snd_musicvolume', type:'value', on:false, val:'0', tip:'Music volume. 0=muted.' },
    { id:'cf_hppan', cmd:'snd_headphone_pan_exponent', label:'HP pan exponent', type:'value', on:true, val:'2', tip:'Headphone stereo separation.' },
    { id:'cf_hpfront', cmd:'snd_front_headphone_position', label:'Front HP pos', type:'value', on:true, val:'45', tip:'Front virtual speaker angle.' },
    { id:'cf_hprear', cmd:'snd_rear_headphone_position', label:'Rear HP pos', type:'value', on:true, val:'135', tip:'Rear virtual speaker angle.' },
    { id:'cf_10sec', cmd:'snd_tensecondwarning_volume', label:'10s warning vol', type:'value', on:true, val:'1', tip:'Bomb 10-second warning volume.' },
    { id:'cf_mvpvol', cmd:'snd_mvp_volume', label:'MVP volume', type:'value', on:false, val:'0.3', tip:'MVP music volume.' },
    { id:'cf_deathvol', cmd:'snd_deathcamera_volume', label:'Death cam vol', type:'value', on:false, val:'0.5', tip:'Death camera sound volume.' },
    { id:'cf_voice', cmd:'voice_enable', label:'voice_enable', type:'toggle', on:true, val:'1', tip:'Enable voice chat.' },
    { id:'cf_mutefocus', cmd:'snd_mute_losefocus', label:'Mute on alt-tab', type:'toggle', on:false, val:'0', tip:'Mute when alt-tabbed.' },
    { id:'cf_voipvol', cmd:'snd_voipvolume', label:'snd_voipvolume', type:'value', on:false, val:'1', tip:'Voice chat volume. 0-1.' },
    { id:'cf_rstarvol', cmd:'snd_roundstart_volume', label:'Round start vol', type:'value', on:false, val:'0', tip:'Round start music volume. 0=muted.' },
    { id:'cf_rendvol', cmd:'snd_roundend_volume', label:'Round end vol', type:'value', on:false, val:'0', tip:'Round end music volume. 0=muted.' },
    { id:'cf_mainstep', cmd:'snd_mixahead', label:'snd_mixahead', type:'value', on:false, val:'0.025', tip:'Audio mix buffer. Lower=less delay. 0.025-0.1.' },
    { id:'cf_menumus', cmd:'snd_menumusic_volume', label:'Menu music vol', type:'value', on:false, val:'0', tip:'Main menu music volume.' },
    { id:'cf_mapobjvol', cmd:'snd_mapobjective_volume', label:'Map objective vol', type:'value', on:false, val:'0.5', tip:'Map objective music volume.' },
    { id:'cf_voicethresh', cmd:'voice_threshold', label:'voice_threshold', type:'value', on:false, val:'2000', tip:'Mic activation threshold (voice activation mode).' },
    { id:'cf_voicevox', cmd:'voice_vox', label:'voice_vox', type:'toggle', on:false, val:'0', tip:'Voice-activated mic (no push-to-talk).' },
    { id:'cf_voiceloop', cmd:'voice_loopback', label:'voice_loopback', type:'toggle', on:false, val:'0', tip:'Hear your own mic in-game (test).' },
    { id:'cf_steamocclusion', cmd:'snd_steamaudio_max_occlusion_samples', label:'Steam Audio samples', type:'value', on:false, val:'32', tip:'Occlusion ray count for Steam Audio. More=quality, fewer=FPS.' },
  ]},

  /* ── Mouse & Input ────────────────────────────────────────── */
  { name: 'Mouse & Input', commands: [
    { id:'cf_sens', cmd:'sensitivity', label:'sensitivity', type:'value', on:true, val:'1.8', tip:'Mouse sensitivity.' },
    { id:'cf_raw', cmd:'m_rawinput', label:'m_rawinput', type:'toggle', on:true, val:'1', tip:'Raw mouse input. Bypasses OS accel.' },
    { id:'cf_zoom', cmd:'zoom_sensitivity_ratio', label:'Zoom sensitivity', type:'value', on:false, val:'1.0', tip:'Scoped sensitivity multiplier.' },
    { id:'cf_pitch', cmd:'m_pitch', label:'m_pitch', type:'value', on:false, val:'0.022', tip:'Mouse pitch (vertical) speed.' },
    { id:'cf_yaw', cmd:'m_yaw', label:'m_yaw', type:'value', on:false, val:'0.022', tip:'Mouse yaw (horizontal) speed.' },
    { id:'cf_radialimm', cmd:'cl_inventory_radial_immediate_select', label:'Radial quick select', type:'toggle', on:false, val:'1', tip:'Select weapon on highlight in radial menu.' },
    { id:'cf_radialtap', cmd:'cl_inventory_radial_tap_to_cycle', label:'Radial tap cycle', type:'toggle', on:false, val:'0', tip:'Tap to cycle weapons in radial.' },
    { id:'cf_radialdeadzone', cmd:'cl_radialmenu_deadzone_size', label:'Radial deadzone', type:'value', on:false, val:'0.02', tip:'Radial menu deadzone size.' },
  ]},

  /* ── Network ──────────────────────────────────────────────── */
  { name: 'Network', commands: [
    { id:'cf_rate', cmd:'rate', label:'rate', type:'value', on:true, val:'786432', tip:'Max bytes/sec from server. 786432=max.' },
    { id:'cf_interp', cmd:'cl_interp', label:'cl_interp', type:'value', on:true, val:'0', tip:'Interpolation delay. 0=auto.' },
    { id:'cf_interpr', cmd:'cl_interp_ratio', label:'cl_interp_ratio', type:'value', on:true, val:'1', tip:'1=minimal, 2=safe.' },
    { id:'cf_updrate', cmd:'cl_updaterate', label:'cl_updaterate', type:'value', on:true, val:'128', tip:'Packets/sec from server.' },
    { id:'cf_cmdrate', cmd:'cl_cmdrate', label:'cl_cmdrate', type:'value', on:true, val:'128', tip:'Packets/sec to server.' },
    { id:'cf_steamdg', cmd:'net_client_steamdatagram_enable_override', label:'Steam Datagram', type:'value', on:true, val:'1', tip:'1=force SDR relay. Lower ping to Valve servers.' },
    { id:'cf_predict', cmd:'cl_predict', label:'cl_predict', type:'toggle', on:true, val:'1', tip:'Client-side prediction. Always keep on.' },
    { id:'cf_lagcomp', cmd:'cl_lagcompensation', label:'cl_lagcompensation', type:'toggle', on:true, val:'1', tip:'Lag compensation. Always keep on.' },
    { id:'cf_resend', cmd:'cl_resend', label:'cl_resend', type:'value', on:false, val:'2', tip:'Seconds before retry on failed connect. 1.5-20.' },
    { id:'cf_netbuffer', cmd:'cl_net_buffer_ticks', label:'cl_net_buffer_ticks', type:'value', on:false, val:'0', tip:'Buffer ticks for snapshots. 0=auto, 1=minimal.' },
    { id:'cf_clockrecv', cmd:'cl_clock_recvmargin_enable', label:'Clock recv margin', type:'toggle', on:false, val:'1', tip:'New clock sync strategy for better network perf.' },
    { id:'cf_cqminqueue', cmd:'cl_cq_min_queue', label:'cl_cq_min_queue', type:'value', on:false, val:'0', tip:'-1=off, 0=server decides, >0=min queue size.' },
    { id:'cf_telping', cmd:'cl_hud_telemetry_ping_show', label:'Telemetry ping', type:'value', on:false, val:'1', tip:'0=never, 1=when poor, 2=always show ping.' },
    { id:'cf_telpingpoor', cmd:'cl_hud_telemetry_ping_poor', label:'Poor ping threshold', type:'value', on:false, val:'100', tip:'Ping (ms) considered poor for HUD telemetry.' },
    { id:'cf_telft', cmd:'cl_hud_telemetry_frametime_show', label:'Telemetry frametime', type:'value', on:false, val:'0', tip:'0=never, 1=when poor, 2=always show frametime.' },
    { id:'cf_telftpoor', cmd:'cl_hud_telemetry_frametime_poor', label:'Poor FT threshold', type:'value', on:false, val:'10', tip:'Frametime (ms) considered poor for HUD telemetry.' },
    { id:'cf_telloss', cmd:'cl_hud_telemetry_net_misdelivery_show', label:'Telemetry loss', type:'value', on:false, val:'1', tip:'0=never, 1=when poor, 2=always show packet loss.' },
    { id:'cf_tellosspoor', cmd:'cl_hud_telemetry_net_misdelivery_poor', label:'Poor loss threshold', type:'value', on:false, val:'5', tip:'Loss rate (%) considered poor for HUD telemetry.' },
    { id:'cf_recvmargin', cmd:'cl_hud_telemetry_serverrecvmargin_graph_show', label:'Recv margin graph', type:'toggle', on:false, val:'0', tip:'Show server receive margin graph on HUD.' },
  ]},

  /* ── Voice & Communication ────────────────────────────────── */
  { name: 'Voice & Comms', commands: [
    { id:'cf_mute', cmd:'cl_mute_enemy_team', label:'Mute enemy team', type:'toggle', on:false, val:'0', tip:'Mute all enemy voice/text.' },
    { id:'cf_mutefriends', cmd:'cl_mute_all_but_friends_and_party', label:'Mute non-friends', type:'toggle', on:false, val:'0', tip:'Only hear Steam friends and party.' },
    { id:'cf_clutchmode', cmd:'cl_clutch_mode', label:'cl_clutch_mode', type:'toggle', on:false, val:'0', tip:'Auto-mute voice in clutch scenarios.' },
    { id:'cf_sanitize', cmd:'cl_sanitize_player_names', label:'Sanitize names', type:'toggle', on:false, val:'0', tip:'Replace player names with generic labels.' },
    { id:'cf_sanmuted', cmd:'cl_sanitize_muted_players', label:'Sanitize muted', type:'toggle', on:false, val:'0', tip:'Hide names/avatars of muted players.' },
    { id:'cf_pingmute', cmd:'cl_player_ping_mute', label:'Mute ping sound', type:'toggle', on:false, val:'0', tip:'Mute the ping system audio.' },
  ]},

  /* ── Buy & Economy ────────────────────────────────────────── */
  { name: 'Buy & Economy', commands: [
    { id:'cf_buymenu', cmd:'cl_use_opens_buy_menu', label:'Use opens buy', type:'toggle', on:false, val:'0', tip:'Prevent E from opening buy menu.' },
    { id:'cf_autowep', cmd:'cl_autowepswitch', label:'Auto weapon switch', type:'toggle', on:false, val:'0', tip:'Auto-switch to picked up weapons.' },
    { id:'cf_silencer', cmd:'cl_silencer_mode', label:'Silencer mode', type:'value', on:false, val:'0', tip:'0=toggle, 1=always on, 2=always off.' },
    { id:'cf_buywarn', cmd:'cl_buywheel_nomousecentering', label:'Buy wheel no recentering', type:'toggle', on:false, val:'0', tip:'Prevent mouse recentering in buy menu.' },
    { id:'cf_buydonate', cmd:'cl_buywheel_donate_key', label:'Donate key', type:'value', on:false, val:'0', tip:'Key to donate weapons in buy menu.' },
    { id:'cf_showgrenade', cmd:'cl_grenadepreview', label:'cl_grenadepreview', type:'toggle', on:false, val:'0', tip:'Show grenade trajectory preview.' },
  ]},

  /* ── Spectator & Demo ─────────────────────────────────────── */
  { name: 'Spectator & Demo', commands: [
    { id:'cf_snaptarget', cmd:'cl_snaptarget', label:'cl_snaptarget', type:'toggle', on:false, val:'0', tip:'Snap spectator camera to targets.' },
    { id:'cf_specswap', cmd:'cl_spec_swapplayersides', label:'Swap player sides', type:'toggle', on:false, val:'0', tip:'Swap team sides in spectator HUD.' },
    { id:'cf_xraydefuse', cmd:'spec_xray_dropped_defusekits', label:'X-ray defuse kits', type:'toggle', on:false, val:'1', tip:'Highlight dropped defuse kits in spectator.' },
    { id:'cf_xraydrop', cmd:'spec_xray_dropped_unoccluded', label:'X-ray C4/kits', type:'toggle', on:false, val:'1', tip:'Always show C4/kits through walls in spectator.' },
  ]},

  /* ── Misc & QoL ───────────────────────────────────────────── */
  { name: 'Misc & QoL', commands: [
    { id:'cf_console', cmd:'con_enable', label:'con_enable', type:'toggle', on:true, val:'1', tip:'Enable developer console (~).' },
    { id:'cf_autohelp', cmd:'cl_autohelp', label:'cl_autohelp', type:'toggle', on:false, val:'0', tip:'Disable in-game help messages.' },
    { id:'cf_instructor', cmd:'gameinstructor_enable', label:'Game instructor', type:'toggle', on:false, val:'0', tip:'Disable tutorial tips.' },
    { id:'cf_joinadv', cmd:'cl_join_advertise', label:'Friends can join', type:'value', on:false, val:'2', tip:'0=no, 1=friends, 2=friends of friends.' },
    { id:'cf_maxping', cmd:'mm_dedicated_search_maxping', label:'Max MM ping', type:'value', on:false, val:'80', tip:'Max matchmaking ping.' },
    { id:'cf_confilter', cmd:'con_filter_enable', label:'Console filter', type:'toggle', on:false, val:'0', tip:'Enable console output filtering.' },
    { id:'cf_autoaccept', cmd:'ui_setting_advertiseforhire_auto', label:'Auto-accept lobby', type:'value', on:false, val:'1', tip:'1=auto-accept lobby invites.' },
    { id:'cf_deathnum', cmd:'cl_deathnotices_show_numbers', label:'Killfeed numbers', type:'toggle', on:false, val:'0', tip:'Show numbers in killfeed.' },
    { id:'cf_clanid', cmd:'cl_clanid', label:'cl_clanid', type:'value', on:false, val:'', tip:'Steam group tag (clan tag) to display.' },
    { id:'cf_freezecam', cmd:'cl_disablefreezecam', label:'Disable freeze cam', type:'toggle', on:false, val:'0', tip:'Skip death freeze camera.' },
    { id:'cf_showmem', cmd:'cl_showmem', label:'cl_showmem', type:'toggle', on:false, val:'0', tip:'Show memory usage overlay.' },
    { id:'cf_autocursor', cmd:'cl_auto_cursor_scale', label:'Auto cursor scale', type:'toggle', on:true, val:'1', tip:'Scale cursor size with resolution.' },
    { id:'cf_cursorscale', cmd:'cl_cursor_scale', label:'cl_cursor_scale', type:'value', on:false, val:'1', tip:'Manual cursor scale factor.' },
  ]},
];

/* ── CFG helper functions ─────────────────────────────────────── */

function updateCfgCounter() {
  let n = 0;
  for (const cat of CFG) for (const c of cat.commands) {
    const el = document.getElementById(c.id) as HTMLInputElement | null;
    if (el?.checked) n++;
  }
  const d = document.getElementById('cfg-count');
  if (d) d.textContent = String(n);
}

function collectCfgContent(): string {
  const L: string[] = [
    '// Generated by aim.camp Player Agent - CS2 CFG Manager',
    `// Theme: ${THEMES[currentThemeIdx].name}`,
    `// Date: ${new Date().toISOString().slice(0, 10)}`,
    '',
  ];
  for (const cat of CFG) {
    const cl: string[] = [];
    for (const c of cat.commands) {
      const el = document.getElementById(c.id) as HTMLInputElement | null;
      if (!el?.checked) continue;
      if (c.type === 'toggle') {
        cl.push(c.val === '' ? c.cmd : `${c.cmd} ${c.val}`);
      } else {
        const v = (document.getElementById(`${c.id}_v`) as HTMLInputElement | null)?.value || c.val;
        cl.push(c.val === '' && !v ? c.cmd : `${c.cmd} ${v}`);
      }
    }
    if (cl.length) { L.push(`// -- ${cat.name} --`); L.push(...cl); L.push(''); }
  }
  return L.join('\n');
}

function parseCfgContent(content: string) {
  for (const cat of CFG) for (const c of cat.commands) {
    setChecked(c.id, false);
    if (c.type === 'value') setVal(`${c.id}_v`, c.val);
  }
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//')) continue;
    for (const cat of CFG) for (const c of cat.commands) {
      const rx = new RegExp(`^${c.cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(.+)$`, 'i');
      const m = t.match(rx);
      if (m) { setChecked(c.id, true); if (c.type === 'value') setVal(`${c.id}_v`, m[1].trim()); }
    }
  }
  updateCfgCounter();
}

function resetCfgDefaults() {
  for (const cat of CFG) for (const c of cat.commands) {
    setChecked(c.id, c.on);
    if (c.type === 'value') setVal(`${c.id}_v`, c.val);
  }
  updateCfgCounter();
}

async function saveCfgFile() {
  try {
    const content = collectCfgContent();
    await invoke('save_cfg', { cfgContent: content });
    toast('CFG saved successfully');
  } catch (e) { console.error(e); toast('Error saving CFG', true); }
}

async function loadCfgFile() {
  try {
    const r = await invoke<{ path: string; content: string }>('load_cfg');
    parseCfgContent(r.content);
    toast(`Loaded: ${r.path.split('\\').pop()}`);
  } catch (e) { console.error(e); }
}

/* ================================================================
   Pro Player Configs
   ================================================================ */
interface ProConfig {
  name: string; team: string;
  sens: string; dpi: string; zoom: string;
  xhStyle: string; xhSize: string; xhGap: string; xhThick: string;
  xhColor: string; xhDot: boolean; xhOutline: boolean;
  vmFov: string; vmX: string; vmY: string; vmZ: string;
  res: string;
}

const PRO_CONFIGS: ProConfig[] = [
  { name:'s1mple', team:'NAVI', sens:'3.09', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'2', xhGap:'-3', xhThick:'0', xhColor:'1', xhDot:false, xhOutline:false, vmFov:'68', vmX:'2.5', vmY:'0', vmZ:'-1.5', res:'1280x960' },
  { name:'ZywOo', team:'Vitality', sens:'2', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'1.5', xhGap:'-3', xhThick:'0', xhColor:'1', xhDot:false, xhOutline:true, vmFov:'68', vmX:'2.5', vmY:'2', vmZ:'-2', res:'1280x960' },
  { name:'NiKo', team:'G2', sens:'1.58', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'3', xhGap:'-3', xhThick:'0', xhColor:'4', xhDot:false, xhOutline:true, vmFov:'68', vmX:'0', vmY:'0', vmZ:'0', res:'1920x1080' },
  { name:'donk', team:'Spirit', sens:'1.35', dpi:'800', zoom:'0.9', xhStyle:'4', xhSize:'1', xhGap:'-3', xhThick:'0', xhColor:'1', xhDot:false, xhOutline:false, vmFov:'68', vmX:'2.5', vmY:'2', vmZ:'-2', res:'1280x960' },
  { name:'m0NESY', team:'G2', sens:'1.68', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'1.5', xhGap:'-3', xhThick:'0', xhColor:'1', xhDot:false, xhOutline:true, vmFov:'68', vmX:'0', vmY:'2', vmZ:'-2', res:'1280x960' },
  { name:'device', team:'Astralis', sens:'1.8', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'2', xhGap:'-2', xhThick:'0', xhColor:'1', xhDot:false, xhOutline:true, vmFov:'68', vmX:'2.5', vmY:'2', vmZ:'-2', res:'1280x960' },
  { name:'ropz', team:'FaZe', sens:'1.77', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'1', xhGap:'-3', xhThick:'0', xhColor:'1', xhDot:true, xhOutline:false, vmFov:'68', vmX:'2.5', vmY:'0', vmZ:'-1.5', res:'1920x1080' },
  { name:'electronic', team:'VP', sens:'2.2', dpi:'400', zoom:'1.0', xhStyle:'4', xhSize:'2', xhGap:'-2', xhThick:'0', xhColor:'5', xhDot:false, xhOutline:true, vmFov:'68', vmX:'2', vmY:'0', vmZ:'-2', res:'1280x960' },
];

function applyProConfig(p: ProConfig) {
  setVal('cf_sens_v', p.sens); setChecked('cf_sens', true);
  setVal('cf_zoom_v', p.zoom); setChecked('cf_zoom', true);
  setVal('cf_xhstyle_v', p.xhStyle); setChecked('cf_xhstyle', true);
  setVal('cf_xhsize_v', p.xhSize); setChecked('cf_xhsize', true);
  setVal('cf_xhgap_v', p.xhGap); setChecked('cf_xhgap', true);
  setVal('cf_xhthick_v', p.xhThick); setChecked('cf_xhthick', true);
  setVal('cf_xhcolor_v', p.xhColor); setChecked('cf_xhcolor', true);
  setChecked('cf_xhdot', p.xhDot);
  setChecked('cf_xhoutline', p.xhOutline);
  setVal('cf_vmfov_v', p.vmFov); setChecked('cf_vmfov', true);
  setVal('cf_vmx_v', p.vmX); setChecked('cf_vmx', true);
  setVal('cf_vmy_v', p.vmY); setChecked('cf_vmy', true);
  setVal('cf_vmz_v', p.vmZ); setChecked('cf_vmz', true);
  updateCfgCounter();
  drawCrosshair();
  toast(`Loaded ${p.name} config`);
}

/* ================================================================
   Crosshair Preview
   ================================================================ */
function drawCrosshair() {
  const canvas = document.getElementById('xhair-cvs') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  const gap = Number.parseFloat((document.getElementById('cf_xhgap_v') as HTMLInputElement)?.value || '-1');
  const size = Number.parseFloat((document.getElementById('cf_xhsize_v') as HTMLInputElement)?.value || '2.5');
  const thick = Math.max(1, Number.parseFloat((document.getElementById('cf_xhthick_v') as HTMLInputElement)?.value || '0.5'));
  const dot = (document.getElementById('cf_xhdot') as HTMLInputElement)?.checked || false;
  const outline = (document.getElementById('cf_xhoutline') as HTMLInputElement)?.checked || false;
  const tShape = (document.getElementById('cf_xht') as HTMLInputElement)?.checked || false;

  const colorMap: Record<string, string> = { '0':'#ff0000', '1':'#00ff00', '2':'#ffff00', '3':'#3344ff', '4':'#00ffff', '5':'#ff8800' };
  const colorIdx = (document.getElementById('cf_xhcolor_v') as HTMLInputElement)?.value || '1';
  const color = colorMap[colorIdx] || '#00ff00';

  const s = size * 3;
  const g = (gap + 4) * 1.5;
  const t = thick * 2;

  if (outline) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const o = 1;
    ctx.fillRect(cx + g - o, cy - t / 2 - o, s + o * 2, t + o * 2);
    ctx.fillRect(cx - g - s - o, cy - t / 2 - o, s + o * 2, t + o * 2);
    ctx.fillRect(cx - t / 2 - o, cy + g - o, t + o * 2, s + o * 2);
    if (!tShape) ctx.fillRect(cx - t / 2 - o, cy - g - s - o, t + o * 2, s + o * 2);
  }

  ctx.fillStyle = color;
  ctx.fillRect(cx + g, cy - t / 2, s, t);
  ctx.fillRect(cx - g - s, cy - t / 2, s, t);
  ctx.fillRect(cx - t / 2, cy + g, t, s);
  if (!tShape) ctx.fillRect(cx - t / 2, cy - g - s, t, s);

  if (dot) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}

/* ================================================================
   Process Manager — flagged processes (resource hogs)
   ================================================================ */
const PROC_FLAGS = new Set([
  'chrome', 'firefox', 'msedge', 'opera', 'brave',
  'discord', 'teams', 'slack', 'zoom',
  'icue', 'icue4', 'corsaircuesvc', 'razersynapse', 'synapse3', 'nzxtcam',
  'asusaura', 'lghub', 'lcore', 'steelseries',
  'obs64', 'obs', 'streamlabs', 'xsplit',
  'onedrive', 'dropbox', 'googledrive',
  'mcafee', 'norton', 'avast', 'avg',
  'wallpaperengine', 'wallpaper32', 'cortana', 'widgets',
  'spotify', 'itunes', 'epicgameslauncher', 'galaxyclient',
]);

/* ================================================================
   Network servers to ping
   ================================================================ */
const NET_SERVERS = [
  { name: 'Valve EU West', host: 'ams.valve.net' },
  { name: 'Valve EU East', host: 'vie.valve.net' },
  { name: 'Valve EU North', host: 'sto.valve.net' },
  { name: 'Valve NA East', host: 'eat.valve.net' },
  { name: 'Valve NA West', host: 'lax.valve.net' },
  { name: 'Valve SA', host: 'gru.valve.net' },
  { name: 'FACEIT EU (1)', host: 'fra.valve.net' },
  { name: 'FACEIT NA', host: 'chi.valve.net' },
  { name: 'Cloudflare DNS', host: '1.1.1.1' },
  { name: 'Google DNS', host: '8.8.8.8' },
];

/* ================================================================
   Config Profiles — save/load SYS+CFG state to localStorage
   ================================================================ */
function collectFullState(): Record<string, string | boolean> {
  const s: Record<string, string | boolean> = {};
  document.querySelectorAll<HTMLInputElement>('#tab-optimizer input, #tab-cfg input').forEach(el => {
    if (!el.id) return;
    if (el.type === 'checkbox') s[el.id] = el.checked;
    else s[el.id] = el.value;
  });
  document.querySelectorAll<HTMLTextAreaElement>('#tab-optimizer textarea, #tab-cfg textarea').forEach(el => {
    if (el.id) s[el.id] = el.value;
  });
  return s;
}

function restoreFullState(s: Record<string, string | boolean>) {
  for (const [id, val] of Object.entries(s)) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = val as boolean;
    else el.value = val as string;
  }
  updateImpact();
  updateCfgCounter();
  drawCrosshair();
}

function saveProfile(name: string) {
  const profiles = JSON.parse(localStorage.getItem('csmooth_profiles') || '{}');
  profiles[name] = collectFullState();
  localStorage.setItem('csmooth_profiles', JSON.stringify(profiles));
}

function loadProfile(name: string) {
  const profiles = JSON.parse(localStorage.getItem('csmooth_profiles') || '{}');
  if (profiles[name]) { restoreFullState(profiles[name]); toast(`Profile: ${name}`); }
}

function deleteProfile(name: string) {
  const profiles = JSON.parse(localStorage.getItem('csmooth_profiles') || '{}');
  delete profiles[name];
  localStorage.setItem('csmooth_profiles', JSON.stringify(profiles));
}

function getProfileNames(): string[] {
  return Object.keys(JSON.parse(localStorage.getItem('csmooth_profiles') || '{}'));
}

/* ================================================================
   HW / PROC / NET tab builders (called from build)
   ================================================================ */

function hwRow(label: string, value: string): HTMLDivElement {
  const r = document.createElement('div');
  r.className = 'hw-row';
  r.innerHTML = `<span class="hw-label">${label}</span><span class="hw-value">${value}</span>`;
  return r;
}

function hwStatus(label: string, state: string): HTMLDivElement {
  const r = document.createElement('div');
  r.className = 'hw-row';
  const cls = state === 'ON' ? 'on' : state === 'OFF' ? 'off' : 'unknown';
  r.innerHTML = `<span class="hw-label">${label}</span><span class="hw-status ${cls}">${state}</span>`;
  return r;
}

/* ================================================================
   Driver Info — system + peripheral drivers
   ================================================================ */

interface DriverEntry {
  category: string;
  device_name: string;
  driver_name: string;
  driver_version: string;
  driver_provider: string;
  manufacturer: string;
  driver_date: string;
  days_old: number;
  is_signed: boolean;
  is_generic: boolean;
  status: string; // 'current' | 'aging' | 'outdated' | 'unknown'
}

const DRV_CATEGORY_ICONS: Record<string, string> = {
  GPU: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h4v4H6z"/><circle cx="16" cy="12" r="2"/></svg>',
  Monitor: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  Audio: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  Network: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  Mouse: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="7" x2="12" y2="11"/></svg>',
  Keyboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>',
  Controller: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="16" height="8" rx="4"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/></svg>',
};

const DRV_CATEGORY_LABELS: Record<string, string> = {
  GPU: 'Placa Gráfica (GPU)',
  Monitor: 'Monitor',
  Audio: 'Áudio',
  Network: 'Rede',
  Mouse: 'Rato / Mouse',
  Keyboard: 'Teclado',
  Controller: 'Controlador de Jogo',
};

/* ================================================================
   Feedback / Suggestions — interfaces & logic
   ================================================================ */

interface FeedbackEntry {
  id: string;
  tab: string;
  description: string;
  screenshot_b64: string;
  sent: string;
  timestamp: string;
}

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: '🐛 Bug / Erro', color: '#ef4444' },
  { value: 'feature', label: '💡 Sugestão / Feature', color: '#3b82f6' },
  { value: 'ui', label: '🎨 Interface / UI', color: '#a855f7' },
  { value: 'perf', label: '⚡ Performance', color: '#f59e0b' },
  { value: 'other', label: '📝 Outro', color: '#6b7280' },
];

function getCurrentTabName(): string {
  const active = document.querySelector('.sidebar-btn.active span');
  return active?.textContent || 'SYS';
}

let feedbackScreenshotB64 = '';

async function captureAppScreenshot(): Promise<string> {
  try {
    const b64: string = await invoke('capture_screenshot');
    return b64;
  } catch (e) {
    console.warn('Screenshot capture failed:', e);
    return '';
  }
}

function showFeedbackModal(preScreenshot?: string) {
  const existing = document.querySelector('.fdbk-overlay');
  if (existing) existing.remove();

  const currentTab = getCurrentTabName();
  feedbackScreenshotB64 = preScreenshot || '';

  const overlay = document.createElement('div');
  overlay.className = 'fdbk-overlay';

  overlay.innerHTML = `
    <div class="fdbk-modal">
      <div class="fdbk-modal-header">
        <h3>📝 Nova Sugestão / Feedback</h3>
        <button class="fdbk-close" id="fdbk-close">&times;</button>
      </div>

      <div class="fdbk-modal-body">
        <div class="fdbk-screenshot-area" id="fdbk-screenshot-area">
          ${feedbackScreenshotB64
            ? `<img src="data:image/png;base64,${feedbackScreenshotB64}" class="fdbk-screenshot-preview" />`
            : '<div class="fdbk-screenshot-placeholder">📷 A capturar screenshot...</div>'}
        </div>

        <div class="fdbk-form">
          <label class="fdbk-label">Categoria</label>
          <select id="fdbk-category" class="fdbk-select">
            ${FEEDBACK_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
          </select>

          <label class="fdbk-label">Tab Atual</label>
          <input type="text" id="fdbk-tab" class="fdbk-input" value="${currentTab}" readonly />

          <label class="fdbk-label">Descrição</label>
          <textarea id="fdbk-desc" class="fdbk-textarea" rows="5" placeholder="Descreve o problema, sugestão ou feedback...\n\nExemplo: O botão X não funciona quando..."></textarea>

          <div class="fdbk-actions">
            <button class="fdbk-btn fdbk-btn-save" id="fdbk-save">💾 Guardar Local</button>
            <button class="fdbk-btn fdbk-btn-discord" id="fdbk-send-discord">🎮 Enviar Discord</button>
            <button class="fdbk-btn fdbk-btn-github" id="fdbk-send-github">🐙 Enviar GitHub</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // If no screenshot yet, capture it now
  if (!feedbackScreenshotB64) {
    captureAppScreenshot().then(b64 => {
      feedbackScreenshotB64 = b64;
      const area = document.getElementById('fdbk-screenshot-area');
      if (area && b64) {
        area.innerHTML = `<img src="data:image/png;base64,${b64}" class="fdbk-screenshot-preview" />`;
      } else if (area) {
        area.innerHTML = '<div class="fdbk-screenshot-placeholder">⚠ Não foi possível capturar screenshot</div>';
      }
    });
  }

  // Close handlers
  document.getElementById('fdbk-close')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Save locally
  document.getElementById('fdbk-save')!.addEventListener('click', async () => {
    const desc = (document.getElementById('fdbk-desc') as HTMLTextAreaElement).value.trim();
    const cat = (document.getElementById('fdbk-category') as HTMLSelectElement).value;
    const tab = (document.getElementById('fdbk-tab') as HTMLInputElement).value;
    if (!desc) { toast('Escreve uma descrição'); return; }

    const id = crypto.randomUUID();
    try {
      await invoke('save_feedback', {
        id,
        tab: `[${cat}] ${tab}`,
        description: desc,
        screenshotB64: feedbackScreenshotB64,
        sent: 'local',
      });
      toast('✅ Feedback guardado localmente');
      overlay.remove();
      refreshFeedbackHistory();
    } catch (e) {
      toast(`Erro ao guardar: ${e}`);
    }
  });

  // Send to Discord
  document.getElementById('fdbk-send-discord')!.addEventListener('click', async () => {
    const desc = (document.getElementById('fdbk-desc') as HTMLTextAreaElement).value.trim();
    const cat = (document.getElementById('fdbk-category') as HTMLSelectElement).value;
    const tab = (document.getElementById('fdbk-tab') as HTMLInputElement).value;
    if (!desc) { toast('Escreve uma descrição'); return; }

    const wh = getDiscordWebhook();
    if (!wh) { showDiscordModal(() => toast('Webhook guardado. Tenta enviar novamente.')); return; }

    const id = crypto.randomUUID();
    const fullDesc = `**[${FEEDBACK_CATEGORIES.find(c => c.value === cat)?.label || cat}]** Tab: ${tab}\n\n${desc}`;

    try {
      const btn = document.getElementById('fdbk-send-discord') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = '⏳ A enviar...';

      await invoke('send_feedback_discord_with_image', {
        webhookUrl: wh,
        description: fullDesc,
        tab,
        screenshotB64: feedbackScreenshotB64,
      });

      // Also save locally
      await invoke('save_feedback', {
        id,
        tab: `[${cat}] ${tab}`,
        description: desc,
        screenshotB64: feedbackScreenshotB64,
        sent: 'discord',
      });

      toast('✅ Feedback enviado para Discord!');
      overlay.remove();
      refreshFeedbackHistory();
    } catch (e) {
      toast(`Erro Discord: ${e}`);
      const btn = document.getElementById('fdbk-send-discord') as HTMLButtonElement;
      if (btn) { btn.disabled = false; btn.textContent = '🎮 Enviar Discord'; }
    }
  });

  // Send to GitHub
  document.getElementById('fdbk-send-github')!.addEventListener('click', async () => {
    const desc = (document.getElementById('fdbk-desc') as HTMLTextAreaElement).value.trim();
    const cat = (document.getElementById('fdbk-category') as HTMLSelectElement).value;
    const tab = (document.getElementById('fdbk-tab') as HTMLInputElement).value;
    if (!desc) { toast('Escreve uma descrição'); return; }

    const token = localStorage.getItem('csmooth_github_token') || '';
    const repo = localStorage.getItem('csmooth_github_repo') || '';
    if (!token || !repo) {
      showGitHubConfigModal();
      return;
    }

    const id = crypto.randomUUID();
    const catLabel = FEEDBACK_CATEGORIES.find(c => c.value === cat)?.label || cat;
    const title = `[${catLabel}] ${desc.substring(0, 80)}`;
    const body = `## Feedback — Player Agent\n\n**Categoria:** ${catLabel}\n**Tab:** ${tab}\n**Data:** ${new Date().toLocaleString('pt-PT')}\n\n### Descrição\n${desc}\n\n---\n*Enviado automaticamente pelo Player Agent*`;

    try {
      const btn = document.getElementById('fdbk-send-github') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = '⏳ A criar issue...';

      await invoke('send_feedback_github', {
        token,
        repo,
        title,
        body,
        screenshotB64: feedbackScreenshotB64,
        labels: ['feedback', cat],
      });

      await invoke('save_feedback', {
        id,
        tab: `[${cat}] ${tab}`,
        description: desc,
        screenshotB64: feedbackScreenshotB64,
        sent: 'github',
      });

      toast('✅ Issue criada no GitHub!');
      overlay.remove();
      refreshFeedbackHistory();
    } catch (e) {
      toast(`Erro GitHub: ${e}`);
      const btn = document.getElementById('fdbk-send-github') as HTMLButtonElement;
      if (btn) { btn.disabled = false; btn.textContent = '🐙 Enviar GitHub'; }
    }
  });
}

function showGitHubConfigModal() {
  const existing = document.querySelector('.gh-overlay');
  if (existing) existing.remove();

  const token = localStorage.getItem('csmooth_github_token') || '';
  const repo = localStorage.getItem('csmooth_github_repo') || '';

  const overlay = document.createElement('div');
  overlay.className = 'gh-overlay';
  overlay.innerHTML = `
    <div class="ai-modal">
      <h3>🐙 GitHub Configuration</h3>
      <label>Personal Access Token</label>
      <input type="password" id="gh-token" value="${token}" placeholder="ghp_xxxxxxxxxxxx" />
      <label>Repository (owner/repo)</label>
      <input type="text" id="gh-repo" value="${repo}" placeholder="username/aim.camp" />
      <div style="font-size:9px;opacity:0.4;margin-top:6px;">
        Cria um <a href="#" id="gh-link" style="color:var(--primary);text-decoration:underline;">Personal Access Token</a> no GitHub com permissão "repo" → Issues.
      </div>
      <div class="ai-modal-actions">
        <button class="ai-cancel" id="gh-cancel">Cancelar</button>
        <button class="ai-save" id="gh-save">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('gh-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('gh-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    shellOpen('https://github.com/settings/tokens/new?scopes=repo&description=PlayerAgent+Feedback');
  });

  document.getElementById('gh-save')!.addEventListener('click', () => {
    const t = (document.getElementById('gh-token') as HTMLInputElement).value.trim();
    const r = (document.getElementById('gh-repo') as HTMLInputElement).value.trim();
    if (t) localStorage.setItem('csmooth_github_token', t);
    if (r) localStorage.setItem('csmooth_github_repo', r);
    overlay.remove();
    toast('GitHub configurado!');
  });
}

async function refreshFeedbackHistory() {
  const el = document.getElementById('fdbk-history');
  if (!el) return;

  try {
    const entries = await invoke<FeedbackEntry[]>('load_feedback_history');

    if (!entries || entries.length === 0) {
      el.innerHTML = `
        <div class="fdbk-empty">
          <div class="fdbk-empty-icon">📝</div>
          <div class="fdbk-empty-text">Sem feedback registado</div>
          <div class="fdbk-empty-hint">Clique direito em qualquer parte da app para enviar sugestões, ou usa o botão abaixo.</div>
        </div>`;
      return;
    }

    // Sort newest first
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    el.innerHTML = `<div class="fdbk-count">${entries.length} feedback${entries.length !== 1 ? 's' : ''} registado${entries.length !== 1 ? 's' : ''}</div>`;

    for (const entry of entries) {
      const card = document.createElement('div');
      card.className = 'fdbk-card';

      const sentBadge = entry.sent === 'discord'
        ? '<span class="fdbk-sent-badge discord">🎮 Discord</span>'
        : entry.sent === 'github'
        ? '<span class="fdbk-sent-badge github">🐙 GitHub</span>'
        : '<span class="fdbk-sent-badge local">💾 Local</span>';

      const dateStr = entry.timestamp
        ? new Date(entry.timestamp).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'N/A';

      card.innerHTML = `
        <div class="fdbk-card-header">
          <span class="fdbk-card-tab">${entry.tab}</span>
          ${sentBadge}
          <span class="fdbk-card-date">${dateStr}</span>
          <button class="fdbk-card-delete" data-id="${entry.id}" title="Apagar">🗑</button>
        </div>
        ${entry.screenshot_b64 ? `<img src="data:image/png;base64,${entry.screenshot_b64}" class="fdbk-card-thumb" loading="lazy" />` : ''}
        <div class="fdbk-card-desc">${entry.description}</div>
      `;
      el.appendChild(card);

      // Delete handler
      card.querySelector('.fdbk-card-delete')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).dataset.id;
        if (!id) return;
        try {
          await invoke('delete_feedback', { id });
          toast('Feedback apagado');
          refreshFeedbackHistory();
        } catch (e) {
          toast(`Erro ao apagar: ${e}`);
        }
      });

      // Click to resend
      card.addEventListener('click', () => {
        showFeedbackModal(entry.screenshot_b64);
        const descField = document.getElementById('fdbk-desc') as HTMLTextAreaElement;
        if (descField) descField.value = entry.description;
      });
    }
  } catch (e) {
    el.innerHTML = `<div class="fdbk-empty"><div class="fdbk-empty-text">Erro ao carregar histórico: ${e}</div></div>`;
  }
}

/* Right-click context menu for feedback */
function setupFeedbackContextMenu() {
  let ctxMenu: HTMLElement | null = null;

  function removeMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }

  document.addEventListener('contextmenu', (e) => {
    // Don't override on inputs/textareas
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (target.closest('.fdbk-overlay') || target.closest('.fdbk-context-menu')) return;

    e.preventDefault();
    removeMenu();

    ctxMenu = document.createElement('div');
    ctxMenu.className = 'fdbk-context-menu';
    ctxMenu.innerHTML = `
      <div class="fdbk-ctx-item" id="fdbk-ctx-suggest">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>📝 Enviar Sugestão</span>
      </div>
      <div class="fdbk-ctx-item" id="fdbk-ctx-bug">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>🐛 Reportar Bug</span>
      </div>
    `;

    // Position
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;

    document.body.appendChild(ctxMenu);

    ctxMenu.querySelector('#fdbk-ctx-suggest')?.addEventListener('click', async () => {
      removeMenu();
      const b64 = await captureAppScreenshot();
      showFeedbackModal(b64);
      // Pre-select "feature"
      const sel = document.getElementById('fdbk-category') as HTMLSelectElement;
      if (sel) sel.value = 'feature';
    });

    ctxMenu.querySelector('#fdbk-ctx-bug')?.addEventListener('click', async () => {
      removeMenu();
      const b64 = await captureAppScreenshot();
      showFeedbackModal(b64);
      // Pre-select "bug"
      const sel = document.getElementById('fdbk-category') as HTMLSelectElement;
      if (sel) sel.value = 'bug';
    });

    // Close on click outside
    setTimeout(() => {
      const handler = (ev: MouseEvent) => {
        if (ctxMenu && !ctxMenu.contains(ev.target as Node)) {
          removeMenu();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 50);
  });
}

// Initialize context menu
setupFeedbackContextMenu();

/* ================================================================
   Benchmark / Frame‑time Analysis
   ================================================================ */

interface BenchmarkResult {
  file_name: string;
  process_name: string;
  duration_secs: number;
  frame_count: number;
  avg_fps: number;
  min_fps: number;
  max_fps: number;
  p01_fps: number;
  p1_fps: number;
  p5_fps: number;
  median_fps: number;
  p95_fps: number;
  p99_fps: number;
  avg_frametime: number;
  p95_frametime: number;
  p99_frametime: number;
  p999_frametime: number;
  stutter_count: number;
  stutter_pct: number;
  dropped_frames: number;
  frametimes: number[];
  timestamps: number[];
  fps_values: number[];
}

let currentBenchResult: BenchmarkResult | null = null;
const benchHistory: BenchmarkResult[] = [];

function drawFrametimeChart(canvas: HTMLCanvasElement, result: BenchmarkResult, mode: 'frametime' | 'fps' = 'frametime') {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 20, right: 16, bottom: 30, left: 50 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const data = mode === 'fps' ? result.fps_values : result.frametimes;
  const ts = result.timestamps;
  if (data.length === 0) return;

  // Find range
  const sorted = [...data].sort((a, b) => a - b);
  const yMin = mode === 'fps' ? 0 : 0;
  // Use P99.5 as max to avoid extreme outliers dominating the chart
  const p995idx = Math.floor(data.length * 0.995);
  const yMax = sorted[Math.min(p995idx, sorted.length - 1)] * 1.15;
  const tMin = ts[0] || 0;
  const tMax = ts[ts.length - 1] || 1;

  // Background
  ctx.fillStyle = 'rgba(10,10,18,0.95)';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = pad.top + (ph * i / gridSteps);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
    // Label
    const val = yMax - (yMax - yMin) * i / gridSteps;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(mode === 'fps' ? 0 : 1) + (mode === 'fps' ? '' : 'ms'), pad.left - 4, y + 3);
  }

  // Time labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const x = pad.left + pw * i / 5;
    const t = tMin + (tMax - tMin) * i / 5;
    ctx.fillText(t.toFixed(1) + 's', x, h - 6);
  }

  // Average line
  const avgVal = mode === 'fps' ? result.avg_fps : result.avg_frametime;
  const avgY = pad.top + ph * (1 - (avgVal - yMin) / (yMax - yMin));
  if (avgY > pad.top && avgY < pad.top + ph) {
    ctx.strokeStyle = 'rgba(0,255,170,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, avgY); ctx.lineTo(pad.left + pw, avgY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,255,170,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(`avg ${avgVal.toFixed(mode === 'fps' ? 0 : 1)}`, pad.left + pw + 2, avgY + 3);
  }

  // 1% low line (for FPS mode)
  if (mode === 'fps') {
    const p1Y = pad.top + ph * (1 - (result.p1_fps - yMin) / (yMax - yMin));
    if (p1Y > pad.top && p1Y < pad.top + ph) {
      ctx.strokeStyle = 'rgba(255,107,107,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.left, p1Y); ctx.lineTo(pad.left + pw, p1Y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,107,107,0.5)';
      ctx.fillText(`1% low ${result.p1_fps.toFixed(0)}`, pad.left + pw + 2, p1Y + 3);
    }
  }

  // Data line
  ctx.strokeStyle = mode === 'fps' ? 'rgba(0,180,255,0.85)' : 'rgba(255,180,60,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + ((ts[i] - tMin) / (tMax - tMin)) * pw;
    const y = pad.top + ph * (1 - (Math.min(data[i], yMax) - yMin) / (yMax - yMin));
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Stutter highlights (frametime mode)
  if (mode === 'frametime') {
    const threshold = result.avg_frametime * 2.5;
    ctx.fillStyle = 'rgba(255,60,60,0.25)';
    for (let i = 0; i < data.length; i++) {
      if (data[i] > threshold) {
        const x = pad.left + ((ts[i] - tMin) / (tMax - tMin)) * pw;
        ctx.fillRect(x - 1, pad.top, 2, ph);
      }
    }
  }

  // Title
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(mode === 'fps' ? 'FPS over time' : 'Frame Time (ms) over time', pad.left, pad.top - 6);
}

function drawFpsHistogram(canvas: HTMLCanvasElement, result: BenchmarkResult) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 20, right: 16, bottom: 30, left: 40 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  if (result.fps_values.length === 0) return;

  // Create histogram bins
  const nbins = 30;
  const fpsMin = Math.floor(result.p01_fps * 0.8);
  const fpsMax = Math.ceil(result.p99_fps * 1.1);
  const binWidth = (fpsMax - fpsMin) / nbins;
  const bins = new Array(nbins).fill(0);

  for (const fps of result.fps_values) {
    const idx = Math.floor((fps - fpsMin) / binWidth);
    if (idx >= 0 && idx < nbins) bins[idx]++;
  }

  const maxBin = Math.max(...bins, 1);

  // Background
  ctx.fillStyle = 'rgba(10,10,18,0.95)';
  ctx.fillRect(0, 0, w, h);

  // Draw bars
  const barW = pw / nbins - 1;
  for (let i = 0; i < nbins; i++) {
    const x = pad.left + (i / nbins) * pw;
    const barH = (bins[i] / maxBin) * ph;
    const y = pad.top + ph - barH;

    const fps = fpsMin + i * binWidth;
    const isLow = fps < result.p1_fps;
    const isAvg = fps >= result.avg_fps - binWidth && fps <= result.avg_fps + binWidth;

    ctx.fillStyle = isLow ? 'rgba(255,107,107,0.6)' : isAvg ? 'rgba(0,255,170,0.6)' : 'rgba(0,150,255,0.4)';
    ctx.fillRect(x, y, barW, barH);
  }

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const fps = fpsMin + (fpsMax - fpsMin) * i / 5;
    const x = pad.left + (i / 5) * pw;
    ctx.fillText(fps.toFixed(0) + ' fps', x, h - 6);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('FPS Distribution', pad.left, pad.top - 6);
}

async function importBenchmarkFile() {
  try {
    const path = await invoke<string>('pick_benchmark_file');
    const result = await invoke<BenchmarkResult>('parse_benchmark_file', { path });
    currentBenchResult = result;
    benchHistory.push(result);
    displayBenchmarkResult(result);
    toast(`Benchmark carregado: ${result.file_name}`);
  } catch (e) {
    if (String(e) !== 'Cancelled') toast(`Erro: ${e}`, true);
  }
}

async function scanCapFrameX() {
  try {
    const files = await invoke<string[]>('scan_capframex_folder');
    if (files.length === 0) {
      toast('CapFrameX não encontrado ou sem capturas');
      return;
    }
    showCapFrameXPicker(files);
  } catch (e) {
    toast(`Erro: ${e}`, true);
  }
}

function showCapFrameXPicker(files: string[]) {
  const existing = document.querySelector('.cx-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'cx-overlay fdbk-overlay';
  overlay.innerHTML = `
    <div class="fdbk-modal" style="max-height:80vh;">
      <div class="fdbk-modal-header">
        <h3>CapFrameX Captures (${files.length})</h3>
        <button class="fdbk-close" id="cx-close">&times;</button>
      </div>
      <div class="fdbk-modal-body" style="max-height:60vh;overflow-y:auto;">
        ${files.map(f => {
          const name = f.split('\\').pop() || f;
          return `<div class="cx-file-item" data-path="${f}" title="${f}">${name}</div>`;
        }).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('cx-close')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.cx-file-item').forEach(el => {
    el.addEventListener('click', async () => {
      const path = (el as HTMLElement).dataset.path;
      if (!path) return;
      overlay.remove();
      try {
        const result = await invoke<BenchmarkResult>('parse_benchmark_file', { path });
        currentBenchResult = result;
        benchHistory.push(result);
        displayBenchmarkResult(result);
        toast(`Benchmark carregado: ${result.file_name}`);
      } catch (e) {
        toast(`Erro ao analisar: ${e}`, true);
      }
    });
  });
}

function displayBenchmarkResult(r: BenchmarkResult) {
  const el = document.getElementById('bench-content');
  if (!el) return;

  el.innerHTML = '';

  // Header info
  const info = document.createElement('div');
  info.className = 'bench-info';
  info.innerHTML = `
    <span class="bench-info-label">📂 ${r.file_name}</span>
    <span class="bench-info-process">🎮 ${r.process_name}</span>
    <span class="bench-info-duration">⏱ ${r.duration_secs.toFixed(1)}s</span>
    <span class="bench-info-frames">${r.frame_count.toLocaleString()} frames</span>
  `;
  el.appendChild(info);

  // Metrics grid
  const metrics = document.createElement('div');
  metrics.className = 'bench-metrics';

  const metricItems = [
    { label: 'AVG FPS', value: r.avg_fps.toFixed(1), cls: 'primary' },
    { label: '1% LOW', value: r.p1_fps.toFixed(1), cls: r.p1_fps < r.avg_fps * 0.5 ? 'bad' : 'warn' },
    { label: '0.1% LOW', value: r.p01_fps.toFixed(1), cls: r.p01_fps < r.avg_fps * 0.3 ? 'bad' : 'warn' },
    { label: 'MEDIAN', value: r.median_fps.toFixed(1), cls: '' },
    { label: 'MAX', value: r.max_fps.toFixed(0), cls: '' },
    { label: 'MIN', value: r.min_fps.toFixed(0), cls: r.min_fps < 30 ? 'bad' : '' },
    { label: 'AVG FT', value: r.avg_frametime.toFixed(2) + 'ms', cls: '' },
    { label: 'P99 FT', value: r.p99_frametime.toFixed(2) + 'ms', cls: r.p99_frametime > 33.3 ? 'bad' : '' },
    { label: 'STUTTERS', value: `${r.stutter_count} (${r.stutter_pct.toFixed(1)}%)`, cls: r.stutter_pct > 2 ? 'bad' : r.stutter_pct > 0.5 ? 'warn' : '' },
    { label: 'DROPPED', value: `${r.dropped_frames}`, cls: r.dropped_frames > 0 ? 'warn' : '' },
  ];

  for (const m of metricItems) {
    const card = document.createElement('div');
    card.className = `bench-metric-card ${m.cls}`;
    card.innerHTML = `<div class="bench-metric-val">${m.value}</div><div class="bench-metric-label">${m.label}</div>`;
    metrics.appendChild(card);
  }
  el.appendChild(metrics);

  // CS2 context assessment
  const assessment = document.createElement('div');
  assessment.className = 'bench-assessment';
  const tips: string[] = [];
  if (r.avg_fps >= 300) tips.push('✅ Excelente! FPS médio acima de 300 — ideal para monitores de 240Hz+.');
  else if (r.avg_fps >= 200) tips.push('👍 Bom desempenho. FPS médio adequado para monitores de 144Hz-240Hz.');
  else if (r.avg_fps >= 144) tips.push('⚠ FPS médio ok para 144Hz, mas podes sentir drops em fights intensos.');
  else tips.push('🔴 FPS médio baixo para CS2 competitivo. Considera baixar definições gráficas.');

  if (r.p1_fps < r.avg_fps * 0.4) tips.push('⚠ 1% Low muito abaixo da média — indica micro-stutters significativos.');
  if (r.stutter_pct > 2) tips.push('🔴 Taxa de stutters elevada (>' + r.stutter_pct.toFixed(1) + '%). Verifica processos em background e drivers.');
  if (r.stutter_pct <= 0.5 && r.p1_fps > r.avg_fps * 0.6) tips.push('✅ Frame pacing consistente — experiência fluida.');
  if (r.dropped_frames > 5) tips.push('⚠ Frames dropped detectados — pode indicar bottleneck de GPU ou VSync issues.');

  assessment.innerHTML = `<div class="bench-assessment-title">🎮 Análise CS2</div>` + tips.map(t => `<div class="bench-tip">${t}</div>`).join('');
  el.appendChild(assessment);

  // Chart mode toggle
  const chartControls = document.createElement('div');
  chartControls.className = 'bench-chart-controls';
  chartControls.innerHTML = `
    <button class="bench-chart-btn active" data-mode="frametime">Frame Time</button>
    <button class="bench-chart-btn" data-mode="fps">FPS</button>
  `;
  el.appendChild(chartControls);

  // Frame time chart
  const chartCanvas = document.createElement('canvas');
  chartCanvas.className = 'bench-chart-canvas';
  chartCanvas.style.cssText = 'width:100%;height:200px;border-radius:6px;';
  el.appendChild(chartCanvas);

  // FPS histogram
  const histCanvas = document.createElement('canvas');
  histCanvas.className = 'bench-hist-canvas';
  histCanvas.style.cssText = 'width:100%;height:140px;border-radius:6px;margin-top:8px;';
  el.appendChild(histCanvas);

  // Draw initial charts
  requestAnimationFrame(() => {
    drawFrametimeChart(chartCanvas, r, 'frametime');
    drawFpsHistogram(histCanvas, r);
  });

  // Chart mode toggle handlers
  chartControls.querySelectorAll('.bench-chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chartControls.querySelectorAll('.bench-chart-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = (btn as HTMLElement).dataset.mode as 'frametime' | 'fps';
      drawFrametimeChart(chartCanvas, r, mode);
    });
  });

  // Comparison section (if multiple benchmarks)
  if (benchHistory.length > 1) {
    const cmpDiv = document.createElement('div');
    cmpDiv.className = 'bench-comparison';
    cmpDiv.innerHTML = `<div class="bench-assessment-title">📊 Comparação (${benchHistory.length} capturas)</div>`;

    const cmpTable = document.createElement('table');
    cmpTable.className = 'drv-table';
    cmpTable.innerHTML = `
      <thead><tr><th>Ficheiro</th><th>Processo</th><th>AVG FPS</th><th>1% Low</th><th>0.1% Low</th><th>Stutters</th><th>Duração</th></tr></thead>
      <tbody>${benchHistory.map(b => `
        <tr>
          <td class="drv-device">${b.file_name}</td>
          <td>${b.process_name}</td>
          <td class="bench-metric-val">${b.avg_fps.toFixed(1)}</td>
          <td>${b.p1_fps.toFixed(1)}</td>
          <td>${b.p01_fps.toFixed(1)}</td>
          <td>${b.stutter_count} (${b.stutter_pct.toFixed(1)}%)</td>
          <td>${b.duration_secs.toFixed(1)}s</td>
        </tr>`).join('')}
      </tbody>
    `;
    cmpDiv.appendChild(cmpTable);
    el.appendChild(cmpDiv);
  }
}

async function refreshDriverInfo() {
  const el = document.getElementById('drv-content');
  if (!el) return;
  el.innerHTML = '<div class="net-status">A analisar drivers do sistema e periféricos...</div>';
  try {
    const drivers = await invoke<DriverEntry[]>('get_driver_info');
    el.innerHTML = '';

    // Summary stats
    const totalCount = drivers.length;
    const genericCount = drivers.filter(d => d.is_generic).length;
    const outdatedCount = drivers.filter(d => d.status === 'outdated').length;
    const agingCount = drivers.filter(d => d.status === 'aging').length;
    const currentCount = drivers.filter(d => d.status === 'current').length;

    const summary = document.createElement('div');
    summary.className = 'drv-summary';
    summary.innerHTML = `
      <div class="drv-summary-item"><span class="drv-summary-val">${totalCount}</span><span class="drv-summary-label">Total</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${genericCount > 0 ? ' warn' : ''}">${genericCount}</span><span class="drv-summary-label">Genéricos</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${outdatedCount > 0 ? ' bad' : ''}">${outdatedCount}</span><span class="drv-summary-label">Desatualizados</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${agingCount > 0 ? ' warn' : ''}">${agingCount}</span><span class="drv-summary-label">&gt;6 meses</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val">${currentCount}</span><span class="drv-summary-label">Atuais</span></div>
    `;
    el.appendChild(summary);

    // Gaming-specific recommendations
    const tips: string[] = [];
    const gpuDrivers = drivers.filter(d => d.category === 'GPU');
    const mouseDrivers = drivers.filter(d => d.category === 'Mouse');
    const audioDrivers = drivers.filter(d => d.category === 'Audio');
    const netDrivers = drivers.filter(d => d.category === 'Network');

    for (const gd of gpuDrivers) {
      if (gd.is_generic) tips.push('⚠ A tua GPU usa uma driver <b>genérica Microsoft</b>. Instala a driver oficial da NVIDIA/AMD para teres o melhor desempenho em CS2.');
      if (gd.status === 'outdated') tips.push('⚠ A driver da GPU tem <b>mais de 1 ano</b>. Considera atualizar para a versão Game Ready mais recente para CS2.');
      if (gd.driver_provider?.toLowerCase().includes('nvidia') && gd.status !== 'current') tips.push('💡 Para NVIDIA: usa <b>GeForce Experience</b> ou <b>nvidia.com/drivers</b> para obter drivers Game Ready otimizados para CS2.');
      if (gd.driver_provider?.toLowerCase().includes('amd') && gd.status !== 'current') tips.push('💡 Para AMD: usa <b>AMD Adrenalin</b> para instalar drivers otimizados. Ativa <b>Anti-Lag</b> para CS2.');
    }
    for (const md of mouseDrivers) {
      if (md.is_generic) tips.push(`⚠ O rato "<b>${md.device_name}</b>" usa driver genérico. Instala o software do fabricante (ex: Logitech G Hub, Razer Synapse, SteelSeries GG) para polling rate e DPI corretos.`);
    }
    for (const ad of audioDrivers) {
      if (ad.is_generic) tips.push(`💡 Dispositivo de áudio "<b>${ad.device_name}</b>" usa driver genérico. Para menor latência sonora, instala a driver do fabricante (ex: Realtek HD Audio, SteelSeries Sonar).`);
    }
    for (const nd of netDrivers) {
      if (nd.is_generic) tips.push(`💡 Adaptador de rede "<b>${nd.device_name}</b>" usa driver genérico. A driver do fabricante (Intel, Realtek, Killer) pode melhorar a latência de rede.`);
    }
    if (genericCount === 0 && outdatedCount === 0) tips.push('✅ Excelente! Todos os teus drivers são do fabricante e estão atualizados. O teu setup está otimizado.');

    if (tips.length > 0) {
      const tipsDiv = document.createElement('div');
      tipsDiv.className = 'drv-tips';
      tipsDiv.innerHTML = `<div class="drv-tips-header">🎮 Recomendações para CS2</div>` + tips.map(t => `<div class="drv-tip-item">${t}</div>`).join('');
      el.appendChild(tipsDiv);
    }

    // Group by category
    const groups: Record<string, DriverEntry[]> = {};
    for (const d of drivers) {
      if (!groups[d.category]) groups[d.category] = [];
      groups[d.category].push(d);
    }

    const grid = document.createElement('div');
    grid.className = 'drv-grid';

    const catOrder = ['GPU', 'Monitor', 'Audio', 'Network', 'Mouse', 'Keyboard', 'Controller'];
    for (const cat of catOrder) {
      const items = groups[cat];
      if (!items || items.length === 0) continue;

      const catDiv = document.createElement('div');
      catDiv.className = 'drv-category';

      const catHeader = document.createElement('div');
      catHeader.className = 'drv-category-header';
      const hasIssues = items.some(d => d.is_generic || d.status === 'outdated');
      catHeader.innerHTML = `${DRV_CATEGORY_ICONS[cat] || ''}<span>${DRV_CATEGORY_LABELS[cat] || cat}</span>${hasIssues ? '<span class="drv-cat-warn">⚠</span>' : '<span class="drv-cat-ok">✔</span>'}<span class="drv-cat-count">${items.length} driver${items.length > 1 ? 's' : ''}</span>`;
      catDiv.appendChild(catHeader);

      const table = document.createElement('table');
      table.className = 'drv-table';
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr><th>Dispositivo</th><th>Driver</th><th>Versão</th><th>Fornecedor</th><th>Tipo</th><th>Estado</th><th>Data</th><th>Assinado</th></tr>`;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const d of items) {
        const tr = document.createElement('tr');
        if (d.is_generic || d.status === 'outdated') tr.className = 'drv-row-warn';

        // Type badge
        const typeBadge = d.is_generic
          ? '<span class="drv-badge generic">Genérico</span>'
          : '<span class="drv-badge manufacturer">Fabricante</span>';

        // Status badge
        let statusBadge = '<span class="drv-badge unknown">?</span>';
        if (d.status === 'current')  statusBadge = '<span class="drv-badge current">Atual</span>';
        if (d.status === 'aging')    statusBadge = '<span class="drv-badge aging">&gt;6m</span>';
        if (d.status === 'outdated') statusBadge = '<span class="drv-badge outdated">Desatualizado</span>';

        // Signed
        const signedHtml = d.is_signed
          ? '<span class="drv-signed yes">&#10004;</span>'
          : '<span class="drv-signed no">&#10008;</span>';

        tr.innerHTML = `
          <td class="drv-device" title="${d.device_name}">${d.device_name}</td>
          <td class="drv-driver" title="${d.driver_name}">${d.driver_name}</td>
          <td class="drv-version">${d.driver_version}</td>
          <td class="drv-provider" title="${d.manufacturer}">${d.driver_provider || d.manufacturer || 'N/A'}</td>
          <td>${typeBadge}</td>
          <td>${statusBadge}</td>
          <td class="drv-date">${d.driver_date || 'N/A'}</td>
          <td>${signedHtml}</td>
        `;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      catDiv.appendChild(table);
      grid.appendChild(catDiv);
    }

    el.appendChild(grid);
  } catch (e) {
    el.innerHTML = `<div class="net-status">Falha ao analisar drivers: ${e}</div>`;
  }
}

async function refreshHardwareInfo() {
  const el = document.getElementById('hw-content');
  if (!el) return;
  el.innerHTML = '<div class="net-status">Scanning hardware...</div>';
  try {
    const hw = await invoke<Record<string, unknown>>('get_hardware_info');
    el.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'hw-grid';

    const cCpu = card('CPU');
    cCpu.appendChild(hwRow('Model', String(hw.cpu_name || 'N/A')));
    cCpu.appendChild(hwRow('Cores', String(hw.cpu_cores || '?')));
    cCpu.appendChild(hwRow('Threads', String(hw.cpu_threads || '?')));
    cCpu.appendChild(hwRow('Clock', `${hw.cpu_clock_mhz || '?'} MHz`));
    grid.appendChild(cCpu);

    const cGpu = card('GPU');
    cGpu.appendChild(hwRow('Model', String(hw.gpu_name || 'N/A')));
    cGpu.appendChild(hwRow('VRAM', `${hw.gpu_vram_mb || '?'} MB`));
    cGpu.appendChild(hwRow('Driver', String(hw.gpu_driver || 'N/A')));
    cGpu.appendChild(hwRow('Refresh Rate', `${hw.refresh_rate || '?'} Hz`));
    grid.appendChild(cGpu);

    const cRam = card('RAM / Storage');
    cRam.appendChild(hwRow('Total RAM', `${hw.ram_total_gb || '?'} GB`));
    cRam.appendChild(hwRow('Modules', String(hw.ram_modules || '?')));
    cRam.appendChild(hwRow('Speed', `${hw.ram_speed_mhz || '?'} MHz`));
    const disks = hw.disks as Array<{name: string; type: string; size_gb: number}> || [];
    for (const d of disks) {
      cRam.appendChild(hwRow(d.name || 'Disk', `${d.type} ${d.size_gb} GB`));
    }
    grid.appendChild(cRam);

    const cSys = card('System / Features');
    cSys.appendChild(hwRow('OS', String(hw.os_name || 'N/A')));
    cSys.appendChild(hwRow('Build', String(hw.os_build || '?')));
    cSys.appendChild(hwStatus('HAGS', String(hw.hags || 'N/A')));
    cSys.appendChild(hwStatus('ReBAR', hw.rebar === 'N/A' ? 'N/A' : (Number(String(hw.rebar).replace(' MB','')) > 256 ? 'ON' : 'OFF')));
    cSys.appendChild(hwStatus('XMP', String(hw.xmp || 'N/A') === 'Likely' ? 'ON' : 'N/A'));
    grid.appendChild(cSys);

    el.appendChild(grid);
  } catch (e) {
    el.innerHTML = `<div class="net-status">Failed: ${e}</div>`;
  }
}

async function refreshProcesses() {
  const list = document.getElementById('proc-list');
  if (!list) return;
  list.innerHTML = '';
  try {
    const procs = await invoke<Array<{name: string; pid: number; ram_mb: number; cpu_s: number}>>('list_processes');
    for (const p of procs) {
      const row = document.createElement('div');
      const flagged = PROC_FLAGS.has(p.name.toLowerCase());
      row.className = 'proc-item' + (flagged ? ' flagged' : '');
      row.innerHTML = `<span class="proc-name" title="${p.name}">${p.name}</span><span class="proc-val">${p.ram_mb} MB</span><span class="proc-val">${p.cpu_s}s</span>`;
      const btn = document.createElement('button');
      btn.className = 'proc-kill';
      btn.textContent = 'END';
      btn.addEventListener('click', async () => {
        try {
          await invoke('kill_process', { pid: p.pid });
          toast(`${p.name} terminated`);
          refreshProcesses();
        } catch (err) { toast(`Failed: ${err}`, true); }
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  } catch (e) {
    list.innerHTML = `<div class="net-status">Failed: ${e}</div>`;
  }
}

async function runPingTests() {
  const list = document.getElementById('net-results');
  if (!list) return;
  list.innerHTML = '<div class="net-status">Pinging servers...</div>';
  const results: Array<{name: string; avg: number; min: number; max: number}> = [];
  for (const srv of NET_SERVERS) {
    try {
      const r = await invoke<{host: string; avg: number; min: number; max: number; ok: boolean}>('ping_server', { host: srv.host, count: 4 });
      results.push({ name: srv.name, avg: r.avg, min: r.min, max: r.max });
    } catch {
      results.push({ name: srv.name, avg: -1, min: -1, max: -1 });
    }
  }
  list.innerHTML = '';
  const hdr = document.createElement('div');
  hdr.className = 'ping-header';
  hdr.innerHTML = '<span>Server</span><span>Avg</span><span>Min</span><span>Max</span><span>Grade</span>';
  list.appendChild(hdr);
  for (const r of results) {
    const row = document.createElement('div');
    row.className = 'ping-row';
    const cls = r.avg < 0 ? 'ping-bad' : r.avg < 30 ? 'ping-good' : r.avg < 80 ? 'ping-ok' : 'ping-bad';
    const grade = r.avg < 0 ? 'FAIL' : r.avg < 15 ? 'A+' : r.avg < 30 ? 'A' : r.avg < 50 ? 'B' : r.avg < 80 ? 'C' : 'D';
    row.innerHTML = `<span class="ping-host">${r.name}</span><span class="ping-val ${cls}">${r.avg < 0 ? '--' : r.avg + 'ms'}</span><span class="ping-val">${r.min < 0 ? '--' : r.min + 'ms'}</span><span class="ping-val">${r.max < 0 ? '--' : r.max + 'ms'}</span><span class="ping-val ${cls}">${grade}</span>`;
    list.appendChild(row);
  }
}

/* ================================================================
   Demo Manager — review tips, notes, ratings, scanning
   ================================================================ */

interface DemoReviewTip {
  icon: string;
  title: string;
  desc: string;
  detail: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const DEMO_TIPS: DemoReviewTip[] = [
  // CRITICAL — check every demo
  { icon: '🎯', title: 'Crosshair Placement', desc: 'Head level? Pre-aimed at angles? Track your crosshair in every engagement.', detail: 'Pause at each fight. Was your crosshair at head height BEFORE the enemy appeared? Were you already aimed where enemies commonly peek? This is the #1 factor separating ranks. In every death, check if your crosshair was in no-man\'s-land or on a wall nobody peeks from.', priority: 'critical' },
  { icon: '💀', title: 'Death Analysis', desc: 'For each death: could you have positioned differently? Was the peek necessary?', detail: 'Every death in CS2 has a cause. Were you standing still in the open? Did you wide-peek an AWP? Did you stay in a position after being spotted? Go through each death and ask: what\'s the earliest decision I could have changed to survive? Focus on deaths where you had no information — those are positioning errors.', priority: 'critical' },
  { icon: '⚔️', title: 'Opening Duels', desc: 'Win rate in first 15 seconds. Your positioning when the round starts matters most.', detail: 'Opening kills/deaths define rounds. If you regularly die first without getting a kill, your opening positions are weak. Track: (1) How often you get the first kill, (2) How often you die first, (3) Your positioning when it happens. First kill win rate above 55% = strong, below 45% = rework openings.', priority: 'critical' },
  { icon: '🔄', title: 'Trade Positions', desc: 'Are you in positions where teammates can trade your death within 2 seconds?', detail: 'CS2 is a team game. If you die and nobody can refrag within 2 seconds, you were isolated. Check: When you peek, is a teammate watching from a crossfire angle? When a teammate dies, could you trade it? If you\'re often dying in positions where the trade is impossible, adjust your spacing.', priority: 'critical' },

  // HIGH — check regularly
  { icon: '💣', title: 'Utility Timing', desc: 'Smoke before entry? Flash for teammate push? Molotov for deny? Track waste.', detail: 'Utility wins rounds. Check: Did you throw smokes at the right time (not too early/late)? Were your flashes actually blinding enemies or just your team? Did you molotov key spots before pushing through? Count utility left at death — dying with 2+ nades means you wasted $600+.', priority: 'high' },
  { icon: '💰', title: 'Economy Decisions', desc: 'Buy/save calls. Buying on eco rounds? Saving when team forces? Equipment at death.', detail: 'Check every buy round: Did you buy correctly? Watch for: Buying on eco when team saves. Not buying head armor vs. AK/M4. Buying a Deagle + armor when you could have done a full eco. Dying with expensive guns you shouldn\'t have bought. Money management wins matches over 30 rounds.', priority: 'high' },
  { icon: '🏁', title: 'Post-Plant Play', desc: 'After planting: position, crossfire, timing. After defuse start: re-peek or wait?', detail: 'Post-plant is where rounds are won or lost. When you plant: Do you get to a crossfire position? Do you play for time or peek early? As retaking CT: Are you using utility to clear? Do you ever commit too early when the timer isn\'t urgent? Track your post-plant round win rate separately.', priority: 'high' },
  { icon: '📡', title: 'Information Usage', desc: 'Did you act on callouts? Are you checking minimap? Reacting to footsteps?', detail: 'When a teammate calls enemy positions, do you adjust? Watch for: Ignoring minimap intel and getting flanked. Not rotating when info says the bomb is going elsewhere. Missing audio cues that indicate enemy position. CS2 provides massive information — using 80% of it is better than aim.', priority: 'high' },
  { icon: '🔁', title: 'Repetitive Mistakes', desc: 'Same position, same peek, same timing = predictable. Change patterns.', detail: 'Watch 3+ rounds where you played the same site. Are you holding the exact same angle every round? If yes, a good opponent reads you by round 3. Track: How many different positions do you use per map side? Do you vary your timing? Unpredictability is a skill you can learn from demos.', priority: 'high' },

  // MEDIUM — review weekly
  { icon: '🔃', title: 'Rotation Speed', desc: 'CT rotations: too slow = late retake. Too fast = faked out. Find balance.', detail: 'Track how long your rotations take and whether you arrive in time for retakes. Getting faked and rotating too early is as bad as rotating too late. Key: Did you wait for confirmation (2nd flash, bomb sound, multiple contacts) before rotating? Or did you leave your site after one contact?', priority: 'medium' },
  { icon: '🗺️', title: 'Map Control', desc: 'T-side: are you taking map control or just rushing? Mid control wins rounds.', detail: 'On T-side, track: Do you take map control methodically (mid, banana, apps) or do you just run to a site? On CT-side, do you play for information early round? Map control = information = better decisions. If your T-side is always 5-man rushes, you\'re leaving free map control behind.', priority: 'medium' },
  { icon: '👀', title: 'Peek Selection', desc: 'Right type of peek for the situation? Wide vs. jiggle vs. shoulder vs. holding.', detail: 'Each peek type has a purpose. Wide peek: when you have info and want to fight. Jiggle: to bait shots and get info. Shoulder: to bait an AWP shot. Holding angle: with AWP or when you know they\'ll push. Track how often you use the wrong peek type — wide peeking an AWP is the most common mistake.', priority: 'medium' },
  { icon: '💡', title: 'Flash Coordination', desc: 'Are you flashing FOR teammates or just throwing? Teammate flashes vs. self-flash.', detail: 'Count: How many of your flashes actually helped a teammate peek? How many times did you flash your own team? A good flash that lets a teammate get a kill is worth more than a kill itself. Track pop-flash success rate and team flash incidents per game.', priority: 'medium' },
  { icon: '⏱️', title: 'Time Management', desc: 'Watching the round timer. Planting before 0:30? Executing with enough time?', detail: 'In T-side rounds, track when you execute or plant relative to the timer. Planting with less than 30 seconds left gives CTs advantage in retake. Planting with 45-55 seconds left is ideal. On CT side, check: Are you using time to your advantage or peeking unnecessarily early?', priority: 'medium' },

  // LOW — awareness items
  { icon: '🔇', title: 'Sound Discipline', desc: 'Running when you should walk? Reloading at bad times? Giving away position.', detail: 'Watch for: Running footsteps that give away your position before a fight. Reloading after 25/30 bullets when an enemy is near. Jumping on metal surfaces. Scoping/unscoping in enemy earshot. Every sound you make is free information for the enemy team.', priority: 'low' },
  { icon: '🏃', title: 'Movement Quality', desc: 'Counter-strafing accuracy? Crouch-peeking too much? Stutter-stepping?', detail: 'Focus on: Are you stopping before shooting (counter-strafe)? Do you crouch-peek every fight (makes you predictable and slow)? Are your spray transfers clean or do you lose control? Movement errors compound — each 10ms of not-stopped shooting reduces accuracy by huge margins.', priority: 'low' },
  { icon: '📐', title: 'Grenade Lineups', desc: 'Consistent smokes? Are they landing correctly? Missing lineups = round lost.', detail: 'A smoke that gaps is worse than no smoke (false sense of safety). Track: How many of your smokes land correctly? Which lineups do you miss most? Prioritize learning 3-4 smokes per map side perfectly rather than 10 approximate ones.', priority: 'low' },
  { icon: '🎥', title: 'Kill Replay', desc: 'Re-watch your kills too, not just deaths. What made them work?', detail: 'It\'s tempting to only review deaths. But reviewing kills teaches you WHAT WORKS. Did you get a kill because of good crosshair placement, a good flash, a good position, or just luck? Reinforce good habits by identifying them. If a kill was lucky, don\'t repeat that play expecting the same result.', priority: 'low' },
];

// notes + ratings stored in localStorage
function getDemoMeta(): Record<string, { notes?: string; rating?: number; tags?: string[] }> {
  return JSON.parse(localStorage.getItem('csmooth_demo_meta') || '{}');
}

function setDemoMeta(name: string, data: { notes?: string; rating?: number }) {
  const all = getDemoMeta();
  all[name] = { ...all[name], ...data };
  localStorage.setItem('csmooth_demo_meta', JSON.stringify(all));
}

/* ================================================================
   AI Integration — config, helpers, prompts
   ================================================================ */

interface AiConfig {
  key: string;
  endpoint: string;
  model: string;
}

const AI_DEFAULTS: AiConfig = {
  key: '',
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama-3.3-70b-versatile',
};

function getAiConfig(): AiConfig {
  const raw = localStorage.getItem('csmooth_ai_config');
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return { ...AI_DEFAULTS };
}

function setAiConfig(cfg: AiConfig) {
  localStorage.setItem('csmooth_ai_config', JSON.stringify(cfg));
}

function hasAiKey(): boolean {
  return getAiConfig().key.length > 5;
}

async function aiChat(systemPrompt: string, userContent: string): Promise<string> {
  const cfg = getAiConfig();
  if (!cfg.key) throw new Error('No API key configured. Click the AI icon in the header to set up.');
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
  return invoke<string>('ai_chat', {
    apiKey: cfg.key,
    endpoint: cfg.endpoint,
    model: cfg.model,
    messages,
  });
}

// simple markdown-to-html for AI responses
function mdToHtml(md: string): string {
  return md
    .replace(/### (.+)/g, '<h4>$1</h4>')
    .replace(/## (.+)/g, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function showAiModal() {
  const existing = document.querySelector('.ai-overlay');
  if (existing) existing.remove();

  const cfg = getAiConfig();
  const overlay = document.createElement('div');
  overlay.className = 'ai-overlay';

  overlay.innerHTML = `
    <div class="ai-modal">
      <h3>AI Configuration</h3>
      <label>API Key</label>
      <input type="password" id="ai-key" value="${cfg.key}" placeholder="gsk_... (Groq) or sk-... (OpenAI)" />
      <label>Endpoint</label>
      <input type="text" id="ai-endpoint" value="${cfg.endpoint}" placeholder="${AI_DEFAULTS.endpoint}" />
      <label>Model</label>
      <input type="text" id="ai-model" value="${cfg.model}" placeholder="${AI_DEFAULTS.model}" />
      <div style="font-size:9px;opacity:0.4;margin-top:6px;">
        Pre-configured for Groq (free). Works with OpenAI, OpenRouter, Ollama, or any OpenAI-compatible API.
        Just paste your Groq API key from <a href="#" id="ai-groq-link" style="color:var(--primary);text-decoration:underline;">console.groq.com</a>.
      </div>
      <div class="ai-modal-actions">
        <button class="ai-cancel" id="ai-cancel">Cancel</button>
        <button class="ai-save" id="ai-save-cfg">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('ai-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('ai-groq-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    shellOpen('https://console.groq.com/keys');
  });

  document.getElementById('ai-save-cfg')!.addEventListener('click', () => {
    const key = (document.getElementById('ai-key') as HTMLInputElement).value.trim();
    const endpoint = (document.getElementById('ai-endpoint') as HTMLInputElement).value.trim();
    const model = (document.getElementById('ai-model') as HTMLInputElement).value.trim();
    setAiConfig({ key, endpoint: endpoint || AI_DEFAULTS.endpoint, model: model || AI_DEFAULTS.model });
    overlay.remove();
    // update status dot
    document.querySelectorAll('.ai-status').forEach(d => {
      d.className = 'ai-status ' + (key.length > 5 ? 'connected' : 'disconnected');
    });
    toast(key ? 'AI configured' : 'AI key removed');
  });
}

// AI system prompts per context
const AI_PROMPTS = {
  demo: `You are a CS2 coaching analyst. The user will provide demo metadata, notes, and a list of 18 review tips with IDs.
For EACH tip, output a line in this exact format:
[TIP_ID] ■■■□□ (X/5) — brief assessment
Where ■=filled □=empty representing how well the player fulfilled that aspect (1-5 scale), followed by a short specific comment.
After all 18 tips, add a "## Summary" section with:
1. Top 3 strengths (tip IDs where score >= 4)
2. Top 3 weaknesses (tip IDs where score <= 2)
3. Priority drill for the specific map played
4. Estimated rank based on overall compliance
Base your assessment on the demo metadata (duration, rounds, map, tickrate) and the player's self-notes/rating. Infer what you can from the data — if notes mention specific events, use those. If no notes, assess based on statistical expectations for the rank implied by the self-rating.
Keep each tip assessment to ONE line. Reply in the same language as the user notes (default English).`,

  hw: `You are a hardware analyst for competitive CS2 gaming. Analyze the system specs provided and give:
1. Bottleneck analysis (CPU vs GPU vs RAM)
2. CS2-specific performance expectations (estimated FPS at 1080p low)
3. Upgrade priority recommendations with budget tiers
4. BIOS/hardware settings to check for this specific hardware
Keep it concise, data-driven.`,

  cfg: `You are a CS2 config optimization expert. Based on the hardware specs and current config settings provided, suggest optimal values for:
1. Network rates for the player's likely connection quality
2. Graphics-related commands for their hardware
3. Input settings optimization
4. Custom commands that complement their setup
Keep it short, just the recommended commands and why.`,

  proc: `You are a Windows process analyst for gaming optimization. Given the process list, identify:
1. Processes safe to kill for gaming (with confidence level)
2. Resource hogs that impact CS2 performance
3. Suspicious or unnecessary background processes
4. Estimated RAM/CPU freed if recommended processes are killed
Be careful: never recommend killing system-critical processes.`,

  net: `You are a network diagnostics expert for CS2 competitive gaming. Analyze the ping results and give:
1. Best server region for this player
2. Connection quality assessment
3. Likely ISP routing issues if any
4. Network optimization suggestions specific to these results
Keep it brief and actionable.`,
};

/* ================================================================
   Social Sharing — Discord webhook, X/Twitter, Reddit, clipboard
   ================================================================ */

function getDiscordWebhook(): string {
  return localStorage.getItem('csmooth_discord_webhook') || '';
}

function setDiscordWebhook(url: string) {
  localStorage.setItem('csmooth_discord_webhook', url);
}

function showDiscordModal(onSaved?: () => void) {
  const existing = document.querySelector('.ai-overlay');
  if (existing) existing.remove();

  const current = getDiscordWebhook();
  const overlay = document.createElement('div');
  overlay.className = 'ai-overlay';
  overlay.innerHTML = `
    <div class="ai-modal">
      <h3>Discord Webhook</h3>
      <label>Webhook URL</label>
      <input type="text" id="discord-wh-url" value="${current}" placeholder="https://discord.com/api/webhooks/..." />
      <div style="font-size:9px;opacity:0.4;margin-top:6px;">
        Server Settings → Integrations → Webhooks → New Webhook → Copy URL
      </div>
      <div class="ai-modal-actions">
        <button class="ai-cancel" id="discord-cancel">Cancel</button>
        <button class="ai-save" id="discord-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('discord-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('discord-save')!.addEventListener('click', () => {
    const url = (document.getElementById('discord-wh-url') as HTMLInputElement).value.trim();
    setDiscordWebhook(url);
    overlay.remove();
    toast(url ? 'Discord webhook saved' : 'Discord webhook removed');
    if (onSaved) onSaved();
  });
}

// color to Discord embed int (strip # and parse hex)
function hexToDiscordColor(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

async function sendDiscord(title: string, description: string, fields: Array<{ name: string; value: string; inline?: boolean }>) {
  const wh = getDiscordWebhook();
  if (!wh) { showDiscordModal(); return; }
  const t = THEMES[currentThemeIdx];
  const color = hexToDiscordColor(t.primary);
  const embedFields = fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true }));
  try {
    const msg = await invoke<string>('send_to_discord', {
      webhookUrl: wh, title, description, color, fields: embedFields,
    });
    toast(msg);
  } catch (e) { toast(`Discord: ${e}`, true); }
}

function shareToX(text: string) {
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  shellOpen(url);
}

function shareToReddit(title: string, text: string) {
  const url = `https://www.reddit.com/submit?title=${encodeURIComponent(title)}&selftext=true&text=${encodeURIComponent(text)}`;
  shellOpen(url);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch { toast('Copy failed', true); }
}

// builds a share toolbar with Discord, X, Reddit, Clipboard
function buildShareBar(getContent: () => { title: string; text: string; fields: Array<{ name: string; value: string; inline?: boolean }> }): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'share-bar';

  const btnDiscord = document.createElement('button');
  btnDiscord.className = 'share-btn share-discord';
  btnDiscord.title = 'Send to Discord channel';
  btnDiscord.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/></svg>`;
  btnDiscord.addEventListener('click', () => {
    const c = getContent();
    sendDiscord(c.title, c.text, c.fields);
  });

  const btnX = document.createElement('button');
  btnX.className = 'share-btn share-x';
  btnX.title = 'Share on X';
  btnX.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  btnX.addEventListener('click', () => {
    const c = getContent();
    shareToX(`${c.title}\n${c.text}\n\n#CS2 #aimcamp #PlayerAgent`);
  });

  const btnReddit = document.createElement('button');
  btnReddit.className = 'share-btn share-reddit';
  btnReddit.title = 'Share on Reddit';
  btnReddit.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`;
  btnReddit.addEventListener('click', () => {
    const c = getContent();
    shareToReddit(c.title, c.text);
  });

  const btnCopy = document.createElement('button');
  btnCopy.className = 'share-btn share-copy';
  btnCopy.title = 'Copy to clipboard';
  btnCopy.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  btnCopy.addEventListener('click', () => {
    const c = getContent();
    const fieldsTxt = c.fields.map(f => `${f.name}: ${f.value}`).join('\n');
    copyToClipboard(`${c.title}\n${c.text}\n${fieldsTxt}`);
  });

  bar.appendChild(btnDiscord);
  bar.appendChild(btnX);
  bar.appendChild(btnReddit);
  bar.appendChild(btnCopy);
  return bar;
}

let currentDemoFolder = '';
let currentDemos: Array<{ name: string; path: string; size_mb: number; modified: number; map_hint: string }> = [];
let selectedDemoIdx = -1;

async function scanDemoFolder(folder: string) {
  currentDemoFolder = folder;
  localStorage.setItem('csmooth_demo_folder', folder);
  const pathEl = document.getElementById('demo-path');
  if (pathEl) pathEl.textContent = folder;
  const listEl = document.getElementById('demo-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="demo-empty">Scanning...</div>';
  try {
    currentDemos = await invoke<typeof currentDemos>('scan_demos', { folder });
    renderDemoList();
  } catch (e) {
    listEl.innerHTML = `<div class="demo-empty">Error: ${e}</div>`;
  }
}

function renderDemoList() {
  const listEl = document.getElementById('demo-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (currentDemos.length === 0) {
    listEl.innerHTML = '<div class="demo-empty">No .dem files found</div>';
    return;
  }
  const hdr = document.createElement('div');
  hdr.className = 'demo-list-header';
  hdr.innerHTML = '<span>Demo</span><span>Map</span><span>Size</span>';
  listEl.appendChild(hdr);
  currentDemos.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'demo-item' + (i === selectedDemoIdx ? ' selected' : '');
    const meta = getDemoMeta()[d.name];
    const ratingStars = meta?.rating ? '★'.repeat(meta.rating) : '';
    row.innerHTML = `<span class="demo-name" title="${d.name}">${ratingStars ? ratingStars + ' ' : ''}${d.name.replace('.dem', '')}</span><span class="demo-map">${d.map_hint || '?'}</span><span class="demo-size">${d.size_mb} MB</span>`;
    row.addEventListener('click', () => selectDemo(i));
    listEl.appendChild(row);
  });
}

async function selectDemo(idx: number) {
  selectedDemoIdx = idx;
  renderDemoList();
  const d = currentDemos[idx];
  const detailEl = document.getElementById('demo-detail');
  if (!detailEl || !d) return;
  detailEl.innerHTML = '<div class="demo-empty">Parsing header...</div>';
  try {
    const hdr = await invoke<Record<string, unknown>>('parse_demo_header', { path: d.path });
    const meta = getDemoMeta()[d.name] || {};
    const durS = Number(hdr.duration_s || 0);
    const durMin = durS > 0 ? `${Math.floor(durS / 60)}m ${Math.round(durS % 60)}s` : 'N/A';
    const date = d.modified > 0 ? new Date(d.modified * 1000).toLocaleString() : 'N/A';

    let html = '<div class="demo-info-grid">';
    html += infoRowHtml('Format', String(hdr.format || 'N/A'));
    html += infoRowHtml('Map', String(hdr.map || d.map_hint || 'N/A'));
    if (hdr.server) html += infoRowHtml('Server', String(hdr.server));
    if (hdr.client) html += infoRowHtml('Player', String(hdr.client));
    html += infoRowHtml('Duration', durMin);
    if (hdr.ticks) html += infoRowHtml('Ticks', String(hdr.ticks));
    if (hdr.tickrate) html += infoRowHtml('Tickrate', String(hdr.tickrate));
    if (hdr.est_rounds) html += infoRowHtml('Est. Rounds', String(hdr.est_rounds));
    html += infoRowHtml('File Size', `${hdr.file_size_mb || d.size_mb} MB`);
    html += infoRowHtml('Date', date);
    html += '</div>';

    // actions
    html += '<div class="demo-actions" style="display:flex;gap:6px;flex-wrap:wrap;">';
    html += `<button class="btn-export" id="demo-play-btn">Play in CS2</button>`;
    html += `<button class="btn-ai" id="demo-ai-btn">🤖 Analyze with AI</button>`;
    html += '</div>';

    // AI response area
    html += '<div class="ai-response" id="demo-ai-response"></div>';

    // share bar
    html += '<div id="demo-share-mount"></div>';

    // rating
    html += '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">';
    html += '<span style="font-size:10px;color:var(--text-muted);font-weight:600;">Rating:</span>';
    html += '<div class="demo-rating" id="demo-rating">';
    for (let s = 1; s <= 5; s++) {
      html += `<span class="star${(meta.rating || 0) >= s ? ' filled' : ''}" data-star="${s}">★</span>`;
    }
    html += '</div></div>';

    // notes
    html += '<div class="demo-notes" style="margin-top:4px;">';
    html += `<textarea id="demo-notes-ta" placeholder="Personal notes for this demo...">${meta.notes || ''}</textarea>`;
    html += '</div>';

    detailEl.innerHTML = html;

    // mount share bar
    const demoShareMount = document.getElementById('demo-share-mount');
    if (demoShareMount) {
      const mapName = String(hdr.map || d.map_hint || 'unknown');
      const shareBar = buildShareBar(() => ({
        title: `CS2 Demo — ${mapName}`,
        text: `${d.name}\nMap: ${mapName} | Duration: ${durMin} | Size: ${hdr.file_size_mb || d.size_mb} MB`,
        fields: [
          { name: 'Map', value: mapName, inline: true },
          { name: 'Duration', value: durMin, inline: true },
          { name: 'Format', value: String(hdr.format || 'N/A'), inline: true },
          ...(hdr.tickrate ? [{ name: 'Tickrate', value: String(hdr.tickrate), inline: true }] : []),
          ...(hdr.server ? [{ name: 'Server', value: String(hdr.server), inline: true }] : []),
          ...(meta.rating ? [{ name: 'Rating', value: '★'.repeat(meta.rating) + '☆'.repeat(5 - meta.rating), inline: true }] : []),
        ],
      }));
      demoShareMount.appendChild(shareBar);
    }

    // event: play
    document.getElementById('demo-play-btn')?.addEventListener('click', async () => {
      try {
        const msg = await invoke<string>('open_demo_in_cs2', { demoPath: d.path });
        toast(msg);
      } catch (e) { toast(`Failed: ${e}`, true); }
    });

    // event: rating stars
    document.querySelectorAll('#demo-rating .star').forEach(star => {
      star.addEventListener('click', () => {
        const v = Number((star as HTMLElement).dataset.star || 0);
        setDemoMeta(d.name, { rating: v });
        document.querySelectorAll('#demo-rating .star').forEach((s, i) => {
          s.classList.toggle('filled', i < v);
        });
        renderDemoList();
      });
    });

    // event: notes
    const ta = document.getElementById('demo-notes-ta') as HTMLTextAreaElement;
    if (ta) {
      let noteTimer: ReturnType<typeof setTimeout>;
      ta.addEventListener('input', () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => setDemoMeta(d.name, { notes: ta.value }), 500);
      });
    }

    // event: AI analysis
    document.getElementById('demo-ai-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('demo-ai-btn') as HTMLButtonElement;
      const respEl = document.getElementById('demo-ai-response');
      if (!respEl || !btn) return;
      if (!hasAiKey()) { showAiModal(); return; }
      btn.disabled = true;
      respEl.innerHTML = '<div class="ai-loading">Analyzing demo...</div>';
      const notesNow = (document.getElementById('demo-notes-ta') as HTMLTextAreaElement)?.value || '';
      const ratingNow = getDemoMeta()[d.name]?.rating || 0;
      const tipsList = DEMO_TIPS.map((t, i) => `TIP_${i + 1}: ${t.title} — ${t.desc}`).join('\n');
      const context = [
        `Demo: ${d.name}`,
        `Map: ${hdr.map || d.map_hint || 'unknown'}`,
        `Format: ${hdr.format || 'unknown'}`,
        hdr.server ? `Server: ${hdr.server}` : '',
        hdr.client ? `Player: ${hdr.client}` : '',
        `Duration: ${durMin}`,
        hdr.ticks ? `Ticks: ${hdr.ticks}` : '',
        hdr.tickrate ? `Tickrate: ${hdr.tickrate}` : '',
        hdr.est_rounds ? `Est. Rounds: ${hdr.est_rounds}` : '',
        `File Size: ${hdr.file_size_mb || d.size_mb} MB`,
        ratingNow ? `Player self-rating: ${ratingNow}/5` : '',
        notesNow ? `Player notes: ${notesNow}` : '',
        '',
        '--- REVIEW TIPS (evaluate each) ---',
        tipsList,
      ].filter(Boolean).join('\n');
      try {
        const result = await aiChat(AI_PROMPTS.demo, context);
        respEl.innerHTML = mdToHtml(result);
      } catch (e) {
        respEl.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`;
      }
      btn.disabled = false;
    });

  } catch (e) {
    detailEl.innerHTML = `<div class="demo-empty">Parse error: ${e}</div>`;
  }
}

function infoRowHtml(label: string, value: string): string {
  return `<div class="demo-info-row"><span class="di-label">${label}</span><span class="di-value">${value}</span></div>`;
}

/* ================================================================
   Build the UI
   ================================================================ */

function buildSubTabs(labels: string[]): { bar: HTMLElement; panels: HTMLElement[]; switchSub: (i: number) => void } {
  const bar = document.createElement('div');
  bar.className = 'sub-tab-bar';
  const btns: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];
  labels.forEach((lbl, i) => {
    const btn = document.createElement('button');
    btn.className = 'sub-tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = lbl;
    btn.addEventListener('click', () => switchSub(i));
    bar.appendChild(btn);
    btns.push(btn);
    const panel = document.createElement('div');
    panel.className = 'sub-tab-panel' + (i === 0 ? ' active' : '');
    panels.push(panel);
  });
  function switchSub(idx: number) {
    btns.forEach((b, i) => b.classList.toggle('active', i === idx));
    panels.forEach((p, i) => p.classList.toggle('active', i === idx));
  }
  return { bar, panels, switchSub };
}

function build() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '';

  /* ── Sidebar ─────────────────────────────────────────────────── */
  const sidebar = document.createElement('nav');
  sidebar.className = 'app-sidebar';

  const btnSys = document.createElement('button');
  btnSys.className = 'sidebar-btn active';
  btnSys.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><span>SYS</span>`;
  btnSys.title = 'System Optimizer';

  const btnCfgTab = document.createElement('button');
  btnCfgTab.className = 'sidebar-btn';
  btnCfgTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><span>CFG</span>`;
  btnCfgTab.title = 'CFG Manager';

  const btnHwTab = document.createElement('button');
  btnHwTab.className = 'sidebar-btn';
  btnHwTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg><span>HW</span>`;
  btnHwTab.title = 'Hardware Info';

  const btnDrvTab = document.createElement('button');
  btnDrvTab.className = 'sidebar-btn';
  btnDrvTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg><span>DRVR</span>`;
  btnDrvTab.title = 'Drivers';

  const btnProcTab = document.createElement('button');
  btnProcTab.className = 'sidebar-btn';
  btnProcTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>PROC</span>`;
  btnProcTab.title = 'Process Manager';

  const btnNetTab = document.createElement('button');
  btnNetTab.className = 'sidebar-btn';
  btnNetTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span>NET</span>`;
  btnNetTab.title = 'Network Diagnostics';

  const btnDemoTab = document.createElement('button');
  btnDemoTab.className = 'sidebar-btn';
  btnDemoTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>DEMO</span>`;
  btnDemoTab.title = 'Demo Review';

  const btnFdbkTab = document.createElement('button');
  btnFdbkTab.className = 'sidebar-btn';
  btnFdbkTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>FDBK</span>`;
  btnFdbkTab.title = 'Feedback & Sugestões';

  const btnBenchTab = document.createElement('button');
  btnBenchTab.className = 'sidebar-btn';
  btnBenchTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg><span>BNCH</span>`;
  btnBenchTab.title = 'Benchmark & Frame Analysis';

  /* ── Community placeholder buttons ─────────────────────────── */
  const sidebarSep = document.createElement('div');
  sidebarSep.className = 'sidebar-sep';
  const sidebarLabel = document.createElement('div');
  sidebarLabel.className = 'sidebar-label';
  sidebarLabel.textContent = 'AIM.CAMP';

  const btnRankTab = document.createElement('button');
  btnRankTab.className = 'sidebar-btn placeholder-btn';
  btnRankTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span>RANK</span>`;
  btnRankTab.title = 'Rankings & Stats';

  const btnServersTab = document.createElement('button');
  btnServersTab.className = 'sidebar-btn placeholder-btn';
  btnServersTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg><span>SRVS</span>`;
  btnServersTab.title = 'Match & Servers';

  const btnMarketTab = document.createElement('button');
  btnMarketTab.className = 'sidebar-btn placeholder-btn';
  btnMarketTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>MRKT</span>`;
  btnMarketTab.title = 'Item Tracker & Market';

  const btnHubTab = document.createElement('button');
  btnHubTab.className = 'sidebar-btn placeholder-btn';
  btnHubTab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span>HUB</span>`;
  btnHubTab.title = 'aim.camp Hub';

  /* ── Sidebar watermark ─────────────────────────────────────── */
  const watermark = document.createElement('div');
  watermark.className = 'sidebar-watermark';
  watermark.innerHTML = `<svg class="sidebar-watermark-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span class="sidebar-watermark-text">aim.camp</span>`;

  sidebar.appendChild(btnSys);
  sidebar.appendChild(btnCfgTab);
  sidebar.appendChild(btnHwTab);
  sidebar.appendChild(btnDrvTab);
  sidebar.appendChild(btnProcTab);
  sidebar.appendChild(btnNetTab);
  sidebar.appendChild(btnDemoTab);
  sidebar.appendChild(btnFdbkTab);
  sidebar.appendChild(btnBenchTab);
  sidebar.appendChild(sidebarSep);
  sidebar.appendChild(sidebarLabel);
  sidebar.appendChild(btnRankTab);
  sidebar.appendChild(btnServersTab);
  sidebar.appendChild(btnMarketTab);
  sidebar.appendChild(btnHubTab);
  sidebar.appendChild(watermark);

  type TabId = 'sys' | 'cfg' | 'hw' | 'drv' | 'proc' | 'net' | 'demo' | 'fdbk' | 'bench' | 'rank' | 'servers' | 'market' | 'hub';
  const allBtns = [btnSys, btnCfgTab, btnHwTab, btnDrvTab, btnProcTab, btnNetTab, btnDemoTab, btnFdbkTab, btnBenchTab, btnRankTab, btnServersTab, btnMarketTab, btnHubTab];
  const tabIds: { btn: HTMLButtonElement; tabId: string }[] = [
    { btn: btnSys, tabId: 'tab-optimizer' },
    { btn: btnCfgTab, tabId: 'tab-cfg' },
    { btn: btnHwTab, tabId: 'tab-hw' },
    { btn: btnDrvTab, tabId: 'tab-drv' },
    { btn: btnProcTab, tabId: 'tab-proc' },
    { btn: btnNetTab, tabId: 'tab-net' },
    { btn: btnDemoTab, tabId: 'tab-demo' },
    { btn: btnFdbkTab, tabId: 'tab-fdbk' },
    { btn: btnBenchTab, tabId: 'tab-bench' },
    { btn: btnRankTab, tabId: 'tab-rank' },
    { btn: btnServersTab, tabId: 'tab-servers' },
    { btn: btnMarketTab, tabId: 'tab-market' },
    { btn: btnHubTab, tabId: 'tab-hub' },
  ];

  function switchTab(t: TabId) {
    const idx = ['sys','cfg','hw','drv','proc','net','demo','fdbk','bench','rank','servers','market','hub'].indexOf(t);
    allBtns.forEach((b, i) => b.classList.toggle('active', i === idx));
    tabIds.forEach((ti, i) => {
      document.getElementById(ti.tabId)?.classList.toggle('active', i === idx);
    });
    // auto-load data on first switch
    if (t === 'hw' && !document.querySelector('.hw-grid')) refreshHardwareInfo();
    if (t === 'drv' && !document.querySelector('.drv-grid')) refreshDriverInfo();
    if (t === 'proc' && !document.querySelector('.proc-item')) refreshProcesses();
    if (t === 'fdbk' && !document.querySelector('.fdbk-card') && !document.querySelector('.fdbk-empty')) refreshFeedbackHistory();
  }
  btnSys.addEventListener('click', () => switchTab('sys'));
  btnCfgTab.addEventListener('click', () => switchTab('cfg'));
  btnHwTab.addEventListener('click', () => switchTab('hw'));
  btnDrvTab.addEventListener('click', () => switchTab('drv'));
  btnProcTab.addEventListener('click', () => switchTab('proc'));
  btnNetTab.addEventListener('click', () => switchTab('net'));
  btnDemoTab.addEventListener('click', () => switchTab('demo'));
  btnFdbkTab.addEventListener('click', () => switchTab('fdbk'));
  btnBenchTab.addEventListener('click', () => switchTab('bench'));
  btnRankTab.addEventListener('click', () => switchTab('rank'));
  btnServersTab.addEventListener('click', () => switchTab('servers'));
  btnMarketTab.addEventListener('click', () => switchTab('market'));
  btnHubTab.addEventListener('click', () => switchTab('hub'));

  const container = document.createElement('div');
  container.className = 'app-container';

  /* ── Header ──────────────────────────────────────────────────── */
  const header = document.createElement('header');
  header.className = 'app-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'header-left';
  headerLeft.innerHTML = `<span class="logo-feather"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span><div><h1>Player Agent</h1><p class="header-subtitle"><span class="header-community">aim.camp</span> CS2 Performance & Community Platform</p></div>`;

  const headerRight = document.createElement('div');
  headerRight.className = 'header-right';

  /* ── Theme icon + dropdown ─────────────────────────────────── */
  const themeWrap = document.createElement('div');
  themeWrap.className = 'theme-wrap';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-btn';
  themeBtn.title = 'Choose color theme';
  themeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/><circle cx="7.5" cy="11.5" r="1.5" fill="#f59e0b" stroke="none"/><circle cx="9" cy="7" r="1.5" fill="#ef4444" stroke="none"/><circle cx="14" cy="6" r="1.5" fill="#3b82f6" stroke="none"/><circle cx="17" cy="10" r="1.5" fill="#10b981" stroke="none"/></svg>`;

  const dropdown = document.createElement('div');
  dropdown.className = 'theme-dropdown';
  dropdown.style.display = 'none';

  THEMES.forEach((t, i) => {
    const opt = document.createElement('div');
    opt.className = 'theme-option' + (i === currentThemeIdx ? ' active' : '');
    const dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.style.background = `linear-gradient(135deg, ${t.primary}, ${t.secondary})`;
    const name = document.createElement('span');
    name.className = 'theme-name';
    name.textContent = t.name;
    opt.appendChild(dot);
    opt.appendChild(name);
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      applyTheme(i);
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(opt);
  });

  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
  });

  themeWrap.appendChild(themeBtn);
  themeWrap.appendChild(dropdown);

  /* ── Profile bar ─────────────────────────────────────────────── */
  const profileBar = document.createElement('div');
  profileBar.className = 'profile-bar';

  const profileSel = document.createElement('select');
  profileSel.id = 'profile-select';
  profileSel.title = 'Select profile';
  const optEmpty = document.createElement('option');
  optEmpty.value = ''; optEmpty.textContent = '-- Profiles --';
  profileSel.appendChild(optEmpty);
  for (const n of getProfileNames()) {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    profileSel.appendChild(o);
  }

  const profileInput = document.createElement('input');
  profileInput.id = 'profile-name';
  profileInput.type = 'text';
  profileInput.placeholder = 'Name';
  profileInput.maxLength = 20;

  const btnProfSave = document.createElement('button');
  btnProfSave.textContent = 'Save';
  btnProfSave.title = 'Save current SYS+CFG state as profile';

  const btnProfLoad = document.createElement('button');
  btnProfLoad.textContent = 'Load';
  btnProfLoad.title = 'Load selected profile';

  const btnProfDel = document.createElement('button');
  btnProfDel.textContent = 'Del';
  btnProfDel.title = 'Delete selected profile';

  function refreshProfileDropdown() {
    profileSel.innerHTML = '';
    const optE = document.createElement('option');
    optE.value = ''; optE.textContent = '-- Profiles --';
    profileSel.appendChild(optE);
    for (const n of getProfileNames()) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      profileSel.appendChild(o);
    }
  }

  btnProfSave.addEventListener('click', () => {
    const name = profileInput.value.trim() || profileSel.value;
    if (!name) { toast('Enter a name', true); return; }
    saveProfile(name);
    refreshProfileDropdown();
    profileSel.value = name;
    toast(`Profile saved: ${name}`);
  });

  btnProfLoad.addEventListener('click', () => {
    const name = profileSel.value;
    if (!name) { toast('Select a profile', true); return; }
    loadProfile(name);
  });

  btnProfDel.addEventListener('click', () => {
    const name = profileSel.value;
    if (!name) return;
    deleteProfile(name);
    refreshProfileDropdown();
    toast(`Profile deleted: ${name}`);
  });

  profileBar.appendChild(profileSel);
  profileBar.appendChild(profileInput);
  profileBar.appendChild(btnProfSave);
  profileBar.appendChild(btnProfLoad);
  profileBar.appendChild(btnProfDel);

  headerRight.appendChild(profileBar);

  /* ── AI config button ──────────────────────────────────────── */
  const aiBtn = document.createElement('button');
  aiBtn.className = 'ai-btn';
  aiBtn.title = 'AI settings (API key, endpoint, model)';
  const aiDot = document.createElement('span');
  aiDot.className = 'ai-status ' + (hasAiKey() ? 'connected' : 'disconnected');
  aiBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.5" fill="currentColor" stroke="none"/><path d="M9 15h6"/></svg>`;
  aiBtn.prepend(aiDot);
  const aiLabel = document.createElement('span');
  aiLabel.textContent = 'AI';
  aiBtn.appendChild(aiLabel);
  aiBtn.addEventListener('click', showAiModal);
  headerRight.appendChild(aiBtn);

  const btnMin = document.createElement('button');
  btnMin.className = 'btn-minimize';
  btnMin.title = 'Minimize to taskbar';
  btnMin.textContent = '—';
  btnMin.addEventListener('click', () => { appWindow.minimize(); });

  const btnClose = document.createElement('button');
  btnClose.className = 'btn-minimize btn-close';
  btnClose.title = 'Close';
  btnClose.textContent = '✕';
  btnClose.addEventListener('click', () => { appWindow.close(); });

  headerRight.appendChild(themeWrap);
  headerRight.appendChild(btnMin);
  headerRight.appendChild(btnClose);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  /* ── 1. BIOS (informational — must be set manually in BIOS/UEFI) ── */
  const c1 = card('BIOS (Manual)', 'ℹ These are recommendations only — BIOS settings must be configured manually in your motherboard BIOS/UEFI setup. The app cannot change BIOS settings.');
  c1.appendChild(infoRow('Disable SVM / Virtualization + Hyper-V', TIP.b_svm));
  c1.appendChild(infoRow('Disable C-States + force CPU 100%', TIP.b_cst));
  c1.appendChild(infoRow("Disable Cool'n'Quiet / SpeedStep", TIP.b_cool));
  c1.appendChild(infoRow('Enable XMP/DOCP (check RAM speed)', TIP.b_xmp));
  c1.appendChild(infoRow('Enable ReSize BAR (SAM)', TIP.b_rbar));
  c1.appendChild(infoRow('Enable Above 4G Decoding', TIP.b_4g));

  /* ── 2. Windows (19 items — reference height card) ───────────── */
  const c2 = card('Windows', '✔ Auto-applied — The script modifies Windows registry & power plans. Run as Admin to apply. Restart may be required.');
  c2.appendChild(toggle('w_power',  'Ultimate Performance Plan', true, TIP.w_power));
  c2.appendChild(toggle('w_dvr',    'Disable Game DVR', true, TIP.w_dvr));
  c2.appendChild(toggle('w_bar',    'Disable Game Bar', true, TIP.w_bar));
  c2.appendChild(toggle('w_mode',   'Disable Game Mode', true, TIP.w_mode));
  c2.appendChild(toggle('w_hib',    'Disable Hibernation', true, TIP.w_hib));
  c2.appendChild(toggle('w_mouse',  'Disable Mouse Accel', true, TIP.w_mouse));
  c2.appendChild(toggle('w_fso',    'Disable Fullscreen Optim', true, TIP.w_fso));
  c2.appendChild(toggle('w_vis',    'Disable Visual Effects', true, TIP.w_vis));
  c2.appendChild(toggle('w_trans',  'Disable Transparency', true, TIP.w_trans));
  c2.appendChild(toggle('w_bgapps', 'Disable Background Apps', true, TIP.w_bgapps));
  c2.appendChild(toggle('w_notif',  'Disable Notifications', true, TIP.w_notif));
  c2.appendChild(toggle('w_cort',   'Disable Cortana', true, TIP.w_cort));
  c2.appendChild(toggle('w_idx',    'Disable Search Indexing', false, TIP.w_idx));
  c2.appendChild(toggle('w_hgs',    'Hardware GPU Scheduling', true, TIP.w_hgs));
  c2.appendChild(toggle('w_hpet',   'Disable HPET', true, TIP.w_hpet));
  c2.appendChild(toggle('w_pthrot', 'Disable Power Throttling', true, TIP.w_pthrot));
  c2.appendChild(toggle('w_park',   'Disable Core Parking', true, TIP.w_park));
  c2.appendChild(toggle('w_temp',   'Clean Temp Files', false, TIP.w_temp));
  c2.appendChild(toggle('w_cs2gpu', 'CS2: High Perf GPU', true, TIP.w_cs2gpu));
  c2.appendChild(toggle('w_deliver','Disable Delivery Optim', true, TIP.w_deliver));
  c2.appendChild(toggle('w_widgets','Disable Widgets (Win11)', false, TIP.w_widgets));
  c2.appendChild(toggle('w_memcomp','Disable Memory Compress', false, TIP.w_memcomp));
  c2.appendChild(toggle('w_uxuser', 'Disable Connected UX', true, TIP.w_uxuser));
  c2.appendChild(toggle('w_spectre', 'Disable CPU Mitigations', false, TIP.w_spectre));
  c2.appendChild(toggle('w_lastaccess','Disable NTFS Last Access', true, TIP.w_lastaccess));
  c2.appendChild(toggle('w_8dot3',    'Disable 8.3 Name Creation', true, TIP.w_8dot3));
  c2.appendChild(toggle('w_mmcss',    'MMCSS Gaming Priority', true, TIP.w_mmcss));
  c2.appendChild(toggle('w_largecache','Disable Large System Cache', true, TIP.w_largecache));

  /* ── 3. Network ──────────────────────────────────────────────── */
  const c3 = card('Network', '✔ Auto-applied — The script modifies network registry & adapter settings via netsh/ipconfig. Applied immediately.');
  c3.appendChild(toggle('n_nagle', 'Disable Nagle (TcpNoDelay)', true, TIP.n_nagle));
  c3.appendChild(toggle('n_tcp',   'Optimize TCP stack', true, TIP.n_tcp));
  c3.appendChild(toggle('n_dns',   'Flush DNS', true, TIP.n_dns));
  c3.appendChild(toggle('n_wifi',  'Disable Wi-Fi Power Save', false, TIP.n_wifi));
  c3.appendChild(toggle('n_throttle','Disable Network Throttle', true, TIP.n_throttle));
  c3.appendChild(toggle('n_ecn',    'Disable ECN Capability', true, TIP.n_ecn));
  c3.appendChild(toggle('n_rss',    'Enable RSS (Recv Scaling)', true, TIP.n_rss));
  c3.appendChild(toggle('n_netbios', 'Disable NetBIOS over TCP', true, TIP.n_netbios));
  c3.appendChild(toggle('n_lmhosts', 'Disable LMHOSTS Lookup', true, TIP.n_lmhosts));
  c3.appendChild(toggle('n_ctcp',    'Enable CTCP Congestion', true, TIP.n_ctcp));

  /* ── 4. NVIDIA ───────────────────────────────────────────────── */
  const c4 = card('NVIDIA', '✔ Auto-applied — The script modifies NVIDIA driver registry keys. Restart the game for changes to take effect.');
  c4.appendChild(toggle('nv_perf',   'Max Performance Mode', true, TIP.nv_perf));
  c4.appendChild(toggle('nv_vsync',  'Disable V-Sync global', true, TIP.nv_vsync));
  c4.appendChild(toggle('nv_lat',    'Ultra Low Latency', true, TIP.nv_lat));
  c4.appendChild(toggle('nv_thread', 'Threaded Optimization', true, TIP.nv_thread));
  c4.appendChild(toggle('nv_aniso',  'AF: App-controlled', false, TIP.nv_aniso));
  c4.appendChild(toggle('nv_shader', 'Clear Shader Cache', false, TIP.nv_shader));
  c4.appendChild(toggle('nv_reflex', 'Force Reflex On+Boost', true, TIP.nv_reflex));
  c4.appendChild(toggle('nv_sharp',  'Disable Image Sharpening', false, TIP.nv_sharp));
  c4.appendChild(toggle('nv_texfilt', 'Texture Filtering: Perf', true, TIP.nv_texfilt));
  c4.appendChild(toggle('nv_prerender','Pre-Rendered Frames = 1', true, TIP.nv_prerender));
  c4.appendChild(toggle('nv_ambient', 'Disable Ambient Occlusion', true, TIP.nv_ambient));
  c4.appendChild(toggle('nv_fxaa',    'Disable Global FXAA', true, TIP.nv_fxaa));

  /* ── 5. Services ─────────────────────────────────────────────── */
  const c5 = card('Services', '✔ Auto-applied — The script stops and disables selected Windows services immediately.');
  c5.appendChild(toggle('s_sys',   'SysMain (Superfetch)', true, TIP.s_sys));
  c5.appendChild(toggle('s_diag',  'DiagTrack (Telemetry)', true, TIP.s_diag));
  c5.appendChild(toggle('s_ws',    'Windows Search', false, TIP.s_ws));
  c5.appendChild(toggle('s_print', 'Print Spooler', false, TIP.s_print));
  c5.appendChild(toggle('s_fax',   'Fax', true, TIP.s_fax));
  c5.appendChild(toggle('s_xbox',  'Xbox Services (all)', true, TIP.s_xbox));
  c5.appendChild(toggle('s_cdp',   'Connected Devices Platform', true, TIP.s_cdp));
  c5.appendChild(toggle('s_wpn',   'WpnUserService (Push)', true, TIP.s_wpn));
  c5.appendChild(toggle('s_diagpol','Diagnostic Policy', false, TIP.s_diagpol));
  c5.appendChild(toggle('s_remote', 'Remote Registry', true, TIP.s_remote));
  c5.appendChild(toggle('s_maps',   'MapsBroker', true, TIP.s_maps));
  c5.appendChild(toggle('s_phonesvc','Phone Service', true, TIP.s_phonesvc));
  c5.appendChild(toggle('s_retaildemo','RetailDemo Service', true, TIP.s_retaildemo));

  /* ── 6. autoexec.cfg ─────────────────────────────────────────── */
  const c6 = card('autoexec.cfg', '✔ Auto-generated — Performance-only commands written to CS2 cfg folder.');
  c6.appendChild(toggle('ae_on', 'Generate autoexec.cfg', true, TIP.ae_on, false));
  c6.appendChild(numInput('ae_fps', 'fps_max', '400'));
  c6.appendChild(numInput('ae_rate','rate', '786432'));
  c6.appendChild(numInput('ae_int', 'cl_interp', '0'));
  c6.appendChild(numInput('ae_ir',  'cl_interp_ratio', '1'));
  c6.appendChild(numInput('ae_ur',  'cl_updaterate', '128'));
  c6.appendChild(numInput('ae_cr',  'cl_cmdrate', '128'));
  c6.appendChild(toggle('ae_raw',  'm_rawinput 1', true, TIP.ae_raw, false));
  const customLabel = document.createElement('label');
  customLabel.textContent = 'Custom commands:';
  customLabel.className = 'helper';
  c6.appendChild(customLabel);
  c6.appendChild(textArea('ae_custom', 'bind "c" "toggle cl_righthand 0 1"'));

  /* ── 7. Launch Options ───────────────────────────────────────── */
  const c7 = card('Launch Options', '⚠ Manual paste — Copy into Steam → CS2 → Properties → Launch Options.');
  c7.appendChild(toggle('lo_exec', '+exec autoexec.cfg', true, TIP.lo_exec, false));
  c7.appendChild(toggle('lo_nvid', '-novid', true, TIP.lo_nvid, false));
  c7.appendChild(toggle('lo_joy',  '-nojoy', true, TIP.lo_joy, false));
  c7.appendChild(toggle('lo_high', '-high', true, TIP.lo_high, false));
  c7.appendChild(toggle('lo_allow', '-allow_third_party_software', false, TIP.lo_allow, false));
  c7.appendChild(numInput('lo_thr','threads', ''));
  const argsLabel = document.createElement('label');
  argsLabel.textContent = 'Extra args:';
  argsLabel.className = 'helper';
  c7.appendChild(argsLabel);
  c7.appendChild(textArea('lo_custom', ''));

  /* ── 8. Extras / FACEIT ──────────────────────────────────────── */
  const c8 = card('Extras & FACEIT', '✔/⚠ Mixed — Registry tweaks are auto-applied via script. FACEIT AC status is informational only. Overlay settings may need app restart.');
  c8.appendChild(infoRow('FACEIT Anti-Cheat status', TIP.x_faceit));
  c8.appendChild(toggle('x_steam',  'Disable Steam Overlay', true, TIP.x_steam));
  c8.appendChild(toggle('x_disc',   'Disable Discord Overlay', true, TIP.x_disc));
  c8.appendChild(toggle('x_resp',   'SystemResponsiveness = 0', true, TIP.x_resp));
  c8.appendChild(toggle('x_gpup',   'GPU Priority for games', true, TIP.x_gpup));
  c8.appendChild(toggle('x_prio',   'PrioritySeparation tuned', true, TIP.x_prio));
  c8.appendChild(toggle('x_cs2p',   'CS2: High Process Priority', true, TIP.x_cs2p));
  c8.appendChild(toggle('x_telem',  'Disable Telemetry Tasks', true, TIP.x_telem));
  c8.appendChild(toggle('x_timer',  'Timer Resolution 0.5ms', false, TIP.x_timer));
  c8.appendChild(toggle('x_msimode', 'MSI Mode for GPU', false, TIP.x_msimode));
  c8.appendChild(toggle('x_pcie',    'PCIe Link State Off', true, TIP.x_pcie));
  c8.appendChild(toggle('x_ndis',    'Interrupt Moderation Off', false, TIP.x_ndis));
  c8.appendChild(toggle('x_large',   'Enable Large Pages', false, TIP.x_large));

  /* ── PRO TIPS (not toggleable — pure informational guidance) ───── */
  /* We inject a tips section below the grid, before the actions bar */
  const tipsSection = document.createElement('section');
  tipsSection.className = 'tips-section';
  tipsSection.innerHTML = `
    <h3 class="tips-heading">Pro Tips & Additional Recommendations</h3>
    <div class="tips-grid">
      <div class="tip-item" title="ISLC (Intelligent Standby List Cleaner) by Wagnardsoft prevents Windows from filling standby RAM with cached data, reducing micro-stutters. Download from wagnardsoft.com and run it alongside CS2.">
        <span class="tip-icon">💡</span><span class="tip-text"><b>ISLC</b> — Run Intelligent Standby List Cleaner to prevent RAM standby stutter. Download from wagnardsoft.com.</span>
      </div>
      <div class="tip-item" title="Windows Timer Resolution defaults to 15.6ms which adds input latency. Use TimerResolution.exe or RTSS to force 0.5ms resolution while gaming. Some anti-cheats may flag this.">
        <span class="tip-icon">⏱</span><span class="tip-text"><b>Timer Resolution</b> — Force 0.5ms timer resolution while gaming for lower input lag. Use TimerResolution.exe.</span>
      </div>
      <div class="tip-item" title="MSI (Message Signaled Interrupts) mode for GPU reduces DPC latency by 50-200µs. Use MSI Utility v3 to enable it for your GPU and network adapter.">
        <span class="tip-icon">⚡</span><span class="tip-text"><b>MSI Mode</b> — Enable MSI interrupts for GPU & NIC to reduce DPC latency. Use MSI Utility v3.</span>
      </div>
      <div class="tip-item" title="Spectre/Meltdown mitigations can reduce CPU performance by 5-30% depending on CPU age. Disabling them is a security tradeoff. bcdedit /set hypervisorlaunchtype off + registry edits.">
        <span class="tip-icon">🛡</span><span class="tip-text"><b>Spectre/Meltdown</b> — Disabling CPU mitigations can gain 5-30% but is a security risk. Research before applying.</span>
      </div>
      <div class="tip-item" title="Windows 10/11 enable Large System Cache by default which competes with games for RAM. Set LargeSystemCache to 0 in HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management.">
        <span class="tip-icon">💾</span><span class="tip-text"><b>Large System Cache</b> — Disable to free RAM for games. Registry: Memory Management → LargeSystemCache=0.</span>
      </div>
      <div class="tip-item" title="Process Lasso or similar tools can set CS2 to always run on performance cores (P-cores) on Intel 12th+ gen CPUs, and prevent Windows from scheduling it on E-cores.">
        <span class="tip-icon">🎯</span><span class="tip-text"><b>CPU Affinity</b> — On hybrid CPUs (Intel 12th+), pin CS2 to P-cores only using Process Lasso.</span>
      </div>
      <div class="tip-item" title="Ensure PCIe link state power management is set to Off in Power Options. This prevents the GPU PCIe bus from downclocking, reducing frame drops.">
        <span class="tip-icon">🔌</span><span class="tip-text"><b>PCIe Link State</b> — Set to Off in Power Options to prevent GPU bus downclocking.</span>
      </div>
      <div class="tip-item" title="Keep GPU drivers updated but avoid Day 1 releases. Use DDU (Display Driver Uninstaller) for clean installs. Game Ready drivers often include CS2-specific optimizations.">
        <span class="tip-icon">📦</span><span class="tip-text"><b>Clean GPU Drivers</b> — Use DDU for clean installs. Prefer Game Ready drivers with CS2 optimizations.</span>
      </div>
    </div>
  `;

  /* ── Actions Bar ─────────────────────────────────────────────── */
  const actions = document.createElement('section');
  actions.className = 'actions';

  const btnExport = document.createElement('button');
  btnExport.className = 'btn-export';
  btnExport.textContent = 'Export .ps1';
  btnExport.title = 'Generate a PowerShell optimization script (.ps1) with all selected settings and save it to disk';

  const btnImport2 = document.createElement('button');
  btnImport2.className = 'btn-import';
  btnImport2.textContent = 'Import .ps1';
  btnImport2.title = 'Load a previously exported .ps1 script and restore its toggle/input settings to the form';

  const btnRun2 = document.createElement('button');
  btnRun2.className = 'btn-run';
  btnRun2.textContent = 'Run as Admin';
  btnRun2.title = 'Generate and immediately execute the optimization script with Administrator privileges — applies all selected changes to your system';

  /* ── Impact prediction bar ───────────────────────────────────── */
  const impactBar = document.createElement('div');
  impactBar.className = 'impact-bar';
  impactBar.title = 'Estimated FPS improvement based on selected features. Features already active on your system (blue LED) are excluded from this estimate.';
  impactBar.innerHTML = `<span class="impact-label">Est. FPS Gain</span><span class="impact-pct"><span id="impact-pct-val">+0.0%</span></span><span class="impact-sep">│</span><span class="impact-fps"><span id="impact-fps-val">+0 FPS</span></span>`;

  actions.appendChild(btnExport);
  actions.appendChild(btnImport2);
  actions.appendChild(btnRun2);
  actions.appendChild(impactBar);

  /* ── Signature (inside actions bar) ───────────────────── */
  const signature = document.createElement('div');
  signature.className = 'app-signature';
  signature.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span> <span class="sig-by">&middot;</span> <span class="sig-community">aim.camp</span>`;
  actions.appendChild(signature);

  /* ── Tab: System Optimizer ─────────────────────────────────────── */
  const tabSys = document.createElement('div');
  tabSys.id = 'tab-optimizer';
  tabSys.className = 'tab-panel active';

  const sysSub = buildSubTabs(['BIOS & Windows', 'Network & GPU', 'Services & Config', 'Extras & Tips']);
  tabSys.appendChild(sysSub.bar);

  // sub 0: BIOS & Windows
  const sysPane0 = document.createElement('main');
  sysPane0.className = 'app-main';
  sysPane0.appendChild(c1);
  sysPane0.appendChild(c2);
  sysSub.panels[0].appendChild(sysPane0);

  // sub 1: Network & GPU
  const sysPane1 = document.createElement('main');
  sysPane1.className = 'app-main';
  sysPane1.appendChild(c3);
  sysPane1.appendChild(c4);
  sysSub.panels[1].appendChild(sysPane1);

  // sub 2: Services & Config
  const sysPane2 = document.createElement('main');
  sysPane2.className = 'app-main';
  sysPane2.appendChild(c5);
  sysPane2.appendChild(c6);
  sysPane2.appendChild(c7);
  sysSub.panels[2].appendChild(sysPane2);

  // sub 3: Extras & Tips
  const sysPane3 = document.createElement('main');
  sysPane3.className = 'app-main';
  sysPane3.appendChild(c8);
  sysSub.panels[3].appendChild(sysPane3);
  sysSub.panels[3].appendChild(tipsSection);

  for (const p of sysSub.panels) tabSys.appendChild(p);
  tabSys.appendChild(actions);

  /* ── Tab: CFG Manager ────────────────────────────────────────── */
  const tabCfg = document.createElement('div');
  tabCfg.id = 'tab-cfg';
  tabCfg.className = 'tab-panel';

  const cfgSub = buildSubTabs(['Performance & Crosshair', 'HUD, Radar & Audio', 'Input, Network & Telemetry', 'Voice, Buy & Misc']);

  // group CFG categories into sub-tab panels
  const cfgSubMap: Record<string, number> = {
    'Performance': 0, 'Crosshair': 0, 'Viewmodel': 0,
    'HUD': 1, 'Radar': 1, 'Audio': 1,
    'Mouse & Input': 2, 'Network': 2,
    'Voice & Comms': 3, 'Buy & Economy': 3, 'Spectator & Demo': 3, 'Misc & QoL': 3,
  };
  const cfgGrids = [0, 1, 2, 3].map(() => {
    const g = document.createElement('main');
    g.className = 'cfg-grid';
    return g;
  });

  for (const cat of CFG) {
    const cc = card(cat.name);
    for (const cmd of cat.commands) {
      if (cmd.type === 'toggle') {
        cc.appendChild(toggle(cmd.id, cmd.label, cmd.on, cmd.tip, false));
      } else {
        const row = document.createElement('div');
        row.className = 'toggle-row';
        if (cmd.tip) row.title = cmd.tip;
        const lbl = document.createElement('label');
        lbl.htmlFor = cmd.id;
        lbl.textContent = cmd.label;
        const vi = document.createElement('input');
        vi.type = 'text'; vi.id = `${cmd.id}_v`; vi.value = cmd.val;
        vi.style.cssText = 'width:56px;text-align:center;padding:2px 4px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:var(--neon-green);font-family:"Rajdhani",monospace;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.id = cmd.id; cb.checked = cmd.on;
        row.appendChild(lbl); row.appendChild(vi); row.appendChild(cb);
        cc.appendChild(row);
      }
    }
    const idx = cfgSubMap[cat.name] ?? 2;
    cfgGrids[idx].appendChild(cc);
  }

  cfgSub.panels[0].appendChild(cfgGrids[0]);
  cfgSub.panels[1].appendChild(cfgGrids[1]);
  cfgSub.panels[2].appendChild(cfgGrids[2]);

  tabCfg.appendChild(cfgSub.bar);

  /* ── Pro Config presets + Crosshair preview ──────────────────── */
  const cfgExtras = document.createElement('section');
  cfgExtras.className = 'cfg-extras';
  cfgExtras.style.cssText = 'display:flex;gap:10px;padding:0 12px 8px;flex-wrap:wrap;';

  // pro config dropdown
  const proCard = card('Pro Configs');
  proCard.style.flex = '1'; proCard.style.minWidth = '200px';
  const proSel = document.createElement('select');
  proSel.className = 'pro-select';
  const proOpt0 = document.createElement('option');
  proOpt0.value = ''; proOpt0.textContent = '-- Select player --';
  proSel.appendChild(proOpt0);
  for (const p of PRO_CONFIGS) {
    const o = document.createElement('option');
    o.value = p.name; o.textContent = `${p.name} (${p.team}) — ${p.sens}@${p.dpi}dpi`;
    proSel.appendChild(o);
  }
  proSel.addEventListener('change', () => {
    const p = PRO_CONFIGS.find(x => x.name === proSel.value);
    if (p) applyProConfig(p);
  });
  const proInfo = document.createElement('div');
  proInfo.style.cssText = 'font-size:10px;opacity:0.5;margin-top:6px;';
  proInfo.textContent = 'Loads crosshair, sensitivity, viewmodel from pro player settings';
  proCard.appendChild(proSel);
  proCard.appendChild(proInfo);
  cfgExtras.appendChild(proCard);

  // crosshair preview
  const xhCard = card('Crosshair Preview');
  xhCard.style.flex = '1'; xhCard.style.minWidth = '200px';
  const xhDiv = document.createElement('div');
  xhDiv.className = 'xhair-preview';
  const cvs = document.createElement('canvas');
  cvs.id = 'xhair-cvs';
  cvs.className = 'xhair-canvas';
  cvs.width = 160; cvs.height = 120;
  xhDiv.appendChild(cvs);
  xhCard.appendChild(xhDiv);
  cfgExtras.appendChild(xhCard);

  cfgSub.panels[2].appendChild(cfgExtras);

  for (const p of cfgSub.panels) tabCfg.appendChild(p);

  // listen for crosshair value changes
  const xhIds = ['cf_xhstyle','cf_xhsize','cf_xhgap','cf_xhthick','cf_xhcolor','cf_xhdot','cf_xhoutline','cf_xht'];
  setTimeout(() => {
    for (const id of xhIds) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      const vel = document.getElementById(id + '_v') as HTMLInputElement | null;
      if (el) el.addEventListener('change', drawCrosshair);
      if (vel) vel.addEventListener('input', drawCrosshair);
    }
    drawCrosshair();
  }, 50);

  /* ── CFG Actions Bar ─────────────────────────────────────────── */
  const cfgActions = document.createElement('section');
  cfgActions.className = 'cfg-actions';

  const btnSaveCfg = document.createElement('button');
  btnSaveCfg.className = 'btn-export';
  btnSaveCfg.textContent = 'Save .cfg';
  btnSaveCfg.title = 'Save autoexec.cfg with selected commands';

  const btnLoadCfg = document.createElement('button');
  btnLoadCfg.className = 'btn-import';
  btnLoadCfg.textContent = 'Load .cfg';
  btnLoadCfg.title = 'Load an existing .cfg file';

  const btnResetCfg = document.createElement('button');
  btnResetCfg.className = 'btn-run';
  btnResetCfg.textContent = 'Reset';
  btnResetCfg.title = 'Reset all commands to defaults';

  const btnCfgAi = document.createElement('button');
  btnCfgAi.className = 'btn-ai';
  btnCfgAi.innerHTML = '🤖 AI Suggest';
  btnCfgAi.title = 'AI config recommendations for your hardware';

  const cfgAiResp = document.createElement('div');
  cfgAiResp.className = 'ai-response';
  cfgAiResp.id = 'cfg-ai-response';

  btnCfgAi.addEventListener('click', async () => {
    if (!hasAiKey()) { showAiModal(); return; }
    btnCfgAi.disabled = true;
    cfgAiResp.innerHTML = '<div class="ai-loading">Generating config suggestions...</div>';
    const hwGrid = document.querySelector('.hw-grid');
    const hwData = hwGrid ? hwGrid.textContent || '' : 'Hardware not scanned yet';
    // gather current CFG states
    const cfgStates: string[] = [];
    for (const cat of CFG) {
      for (const c of cat.commands) {
        const el = document.getElementById(c.id) as HTMLInputElement | null;
        const vel = document.getElementById(c.id + '_v') as HTMLInputElement | null;
        if (el?.checked) cfgStates.push(`${c.label}${vel ? ' = ' + vel.value : ''}`);
      }
    }
    const context = `Hardware:\n${hwData}\n\nActive config commands:\n${cfgStates.join('\n')}`;
    try {
      const result = await aiChat(AI_PROMPTS.cfg, context);
      cfgAiResp.innerHTML = mdToHtml(result);
    } catch (e) { cfgAiResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`; }
    btnCfgAi.disabled = false;
  });

  const cfgCounter = document.createElement('div');
  cfgCounter.className = 'cfg-counter';
  cfgCounter.innerHTML = '<span>Commands:</span> <span id="cfg-count">0</span>';

  const cfgSig = document.createElement('div');
  cfgSig.className = 'app-signature';
  cfgSig.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;

  cfgActions.appendChild(btnSaveCfg);
  cfgActions.appendChild(btnLoadCfg);
  cfgActions.appendChild(btnResetCfg);
  cfgActions.appendChild(btnCfgAi);
  cfgActions.appendChild(cfgCounter);
  cfgActions.appendChild(cfgAiResp);
  cfgActions.appendChild(cfgSig);
  tabCfg.appendChild(cfgActions);

  /* ── Tab: Hardware Info ──────────────────────────────────────── */
  const tabHw = document.createElement('div');
  tabHw.id = 'tab-hw';
  tabHw.className = 'tab-panel';

  const hwHeader = document.createElement('section');
  hwHeader.className = 'hw-actions';
  hwHeader.style.cssText = 'display:flex;gap:8px;padding:10px 12px;align-items:center;';
  const btnHwRefresh = document.createElement('button');
  btnHwRefresh.className = 'btn-export';
  btnHwRefresh.textContent = 'Scan Hardware';
  btnHwRefresh.title = 'Detect hardware via WMI';
  btnHwRefresh.addEventListener('click', refreshHardwareInfo);
  const btnHwAi = document.createElement('button');
  btnHwAi.className = 'btn-ai';
  btnHwAi.innerHTML = '🤖 AI Analysis';
  btnHwAi.title = 'AI bottleneck analysis + upgrade tips';
  const hwInfo = document.createElement('span');
  hwInfo.style.cssText = 'font-size:10px;opacity:0.5;';
  hwInfo.textContent = 'Reads CPU, GPU, RAM, disk, HAGS, ReBAR via PowerShell WMI';
  hwHeader.appendChild(btnHwRefresh);
  hwHeader.appendChild(btnHwAi);
  const hwShareBar = buildShareBar(() => {
    const hwText = document.getElementById('hw-content')?.textContent || 'No data';
    return { title: 'aim.camp Player Agent — Hardware Specs', text: hwText.slice(0, 500), fields: [] };
  });
  hwHeader.appendChild(hwShareBar);
  hwHeader.appendChild(hwInfo);
  tabHw.appendChild(hwHeader);

  const hwContent = document.createElement('div');
  hwContent.id = 'hw-content';
  hwContent.style.cssText = 'padding:0 12px 12px;';
  hwContent.innerHTML = '<div class="net-status">Click "Scan Hardware" to detect your system</div>';
  tabHw.appendChild(hwContent);

  const hwAiResp = document.createElement('div');
  hwAiResp.className = 'ai-response';
  hwAiResp.id = 'hw-ai-response';
  hwAiResp.style.margin = '0 12px';
  tabHw.appendChild(hwAiResp);

  btnHwAi.addEventListener('click', async () => {
    if (!hasAiKey()) { showAiModal(); return; }
    const hwText = document.getElementById('hw-content')?.textContent || '';
    if (hwText.includes('Click "Scan')) { toast('Scan hardware first', true); return; }
    btnHwAi.disabled = true;
    hwAiResp.innerHTML = '<div class="ai-loading">Analyzing hardware...</div>';
    try {
      const result = await aiChat(AI_PROMPTS.hw, hwText);
      hwAiResp.innerHTML = mdToHtml(result);
    } catch (e) { hwAiResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`; }
    btnHwAi.disabled = false;
  });

  const hwSig = document.createElement('section');
  hwSig.className = 'cfg-actions';
  hwSig.style.marginTop = 'auto';
  const hwSigText = document.createElement('div');
  hwSigText.className = 'app-signature';
  hwSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  hwSig.appendChild(hwSigText);
  tabHw.appendChild(hwSig);

  /* ── Tab: Drivers ────────────────────────────────────────────── */
  const tabDrv = document.createElement('div');
  tabDrv.id = 'tab-drv';
  tabDrv.className = 'tab-panel';

  const drvHeader = document.createElement('section');
  drvHeader.className = 'hw-actions';
  drvHeader.style.cssText = 'display:flex;gap:8px;padding:10px 12px;align-items:center;';
  const btnDrvRefresh = document.createElement('button');
  btnDrvRefresh.className = 'btn-export';
  btnDrvRefresh.textContent = 'Analisar Drivers';
  btnDrvRefresh.title = 'Analisar drivers do sistema e periféricos via WMI';
  btnDrvRefresh.addEventListener('click', refreshDriverInfo);
  const drvInfo = document.createElement('span');
  drvInfo.style.cssText = 'font-size:10px;opacity:0.5;';
  drvInfo.textContent = 'Detecta drivers GPU, áudio, rede, rato, teclado e controladores. Verifica se são genéricos ou do fabricante.';
  drvHeader.appendChild(btnDrvRefresh);
  drvHeader.appendChild(drvInfo);
  tabDrv.appendChild(drvHeader);

  const drvContent = document.createElement('div');
  drvContent.id = 'drv-content';
  drvContent.style.cssText = 'padding:0;flex:1;overflow-y:auto;';
  drvContent.innerHTML = '<div class="net-status">Clique "Analisar Drivers" para verificar os drivers do seu sistema</div>';
  tabDrv.appendChild(drvContent);

  const drvSig = document.createElement('section');
  drvSig.className = 'cfg-actions';
  drvSig.style.marginTop = 'auto';
  const drvSigText = document.createElement('div');
  drvSigText.className = 'app-signature';
  drvSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  drvSig.appendChild(drvSigText);
  tabDrv.appendChild(drvSig);

  /* ── Tab: Process Manager ────────────────────────────────────── */
  const tabProc = document.createElement('div');
  tabProc.id = 'tab-proc';
  tabProc.className = 'tab-panel';

  const procHeader = document.createElement('section');
  procHeader.style.cssText = 'display:flex;gap:8px;padding:10px 12px;align-items:center;';
  const btnProcRefresh = document.createElement('button');
  btnProcRefresh.className = 'btn-export';
  btnProcRefresh.textContent = 'Refresh Processes';
  btnProcRefresh.title = 'List top 40 processes by RAM usage';
  btnProcRefresh.addEventListener('click', refreshProcesses);
  const btnProcAi = document.createElement('button');
  btnProcAi.className = 'btn-ai';
  btnProcAi.innerHTML = '🤖 AI Analyze';
  btnProcAi.title = 'AI identifies safe-to-kill processes';
  const procInfo = document.createElement('span');
  procInfo.style.cssText = 'font-size:10px;opacity:0.5;';
  procInfo.textContent = 'Shows top 40 processes (>10MB RAM). Yellow = known resource hog.';
  procHeader.appendChild(btnProcRefresh);
  procHeader.appendChild(btnProcAi);
  const procShareBar = buildShareBar(() => {
    const procText = document.getElementById('proc-list')?.textContent || 'No data';
    return { title: 'aim.camp Player Agent — Process List', text: procText.slice(0, 500), fields: [] };
  });
  procHeader.appendChild(procShareBar);
  procHeader.appendChild(procInfo);
  tabProc.appendChild(procHeader);

  const procHdr = document.createElement('div');
  procHdr.className = 'proc-header';
  procHdr.innerHTML = '<span>Process</span><span>RAM</span><span>CPU</span><span></span>';
  tabProc.appendChild(procHdr);

  const procList = document.createElement('div');
  procList.id = 'proc-list';
  procList.className = 'proc-list';
  procList.innerHTML = '<div class="net-status">Click "Refresh Processes" to scan</div>';
  tabProc.appendChild(procList);

  const procAiResp = document.createElement('div');
  procAiResp.className = 'ai-response';
  procAiResp.id = 'proc-ai-response';
  procAiResp.style.margin = '0 12px';
  tabProc.appendChild(procAiResp);

  btnProcAi.addEventListener('click', async () => {
    if (!hasAiKey()) { showAiModal(); return; }
    const procText = document.getElementById('proc-list')?.textContent || '';
    if (procText.includes('Click "Refresh')) { toast('Refresh processes first', true); return; }
    btnProcAi.disabled = true;
    procAiResp.innerHTML = '<div class="ai-loading">Analyzing processes...</div>';
    try {
      const result = await aiChat(AI_PROMPTS.proc, procText);
      procAiResp.innerHTML = mdToHtml(result);
    } catch (e) { procAiResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`; }
    btnProcAi.disabled = false;
  });

  const procSig = document.createElement('section');
  procSig.className = 'cfg-actions';
  procSig.style.marginTop = 'auto';
  const procSigText = document.createElement('div');
  procSigText.className = 'app-signature';
  procSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  procSig.appendChild(procSigText);
  tabProc.appendChild(procSig);

  /* ── Tab: Network Diagnostics ────────────────────────────────── */
  const tabNet = document.createElement('div');
  tabNet.id = 'tab-net';
  tabNet.className = 'tab-panel';

  const netHeader = document.createElement('section');
  netHeader.style.cssText = 'display:flex;gap:8px;padding:10px 12px;align-items:center;';
  const btnPingAll = document.createElement('button');
  btnPingAll.className = 'btn-export';
  btnPingAll.textContent = 'Ping All Servers';
  btnPingAll.title = 'Ping Valve + FACEIT + DNS servers';
  btnPingAll.addEventListener('click', runPingTests);
  const btnNetAi = document.createElement('button');
  btnNetAi.className = 'btn-ai';
  btnNetAi.innerHTML = '🤖 AI Diagnose';
  btnNetAi.title = 'AI network quality analysis';
  const netInfo = document.createElement('span');
  netInfo.style.cssText = 'font-size:10px;opacity:0.5;';
  netInfo.textContent = 'Pings 10 servers (Valve, FACEIT, DNS). Takes ~40 seconds.';
  netHeader.appendChild(btnPingAll);
  netHeader.appendChild(btnNetAi);
  const netShareBar = buildShareBar(() => {
    const netText = document.getElementById('net-results')?.textContent || 'No data';
    return { title: 'aim.camp Player Agent — Network Ping Results', text: netText.slice(0, 500), fields: [] };
  });
  netHeader.appendChild(netShareBar);
  netHeader.appendChild(netInfo);
  tabNet.appendChild(netHeader);

  const netResults = document.createElement('div');
  netResults.id = 'net-results';
  netResults.className = 'net-grid';
  netResults.style.cssText = 'padding:0 12px 12px;';
  netResults.innerHTML = '<div class="net-status">Click "Ping All Servers" to test latency</div>';
  tabNet.appendChild(netResults);

  const netAiResp = document.createElement('div');
  netAiResp.className = 'ai-response';
  netAiResp.id = 'net-ai-response';
  netAiResp.style.margin = '0 12px';
  tabNet.appendChild(netAiResp);

  btnNetAi.addEventListener('click', async () => {
    if (!hasAiKey()) { showAiModal(); return; }
    const netText = document.getElementById('net-results')?.textContent || '';
    if (netText.includes('Click "Ping')) { toast('Run ping tests first', true); return; }
    btnNetAi.disabled = true;
    netAiResp.innerHTML = '<div class="ai-loading">Analyzing network...</div>';
    try {
      const result = await aiChat(AI_PROMPTS.net, netText);
      netAiResp.innerHTML = mdToHtml(result);
    } catch (e) { netAiResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`; }
    btnNetAi.disabled = false;
  });

  const netSig = document.createElement('section');
  netSig.className = 'cfg-actions';
  netSig.style.marginTop = 'auto';
  const netSigText = document.createElement('div');
  netSigText.className = 'app-signature';
  netSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  netSig.appendChild(netSigText);
  tabNet.appendChild(netSig);

  /* ── Tab: Demo Review ────────────────────────────────────────── */
  const tabDemo = document.createElement('div');
  tabDemo.id = 'tab-demo';
  tabDemo.className = 'tab-panel';

  const demoSub = buildSubTabs(['Library', 'Review Guide']);
  tabDemo.appendChild(demoSub.bar);

  // toolbar
  const demoToolbar = document.createElement('div');
  demoToolbar.className = 'demo-toolbar';

  const btnDemoFolder = document.createElement('button');
  btnDemoFolder.className = 'btn-import';
  btnDemoFolder.textContent = 'Browse Folder';
  btnDemoFolder.title = 'Select CS2 replays folder';
  btnDemoFolder.addEventListener('click', async () => {
    try {
      const f = await invoke<string>('pick_demo_folder');
      scanDemoFolder(f);
    } catch { /* cancelled */ }
  });

  const btnDemoRefresh = document.createElement('button');
  btnDemoRefresh.className = 'btn-export';
  btnDemoRefresh.textContent = 'Scan';
  btnDemoRefresh.title = 'Re-scan folder for .dem files';
  btnDemoRefresh.addEventListener('click', () => {
    if (currentDemoFolder) scanDemoFolder(currentDemoFolder);
  });

  const demoPathEl = document.createElement('span');
  demoPathEl.id = 'demo-path';
  demoPathEl.className = 'demo-path';
  demoPathEl.textContent = localStorage.getItem('csmooth_demo_folder') || 'No folder selected';

  const demoCount = document.createElement('span');
  demoCount.style.cssText = 'font-size:10px;opacity:0.5;';
  demoCount.textContent = 'Select your CS2/replays folder or a custom folder with .dem files';

  demoToolbar.appendChild(btnDemoFolder);
  demoToolbar.appendChild(btnDemoRefresh);
  demoToolbar.appendChild(demoPathEl);
  demoToolbar.appendChild(demoCount);
  demoSub.panels[0].appendChild(demoToolbar);

  // body: left = demo list, right = detail
  const demoBody = document.createElement('div');
  demoBody.className = 'demo-body';

  const demoListWrap = document.createElement('div');
  demoListWrap.className = 'demo-list-wrap';
  demoListWrap.id = 'demo-list';
  demoListWrap.innerHTML = '<div class="demo-empty">Select a folder to scan for demos</div>';
  demoBody.appendChild(demoListWrap);

  const demoDetailWrap = document.createElement('div');
  demoDetailWrap.className = 'demo-detail';

  const demoDetailContent = document.createElement('div');
  demoDetailContent.id = 'demo-detail';
  demoDetailContent.innerHTML = '<div class="demo-empty">Select a demo from the list</div>';
  demoDetailWrap.appendChild(demoDetailContent);

  demoBody.appendChild(demoDetailWrap);
  demoSub.panels[0].appendChild(demoBody);

  // review tips section (sub-tab 1)
  const tipsCard = card('Demo Review Guide');
  const tipsContainer = document.createElement('div');
  tipsContainer.className = 'demo-tips';

  for (const tip of DEMO_TIPS) {
    const el = document.createElement('div');
    el.className = `demo-tip priority-${tip.priority}`;
    el.title = tip.detail;
    const prioLabel = tip.priority === 'critical' ? 'MUST' : tip.priority === 'high' ? 'CHECK' : tip.priority === 'medium' ? 'WEEKLY' : 'AWARE';
    const prioClass = `prio-${tip.priority}`;
    el.innerHTML = `<span class="dt-icon">${tip.icon}</span><div class="dt-body"><span class="dt-title">${tip.title}</span> <span class="dt-desc">${tip.desc}</span></div><span class="dt-prio ${prioClass}">${prioLabel}</span>`;
    tipsContainer.appendChild(el);
  }
  tipsCard.appendChild(tipsContainer);
  demoSub.panels[1].appendChild(tipsCard);

  for (const p of demoSub.panels) tabDemo.appendChild(p);

  const demoSig = document.createElement('section');
  demoSig.className = 'cfg-actions';
  demoSig.style.marginTop = 'auto';
  const demoSigText = document.createElement('div');
  demoSigText.className = 'app-signature';
  demoSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  demoSig.appendChild(demoSigText);
  tabDemo.appendChild(demoSig);

  // auto-load saved folder (fallback to test-demos for dev)
  const savedDemoFolder = localStorage.getItem('csmooth_demo_folder');
  const defaultDemoFolder = 'D:\\Projetos\\CSmooth\\test-demos';
  const folderToLoad = savedDemoFolder || defaultDemoFolder;
  setTimeout(() => scanDemoFolder(folderToLoad), 100);

  /* ── Community Placeholder Tabs ────────────────────────────────── */
  function buildPlaceholder(id: string, icon: string, title: string, subtitle: string, desc: string, features: string[], integrations: string[], eta: string): HTMLElement {
    const tab = document.createElement('div');
    tab.id = id;
    tab.className = 'tab-panel';
    tab.innerHTML = `
      <div class="placeholder-panel">
        <div class="placeholder-badge">EM DESENVOLVIMENTO</div>
        <div class="placeholder-icon">${icon}</div>
        <div class="placeholder-title">${title}</div>
        <div class="placeholder-subtitle">${subtitle}</div>
        <div class="placeholder-desc">${desc}</div>
        <div class="placeholder-section-label">Features</div>
        <div class="placeholder-features">
          ${features.map(f => `<span class="placeholder-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${f}</span>`).join('')}
        </div>
        <div class="placeholder-section-label">Integrações</div>
        <div class="placeholder-integrations">
          ${integrations.map(i => `<span class="placeholder-integration">${i}</span>`).join('')}
        </div>
        <div class="placeholder-eta">${eta}</div>
      </div>`;
    return tab;
  }

  /* ── Tab: Feedback & Sugestões ───────────────────────────────── */
  const tabFdbk = document.createElement('div');
  tabFdbk.id = 'tab-fdbk';
  tabFdbk.className = 'tab-panel';

  const fdbkToolbar = document.createElement('section');
  fdbkToolbar.className = 'hw-actions';
  fdbkToolbar.style.cssText = 'display:flex;gap:8px;padding:10px 12px;align-items:center;flex-wrap:wrap;';

  const btnFdbkNew = document.createElement('button');
  btnFdbkNew.className = 'btn-export';
  btnFdbkNew.textContent = '📝 Nova Sugestão';
  btnFdbkNew.title = 'Abrir formulário de feedback';
  btnFdbkNew.addEventListener('click', async () => {
    const b64 = await captureAppScreenshot();
    showFeedbackModal(b64);
  });

  const btnFdbkRefresh = document.createElement('button');
  btnFdbkRefresh.className = 'btn-import';
  btnFdbkRefresh.textContent = '🔄 Atualizar';
  btnFdbkRefresh.title = 'Recarregar histórico';
  btnFdbkRefresh.addEventListener('click', refreshFeedbackHistory);

  const btnFdbkGhCfg = document.createElement('button');
  btnFdbkGhCfg.className = 'btn-import';
  btnFdbkGhCfg.textContent = '🐙 GitHub';
  btnFdbkGhCfg.title = 'Configurar GitHub';
  btnFdbkGhCfg.addEventListener('click', showGitHubConfigModal);

  const btnFdbkDiscordCfg = document.createElement('button');
  btnFdbkDiscordCfg.className = 'btn-import';
  btnFdbkDiscordCfg.textContent = '🎮 Discord';
  btnFdbkDiscordCfg.title = 'Configurar Discord Webhook';
  btnFdbkDiscordCfg.addEventListener('click', () => showDiscordModal());

  const fdbkInfo = document.createElement('span');
  fdbkInfo.style.cssText = 'font-size:10px;opacity:0.5;flex:1;';
  fdbkInfo.textContent = 'Clique direito em qualquer parte da app para enviar feedback rápido.';

  fdbkToolbar.appendChild(btnFdbkNew);
  fdbkToolbar.appendChild(btnFdbkRefresh);
  fdbkToolbar.appendChild(btnFdbkGhCfg);
  fdbkToolbar.appendChild(btnFdbkDiscordCfg);
  fdbkToolbar.appendChild(fdbkInfo);
  tabFdbk.appendChild(fdbkToolbar);

  const fdbkHistory = document.createElement('div');
  fdbkHistory.id = 'fdbk-history';
  fdbkHistory.style.cssText = 'padding:8px 12px;flex:1;overflow-y:auto;';
  fdbkHistory.innerHTML = '<div class="fdbk-empty"><div class="fdbk-empty-icon">📝</div><div class="fdbk-empty-text">Sem feedback registado</div><div class="fdbk-empty-hint">Clique direito em qualquer parte da app para enviar sugestões, ou usa o botão acima.</div></div>';
  tabFdbk.appendChild(fdbkHistory);

  const fdbkSig = document.createElement('section');
  fdbkSig.className = 'cfg-actions';
  fdbkSig.style.marginTop = 'auto';
  const fdbkSigText = document.createElement('div');
  fdbkSigText.className = 'app-signature';
  fdbkSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  fdbkSig.appendChild(fdbkSigText);
  tabFdbk.appendChild(fdbkSig);

  /* ── Tab: Benchmark / Frame Analysis ─────────────────────────── */
  const tabBench = document.createElement('div');
  tabBench.id = 'tab-bench';
  tabBench.className = 'tab-panel';

  const benchToolbar = document.createElement('section');
  benchToolbar.className = 'hw-actions';
  benchToolbar.style.cssText = 'display:flex;gap:8px;padding:10px 12px;align-items:center;flex-wrap:wrap;';

  const btnBenchImport = document.createElement('button');
  btnBenchImport.className = 'btn-export';
  btnBenchImport.textContent = '📂 Importar CSV/JSON';
  btnBenchImport.title = 'Importar ficheiro PresentMon CSV ou CapFrameX JSON';
  btnBenchImport.addEventListener('click', importBenchmarkFile);

  const btnBenchCX = document.createElement('button');
  btnBenchCX.className = 'btn-import';
  btnBenchCX.textContent = '📦 CapFrameX';
  btnBenchCX.title = 'Procurar capturas CapFrameX';
  btnBenchCX.addEventListener('click', scanCapFrameX);

  const btnBenchClear = document.createElement('button');
  btnBenchClear.className = 'btn-import';
  btnBenchClear.textContent = '🗑 Limpar';
  btnBenchClear.title = 'Limpar dados de benchmark';
  btnBenchClear.addEventListener('click', () => {
    benchHistory.length = 0;
    currentBenchResult = null;
    const el = document.getElementById('bench-content');
    if (el) el.innerHTML = '<div class="bench-empty"><div class="bench-empty-icon">📊</div><div class="bench-empty-title">Benchmark & Frame Analysis</div><div class="bench-empty-desc">Importa um ficheiro PresentMon (.csv) ou CapFrameX (.json) para analisar frame times, FPS e stutters do teu sistema em CS2.</div><div class="bench-empty-hint">Alternativa leve ao CapFrameX — analisa os mesmos dados com métricas completas e gráficos interativos.</div><div class="bench-compat"><span class="bench-compat-item">✅ PresentMon CSV</span><span class="bench-compat-item">✅ CapFrameX JSON</span><span class="bench-compat-item">✅ OCAT CSV</span><span class="bench-compat-item">✅ FrameView CSV</span></div></div>';
  });

  const benchInfo = document.createElement('span');
  benchInfo.style.cssText = 'font-size:10px;opacity:0.5;flex:1;';
  benchInfo.textContent = 'Compatível com PresentMon, CapFrameX, OCAT e FrameView. Análise de frame times, FPS, percentis e stutters.';

  benchToolbar.appendChild(btnBenchImport);
  benchToolbar.appendChild(btnBenchCX);
  benchToolbar.appendChild(btnBenchClear);
  benchToolbar.appendChild(benchInfo);
  tabBench.appendChild(benchToolbar);

  const benchContent = document.createElement('div');
  benchContent.id = 'bench-content';
  benchContent.style.cssText = 'padding:0 12px;flex:1;overflow-y:auto;';
  benchContent.innerHTML = '<div class="bench-empty"><div class="bench-empty-icon">📊</div><div class="bench-empty-title">Benchmark & Frame Analysis</div><div class="bench-empty-desc">Importa um ficheiro PresentMon (.csv) ou CapFrameX (.json) para analisar frame times, FPS e stutters do teu sistema em CS2.</div><div class="bench-empty-hint">Alternativa leve ao CapFrameX — analisa os mesmos dados com métricas completas e gráficos interativos.</div><div class="bench-compat"><span class="bench-compat-item">✅ PresentMon CSV</span><span class="bench-compat-item">✅ CapFrameX JSON</span><span class="bench-compat-item">✅ OCAT CSV</span><span class="bench-compat-item">✅ FrameView CSV</span></div></div>';
  tabBench.appendChild(benchContent);

  const benchSig = document.createElement('section');
  benchSig.className = 'cfg-actions';
  benchSig.style.marginTop = 'auto';
  const benchSigText = document.createElement('div');
  benchSigText.className = 'app-signature';
  benchSigText.innerHTML = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>`;
  benchSig.appendChild(benchSigText);
  tabBench.appendChild(benchSig);

  const tabRank = buildPlaceholder('tab-rank',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    'RANKINGS & STATS',
    'ELO \u00b7 Leaderboards \u00b7 Conquistas',
    'Rankings globais e mensais, ELO tracking, stats por mapa e modo, conquistas desbloqueáveis e perfis de jogador com histórico de partidas. Login via Steam, Discord ou FACEIT.',
    ['ELO Tracker', 'Leaderboard Global', 'Stats por Mapa', 'Conquistas & Badges', 'Match History', 'Player Profiles'],
    ['OAuth Steam', 'OAuth Discord', 'FACEIT API', 'Node.js Backend'],
    'Integra\u00E7\u00E3o OAuth + FACEIT Data API \u2014 em desenvolvimento'
  );

  const tabServers = buildPlaceholder('tab-servers',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    'MATCH & SERVERS',
    'Criar Partida \u00b7 5v5 \u00b7 Retakes \u00b7 Live Status',
    'Lança servidores CS2 diretamente via Discord Bot. Modos 5v5 competitivo e Retakes com auto team balancing, criação de canais de voz e info privada por jogador. Monitorização em tempo real.',
    ['Criar Partida via Bot', '5v5 Competitivo', 'Retakes Mode', 'Auto Team Balancing', 'Server Status Live', 'Quick Connect'],
    ['Discord Bot', 'Docker + SteamCMD', 'WebSocket', 'Prometheus'],
    'Infraestrutura Docker + SteamCMD + Discord Bot \u2014 em desenvolvimento'
  );

  const tabMarket = buildPlaceholder('tab-market',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'ITEM TRACKER',
    'Inventário \u00b7 Preços \u00b7 Watchlist \u00b7 Alertas',
    'Monitoriza o teu inventário Steam CS2, acompanha o histórico de preços de skins, cria watchlists com alertas de preço e analisa tendências do mercado. Informação em tempo real.',
    ['Steam Inventory', 'Price History', 'Watchlist & Alertas', 'Market Trends', 'Trade Tracker', 'Float & Wear'],
    ['Steam Web API', 'WebSocket Real-time', 'Node.js Backend', 'React Frontend'],
    'Integra\u00E7\u00E3o Steam Web API + Price Tracking \u2014 em desenvolvimento'
  );

  const tabHub = buildPlaceholder('tab-hub',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    'AIM.CAMP HUB',
    'Wiki \u00b7 Eventos \u00b7 Discord \u00b7 Feedback',
    'Portal central da comunidade aim.camp: wiki com guias e strats, calendário de eventos e torneios, bridge com Discord, sistema de feedback e sugestões. Conhecimento partilhado por todos.',
    ['Wiki & Guias', 'Evento Calendar', 'Discord Bridge', 'Feedback System', 'Torneios', 'Member Profiles'],
    ['Discord OAuth', 'React SPA', 'WebSocket', 'Grafana Dashboards'],
    'Community platform aim.camp \u2014 em desenvolvimento'
  );

  /* ── Assemble ────────────────────────────────────────────────── */
  container.appendChild(header);
  container.appendChild(tabSys);
  container.appendChild(tabCfg);
  container.appendChild(tabHw);
  container.appendChild(tabDrv);
  container.appendChild(tabProc);
  container.appendChild(tabNet);
  container.appendChild(tabDemo);
  container.appendChild(tabFdbk);
  container.appendChild(tabBench);
  container.appendChild(tabRank);
  container.appendChild(tabServers);
  container.appendChild(tabMarket);
  container.appendChild(tabHub);
  app.appendChild(sidebar);
  app.appendChild(container);

  /* ── Button handlers ─────────────────────────────────────────── */
  btnExport.addEventListener('click', exportScript);
  btnImport2.addEventListener('click', importScript);
  btnRun2.addEventListener('click', runConfigAsAdmin);
  btnSaveCfg.addEventListener('click', saveCfgFile);
  btnLoadCfg.addEventListener('click', loadCfgFile);
  btnResetCfg.addEventListener('click', resetCfgDefaults);

  /* CFG counter listeners */
  for (const cat of CFG) for (const c of cat.commands) {
    const el = document.getElementById(c.id) as HTMLInputElement | null;
    if (el) el.addEventListener('change', updateCfgCounter);
  }

  /* ── Initial calcs ─────────────────────────────────────────── */
  updateImpact();
  updateCfgCounter();
}

build();

// Restore saved theme
const savedTheme = localStorage.getItem('csmooth_theme');
if (savedTheme !== null) applyTheme(Number.parseInt(savedTheme, 10));

refreshSystemState();
