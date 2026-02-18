import { open as shellOpen } from "@tauri-apps/api/shell";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";
import "./style.css";
import { llmService } from "./lib/llm-service";

/* ================================================================
   Global error handler — catch-all for uncaught errors & rejections
   ================================================================ */
globalThis.onerror = (_msg, _src, _line, _col, err) => {
  console.error("[Global]", err);
  try {
    const t = document.createElement("div");
    t.className = "status-toast toast-error";
    t.textContent = `Unexpected error: ${err?.message ?? "unknown"}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  } catch { /* avoid infinite loop */ }
};
globalThis.onunhandledrejection = (ev: PromiseRejectionEvent) => {
  console.error("[UnhandledRejection]", ev.reason);
  try {
    const t = document.createElement("div");
    t.className = "status-toast toast-error";
    t.textContent = `Unhandled promise: ${ev.reason?.message ?? String(ev.reason)}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  } catch { /* avoid infinite loop */ }
};

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
  allow_third_party: boolean;
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
let _currentScriptPath = "";

/* ================================================================
   Schema System — layout customization for CFG tabs
   ================================================================ */
interface SchemaTabLayout {
  /** Ordered list of command IDs visible in this tab view */
  commands: string[];
}

interface Schema {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Maps tab view names to their layouts.
   *  Keys: "Principal", "sec_Performance", "sec_Crosshair", "sec_HUD & Radar",
   *        "sec_Audio", "sec_Input & Rede", "sec_Outros" */
  cfgLayout: Record<string, SchemaTabLayout>;
  /** SYS + CFG input values snapshot (checkbox states + text values) */
  values?: Record<string, string | boolean>;
}

const SCHEMA_STORAGE_KEY = "aimcamp_schemas";
const SCHEMA_ACTIVE_KEY = "aimcamp_schema_active";

function getSchemas(): Schema[] {
  try {
    return JSON.parse(localStorage.getItem(SCHEMA_STORAGE_KEY) || "[]");
  } catch { return []; }
}
function saveSchemas(schemas: Schema[]): void {
  localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(schemas));
}
function getActiveSchemaId(): string | null {
  return localStorage.getItem(SCHEMA_ACTIVE_KEY);
}
function setActiveSchemaId(id: string | null): void {
  if (id) localStorage.setItem(SCHEMA_ACTIVE_KEY, id);
  else localStorage.removeItem(SCHEMA_ACTIVE_KEY);
}
function getActiveSchema(): Schema | null {
  const id = getActiveSchemaId();
  if (!id) return null;
  return getSchemas().find((s) => s.id === id) || null;
}
function generateSchemaId(): string {
  return "sch_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function createSchema(name: string): Schema {
  const schemas = getSchemas();
  const now = new Date().toISOString();
  // Build default layout from current CFG pri flags
  const priCmds: string[] = [];
  const secMap: Record<string, string[]> = {
    sec_Performance: [], sec_Crosshair: [], "sec_HUD & Radar": [],
    sec_Audio: [], "sec_Input & Rede": [], sec_Outros: [],
  };
  const catToSec = CAT_TO_SEC_KEY;
  for (const cat of CFG) {
    for (const cmd of cat.commands) {
      if (cmd.pri) priCmds.push(cmd.id);
      else {
        const key = catToSec[cat.name] || "sec_Outros";
        if (secMap[key]) secMap[key].push(cmd.id);
      }
    }
  }
  const cfgLayout: Record<string, SchemaTabLayout> = { Principal: { commands: priCmds } };
  for (const [k, v] of Object.entries(secMap)) cfgLayout[k] = { commands: v };

  const schema: Schema = { id: generateSchemaId(), name, createdAt: now, updatedAt: now, cfgLayout, values: {} };
  schemas.push(schema);
  saveSchemas(schemas);
  return schema;
}

/** Save current SYS+CFG input values into the active schema */
function saveSchemaValues(schemaId: string, vals: Record<string, string | boolean>): void {
  const schemas = getSchemas();
  const s = schemas.find((x) => x.id === schemaId);
  if (s) {
    s.values = vals;
    s.updatedAt = new Date().toISOString();
    saveSchemas(schemas);
  }
}
function deleteSchema(id: string): void {
  const schemas = getSchemas().filter((s) => s.id !== id);
  saveSchemas(schemas);
  if (getActiveSchemaId() === id) setActiveSchemaId(null);
}
function renameSchema(id: string, newName: string): void {
  const schemas = getSchemas();
  const s = schemas.find((x) => x.id === id);
  if (s) { s.name = newName; s.updatedAt = new Date().toISOString(); saveSchemas(schemas); }
}
function updateSchemaTabLayout(schemaId: string, tabView: string, commandIds: string[]): void {
  const schemas = getSchemas();
  const s = schemas.find((x) => x.id === schemaId);
  if (s) {
    s.cfgLayout[tabView] = { commands: commandIds };
    s.updatedAt = new Date().toISOString();
    saveSchemas(schemas);
  }
}
function _schemaToJson(schema: Schema): string {
  return JSON.stringify(schema, null, 2);
}
function schemaFromJson(json: string): Schema | null {
  try {
    const obj = JSON.parse(json);
    if (obj?.id && obj.name && obj.cfgLayout) return obj as Schema;
    return null;
  } catch { return null; }
}

/** Import or update a schema from a .pla JSON string. Returns the schema. */
function _importSchemaFromPla(plaJson: string): Schema | null {
  const imported = schemaFromJson(plaJson);
  if (!imported) return null;
  const schemas = getSchemas();
  const existing = schemas.find((s) => s.id === imported.id);
  if (existing) {
    existing.name = imported.name;
    existing.cfgLayout = imported.cfgLayout;
    if (imported.values) existing.values = imported.values;
    existing.updatedAt = new Date().toISOString();
    saveSchemas(schemas);
    return existing;
  }
  imported.updatedAt = new Date().toISOString();
  schemas.push(imported);
  saveSchemas(schemas);
  return imported;
}

/** Map CFG category name → schema sec_ key */
const CAT_TO_SEC_KEY: Record<string, string> = {
  Performance: "sec_Performance", Viewmodel: "sec_Performance",
  Crosshair: "sec_Crosshair",
  HUD: "sec_HUD & Radar", Radar: "sec_HUD & Radar",
  Audio: "sec_Audio",
  "Mouse & Input": "sec_Input & Rede", Network: "sec_Input & Rede",
  "Voice & Comms": "sec_Outros", "Buy & Economy": "sec_Outros",
  "Spectator & Demo": "sec_Outros", "Misc & QoL": "sec_Outros",
};

/** Find the category name for a given command ID */
function findCmdCatName(cmdId: string): string {
  for (const cat of CFG) {
    if (cat.commands.some((c) => c.id === cmdId)) return cat.name;
  }
  return "Misc & QoL";
}

/** Create the "Default" schema with ALL commands included */
function createDefaultSchema(): Schema {
  const schemas = getSchemas();
  const now = new Date().toISOString();
  const priCmds: string[] = [];
  const secMap: Record<string, string[]> = {
    sec_Performance: [], sec_Crosshair: [], "sec_HUD & Radar": [],
    sec_Audio: [], "sec_Input & Rede": [], sec_Outros: [],
  };
  const catToSec = CAT_TO_SEC_KEY;
  for (const cat of CFG) {
    for (const cmd of cat.commands) {
      if (cmd.pri) priCmds.push(cmd.id);
      else {
        const key = catToSec[cat.name] || "sec_Outros";
        if (secMap[key]) secMap[key].push(cmd.id);
      }
    }
  }
  const cfgLayout: Record<string, SchemaTabLayout> = { Principal: { commands: priCmds } };
  for (const [k, v] of Object.entries(secMap)) cfgLayout[k] = { commands: v };
  const schema: Schema = { id: generateSchemaId(), name: "Default", createdAt: now, updatedAt: now, cfgLayout, values: {} };
  schemas.push(schema);
  saveSchemas(schemas);
  return schema;
}

/** Get active schema, creating a default one if none exists */
function ensureActiveSchema(): Schema {
  let schema = getActiveSchema();
  if (!schema) {
    // No active schema — check if any schemas exist
    const schemas = getSchemas();
    if (schemas.length > 0) {
      // Activate the first available schema
      schema = schemas[0];
      setActiveSchemaId(schema.id);
    } else {
      // First run — create "Default" schema with all commands
      schema = createDefaultSchema();
      setActiveSchemaId(schema.id);
    }
  }
  return schema;
}

/** Build a Set of command IDs that are in "Principal" based on active schema or defaults */
function getPrincipalSet(): Set<string> {
  const schema = getActiveSchema();
  if (schema?.cfgLayout?.Principal) {
    return new Set(schema.cfgLayout.Principal.commands);
  }
  // Default: use pri flags from CFG data
  const s = new Set<string>();
  for (const cat of CFG) {
    for (const cmd of cat.commands) {
      if (cmd.pri) s.add(cmd.id);
    }
  }
  return s;
}

/** Toggle a command between Primary and Secondary in the active schema */
function toggleCmdPrincipal(cmdId: string, makePrincipal: boolean): void {
  const schema = ensureActiveSchema();
  if (!schema.cfgLayout.Principal) schema.cfgLayout.Principal = { commands: [] };
  if (makePrincipal) {
    // Add to Principal
    if (!schema.cfgLayout.Principal.commands.includes(cmdId)) {
      schema.cfgLayout.Principal.commands.push(cmdId);
    }
    // Remove from all sec_ layouts
    for (const key of Object.keys(schema.cfgLayout)) {
      if (key.startsWith("sec_")) {
        schema.cfgLayout[key].commands = schema.cfgLayout[key].commands.filter((id) => id !== cmdId);
      }
    }
  } else {
    // Remove from Principal
    schema.cfgLayout.Principal.commands = schema.cfgLayout.Principal.commands.filter((id) => id !== cmdId);
    // Add to appropriate sec_ layout
    const catName = findCmdCatName(cmdId);
    const secKey = CAT_TO_SEC_KEY[catName] || "sec_Outros";
    if (!schema.cfgLayout[secKey]) schema.cfgLayout[secKey] = { commands: [] };
    if (!schema.cfgLayout[secKey].commands.includes(cmdId)) {
      schema.cfgLayout[secKey].commands.push(cmdId);
    }
  }
  // Persist
  const schemas = getSchemas();
  const idx = schemas.findIndex((s) => s.id === schema.id);
  if (idx >= 0) { schemas[idx] = schema; saveSchemas(schemas); }
}

/** Save the order of rows within a SYS card to localStorage */
const SYS_ORDER_KEY = "aimcamp_sys_order_";
function saveSysCardOrder(section: string, ids: string[]): void {
  localStorage.setItem(SYS_ORDER_KEY + section, JSON.stringify(ids));
}
function restoreSysCardOrder(cardEl: HTMLElement): void {
  const section = cardEl.dataset.section;
  if (!section) return;
  const saved = localStorage.getItem(SYS_ORDER_KEY + section);
  if (!saved) return;
  try {
    const order: string[] = JSON.parse(saved);
    const rows = Array.from(cardEl.querySelectorAll<HTMLElement>(":scope > .toggle-row"));
    const rowMap = new Map<string, HTMLElement>();
    rows.forEach((r) => {
      const cb = r.querySelector<HTMLInputElement>("input[type=checkbox]");
      if (cb) rowMap.set(cb.id, r);
    });
    const applyBtn = cardEl.querySelector(".card-apply-btn");
    for (const id of order) {
      const row = rowMap.get(id);
      if (row) {
        if (applyBtn) applyBtn.before(row);
        else cardEl.appendChild(row);
      }
    }
  } catch { /* ignore */ }
}

/* Layout edit state */
let _layoutEditMode = false;
let _layoutEditTabView = "";
let _layoutEditOriginal: string[] = [];
let _layoutEditContainer: HTMLElement | null = null;

/** Get the current tab view name based on active CFG sub-tab state */
function getCurrentCfgTabView(): string {
  // Check CFG inner sub-tabs (Primary / Secondary)
  const cfgPanel = document.getElementById("tab-cfg");
  if (!cfgPanel) return "Principal";
  const mainBtns = cfgPanel.querySelectorAll<HTMLButtonElement>(":scope > .sub-tab-bar > .sub-tab-btn");
  const mainPanels = cfgPanel.querySelectorAll<HTMLElement>(":scope > .sub-tab-panel");
  let mainActive = 0;
  mainBtns.forEach((b, i) => { if (b.classList.contains("active")) mainActive = i; });
  if (mainActive === 0) return "Principal";
  // Secondary — find which inner sub-tab is active
  const secPanel = mainPanels[1];
  if (!secPanel) return "sec_Performance";
  const innerBtns = secPanel.querySelectorAll<HTMLButtonElement>(".inner-sub-tab-bar .sub-tab-btn");
  const innerLabels = ["sec_Performance", "sec_Crosshair", "sec_HUD & Radar", "sec_Audio", "sec_Input & Rede", "sec_Outros"];
  let innerActive = 0;
  innerBtns.forEach((b, i) => { if (b.classList.contains("active")) innerActive = i; });
  return innerLabels[innerActive] || "sec_Performance";
}

/* ================================================================
   Color Themes
   ================================================================ */
interface Theme {
  name: string;
  primary: string;
  secondary: string;
}

const THEMES: Theme[] = [
  { name: "Matrix", primary: "#00ff41", secondary: "#008f11" },
  { name: "Cyberpunk", primary: "#ff00ff", secondary: "#00ffff" },
  { name: "Sunset", primary: "#ff6b35", secondary: "#f7c948" },
  { name: "Arctic", primary: "#00d4ff", secondary: "#a78bfa" },
  { name: "Crimson", primary: "#ff2d55", secondary: "#ff9500" },
  { name: "Emerald", primary: "#10b981", secondary: "#06b6d4" },
  { name: "Phantom", primary: "#a855f7", secondary: "#ec4899" },
  { name: "Amber", primary: "#f59e0b", secondary: "#ef4444" },
  { name: "Frost", primary: "#60a5fa", secondary: "#34d399" },
  { name: "Volcano", primary: "#dc2626", secondary: "#fb923c" },
  { name: "Neon Lime", primary: "#84cc16", secondary: "#22d3ee" },
  { name: "Raz", primary: "#00ff6a", secondary: "#44ff99" },
  { name: "Space", primary: "#7eb8ff", secondary: "#b4a0ff" },
];

let currentThemeIdx = 11;

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
  w_power: 3, // Ultimate Performance plan — 2-5%
  w_dvr: 2.5, // Game DVR off — 2-4% (encoder overhead)
  w_bar: 1, // Game Bar off — 0.5-1.5% overlay overhead
  w_mode: 1, // Game Mode off — 0-2% inconsistent
  w_hib: 0.5, // Hibernation off — stability, <1% FPS
  w_mouse: 0, // Mouse accel — aim quality, no FPS
  w_fso: 2, // Fullscreen Optim off — 1-3% + input lag
  w_vis: 0.5, // Visual Effects off — <1% in-game
  w_trans: 0.5, // Transparency off — <1%
  w_bgapps: 2, // Background apps off — 1-3%
  w_notif: 0.5, // Notifications off — <0.5%
  w_cort: 0.5, // Cortana off — <1%
  w_idx: 1.5, // Search indexing off — 1-2% (disk I/O)
  w_hgs: 2, // HAGS — 1-3% on RTX 30/40
  w_hpet: 3, // HPET off — 2-5% DPC latency
  w_pthrot: 1, // Power throttling off — 0.5-1.5%
  w_park: 1.5, // Core parking off — 1-2%
  w_temp: 0, // Cleanup — no FPS
  w_cs2gpu: 1, // GPU preference — 0-2% (laptops)
  w_deliver: 1, // Delivery Optimization off — reduces background bandwidth
  w_widgets: 0.5, // Widgets off — saves RAM + CPU (Win11)
  w_memcomp: 1, // Memory Compression off — reduces CPU for mem management
  w_uxuser: 0.5, // Connected UX off — telemetry + background activity
  w_spectre: 8, // CPU mitigations off — 5-30% (CPU-dependent, security risk)
  w_lastaccess: 0.5, // NTFS Last Access off — reduces disk writes
  w_8dot3: 0.5, // 8.3 name creation off — reduces NTFS overhead
  w_mmcss: 1.5, // MMCSS gaming priority — scheduler boost for games
  w_largecache: 1, // Large System Cache off — frees RAM for games

  /* Network — latency, not FPS */
  n_nagle: 0,
  n_tcp: 0,
  n_dns: 0,
  n_wifi: 0,
  n_throttle: 1, // Network Throttling off — 10 default packets/ms → unlimited
  n_ecn: 0, // ECN off — latency, not FPS
  n_rss: 0, // RSS on — latency, not FPS
  n_netbios: 0, // NetBIOS off — legacy protocol, latency only
  n_lmhosts: 0, // LMHOSTS off — legacy DNS, latency only
  n_ctcp: 0, // CTCP — congestion control, latency only

  /* NVIDIA */
  nv_perf: 3, // Max perf — 2-5% prevents downclocking
  nv_vsync: 2, // VSync off — removes frame cap, less queue
  nv_lat: 1.5, // Ultra low latency — <1% FPS, big input lag win
  nv_thread: 1.5, // Threaded optimization — 1-2%
  nv_aniso: 0.5, // App-controlled AF — <1%
  nv_shader: 0, // Cache clear — no lasting FPS gain
  nv_reflex: 1.5, // Reflex On+Boost — input latency + slight FPS variance
  nv_sharp: 0.5, // Image Sharpening off — frees GPU post-process
  nv_texfilt: 0.5, // Texture filtering perf — less GPU filtering work
  nv_prerender: 1, // Pre-rendered frames 1 — lower input lag
  nv_ambient: 1, // Ambient Occlusion off — saves GPU cycles
  nv_fxaa: 0.5, // FXAA off — removes forced antialiasing

  /* Services */
  s_sys: 1.5, // SysMain off — 1-2% (RAM/disk)
  s_diag: 0.5, // DiagTrack off — <1%
  s_ws: 1, // WSearch off — 0.5-1.5%
  s_print: 0, // Print Spooler — 0%
  s_fax: 0, // Fax — 0%
  s_xbox: 0.5, // Xbox services — <1%
  s_cdp: 0.5, // Connected Devices Platform — <1%
  s_wpn: 0.5, // WpnUserService — push notifications <1%
  s_diagpol: 0.5, // Diagnostic Policy — <1%
  s_remote: 0, // Remote Registry — security, 0 FPS
  s_maps: 0.5, // MapsBroker — background data <1%
  s_phonesvc: 0, // Phone Service — 0 FPS
  s_retaildemo: 0, // RetailDemo — 0 FPS

  /* Autoexec — marginal in-game */
  ae_on: 0,
  ae_raw: 0,

  /* Launch options */
  lo_exec: 0,
  lo_nvid: 0,
  lo_joy: 0.5,
  lo_high: 2, // -high priority — 1-3%
  lo_allow: 0,

  /* Extras */
  x_faceit: 0,
  x_steam: 1.5, // Steam overlay off — 1-2%
  x_disc: 1, // Discord overlay off — 0.5-1.5%
  x_resp: 2, // SystemResponsiveness=0 — 1-3%
  x_gpup: 1, // GPU priority — 0.5-1.5%
  x_prio: 1.5, // PrioritySeparation — 1-2%
  x_cs2p: 1.5, // CS2 high priority — 1-2%
  x_telem: 0.5, // Telemetry tasks — <1%
  x_timer: 1, // Timer resolution — 0.5-1.5% input lag improvement
  x_msimode: 1.5, // MSI mode GPU — reduces DPC latency 50-200us
  x_pcie: 1, // PCIe Link State off — prevents GPU bus downclocking
  x_ndis: 0.5, // Interrupt Moderation off — lower network latency
  x_large: 1, // Large Pages — reduces TLB misses
};

/* ================================================================
   Hardware-Aware Recommendation Engine
   ================================================================ */

interface HwProfile {
  cpuName: string;
  cpuCores: number;
  cpuThreads: number;
  cpuClockMhz: number;
  gpuName: string;
  gpuVramMb: number;
  gpuDriver: string;
  ramTotalGb: number;
  ramSpeedMhz: number;
  refreshRate: number;
  osName: string;
  osBuild: string;
  isNvidia: boolean;
  isAmd: boolean;
  isIntel: boolean;
  hasHags: boolean;
  hasRebar: boolean;
  isWin11: boolean;
  isLowEnd: boolean;
  isMidRange: boolean;
  isHighEnd: boolean;
}

/** Safely convert an unknown value to string (avoids [object Object] coercion) */
function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return typeof v === "string" ? v : `${v}`;
}

let _hwCache: HwProfile | null = null;

async function getHwProfile(): Promise<HwProfile> {
  if (_hwCache) return _hwCache;
  try {
    const hw = await invoke<Record<string, unknown>>("get_hardware_info");
    const gpuName = str(hw.gpu_name, "").toUpperCase();
    const cpuName = str(hw.cpu_name, "").toUpperCase();
    const vram = Number(hw.gpu_vram_mb) || 0;
    const cores = Number(hw.cpu_cores) || 4;
    const ramGb = Number(hw.ram_total_gb) || 8;
    // Tier detection: low < 4GB VRAM or < 4 cores, high > 8GB VRAM and > 6 cores
    const isLowEnd = vram < 4096 || cores < 4 || ramGb < 8;
    const isHighEnd = vram >= 8192 && cores >= 6 && ramGb >= 16;
    _hwCache = {
      cpuName: str(hw.cpu_name, "Unknown"),
      cpuCores: cores,
      cpuThreads: Number(hw.cpu_threads) || cores * 2,
      cpuClockMhz: Number(hw.cpu_clock_mhz) || 0,
      gpuName: str(hw.gpu_name, "Unknown"),
      gpuVramMb: vram,
      gpuDriver: str(hw.gpu_driver, ""),
      ramTotalGb: ramGb,
      ramSpeedMhz: Number(hw.ram_speed_mhz) || 0,
      refreshRate: Number(hw.refresh_rate) || 60,
      osName: str(hw.os_name, ""),
      osBuild: str(hw.os_build, ""),
      isNvidia: gpuName.includes("NVIDIA") || gpuName.includes("GEFORCE") || gpuName.includes("RTX") || gpuName.includes("GTX"),
      isAmd: gpuName.includes("AMD") || gpuName.includes("RADEON"),
      isIntel: gpuName.includes("INTEL") || cpuName.includes("INTEL"),
      hasHags: str(hw.hags, "").toUpperCase().includes("ON") || str(hw.hags, "").toUpperCase().includes("ENABLED"),
      hasRebar: (() => {
        const rb = str(hw.rebar, "");
        if (rb === "N/A") return false;
        const mbVal = Number(rb.replace(" MB", ""));
        return mbVal > 256;
      })(),
      isWin11: str(hw.os_name, "").includes("11"),
      isLowEnd,
      isMidRange: !isLowEnd && !isHighEnd,
      isHighEnd,
    };
    return _hwCache;
  } catch {
    // Fallback profile for when HW detection fails
    return {
      cpuName: "Unknown", cpuCores: 4, cpuThreads: 8, cpuClockMhz: 3000,
      gpuName: "Unknown", gpuVramMb: 4096, gpuDriver: "", ramTotalGb: 16,
      ramSpeedMhz: 2400, refreshRate: 60, osName: "Windows", osBuild: "",
      isNvidia: false, isAmd: false, isIntel: false, hasHags: false,
      hasRebar: false, isWin11: false, isLowEnd: false, isMidRange: true, isHighEnd: false,
    };
  }
}

/**
 * Returns recommended SYS toggle values per card section.
 * Keys are toggle IDs, values are recommended boolean state.
 */
function getSysRecommendations(hw: HwProfile): Record<string, boolean> {
  const rec: Record<string, boolean> = {
    /* ── Windows ── */
    w_power: true,     // Ultimate Performance — always recommended
    w_dvr: true,       // Game DVR off — saves encoder overhead
    w_bar: true,       // Game Bar off — overlay overhead
    w_mode: true,      // Game Mode off — inconsistent behavior
    w_hib: true,       // Hibernation off — stability
    w_mouse: true,     // Mouse accel off — essential for FPS
    w_fso: true,       // Fullscreen Optim off — input lag
    w_vis: true,       // Visual Effects off — minor gain
    w_trans: true,     // Transparency off — minor gain
    w_bgapps: true,    // Background apps off — frees RAM+CPU
    w_notif: true,     // Notifications off — no interruptions
    w_cort: true,      // Cortana off — useless for gaming
    w_idx: false,      // Search indexing — keep for daily use, minor impact
    w_hgs: hw.isNvidia && hw.gpuVramMb >= 6144, // HAGS only for modern NVIDIA w/ 6GB+
    w_hpet: true,      // HPET off — big DPC latency win
    w_pthrot: true,    // Power throttling off — maintain clocks
    w_park: true,      // Core parking off — keep all cores active
    w_temp: false,     // Clean temp — not for auto-apply, too invasive
    w_cs2gpu: true,    // CS2 high perf GPU — always
    w_deliver: true,   // Delivery Optimization off — stops background bandwidth
    w_widgets: hw.isWin11, // Widgets only matter on Win11
    w_memcomp: hw.ramTotalGb >= 16, // Only disable mem compression if 16GB+ RAM
    w_uxuser: true,    // Connected UX off — telemetry
    w_spectre: false,  // CPU mitigations — DO NOT auto-enable, security risk
    w_lastaccess: true, // NTFS last access — safe optimization
    w_8dot3: true,     // 8.3 name creation off — safe
    w_mmcss: true,     // MMCSS gaming priority — scheduler boost
    w_largecache: true, // Large system cache off — frees RAM

    /* ── Network ── */
    n_nagle: true,     // Nagle off — essential for low latency
    n_tcp: true,       // TCP optimization — always
    n_dns: true,       // Flush DNS — fresh DNS cache
    n_wifi: false,     // Wi-Fi power save — only enable if on Wi-Fi
    n_throttle: true,  // Network throttle off — always
    n_ecn: true,       // ECN off — reduces overhead
    n_rss: true,       // RSS on — better multi-core network handling
    n_netbios: true,   // NetBIOS off — legacy, not needed
    n_lmhosts: true,   // LMHOSTS off — legacy
    n_ctcp: true,      // CTCP on — better congestion control

    /* ── NVIDIA ── (only apply if NVIDIA GPU) */
    nv_perf: hw.isNvidia,    // Max perf mode
    nv_vsync: hw.isNvidia,   // VSync off
    nv_lat: hw.isNvidia,     // Ultra low latency
    nv_thread: hw.isNvidia,  // Threaded optimization
    nv_aniso: false,         // App-controlled AF — leave to game
    nv_shader: false,        // Shader cache clear — not auto
    nv_reflex: hw.isNvidia,  // Reflex On+Boost
    nv_sharp: false,         // Image sharpening off — preference
    nv_texfilt: hw.isNvidia, // Texture filtering perf
    nv_prerender: hw.isNvidia, // Pre-rendered frames = 1
    nv_ambient: hw.isNvidia, // Ambient occlusion off
    nv_fxaa: hw.isNvidia,    // FXAA off

    /* ── Services ── */
    s_sys: true,       // SysMain off — RAM/disk freed
    s_diag: true,      // DiagTrack off — telemetry
    s_ws: false,       // Windows Search — keep for daily use
    s_print: false,    // Print Spooler — keep if user prints
    s_fax: true,       // Fax off — nobody uses fax
    s_xbox: true,      // Xbox services off — unless using Xbox
    s_cdp: true,       // Connected Devices off — Bluetooth/sharing
    s_wpn: true,       // Push notifications off — no distractions
    s_diagpol: false,  // Diagnostic Policy — keep for troubleshooting
    s_remote: true,    // Remote Registry off — security
    s_maps: true,      // MapsBroker off — nobody needs Win maps
    s_phonesvc: true,  // Phone service off — not needed
    s_retaildemo: true, // RetailDemo off — certainly not needed

    /* ── Extras ── */
    x_steam: true,     // Steam overlay off — FPS gain
    x_disc: true,      // Discord overlay off — FPS gain
    x_resp: true,      // SystemResponsiveness=0 — more CPU for games
    x_gpup: true,      // GPU priority for games
    x_prio: true,      // PrioritySeparation tuned
    x_cs2p: true,      // CS2 high process priority
    x_telem: true,     // Telemetry tasks off
    x_timer: false,    // Timer resolution — advanced, may flag AC
    x_msimode: false,  // MSI mode — advanced, needs manual verification
    x_pcie: true,      // PCIe link state off — prevent downclocking
    x_ndis: false,     // Interrupt moderation off — advanced
    x_large: false,    // Large pages — advanced, needs admin rights
  };
  return rec;
}

/**
 * Returns recommended autoexec / launch options values.
 */
function getAutoexecRecommendations(hw: HwProfile): Record<string, { checked?: boolean; value?: string }> {
  const fps = hw.refreshRate >= 240 ? "0" : String(Math.min(999, hw.refreshRate * 2));
  return {
    ae_on:  { checked: true },
    ae_fps: { value: fps },
    ae_rate: { value: "786432" },
    ae_int: { value: "0" },
    ae_ir:  { value: "1" },
    ae_ur:  { value: "128" },
    ae_cr:  { value: "128" },
    ae_raw: { checked: true },
    // Launch options
    lo_exec: { checked: true },
    lo_nvid: { checked: true },
    lo_joy:  { checked: true },
    lo_high: { checked: true },
    lo_allow: { checked: false },
    lo_thr:  { value: String(hw.cpuCores) },
  };
}

/**
 * Returns competitive CS2 recommended CFG values.
 * Based on pro player averages and community best practices.
 */
function getCfgRecommendations(hw: HwProfile): Record<string, { on: boolean; val?: string }> {
  const fps = hw.refreshRate >= 240 ? "0" : String(Math.min(999, hw.refreshRate * 2));
  return {
    /* Performance */
    cf_fpsmax: { on: true, val: fps },
    cf_fpsmaxui: { on: true, val: "120" },
    cf_particles: { on: false },
    cf_tracers: { on: false },
    cf_preload: { on: true, val: "1" },
    cf_lowlat: { on: true, val: "1" },
    cf_shadows: { on: true, val: hw.isHighEnd ? "1" : "0" },
    cf_ragdolls: { on: true, val: "0" },
    cf_nofocus: { on: true, val: "50" },
    cf_postproc: { on: true, val: "0" },
    cf_dynimg: { on: true, val: "0" },
    cf_animavatar: { on: true, val: "0" },
    cf_newbob: { on: true, val: "1" },

    /* Crosshair — competitive defaults (style 4, green, small, tight) */
    cf_xhstyle: { on: true, val: "4" },
    cf_xhsize: { on: true, val: "2" },
    cf_xhgap: { on: true, val: "-2" },
    cf_xhthick: { on: true, val: "0.5" },
    cf_xhcolor: { on: true, val: "1" },
    cf_xhdot: { on: false },
    cf_xhoutline: { on: true, val: "1" },
    cf_xhoutthick: { on: true, val: "1" },
    cf_xhalpha: { on: true, val: "255" },
    cf_xht: { on: false },
    cf_xhrecoil: { on: false },
    cf_xhfriend: { on: true, val: "1" },

    /* Viewmodel — competitive preset */
    cf_vmfov: { on: true, val: "68" },
    cf_rhand: { on: true, val: "1" },

    /* HUD — clean competitive setup */
    cf_hudscale: { on: true, val: "0.85" },
    cf_showfps: { on: true, val: "1" },
    cf_teamid: { on: true, val: "1" },
    cf_teamidcolor: { on: true, val: "1" },
    cf_showequip: { on: true },
    cf_tmcolors: { on: true, val: "1" },
    cf_loadout: { on: true, val: "1" },
    cf_fastswitch: { on: true, val: "1" },
    cf_targetid: { on: true, val: "1" },

    /* Radar — competitive defaults */
    cf_radarscale: { on: true, val: "0.4" },
    cf_radarctr: { on: true, val: "0" },
    cf_radarrotate: { on: true, val: "1" },
    cf_radarsquare: { on: true, val: "1" },

    /* Audio — competitive: HRTF, no music, focus on game sounds */
    cf_vol: { on: true, val: "0.5" },
    cf_musicvol: { on: true, val: "0" },
    cf_hppan: { on: true, val: "2" },
    cf_hpfront: { on: true, val: "45" },
    cf_hprear: { on: true, val: "135" },
    cf_10sec: { on: true, val: "1" },
    cf_mvpvol: { on: true, val: "0" },
    cf_rstarvol: { on: true, val: "0" },
    cf_rendvol: { on: true, val: "0" },
    cf_menumus: { on: true, val: "0" },
    cf_mainstep: { on: true, val: "0.025" },
    cf_voice: { on: true, val: "1" },

    /* Mouse & Input */
    cf_raw: { on: true, val: "1" },
    cf_sens: { on: true, val: "1.8" },

    /* Network — max rate competitive */
    cf_rate: { on: true, val: "786432" },
    cf_interp: { on: true, val: "0" },
    cf_interpr: { on: true, val: "1" },
    cf_updrate: { on: true, val: "128" },
    cf_cmdrate: { on: true, val: "128" },
    cf_steamdg: { on: true, val: "1" },
    cf_predict: { on: true, val: "1" },
    cf_lagcomp: { on: true, val: "1" },

    /* Buy & Economy */
    cf_autowep: { on: true, val: "0" },

    /* Misc & QoL */
    cf_console: { on: true, val: "1" },
    cf_autohelp: { on: true, val: "0" },
    cf_instructor: { on: true, val: "0" },
    cf_maxping: { on: true, val: "80" },
  };
}

/**
 * Apply recommended SYS toggle values for a specific card section.
 */
async function applySysRecommendations(section: string) {
  const hw = await getHwProfile();
  const rec = getSysRecommendations(hw);
  let count = 0;

  // Map section name to toggle ID prefixes
  const prefixMap: Record<string, string[]> = {
    windows: ["w_"],
    network: ["n_"],
    nvidia: ["nv_"],
    services: ["s_"],
    extras: ["x_"],
  };

  const prefixes = prefixMap[section];
  if (!prefixes) return;

  for (const [id, val] of Object.entries(rec)) {
    if (!prefixes.some((p) => id.startsWith(p))) continue;
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el?.type === "checkbox") {
      el.checked = val;
      count++;;
    }
  }
  updateImpact();
  toast(`⚡ ${count} recommended settings applied to "${section}"`);
}

/**
 * Apply recommended autoexec/launch option values.
 */
async function applyAutoexecRecommendations() {
  const hw = await getHwProfile();
  const rec = getAutoexecRecommendations(hw);
  let count = 0;
  for (const [id, r] of Object.entries(rec)) {
    if (r.checked !== undefined) {
      setChecked(id, r.checked);
      count++;
    }
    if (r.value !== undefined) {
      setVal(id, r.value);
      count++;
    }
  }
  updateImpact();
  toast(`⚡ ${count} recommended autoexec settings applied (fps_max based on ${hw.refreshRate}Hz)`);
}

/**
 * Apply recommended launch option values.
 */
async function applyLaunchRecommendations() {
  const hw = await getHwProfile();
  const rec = getAutoexecRecommendations(hw);
  let count = 0;
  const launchIds = ["lo_exec", "lo_nvid", "lo_joy", "lo_high", "lo_allow", "lo_thr"];
  for (const id of launchIds) {
    const r = rec[id];
    if (!r) continue;
    if (r.checked !== undefined) { setChecked(id, r.checked); count++; }
    if (r.value !== undefined) { setVal(id, r.value); count++; }
  }
  updateImpact();
  toast(`⚡ ${count} recommended launch options applied (threads=${hw.cpuCores})`);
}

/**
 * Apply all recommended CFG values.
 */
async function applyCfgRecommendations() {
  const hw = await getHwProfile();
  const rec = getCfgRecommendations(hw);
  let count = 0;
  for (const [id, r] of Object.entries(rec)) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el?.type === "checkbox") {
      el.checked = r.on;
      count++;
    }
    if (r.val !== undefined) {
      const valEl = document.getElementById(`${id}_v`) as HTMLInputElement | null;
      if (valEl) valEl.value = r.val;
    }
  }
  updateCfgCounter();
  drawCrosshair();
  toast(`⚡ ${count} competitive CS2 commands applied (fps_max based on ${hw.refreshRate}Hz)`);
}

/**
 * Apply ALL SYS recommendations across all cards at once.
 */
async function applyAllSysRecommendations() {
  const hw = await getHwProfile();
  const rec = getSysRecommendations(hw);
  let count = 0;
  for (const [id, val] of Object.entries(rec)) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el?.type === "checkbox") {
      el.checked = val;
      count++;
    }
  }
  // Also apply autoexec + launch recs
  const aRec = getAutoexecRecommendations(hw);
  for (const [id, r] of Object.entries(aRec)) {
    if (r.checked !== undefined) { setChecked(id, r.checked); count++; }
    if (r.value !== undefined) { setVal(id, r.value); count++; }
  }
  updateImpact();
  let tier = "MID-RANGE";
  if (hw.isHighEnd) tier = "HIGH-END";
  else if (hw.isLowEnd) tier = "LOW-END";
  toast(`⚡ ${count} settings optimized for ${tier}: ${hw.gpuName} / ${hw.cpuCores}C / ${hw.ramTotalGb}GB`);
}

/**
 * Helper to create a "Recommend" button for SYS cards.
 */
function cardRecommendBtn(section: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "card-apply-btn card-recommend-btn";
  btn.innerHTML = "⚡ Recommended Config";
  btn.title = `Apply recommended settings for "${section}" based on your hardware`;
  btn.addEventListener("click", () => applySysRecommendations(section));
  return btn;
}

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
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
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
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
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

  s.setProperty("--neon-green", pc);
  s.setProperty("--accent", pc);
  s.setProperty("--neon-cyan", sc);
  s.setProperty("--border-glow", hexToRgba(pc, 0.12));
  s.setProperty("--glow-sm", `0 0 6px ${hexToRgba(pc, 0.3)}`);
  s.setProperty("--glow-md", `0 0 14px ${hexToRgba(pc, 0.25)}, 0 0 40px ${hexToRgba(pc, 0.08)}`);

  /* Theme-harmonious button colors */
  s.setProperty("--btn-schema-bg", hexToRgba(sc, 0.12));
  s.setProperty("--btn-schema-border", hexToRgba(sc, 0.2));
  s.setProperty("--btn-schema-bg-hover", hexToRgba(sc, 0.22));
  s.setProperty("--edit-mode-border", hexToRgba(pc, 0.35));
  s.setProperty("--edit-mode-row-hover", hexToRgba(pc, 0.06));
  s.setProperty("--recommend-bg", `linear-gradient(135deg, ${sc}, ${darken(sc, 20)})`);
  s.setProperty("--recommend-shadow", `0 2px 8px ${hexToRgba(sc, 0.25)}`);
  s.setProperty("--recommend-shadow-hover", `0 3px 12px ${hexToRgba(sc, 0.4)}`);

  /* Apply special theme body class */
  document.body.classList.remove("theme-raz", "theme-space");
  if (t.name === "Raz") document.body.classList.add("theme-raz");
  if (t.name === "Space") document.body.classList.add("theme-space");

  const el =
    document.getElementById("dynamic-theme-css") ||
    (() => {
      const e = document.createElement("style");
      e.id = "dynamic-theme-css";
      document.head.appendChild(e);
      return e;
    })();

  const pcHex = pc.slice(1);
  const runWarm = blend(pc, "#fb923c", 0.25);
  const runEnd = blend(pc, "#ef4444", 0.15);

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
    .schema-item.schema-active { border-color: ${hexToRgba(pc, 0.35)} !important; background: ${hexToRgba(pc, 0.04)} !important; }
    .schema-item-tabs { color: ${hexToRgba(pc, 0.7)} !important; }
    .btn-schema-save { color: ${pc} !important; border-color: ${hexToRgba(pc, 0.2)} !important; background: ${hexToRgba(pc, 0.12)} !important; }
    .cfg-grid-edit-mode .card-balloon { border-color: ${hexToRgba(pc, 0.35)} !important; }
    .hw-row { border-bottom-color: ${hexToRgba(pc, 0.06)} !important; }
    .hw-status.on { background: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.3)} !important; }
    .hw-status.off { background: rgba(239,68,68,0.15) !important; color: #ef4444 !important; }
    .hw-value { color: ${sc} !important; }
    .drv-category-header { color: ${pc} !important; border-bottom-color: ${hexToRgba(pc, 0.12)} !important; }
    .drv-category { border-left-color: ${pc} !important; }
    .drv-category.drv-cat-issue { border-left-color: #ffb43c !important; }
    .drv-device-card.drv-dev-ok { border-left-color: ${pc} !important; }
    .drv-badge.manufacturer { background: ${hexToRgba(pc, 0.1)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.25)} !important; }
    .drv-badge.current { background: ${hexToRgba(pc, 0.08)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.2)} !important; }
    .drv-summary-val { color: ${pc} !important; }
    .drv-signed.yes { color: ${pc} !important; }
    .drv-tips-header { color: ${pc} !important; border-bottom-color: ${hexToRgba(pc, 0.1)} !important; }
    .drv-tips { background: ${hexToRgba(pc, 0.02)} !important; }
    .drv-cat-ok { color: ${pc} !important; }
    .proc-item.flagged { border-color: ${hexToRgba("#eab308", 0.3)} !important; background: ${hexToRgba("#eab308", 0.06)} !important; }
    .proc-kill { background: linear-gradient(135deg, #ef4444, #b91c1c) !important; }
    .proc-header { border-bottom-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .ping-good { color: ${pc} !important; }
    .ping-ok { color: #eab308 !important; }
    .ping-bad { color: #ef4444 !important; }
    .ping-header { border-bottom-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .ping-row { border-bottom-color: ${hexToRgba(pc, 0.06)} !important; }
    .config-schema-bar select, .config-schema-bar input { border-color: ${hexToRgba(pc, 0.15)} !important; color: ${pc} !important; }
    .config-schema-bar select:focus, .config-schema-bar input:focus { border-color: ${pc} !important; box-shadow: 0 0 6px ${hexToRgba(pc, 0.25)} !important; }
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
    .adv-btn:hover { border-color: ${pc} !important; color: ${pc} !important; }
    .adv-modal h3 { color: ${pc} !important; }
    .adv-modal input:focus, .adv-modal select:focus { border-color: ${pc} !important; box-shadow: 0 0 6px ${hexToRgba(pc, 0.2)} !important; }
    .adv-modal-actions .adv-save { background: ${pc} !important; }
    .btn-adv { background: linear-gradient(135deg, ${hexToRgba(sc, 0.2)}, ${hexToRgba(sc, 0.1)}) !important; border-color: ${hexToRgba(sc, 0.25)} !important; color: ${sc} !important; }
    .btn-adv:hover { box-shadow: 0 0 12px ${hexToRgba(sc, 0.2)} !important; }
    .adv-response { border-color: ${hexToRgba(sc, 0.12)} !important; background: ${hexToRgba(sc, 0.04)} !important; }
    .adv-response strong { color: ${pc} !important; }
    .adv-response h3, .adv-response h4 { color: ${sc} !important; }
    .adv-loading { color: ${sc} !important; }
    .adv-loading::before { border-top-color: ${sc} !important; border-color: ${hexToRgba(sc, 0.2)} !important; border-top-color: ${sc} !important; }
    .adv-status.connected { background: ${pc} !important; box-shadow: 0 0 4px ${pc} !important; }
    .share-copy:hover { color: ${pc} !important; border-color: ${hexToRgba(pc, 0.3)} !important; background: ${hexToRgba(pc, 0.06)} !important; }
    .donate-popup { border-color: ${hexToRgba(pc, 0.2)} !important; box-shadow: 0 -6px 32px rgba(0,0,0,0.6), 0 0 20px ${hexToRgba(pc, 0.08)} !important; }
    .donate-popup::after { border-top-color: ${hexToRgba(pc, 0.2)} !important; }
    .donate-title { color: ${pc} !important; }
    .add-feature-btn { border-color: ${hexToRgba(pc, 0.25)} !important; background: ${hexToRgba(pc, 0.04)} !important; color: ${hexToRgba(pc, 0.6)} !important; }
    .add-feature-btn:hover { background: ${hexToRgba(pc, 0.1)} !important; border-color: ${hexToRgba(pc, 0.45)} !important; color: ${pc} !important; }
    .add-feature-menu { border-color: ${hexToRgba(pc, 0.2)} !important; }
    .add-feature-menu button:hover { background: ${hexToRgba(pc, 0.08)} !important; }
    .schema-bar-btn { border-color: ${hexToRgba(pc, 0.2)} !important; color: ${hexToRgba(pc, 0.7)} !important; }
    .schema-bar-btn:hover { background: ${hexToRgba(pc, 0.12)} !important; color: ${pc} !important; border-color: ${hexToRgba(pc, 0.35)} !important; }
    .schema-bar-btn-del:hover { background: rgba(239,68,68,0.15) !important; color: #ef4444 !important; border-color: rgba(239,68,68,0.3) !important; }
    .schema-bar-btn-new { border-color: ${hexToRgba(pc, 0.2)} !important; color: ${hexToRgba(pc, 0.6)} !important; }
    .schema-bar-btn-new:hover { background: ${hexToRgba(pc, 0.12)} !important; border-color: ${hexToRgba(pc, 0.4)} !important; color: ${pc} !important; }
    .config-schema-bar .btn-schema { border-color: ${hexToRgba(sc, 0.25)} !important; color: ${sc} !important; background: ${hexToRgba(sc, 0.08)} !important; }
    .config-schema-bar .btn-schema:hover { background: ${hexToRgba(sc, 0.18)} !important; }
    .card-recommend-btn {
      background: linear-gradient(135deg, ${sc}, ${darken(sc, 20)}) !important;
      color: #111 !important;
      box-shadow: 0 2px 8px ${hexToRgba(sc, 0.25)} !important;
    }
    .card-recommend-btn:hover { box-shadow: 0 3px 12px ${hexToRgba(sc, 0.4)} !important; }
    .btn-recommend-all {
      background: linear-gradient(135deg, ${sc}, ${darken(sc, 20)}) !important;
      color: #111 !important;
      box-shadow: 0 2px 8px ${hexToRgba(sc, 0.25)} !important;
    }
    .btn-recommend-all:hover { box-shadow: 0 3px 12px ${hexToRgba(sc, 0.4)} !important; }
    .card-apply-save { background: ${pc} !important; color: #111 !important; }
    .card-apply-copy { background: ${sc} !important; color: #111 !important; }
  `;

  /* Theme dropdown active state */
  document.querySelectorAll<HTMLElement>(".theme-option").forEach((o, i) => {
    o.classList.toggle("active", i === idx);
  });

  localStorage.setItem("csmooth_theme", String(idx));
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
    if (!el?.type || el.type !== "checkbox" || !el.checked) continue;
    /* Skip if LED shows this is already applied on the system */
    const led = document.getElementById(`led_${id}`);
    if (led?.classList.contains("active")) continue;
    total += pct;
  }
  const fpsGain = Math.round((BASELINE_FPS * total) / 100);
  const pctDisplay = document.getElementById("impact-pct-val");
  const fpsDisplay = document.getElementById("impact-fps-val");
  if (pctDisplay) pctDisplay.textContent = `+${total.toFixed(1)}%`;
  if (fpsDisplay) fpsDisplay.textContent = `+${fpsGain} FPS`;
}

/* ================================================================
   UI helpers
   ================================================================ */

/* ── Custom Tooltip System ──────────────────────────────────────── */
let _tipEl: HTMLDivElement | null = null;
let _tipTimer: ReturnType<typeof setTimeout> | null = null;

function ensureTipEl(): HTMLDivElement {
  if (!_tipEl) {
    _tipEl = document.createElement("div");
    _tipEl.className = "ac-tooltip";
    _tipEl.style.display = "none";
    document.body.appendChild(_tipEl);
  }
  return _tipEl;
}

function attachTooltip(el: HTMLElement, html: string) {
  el.addEventListener("mouseenter", (e) => {
    const tip = ensureTipEl();
    tip.innerHTML = html;
    tip.style.display = "block";
    positionTip(tip, e);
    if (_tipTimer) clearTimeout(_tipTimer);
    _tipTimer = setTimeout(() => { tip.classList.add("visible"); }, 10);
  });
  el.addEventListener("mousemove", (e) => { positionTip(ensureTipEl(), e); });
  el.addEventListener("mouseleave", () => {
    const tip = ensureTipEl();
    tip.classList.remove("visible");
    if (_tipTimer) clearTimeout(_tipTimer);
    _tipTimer = setTimeout(() => { tip.style.display = "none"; }, 120);
  });
}

function positionTip(tip: HTMLDivElement, e: MouseEvent) {
  const pad = 12;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = tip.getBoundingClientRect();
  if (x + r.width > window.innerWidth - pad) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - pad) y = e.clientY - r.height - pad;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

/* helper: build tooltip HTML with optional performance impact */
function tipHtml(title: string, desc: string, impact?: string, method?: string): string {
  let h = `<div class="tt-title">${title}</div><div class="tt-desc">${desc}</div>`;
  if (impact) h += `<div class="tt-impact">${impact}</div>`;
  if (method) h += `<div class="tt-method">${method}</div>`;
  return h;
}

/* parse TIP strings into rich HTML — extracts impact & method from the ✔/⚠/ℹ format */
function tipFromLegacy(raw: string): string {
  const isAuto = raw.startsWith("✔");
  const isManual = raw.startsWith("⚠");
  let badge: string;
  if (isAuto) badge = '<span class="tt-badge auto">AUTO</span>';
  else if (isManual) badge = '<span class="tt-badge manual">MANUAL</span>';
  else badge = '<span class="tt-badge info">INFO</span>';

  // extract method in parens e.g. (Registry), (PowerShell), (Service)
  const methodMatch = /\(([^)]+)\)/.exec(raw);
  const method = methodMatch ? methodMatch[1] : "";

  // extract impact e.g. +3.0% (+8 FPS) or 0 FPS
  const impactMatch = /([+\d.]+%\s*\([^)]+\)|0 FPS[^.]*)/.exec(raw);
  const impact = impactMatch ? impactMatch[1] : "";

  // remaining description: strip the prefix markers and extracted parts
  let desc = raw.replace(/^[✔⚠ℹ]\s*(AUTO|MANUAL BIOS|MANUAL PASTE|INFO ONLY)?\s*\([^)]*\)\s*:?\s*/i, "").trim();
  if (impact) desc = desc.replace(impact, "").replace(/\.\s*$/, "").trim();
  // remove trailing dot
  desc = desc.replace(/\.\s*$/, "");

  const viaSpan = method ? '<span class="tt-via">' + method + "</span>" : "";
  let h = '<div class="tt-header">' + badge + viaSpan + "</div>";
  h += `<div class="tt-desc">${desc}</div>`;
  if (impact && impact !== "0 FPS") h += `<div class="tt-impact">⚡ ${impact}</div>`;
  return h;
}

function toggle(id: string, label: string, isChecked: boolean, tooltip?: string, showLed = true): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "toggle-row";
  if (tooltip) attachTooltip(row, tipFromLegacy(tooltip));
  const lbl = document.createElement("label");
  lbl.htmlFor = id;
  lbl.textContent = label;
  if (showLed) {
    const led = document.createElement("span");
    led.className = "led unknown";
    led.id = `led_${id}`;
    led.title = "Checking system state…";
    row.appendChild(lbl);
    row.appendChild(led);
  } else {
    row.appendChild(lbl);
  }
  const inp = document.createElement("input");
  inp.type = "checkbox";
  inp.id = id;
  inp.checked = isChecked;
  inp.addEventListener("change", () => {
    updateImpact();
    const parentCard = inp.closest("[data-section]");
    if (parentCard) parentCard.classList.add("card-pending");
  });
  row.appendChild(inp);
  return row;
}

function infoRow(label: string, tooltip?: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "info-row";
  if (tooltip) attachTooltip(row, tipFromLegacy(tooltip));
  const badge = document.createElement("span");
  badge.className = "info-badge";
  badge.textContent = "!";
  const lbl = document.createElement("span");
  lbl.className = "info-label";
  lbl.textContent = label;
  row.appendChild(badge);
  row.appendChild(lbl);
  return row;
}

function numInput(id: string, label: string, value: string, tooltip?: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "input-row";
  if (tooltip) attachTooltip(row, tipFromLegacy(tooltip));
  const lbl = document.createElement("label");
  lbl.htmlFor = id;
  lbl.textContent = label;
  const inp = document.createElement("input");
  inp.type = "text";
  inp.id = id;
  inp.value = value;
  row.appendChild(lbl);
  row.appendChild(inp);
  return row;
}

function textArea(id: string, placeholder: string): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.id = id;
  ta.placeholder = placeholder;
  ta.rows = 2;
  return ta;
}

function card(title: string, tooltip?: string): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "card";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  if (tooltip) attachTooltip(h2, `<div class="tt-desc">${tooltip}</div>`);
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
  document.querySelectorAll(".status-toast").forEach((e) => { e.remove(); });
  const t = document.createElement("div");
  t.className = "status-toast" + (isError ? " toast-error" : "");
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
      disable_svm: true,
      disable_c_states: true,
      disable_cool_n_quiet: true,
      enable_xmp: true,
      enable_resize_bar: true,
      enable_above_4g: true,
    },
    windows: {
      ultimate_power_plan: ck("w_power"),
      disable_game_dvr: ck("w_dvr"),
      disable_game_bar: ck("w_bar"),
      disable_game_mode: ck("w_mode"),
      disable_hibernation: ck("w_hib"),
      disable_mouse_accel: ck("w_mouse"),
      disable_fullscreen_optim: ck("w_fso"),
      disable_visual_effects: ck("w_vis"),
      disable_transparency: ck("w_trans"),
      disable_background_apps: ck("w_bgapps"),
      disable_notifications: ck("w_notif"),
      disable_cortana: ck("w_cort"),
      disable_search_indexing: ck("w_idx"),
      hardware_gpu_scheduling: ck("w_hgs"),
      disable_hpet: ck("w_hpet"),
      disable_power_throttling: ck("w_pthrot"),
      disable_core_parking: ck("w_park"),
      clean_temp_files: ck("w_temp"),
      cs2_high_performance_gpu: ck("w_cs2gpu"),
      disable_delivery_optim: ck("w_deliver"),
      disable_widgets: ck("w_widgets"),
      disable_memory_compression: ck("w_memcomp"),
      disable_connected_ux: ck("w_uxuser"),
      disable_spectre: ck("w_spectre"),
      disable_last_access: ck("w_lastaccess"),
      disable_8dot3: ck("w_8dot3"),
      mmcss_gaming: ck("w_mmcss"),
      disable_large_cache: ck("w_largecache"),
    },
    network: {
      disable_nagle: ck("n_nagle"),
      optimize_tcp: ck("n_tcp"),
      flush_dns: ck("n_dns"),
      disable_wifi_power_save: ck("n_wifi"),
      disable_network_throttle: ck("n_throttle"),
      disable_ecn: ck("n_ecn"),
      enable_rss: ck("n_rss"),
      disable_netbios: ck("n_netbios"),
      disable_lmhosts: ck("n_lmhosts"),
      enable_ctcp: ck("n_ctcp"),
    },
    nvidia: {
      prefer_max_perf: ck("nv_perf"),
      disable_vsync: ck("nv_vsync"),
      low_latency_ultra: ck("nv_lat"),
      threaded_optimization: ck("nv_thread"),
      disable_anisotropic: ck("nv_aniso"),
      shader_cache_clear: ck("nv_shader"),
      force_reflex: ck("nv_reflex"),
      disable_sharpening: ck("nv_sharp"),
      texture_filter_perf: ck("nv_texfilt"),
      pre_rendered_frames_1: ck("nv_prerender"),
      disable_ambient_occlusion: ck("nv_ambient"),
      disable_fxaa: ck("nv_fxaa"),
    },
    services: {
      disable_sysmain: ck("s_sys"),
      disable_diagtrack: ck("s_diag"),
      disable_wsearch: ck("s_ws"),
      disable_print_spooler: ck("s_print"),
      disable_fax: ck("s_fax"),
      disable_xbox_services: ck("s_xbox"),
      disable_cdp: ck("s_cdp"),
      disable_wpn: ck("s_wpn"),
      disable_diagnostic_policy: ck("s_diagpol"),
      disable_remote_registry: ck("s_remote"),
      disable_maps_broker: ck("s_maps"),
      disable_phone_service: ck("s_phonesvc"),
      disable_retail_demo: ck("s_retaildemo"),
    },
    autoexec: {
      enabled: ck("ae_on"),
      fps_max: vl("ae_fps", "400"),
      rate: vl("ae_rate", "786432"),
      cl_interp: vl("ae_int", "0"),
      cl_interp_ratio: vl("ae_ir", "1"),
      cl_updaterate: vl("ae_ur", "128"),
      cl_cmdrate: vl("ae_cr", "128"),
      sensitivity: vl("ae_sens", "2"),
      viewmodel_fov: vl("ae_vmfov", "68"),
      m_rawinput: ck("ae_raw"),
      net_graph: ck("ae_netgraph"),
      custom_commands: (document.getElementById("ae_custom") as HTMLTextAreaElement)?.value || "",
    },
    launch_options: {
      exec_autoexec: ck("lo_exec"),
      novid: ck("lo_nvid"),
      tickrate_128: ck("lo_tick"),
      nojoy: ck("lo_joy"),
      high_priority: ck("lo_high"),
      allow_third_party: ck("lo_allow"),
      threads: vl("lo_thr", ""),
      custom_args: (document.getElementById("lo_custom") as HTMLTextAreaElement)?.value?.trim() || "",
    },
    extras: {
      faceit_admin: false,
      disable_steam_overlay: ck("x_steam"),
      disable_discord_overlay: ck("x_disc"),
      system_responsiveness: ck("x_resp"),
      gpu_priority: ck("x_gpup"),
      priority_separation: ck("x_prio"),
      cs2_process_priority: ck("x_cs2p"),
      disable_telemetry_tasks: ck("x_telem"),
      timer_resolution: ck("x_timer"),
      msi_mode_gpu: ck("x_msimode"),
      pcie_link_state_off: ck("x_pcie"),
      interrupt_moderation_off: ck("x_ndis"),
      enable_large_pages: ck("x_large"),
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

  setChecked("w_power", has("e9a42b02-d5df-448d-aa00-03f14749eb61"));
  setChecked("w_dvr", has("GameDVR_Enabled"));
  setChecked("w_bar", has("UseNexusForGameBarEnabled"));
  setChecked("w_mode", has("AutoGameModeEnabled"));
  setChecked("w_hib", has("powercfg -h off"));
  setChecked("w_mouse", has("'MouseSpeed'"));
  setChecked("w_fso", has("DISABLEDXMAXIMIZEDWINDOWEDMODE"));
  setChecked("w_vis", has("VisualFXSetting"));
  setChecked("w_trans", has("EnableTransparency"));
  setChecked("w_bgapps", has("GlobalUserDisabled"));
  setChecked("w_notif", has("ToastEnabled"));
  setChecked("w_cort", has("AllowCortana"));
  setChecked("w_idx", has("'WSearch'"));
  setChecked("w_hgs", has("HwSchMode"));
  setChecked("w_hpet", has("useplatformtick"));
  setChecked("w_pthrot", has("PowerThrottlingOff"));
  setChecked("w_park", has("CPMINCORES"));
  setChecked("w_temp", has(String.raw`TEMP\*`));
  setChecked("w_cs2gpu", has("GpuPreference=2"));
  setChecked("w_deliver", has("'DoSvc'"));
  setChecked("w_widgets", has("TaskbarDa"));
  setChecked("w_memcomp", has("Disable-MMAgent"));
  setChecked("w_uxuser", has("DiagTrack") && has("ConnectedUser"));
  setChecked("w_spectre", has("FeatureSettingsOverride"));
  setChecked("w_lastaccess", has("NtfsDisableLastAccessUpdate"));
  setChecked("w_8dot3", has("NtfsDisable8dot3NameCreation"));
  setChecked("w_mmcss", has("SystemProfile") && has("SystemResponsiveness"));
  setChecked("w_largecache", has("LargeSystemCache"));

  setChecked("n_nagle", has("TCPNoDelay"));
  setChecked("n_tcp", has("autotuninglevel"));
  setChecked("n_dns", has("flushdns"));
  setChecked("n_wifi", has("WakeOnMagicPacket"));
  setChecked("n_throttle", has("NetworkThrottlingIndex"));
  setChecked("n_ecn", has("ecncapability"));
  setChecked("n_rss", has("rss"));
  setChecked("n_netbios", has("NetbiosOptions"));
  setChecked("n_lmhosts", has("EnableLMHOSTS"));
  setChecked("n_ctcp", has("ctcp"));

  setChecked("nv_perf", has("PowerMizerLevel"));
  setChecked("nv_vsync", has("NVTweak"));
  setChecked("nv_lat", has("RMDelayCycles"));
  setChecked("nv_thread", has("ThreadedOptimization"));
  setChecked("nv_aniso", has("Anisotropic") || has("anisotropic"));
  setChecked("nv_shader", has("DXCache"));
  setChecked("nv_reflex", has("ReflexMode"));
  setChecked("nv_sharp", has("SharpenEnabled"));
  setChecked("nv_texfilt", has("TextureFilterQuality"));
  setChecked("nv_prerender", has("MaxFrameAllowed"));
  setChecked("nv_ambient", has("AmbientOcclusion"));
  setChecked("nv_fxaa", has("FXAAEnable"));

  setChecked("s_sys", has("'SysMain'"));
  setChecked("s_diag", has("'DiagTrack'"));
  setChecked("s_ws", has("'WSearch'") && has("Stop-Service"));
  setChecked("s_print", has("'Spooler'"));
  setChecked("s_fax", has("'Fax'"));
  setChecked("s_xbox", has("XblAuthManager"));
  setChecked("s_cdp", has("'CDPSvc'"));
  setChecked("s_wpn", has("WpnUserService"));
  setChecked("s_diagpol", has("'DPS'"));
  setChecked("s_remote", has("'RemoteRegistry'"));
  setChecked("s_maps", has("'MapsBroker'"));
  setChecked("s_phonesvc", has("'PhoneSvc'"));
  setChecked("s_retaildemo", has("'RetailDemo'"));

  setChecked("ae_on", has("autoexecLines"));
  const fpsMatch = /fps_max (\d+)/.exec(content);
  if (fpsMatch) setVal("ae_fps", fpsMatch[1]);
  const rateMatch = /rate (\d+)/.exec(content);
  if (rateMatch) setVal("ae_rate", rateMatch[1]);
  const interpMatch = /cl_interp (\S+)/.exec(content);
  if (interpMatch) setVal("ae_int", interpMatch[1]);
  const irMatch = /cl_interp_ratio (\S+)/.exec(content);
  if (irMatch) setVal("ae_ir", irMatch[1]);
  const urMatch = /cl_updaterate (\d+)/.exec(content);
  if (urMatch) setVal("ae_ur", urMatch[1]);
  const crMatch = /cl_cmdrate (\d+)/.exec(content);
  if (crMatch) setVal("ae_cr", crMatch[1]);
  const sensMatch = /sensitivity (\S+)/.exec(content);
  if (sensMatch) setVal("ae_sns", sensMatch[1]);
  const fovMatch = /viewmodel_fov (\S+)/.exec(content);
  if (fovMatch) setVal("ae_fov", fovMatch[1]);
  setChecked("ae_raw", has("m_rawinput 1"));

  setChecked("lo_exec", has("+exec autoexec"));
  setChecked("lo_nvid", has("-novid"));
  setChecked("lo_joy", has("-nojoy"));
  setChecked("lo_high", has("-high"));
  setChecked("lo_allow", has("-allow_third_party_software"));
  const threadMatch = /-threads (\d+)/.exec(content);
  if (threadMatch) setVal("lo_thr", threadMatch[1]);

  setChecked("x_faceit", has("FACEITService"));
  setChecked("x_steam", has("GameOverlayDisabled"));
  setChecked("x_disc", has("DiscordHook"));
  setChecked("x_resp", has("SystemResponsiveness"));
  setChecked("x_gpup", has("GPU Priority"));
  setChecked("x_prio", has("Win32PrioritySeparation"));
  setChecked("x_cs2p", has("'cs2'"));
  setChecked("x_telem", has("CompatTelRunner"));
  setChecked("x_timer", has("TimeIncrement"));
  setChecked("x_msimode", has("MSISupported"));
  setChecked("x_pcie", has("ASPM"));
  setChecked("x_ndis", has("InterruptModeration"));
  setChecked("x_large", has("SeLockMemoryPrivilege"));

  updateImpact();
}

/* ================================================================
   Tauri bridge
   ================================================================ */

async function exportScript() {
  try {
    const config = collectConfig();
    const ps1 = await invoke<string>("generate_script", { config });
    await invoke("save_script", { scriptContent: ps1 });
    toast("Script exported successfully");
  } catch (e) {
    console.error(e);
    toast("Error generating script — check console (F12)", true);
  }
}

async function importScript() {
  try {
    const result = await invoke<{ path: string; content: string }>("import_script");
    _currentScriptPath = result.path;
    parsePs1AndSetToggles(result.content);
    toast(`Imported: ${result.path.split("\\").pop()}`);
    refreshSystemState();
  } catch (e) {
    console.error(e);
  }
}

async function runConfigAsAdmin() {
  try {
    const config = collectConfig();
    toast("Generating & launching as Admin…");
    const msg = await invoke<string>("run_config_as_admin", { config });
    toast(msg);
    pollScriptReport();
  } catch (e) {
    console.error(e);
    toast("Failed to run config as admin", true);
  }
}

async function runSectionAsAdmin(section: string, label: string) {
  try {
    const config = collectConfig();
    toast(`Applying ${label}…`);
    const msg = await invoke<string>("run_config_as_admin", { config, section });
    toast(msg);
    // Remove pending badge from the card
    const card = document.querySelector(`[data-section="${section}"]`);
    if (card) card.classList.remove("card-pending");
    pollScriptReport();
  } catch (e) {
    console.error(e);
    toast(`Failed to apply ${label}`, true);
  }
}

/** Poll for PS1 script report and show modal when ready */
async function pollScriptReport() {
  let attempts = 0;
  const maxAttempts = 120; // ~2 minutes
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) { clearInterval(interval); return; }
    try {
      const report = await invoke<ScriptReport>("get_script_report");
      if (!report || report.status === "no_report") return;
      clearInterval(interval);
      showScriptReportModal(report);
    } catch { /* keep polling */ }
  }, 1000);
}

function showScriptReportModal(report: ScriptReport) {
  const existing = document.getElementById("script-report-modal");
  if (existing) existing.remove();

  const durationStr = report.duration_secs ? `${report.duration_secs}s` : "N/A";
  const startStr = report.start_time ? new Date(report.start_time).toLocaleTimeString() : "";
  const endStr = report.end_time ? new Date(report.end_time).toLocaleTimeString() : "";
  let statusIcon: string;
  if (report.status === "success") statusIcon = "✅";
  else if (report.status === "partial") statusIcon = "⚠️";
  else statusIcon = "❌";
  let statusText: string;
  if (report.status === "success") statusText = "Success";
  else if (report.status === "partial") statusText = "Partial (with errors)";
  else statusText = "Failed";

  const errorsHtml = report.errors && report.errors.length > 0
    ? '<div class="report-errors"><div class="report-errors-title">Errors (' + report.errors.length + '):</div>' + report.errors.map((e) => '<div class="report-error-item">• ' + e + "</div>").join("") + "</div>"
    : "";

  const modal = document.createElement("div");
  modal.id = "script-report-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box report-modal">
      <div class="modal-title">${statusIcon} Execution Report</div>
      <div class="report-grid">
        <div class="report-stat">
          <span class="report-stat-val">${statusText}</span>
          <span class="report-stat-label">Status</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-val">${durationStr}</span>
          <span class="report-stat-label">Duration</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-val">${report.sections_run || 0}</span>
          <span class="report-stat-label">Sections</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-val">${report.commands_run || 0}</span>
          <span class="report-stat-label">Commands</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-val">${startStr}</span>
          <span class="report-stat-label">Start</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-val">${endStr}</span>
          <span class="report-stat-label">End</span>
        </div>
      </div>
      ${errorsHtml}
      <button class="modal-close-btn" id="report-close-btn">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById("report-close-btn")?.addEventListener("click", () => modal.remove());
}

function copyLaunchOptions() {
  const opts: string[] = [];
  if (ck("lo_exec")) opts.push("+exec autoexec.cfg");
  if (ck("lo_nvid")) opts.push("-novid");
  if (ck("lo_joy")) opts.push("-nojoy");
  if (ck("lo_high")) opts.push("-high");
  if (ck("lo_allow")) opts.push("-allow_third_party_software");
  const thr = vl("lo_thr", "");
  if (thr) opts.push(`-threads ${thr}`);
  const custom = (document.getElementById("lo_custom") as HTMLTextAreaElement)?.value?.trim();
  if (custom) opts.push(custom);
  const str = opts.join(" ");
  navigator.clipboard.writeText(str);
  toast(`Launch options copied: ${str}`);
}

function cardApplyBtn(label: string, section: string, icon: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "card-apply-btn";
  btn.innerHTML = `${icon} ${label}`;
  btn.title = `Apply only the "${section}" changes as Admin`;
  btn.addEventListener("click", () => runSectionAsAdmin(section, label));
  return btn;
}

function _markCardPending(section: string) {
  const card = document.querySelector(`[data-section="${section}"]`);
  if (card) card.classList.add("card-pending");
}

/* ================================================================
   System state LED refresh
   ================================================================ */

async function refreshSystemState() {
  try {
    const state = await invoke<Record<string, boolean | null>>("check_system_state");
    for (const [id, value] of Object.entries(state)) {
      const led = document.getElementById(`led_${id}`);
      if (!led) continue;
      led.classList.remove("active", "unknown");
      if (value === true) {
        led.classList.add("active");
        led.title = "✔ Applied on this system (excluded from estimate)";
      } else if (value === false) {
        led.title = "✖ Not yet applied";
      } else {
        led.classList.add("unknown");
        led.title = "— Cannot determine";
      }
    }
    /* Recalculate impact now that LEDs are updated */
    updateImpact();
  } catch (e) {
    console.error("System state check failed:", e);
  }
}

/** Sync checkboxes with actual system state (for first-time users) */
async function syncTogglesWithSystemState() {
  try {
    const state = await invoke<Record<string, boolean | null>>("check_system_state");
    for (const [id, value] of Object.entries(state)) {
      // Only set checkbox if value is known (true or false, not null)
      if (value !== null) {
        const checkbox = document.getElementById(id) as HTMLInputElement | null;
        if (checkbox?.type === "checkbox") {
          checkbox.checked = value;
        }
      }
      // Also update LEDs
      const led = document.getElementById(`led_${id}`);
      if (!led) continue;
      led.classList.remove("active", "unknown");
      if (value === true) {
        led.classList.add("active");
        led.title = "✔ Applied on this system (excluded from estimate)";
      } else if (value === false) {
        led.title = "✖ Not yet applied";
      } else {
        led.classList.add("unknown");
        led.title = "— Cannot determine";
      }
    }
    /* Recalculate impact now that toggles are updated */
    updateImpact();
    updateCfgCounter();
  } catch (e) {
    console.error("System state sync failed:", e);
  }
}

/* ================================================================
   Tooltips
   ================================================================ */
const TIP: Record<string, string> = {
  /* BIOS — manual settings, the app only shows recommendations */
  b_svm: "⚠ MANUAL BIOS: Navigate to BIOS → CPU Config → Disable SVM/VT-x. Eliminates hypervisor overhead. Impact: ~3% (+7 FPS). The app cannot change BIOS settings.",
  b_cst: "⚠ MANUAL BIOS: Navigate to BIOS → Advanced → Disable C-States. Forces CPU 100% frequency. Impact: ~2.5% (+6 FPS). The app cannot change BIOS settings.",
  b_cool: "⚠ MANUAL BIOS: Navigate to BIOS → CPU Config → Disable Cool'n'Quiet / SpeedStep. Locks max turbo. Impact: ~1.5% (+4 FPS). The app cannot change BIOS settings.",
  b_xmp: "⚠ MANUAL BIOS: Navigate to BIOS → OC/Memory → Enable XMP/DOCP profile. Runs RAM at rated speed. Impact: ~8% (+20 FPS). The app cannot change BIOS settings.",
  b_rbar: "⚠ MANUAL BIOS: Navigate to BIOS → PCI → Enable Resizable BAR / Smart Access Memory. Impact: ~1.5% (+4 FPS). The app cannot change BIOS settings.",
  b_4g: "⚠ MANUAL BIOS: Navigate to BIOS → PCI → Enable Above 4G Decoding. Required for ReBAR. 0 FPS impact alone. The app cannot change BIOS settings.",

  /* Windows — auto-applied via registry/PowerShell when you Run or Export */
  w_power: '✔ AUTO (Registry): Activates the hidden "Ultimate Performance" power plan. Minimizes CPU power management latency. +3.0% (+8 FPS).',
  w_dvr: "✔ AUTO (Registry): Disables Game DVR background recording. Stops encoder overhead. +2.5% (+6 FPS).",
  w_bar: "✔ AUTO (Registry): Disables Game Bar overlay (Win+G). Removes overlay hooks. +1.0% (+3 FPS).",
  w_mode: "✔ AUTO (Registry): Disables Windows Game Mode. Can cause inconsistent frame pacing. +1.0% (+3 FPS).",
  w_hib: "✔ AUTO (PowerShell): Disables Hibernation and Fast Startup via powercfg. +0.5% (+1 FPS). Stability improvement.",
  w_mouse: "✔ AUTO (Registry): Disables mouse acceleration (MouseSpeed=0). Essential for consistent aim. 0 FPS — aim quality only.",
  w_fso: "✔ AUTO (Registry): Disables Fullscreen Optimizations for CS2. Reduces input lag. +2.0% (+5 FPS).",
  w_vis: "✔ AUTO (Registry): Sets Visual Effects to Best Performance. +0.5% (+1 FPS) in-game.",
  w_trans: "✔ AUTO (Registry): Disables desktop transparency effects. +0.5% (+1 FPS).",
  w_bgapps: "✔ AUTO (Registry): Disables all background UWP app activity. +2.0% (+5 FPS).",
  w_notif: "✔ AUTO (Registry): Disables toast notifications. +0.5% (+1 FPS).",
  w_cort: "✔ AUTO (Registry): Disables Cortana. +0.5% (+1 FPS). Saves ~50-100MB RAM.",
  w_idx: "✔ AUTO (Service): Disables Windows Search Indexing service. +1.5% (+4 FPS). Reduces disk I/O.",
  w_hgs: "✔ AUTO (Registry): Enables Hardware-accelerated GPU Scheduling. +2.0% (+5 FPS) on RTX 30/40.",
  w_hpet: "✔ AUTO (bcdedit): Disables HPET timer. +3.0% (+8 FPS). Reduces DPC latency.",
  w_pthrot: "✔ AUTO (Registry): Disables Power Throttling. +1.0% (+3 FPS).",
  w_park: "✔ AUTO (powercfg): Disables CPU Core Parking. +1.5% (+4 FPS). Prevents core-wake hitches.",
  w_temp: "✔ AUTO (PowerShell): Cleans TEMP directories. 0 FPS — maintenance only.",
  w_cs2gpu: "✔ AUTO (Registry): Forces CS2 to use dedicated GPU. +1.0% (+3 FPS). High impact on laptops.",
  w_deliver: "✔ AUTO (Service): Disables Delivery Optimization (Windows Update P2P). +1.0% (+3 FPS). Prevents background uploads.",
  w_widgets: "✔ AUTO (Registry): Disables Windows 11 Widgets. +0.5% (+1 FPS). Saves ~100MB RAM.",
  w_memcomp: "✔ AUTO (PowerShell): Disables Memory Compression. +1.0% (+3 FPS). Trades RAM for CPU overhead.",
  w_uxuser: "✔ AUTO (Registry): Disables Connected User Experiences and Telemetry. +0.5% (+1 FPS). Stops background data collection.",
  w_spectre: "✔ AUTO (Registry+bcdedit): Disables Spectre/Meltdown CPU mitigations. +8.0% (+20 FPS). Security risk — research before applying.",
  w_lastaccess: "✔ AUTO (fsutil): Disables NTFS Last Access timestamp. +0.5% (+1 FPS). Reduces disk write overhead.",
  w_8dot3: "✔ AUTO (fsutil): Disables 8.3 short filename creation. +0.5% (+1 FPS). Reduces NTFS overhead on large directories.",
  w_mmcss: "✔ AUTO (Registry): Sets MMCSS multimedia scheduler to gaming priority. +1.5% (+4 FPS). Higher scheduling priority for games.",
  w_largecache: "✔ AUTO (Registry): Disables Large System Cache. +1.0% (+3 FPS). Frees RAM for gaming.",

  /* Network — auto-applied via registry/netsh */
  n_nagle: "✔ AUTO (Registry): Disables Nagle's Algorithm (TcpNoDelay). Reduces latency 10-30ms. 0 FPS — latency only.",
  n_tcp: "✔ AUTO (netsh): Optimizes TCP auto-tuning level. 0 FPS — latency improvement only.",
  n_dns: "✔ AUTO (ipconfig): Flushes DNS resolver cache. 0 FPS — connectivity fix.",
  n_wifi: "✔ AUTO (PowerShell): Disables Wi-Fi adapter power saving. 0 FPS — prevents WiFi latency spikes.",
  n_throttle: "✔ AUTO (Registry): Disables NetworkThrottlingIndex. +1.0% (+3 FPS). Removes 10 packets/ms limit.",
  n_ecn: "✔ AUTO (netsh): Disables ECN Capability. 0 FPS — reduces packet overhead on some ISPs.",
  n_rss: "✔ AUTO (netsh): Enables Receive Side Scaling across CPU cores. 0 FPS — distributes network I/O.",
  n_netbios: "✔ AUTO (Registry): Disables NetBIOS over TCP/IP on all adapters. 0 FPS — removes legacy SMB overhead.",
  n_lmhosts: "✔ AUTO (Registry): Disables LMHOSTS lookup on all adapters. 0 FPS — removes legacy name resolution delay.",
  n_ctcp: "✔ AUTO (netsh): Enables Compound TCP congestion control. 0 FPS — better throughput under packet loss.",

  /* NVIDIA — auto-applied via registry */
  nv_perf: "✔ AUTO (Registry): Sets NVIDIA to Max Performance mode. +3.0% (+8 FPS). Prevents GPU downclocking.",
  nv_vsync: "✔ AUTO (Registry): Disables V-Sync globally. +2.0% (+5 FPS). Removes frame cap + input lag.",
  nv_lat: "✔ AUTO (Registry): Sets Ultra Low Latency mode. +1.5% (+4 FPS). Reduces input-to-display latency 10-30ms.",
  nv_thread: "✔ AUTO (Registry): Enables Threaded Optimization. +1.5% (+4 FPS) on multi-core CPUs.",
  nv_aniso: "✔ AUTO (Registry): Sets Anisotropic Filtering to app-controlled. +0.5% (+1 FPS).",
  nv_shader: "✔ AUTO (PowerShell): Clears Shader Cache files. 0 FPS — maintenance.",
  nv_reflex: "✔ AUTO (Registry): Forces NVIDIA Reflex On+Boost via profile. +1.5% (+4 FPS). Reduces render queue latency.",
  nv_sharp: "✔ AUTO (Registry): Disables Image Sharpening filter. +0.5% (+1 FPS). Frees GPU post-processing.",
  nv_texfilt: "✔ AUTO (Registry): Sets Texture Filtering Quality to High Performance. +0.5% (+1 FPS). Reduces anisotropic overhead.",
  nv_prerender: "✔ AUTO (Registry): Sets Max Pre-Rendered Frames to 1. +1.0% (+3 FPS). Reduces CPU-side input lag by 1-2 frames.",
  nv_ambient: "✔ AUTO (Registry): Disables Ambient Occlusion globally. +1.0% (+3 FPS). Saves GPU shader cycles.",
  nv_fxaa: "✔ AUTO (Registry): Disables global FXAA (forced antialiasing). +0.5% (+1 FPS). Lets CS2 handle AA.",

  /* Services — auto-applied via Stop-Service/Set-Service */
  s_sys: "✔ AUTO (Service): Stops and disables SysMain (Superfetch). +1.5% (+4 FPS). Frees RAM + disk I/O.",
  s_diag: "✔ AUTO (Service): Stops and disables DiagTrack telemetry. +0.5% (+1 FPS).",
  s_ws: "✔ AUTO (Service): Stops and disables Windows Search. +1.0% (+3 FPS). Stops disk I/O spikes.",
  s_print: "✔ AUTO (Service): Stops and disables Print Spooler. 0 FPS — if not printing.",
  s_fax: "✔ AUTO (Service): Stops and disables Fax service. 0 FPS.",
  s_xbox: "✔ AUTO (Service): Stops and disables Xbox services (all). +0.5% (+1 FPS). Saves RAM.",
  s_cdp: "✔ AUTO (Service): Stops and disables Connected Devices Platform. +0.5% (+1 FPS). Bluetooth/device sync.",
  s_wpn: "✔ AUTO (Service): Stops and disables WpnUserService (push notifications). +0.5% (+1 FPS).",
  s_diagpol: "✔ AUTO (Service): Stops and disables Diagnostic Policy Service. +0.5% (+1 FPS). Diagnostic logging.",
  s_remote: "✔ AUTO (Service): Stops and disables Remote Registry. 0 FPS — security + attack surface reduction.",
  s_maps: "✔ AUTO (Service): Stops and disables MapsBroker. +0.5% (+1 FPS). Prevents background map data downloads.",
  s_phonesvc: "✔ AUTO (Service): Stops and disables Phone Service. 0 FPS — unnecessary for gaming.",
  s_retaildemo: "✔ AUTO (Service): Stops and disables RetailDemo Service. 0 FPS — only used on demo kiosks.",

  /* autoexec.cfg — auto-generated by the app, written to CS2 cfg folder */
  ae_on: "✔ AUTO (File): The app generates autoexec.cfg and writes it to your CS2 cfg folder when you Export or Run.",
  ae_raw: "✔ AUTO (CFG): Sets m_rawinput 1 in autoexec.cfg. Raw mouse input for consistent aim. 0 FPS.",

  /* Launch Options — generated by the app, user must paste into Steam */
  lo_exec: '⚠ MANUAL PASTE: Generates "+exec autoexec" for Steam Launch Options. You must paste this into Steam → CS2 → Properties → Launch Options.',
  lo_nvid: '⚠ MANUAL PASTE: Generates "-novid" to skip intro video. 0 FPS. Paste into Steam Launch Options.',
  lo_joy: '⚠ MANUAL PASTE: Generates "-nojoy" to disable controller polling. +0.5% (+1 FPS). Paste into Steam Launch Options.',
  lo_high: '⚠ MANUAL PASTE: Generates "-high" for high process priority. +2.0% (+5 FPS). Paste into Steam Launch Options.',
  lo_allow: '⚠ MANUAL PASTE: Generates "-allow_third_party_software" for FACEIT/overlay compatibility. 0 FPS. Paste into Steam Launch Options.',

  /* Extras — mixed: registry tweaks are auto-applied, FACEIT is informational */
  x_faceit: "ℹ INFO ONLY: Checks if FACEIT Anti-Cheat service is running on your system. The app does not modify FACEIT — this is a status check.",
  x_steam: "✔ AUTO (Registry): Disables Steam Overlay via registry. +1.5% (+4 FPS). May need Steam restart.",
  x_disc: "✔ AUTO (Registry): Disables Discord Overlay hook. +1.0% (+3 FPS). May need Discord restart.",
  x_resp: "✔ AUTO (Registry): Sets SystemResponsiveness = 0. +2.0% (+5 FPS). Max CPU reservation for game.",
  x_gpup: "✔ AUTO (Registry): Sets GPU Priority for gaming processes. +1.0% (+3 FPS).",
  x_prio: "✔ AUTO (Registry): Tunes Win32PrioritySeparation for foreground apps. +1.5% (+4 FPS). Better frame pacing.",
  x_cs2p: "✔ AUTO (Registry): Sets CS2 process to High priority class. +1.5% (+4 FPS).",
  x_telem: "✔ AUTO (PowerShell): Disables Windows telemetry scheduled tasks. +0.5% (+1 FPS). Prevents periodic data collection.",
  x_timer: "✔ AUTO (PowerShell): Sets global timer resolution to 0.5ms via bcdedit. +1.0% (+3 FPS). Reduces input processing delay.",
  x_msimode: "✔ AUTO (Registry): Enables MSI (Message Signaled Interrupts) for GPU. +1.5% (+4 FPS). Reduces DPC latency 50-200µs.",
  x_pcie: "✔ AUTO (PowerShell): Disables PCIe Active State Power Management. +1.0% (+3 FPS). Prevents GPU bus downclocking.",
  x_ndis: "✔ AUTO (Registry): Disables network adapter Interrupt Moderation. +0.5% (+1 FPS). Lower packet processing latency.",
  x_large: "✔ AUTO (Registry): Enables Large Pages privilege for CS2. +1.0% (+3 FPS). Reduces TLB misses on large memory allocations.",
  x_cs2_affinity: "⚡ BOTÃO: Limita o CS2 apenas aos cores físicos (desactiva Hyper-Threading/SMT). Reduz overhead do scheduler de threads. +1–2% FPS, menos stutters em CPUs multi-core. Cria tarefa agendada para aplicar automaticamente ao lançar o CS2.",
};

/* ================================================================
   CFG Manager — CS2 console commands by category
   ================================================================ */

interface CfgCmd {
  id: string;
  cmd: string;
  label: string;
  type: "toggle" | "value";
  on: boolean;
  val: string;
  tip: string;
  /** If true, this command appears in the "Principal" quick-access tab */
  pri?: boolean;
}
interface CfgCat {
  name: string;
  commands: CfgCmd[];
}

const CFG: CfgCat[] = [
  /* ── Performance & Rendering ──────────────────────────────── */
  {
    name: "Performance",
    commands: [
      { id: "cf_fpsmax", cmd: "fps_max", label: "fps_max", type: "value", on: true, val: "400", tip: "Maximum framerate. 0 = unlimited.", pri: true },
      { id: "cf_fpsmaxui", cmd: "fps_max_ui", label: "fps_max_ui", type: "value", on: false, val: "120", tip: "Max FPS in menus. Saves GPU power." },
      { id: "cf_particles", cmd: "r_drawparticles", label: "r_drawparticles", type: "toggle", on: false, val: "0", tip: "Disable particles for clarity/FPS." },
      { id: "cf_tracers", cmd: "r_drawtracers", label: "r_drawtracers", type: "toggle", on: false, val: "0", tip: "Disable bullet tracers." },
      { id: "cf_preload", cmd: "cl_forcepreload", label: "cl_forcepreload", type: "toggle", on: true, val: "1", tip: "Preload all resources. Reduces mid-game stutters.", pri: true },
      { id: "cf_lowlat", cmd: "engine_low_latency_sleep_after_client_tick", label: "Low Latency Sleep", type: "toggle", on: true, val: "1", tip: "Reflex-style low latency. Reduces input lag.", pri: true },
      { id: "cf_shadows", cmd: "cl_csm_enabled", label: "cl_csm_enabled", type: "toggle", on: true, val: "1", tip: "Cascaded shadow maps. Disable for FPS boost.", pri: true },
      { id: "cf_ragdolls", cmd: "cl_ragdoll_physics_enable", label: "cl_ragdoll_physics_enable", type: "toggle", on: true, val: "0", tip: "Disable ragdolls on death. Reduces GPU load.", pri: true },
      { id: "cf_nofocus", cmd: "engine_no_focus_sleep", label: "engine_no_focus_sleep", type: "value", on: false, val: "0", tip: "Sleep ms when alt-tabbed. 0=no throttle." },
      { id: "cf_gamma", cmd: "r_fullscreen_gamma", label: "r_fullscreen_gamma", type: "value", on: false, val: "2.2", tip: "Fullscreen gamma. 1.6-2.6." },
      {
        id: "cf_postproc",
        cmd: "r_csgo_postprocess_enable",
        label: "r_csgo_postprocess_enable",
        type: "toggle",
        on: false,
        val: "0",
        tip: "Post-processing (bloom, color correction). Disable for FPS.",
      },
      { id: "cf_dynimg", cmd: "cl_itemimages_dynamically_generated", label: "Dynamic item images", type: "toggle", on: false, val: "0", tip: "Disable dynamic item image generation. Saves GPU." },
      { id: "cf_animavatar", cmd: "cl_allow_animated_avatars", label: "Animated avatars", type: "toggle", on: false, val: "0", tip: "Disable animated avatars for CPU savings." },
      { id: "cf_newbob", cmd: "cl_usenewbob", label: "cl_usenewbob", type: "toggle", on: true, val: "1", tip: "Use new weapon bob system. More fluid." },
      { id: "cf_timeout", cmd: "cl_timeout", label: "cl_timeout", type: "value", on: false, val: "30", tip: "Seconds before disconnect on no response. Default 30." },
      { id: "cf_showbuild", cmd: "r_show_build_info", label: "r_show_build_info", type: "toggle", on: false, val: "0", tip: "Show build info overlay. Off for clean screen." },
    ],
  },

  /* ── Crosshair ────────────────────────────────────────────── */
  {
    name: "Crosshair",
    commands: [
      { id: "cf_xhstyle", cmd: "cl_crosshairstyle", label: "cl_crosshairstyle", type: "value", on: true, val: "4", tip: "0=default, 1=static, 2=classic, 3=classic dyn, 4=classic static, 5=hybrid.", pri: true },
      { id: "cf_xhsize", cmd: "cl_crosshairsize", label: "cl_crosshairsize", type: "value", on: true, val: "2.5", tip: "Crosshair line length.", pri: true },
      { id: "cf_xhgap", cmd: "cl_crosshairgap", label: "cl_crosshairgap", type: "value", on: true, val: "-1", tip: "Center gap. Negative = tighter.", pri: true },
      { id: "cf_xhthick", cmd: "cl_crosshairthickness", label: "cl_crosshairthickness", type: "value", on: true, val: "0.5", tip: "Line thickness.", pri: true },
      { id: "cf_xhcolor", cmd: "cl_crosshaircolor", label: "cl_crosshaircolor", type: "value", on: true, val: "1", tip: "0=red, 1=green, 2=yellow, 3=blue, 4=cyan, 5=custom.", pri: true },
      { id: "cf_xhcolorr", cmd: "cl_crosshaircolor_r", label: "cl_crosshaircolor_r", type: "value", on: false, val: "50", tip: "Red channel (0-255). Needs crosshaircolor 5." },
      { id: "cf_xhcolorg", cmd: "cl_crosshaircolor_g", label: "cl_crosshaircolor_g", type: "value", on: false, val: "250", tip: "Green channel (0-255). Needs crosshaircolor 5." },
      { id: "cf_xhcolorb", cmd: "cl_crosshaircolor_b", label: "cl_crosshaircolor_b", type: "value", on: false, val: "50", tip: "Blue channel (0-255). Needs crosshaircolor 5." },
      { id: "cf_xhdot", cmd: "cl_crosshairdot", label: "cl_crosshairdot", type: "toggle", on: false, val: "0", tip: "Center dot on crosshair.", pri: true },
      { id: "cf_xhoutline", cmd: "cl_crosshair_drawoutline", label: "Draw outline", type: "toggle", on: true, val: "1", tip: "Draw crosshair outline for visibility.", pri: true },
      { id: "cf_xhoutthick", cmd: "cl_crosshair_outlinethickness", label: "Outline thickness", type: "value", on: true, val: "1", tip: "Crosshair outline thickness." },
      { id: "cf_xhalpha", cmd: "cl_crosshairalpha", label: "cl_crosshairalpha", type: "value", on: true, val: "255", tip: "Transparency. 0-255.", pri: true },
      { id: "cf_xht", cmd: "cl_crosshair_t", label: "cl_crosshair_t", type: "toggle", on: false, val: "0", tip: "T-shaped crosshair (no top line).", pri: true },
      { id: "cf_xhsniper", cmd: "cl_crosshair_sniper_width", label: "Sniper width", type: "value", on: false, val: "1", tip: "Sniper scope crosshair width." },
      { id: "cf_xhfriend", cmd: "cl_crosshair_friendly_warning", label: "Friendly warning", type: "value", on: true, val: "1", tip: "0=off, 1=icon, 2=both." },
      { id: "cf_xhrecoil", cmd: "cl_crosshair_recoil", label: "cl_crosshair_recoil", type: "toggle", on: false, val: "0", tip: "Crosshair follows recoil pattern." },
      { id: "cf_fixedgap", cmd: "cl_fixedcrosshairgap", label: "cl_fixedcrosshairgap", type: "value", on: false, val: "3", tip: "Gap for static crosshair styles." },
      { id: "cf_xhgapwep", cmd: "cl_crosshairgap_useweaponvalue", label: "Gap per weapon", type: "toggle", on: false, val: "0", tip: "Adjust gap per weapon. 0=fixed gap." },
    ],
  },

  /* ── Viewmodel ────────────────────────────────────────────── */
  {
    name: "Viewmodel",
    commands: [
      { id: "cf_vmfov", cmd: "viewmodel_fov", label: "viewmodel_fov", type: "value", on: true, val: "68", tip: "Viewmodel FOV. 54-68.", pri: true },
      { id: "cf_vmx", cmd: "viewmodel_offset_x", label: "viewmodel_offset_x", type: "value", on: false, val: "2.5", tip: "Horizontal offset. -2.5 to 2.5.", pri: true },
      { id: "cf_vmy", cmd: "viewmodel_offset_y", label: "viewmodel_offset_y", type: "value", on: false, val: "0", tip: "Forward/back offset. -2 to 2.", pri: true },
      { id: "cf_vmz", cmd: "viewmodel_offset_z", label: "viewmodel_offset_z", type: "value", on: false, val: "-1.5", tip: "Vertical offset. -2 to 2.", pri: true },
      { id: "cf_rhand", cmd: "cl_righthand", label: "cl_righthand", type: "toggle", on: true, val: "1", tip: "0=left, 1=right hand.", pri: true },
      { id: "cf_bob", cmd: "cl_bob_lower_amt", label: "cl_bob_lower_amt", type: "value", on: false, val: "21", tip: "Weapon bob when running. 5-30." },
      { id: "cf_vmsl", cmd: "cl_viewmodel_shift_left_amt", label: "Shift left amt", type: "value", on: false, val: "1.5", tip: "Move-left shift. 0.5-2." },
      { id: "cf_vmsr", cmd: "cl_viewmodel_shift_right_amt", label: "Shift right amt", type: "value", on: false, val: "0.75", tip: "Move-right shift. 0.25-2." },
      { id: "cf_vmpreset", cmd: "viewmodel_presetpos", label: "viewmodel_presetpos", type: "value", on: false, val: "0", tip: "0=custom, 1=Desktop, 2=Couch, 3=Classic." },
    ],
  },

  /* ── HUD ──────────────────────────────────────────────────── */
  {
    name: "HUD",
    commands: [
      { id: "cf_hudcolor", cmd: "cl_hud_color", label: "cl_hud_color", type: "value", on: false, val: "0", tip: "HUD color. 0=default, 1-10=presets." },
      { id: "cf_hudalpha", cmd: "cl_hud_background_alpha", label: "HUD bg alpha", type: "value", on: false, val: "0.5", tip: "HUD background transparency. 0-1." },
      { id: "cf_hudstyle", cmd: "cl_hud_healthammo_style", label: "Health/ammo style", type: "toggle", on: false, val: "0", tip: "0=default, 1=simplified." },
      { id: "cf_hudscale", cmd: "hud_scaling", label: "hud_scaling", type: "value", on: false, val: "0.85", tip: "HUD size. 0.5-0.95." },
      { id: "cf_showfps", cmd: "cl_showfps", label: "cl_showfps", type: "value", on: false, val: "1", tip: "0=off, 1=fps, 2=fps+smooth." },
      { id: "cf_netgraph", cmd: "net_graph", label: "net_graph", type: "toggle", on: false, val: "1", tip: "Network stats overlay." },
      { id: "cf_observer", cmd: "cl_show_observer_crosshair", label: "Observer crosshair", type: "value", on: false, val: "2", tip: "0=off, 1=friends, 2=all." },
      { id: "cf_teamid", cmd: "cl_teamid_overhead_always", label: "Team ID overhead", type: "toggle", on: true, val: "1", tip: "Always show teammate info." },
      { id: "cf_teamidmode", cmd: "cl_teamid_overhead_mode", label: "Team ID mode", type: "value", on: false, val: "2", tip: "0=pips, 1=names, 2=equipment." },
      { id: "cf_teamidcolor", cmd: "cl_teamid_overhead_colors_show", label: "Team ID colors", type: "toggle", on: true, val: "1", tip: "Show teammate colors above heads." },
      { id: "cf_loadout", cmd: "cl_showloadout", label: "cl_showloadout", type: "toggle", on: true, val: "1", tip: "Always show weapon loadout." },
      { id: "cf_plcount", cmd: "cl_hud_playercount_pos", label: "Player count pos", type: "value", on: false, val: "0", tip: "0=top, 1=bottom." },
      { id: "cf_plshow", cmd: "cl_hud_playercount_showcount", label: "Player count mode", type: "toggle", on: false, val: "1", tip: "0=avatars, 1=count only." },
      { id: "cf_showpos", cmd: "cl_showpos", label: "cl_showpos", type: "toggle", on: false, val: "0", tip: "Show position/velocity overlay." },
      { id: "cf_targetid", cmd: "hud_showtargetid", label: "hud_showtargetid", type: "toggle", on: true, val: "1", tip: "Show enemy name on hover." },
      { id: "cf_deathnotice", cmd: "cl_drawhud_force_deathnotices", label: "Force killfeed", type: "value", on: false, val: "0", tip: "-1=never, 0=with HUD, 1=always." },
      { id: "cf_tmcolors", cmd: "cl_teammate_colors_show", label: "Teammate colors", type: "toggle", on: true, val: "1", tip: "Unique colors per teammate on radar." },
      { id: "cf_roundend", cmd: "cl_disable_round_end_report", label: "Disable round report", type: "toggle", on: false, val: "0", tip: "Hide round-end scoreboard." },
      { id: "cf_hideavatar", cmd: "cl_hide_avatar_images", label: "Hide avatars", type: "value", on: false, val: "0", tip: "0=show, 1=hide all, 2=hide non-friends." },
      { id: "cf_fastswitch", cmd: "hud_fastswitch", label: "hud_fastswitch", type: "toggle", on: true, val: "1", tip: "Fast weapon switching (no menu)." },
      { id: "cf_showequip", cmd: "+cl_show_team_equipment", label: "Show team equipment", type: "toggle", on: true, val: "", tip: "Always show teammate equipment above heads." },
      { id: "cf_safex", cmd: "safezonex", label: "safezonex", type: "value", on: false, val: "1.0", tip: "HUD horizontal safe zone. 0.85-1." },
      { id: "cf_safey", cmd: "safezoney", label: "safezoney", type: "value", on: false, val: "1.0", tip: "HUD vertical safe zone. 0.85-1." },
    ],
  },

  /* ── Radar ────────────────────────────────────────────────── */
  {
    name: "Radar",
    commands: [
      { id: "cf_radarscale", cmd: "cl_radar_scale", label: "cl_radar_scale", type: "value", on: false, val: "0.4", tip: "Radar zoom. 0.25-1. Lower = more map visible." },
      { id: "cf_radarctr", cmd: "cl_radar_always_centered", label: "Radar centered", type: "toggle", on: false, val: "0", tip: "0=smart scroll, 1=always centered." },
      { id: "cf_radaricon", cmd: "cl_radar_icon_scale_min", label: "Radar icon scale", type: "value", on: false, val: "0.6", tip: "Min radar icon size. 0.4-1.25." },
      { id: "cf_radarrotate", cmd: "cl_radar_rotate", label: "cl_radar_rotate", type: "toggle", on: true, val: "1", tip: "Radar rotates with player view." },
      { id: "cf_radarsquare", cmd: "cl_radar_square_with_scoreboard", label: "Square on scoreboard", type: "toggle", on: true, val: "1", tip: "Radar becomes square when scoreboard opens." },
      { id: "cf_radarhudscale", cmd: "cl_hud_radar_scale", label: "cl_hud_radar_scale", type: "value", on: false, val: "1.0", tip: "Radar HUD size. 0.8-1.3." },
    ],
  },

  /* ── Audio ────────────────────────────────────────────────── */
  {
    name: "Audio",
    commands: [
      { id: "cf_vol", cmd: "volume", label: "volume", type: "value", on: false, val: "0.5", tip: "Master volume. 0-1.", pri: true },
      { id: "cf_musicvol", cmd: "snd_musicvolume", label: "snd_musicvolume", type: "value", on: false, val: "0", tip: "Music volume. 0=muted.", pri: true },
      { id: "cf_hppan", cmd: "snd_headphone_pan_exponent", label: "HP pan exponent", type: "value", on: true, val: "2", tip: "Headphone stereo separation." },
      { id: "cf_hpfront", cmd: "snd_front_headphone_position", label: "Front HP pos", type: "value", on: true, val: "45", tip: "Front virtual speaker angle." },
      { id: "cf_hprear", cmd: "snd_rear_headphone_position", label: "Rear HP pos", type: "value", on: true, val: "135", tip: "Rear virtual speaker angle." },
      { id: "cf_10sec", cmd: "snd_tensecondwarning_volume", label: "10s warning vol", type: "value", on: true, val: "1", tip: "Bomb 10-second warning volume." },
      { id: "cf_mvpvol", cmd: "snd_mvp_volume", label: "MVP volume", type: "value", on: false, val: "0.3", tip: "MVP music volume." },
      { id: "cf_deathvol", cmd: "snd_deathcamera_volume", label: "Death cam vol", type: "value", on: false, val: "0.5", tip: "Death camera sound volume." },
      { id: "cf_voice", cmd: "voice_enable", label: "voice_enable", type: "toggle", on: true, val: "1", tip: "Enable voice chat." },
      { id: "cf_mutefocus", cmd: "snd_mute_losefocus", label: "Mute on alt-tab", type: "toggle", on: false, val: "0", tip: "Mute when alt-tabbed." },
      { id: "cf_voipvol", cmd: "snd_voipvolume", label: "snd_voipvolume", type: "value", on: false, val: "1", tip: "Voice chat volume. 0-1." },
      { id: "cf_rstarvol", cmd: "snd_roundstart_volume", label: "Round start vol", type: "value", on: false, val: "0", tip: "Round start music volume. 0=muted." },
      { id: "cf_rendvol", cmd: "snd_roundend_volume", label: "Round end vol", type: "value", on: false, val: "0", tip: "Round end music volume. 0=muted." },
      { id: "cf_mainstep", cmd: "snd_mixahead", label: "snd_mixahead", type: "value", on: false, val: "0.025", tip: "Audio mix buffer. Lower=less delay. 0.025-0.1." },
      { id: "cf_menumus", cmd: "snd_menumusic_volume", label: "Menu music vol", type: "value", on: false, val: "0", tip: "Main menu music volume." },
      { id: "cf_mapobjvol", cmd: "snd_mapobjective_volume", label: "Map objective vol", type: "value", on: false, val: "0.5", tip: "Map objective music volume." },
      { id: "cf_voicethresh", cmd: "voice_threshold", label: "voice_threshold", type: "value", on: false, val: "2000", tip: "Mic activation threshold (voice activation mode)." },
      { id: "cf_voicevox", cmd: "voice_vox", label: "voice_vox", type: "toggle", on: false, val: "0", tip: "Voice-activated mic (no push-to-talk)." },
      { id: "cf_voiceloop", cmd: "voice_loopback", label: "voice_loopback", type: "toggle", on: false, val: "0", tip: "Hear your own mic in-game (test)." },
      {
        id: "cf_steamocclusion",
        cmd: "snd_steamaudio_max_occlusion_samples",
        label: "Steam Audio samples",
        type: "value",
        on: false,
        val: "32",
        tip: "Occlusion ray count for Steam Audio. More=quality, fewer=FPS.",
      },
    ],
  },

  /* ── Mouse & Input ────────────────────────────────────────── */
  {
    name: "Mouse & Input",
    commands: [
      { id: "cf_sens", cmd: "sensitivity", label: "sensitivity", type: "value", on: true, val: "1.8", tip: "Mouse sensitivity.", pri: true },
      { id: "cf_raw", cmd: "m_rawinput", label: "m_rawinput", type: "toggle", on: true, val: "1", tip: "Raw mouse input. Bypasses OS accel.", pri: true },
      { id: "cf_zoom", cmd: "zoom_sensitivity_ratio", label: "Zoom sensitivity", type: "value", on: false, val: "1.0", tip: "Scoped sensitivity multiplier.", pri: true },
      { id: "cf_pitch", cmd: "m_pitch", label: "m_pitch", type: "value", on: false, val: "0.022", tip: "Mouse pitch (vertical) speed." },
      { id: "cf_yaw", cmd: "m_yaw", label: "m_yaw", type: "value", on: false, val: "0.022", tip: "Mouse yaw (horizontal) speed." },
      { id: "cf_radialimm", cmd: "cl_inventory_radial_immediate_select", label: "Radial quick select", type: "toggle", on: false, val: "1", tip: "Select weapon on highlight in radial menu." },
      { id: "cf_radialtap", cmd: "cl_inventory_radial_tap_to_cycle", label: "Radial tap cycle", type: "toggle", on: false, val: "0", tip: "Tap to cycle weapons in radial." },
      { id: "cf_radialdeadzone", cmd: "cl_radialmenu_deadzone_size", label: "Radial deadzone", type: "value", on: false, val: "0.02", tip: "Radial menu deadzone size." },
    ],
  },

  /* ── Network ──────────────────────────────────────────────── */
  {
    name: "Network",
    commands: [
      { id: "cf_rate", cmd: "rate", label: "rate", type: "value", on: true, val: "786432", tip: "Max bytes/sec from server. 786432=max.", pri: true },
      { id: "cf_interp", cmd: "cl_interp", label: "cl_interp", type: "value", on: true, val: "0", tip: "Interpolation delay. 0=auto.", pri: true },
      { id: "cf_interpr", cmd: "cl_interp_ratio", label: "cl_interp_ratio", type: "value", on: true, val: "1", tip: "1=minimal, 2=safe.", pri: true },
      { id: "cf_updrate", cmd: "cl_updaterate", label: "cl_updaterate", type: "value", on: true, val: "128", tip: "Packets/sec from server.", pri: true },
      { id: "cf_cmdrate", cmd: "cl_cmdrate", label: "cl_cmdrate", type: "value", on: true, val: "128", tip: "Packets/sec to server.", pri: true },
      { id: "cf_steamdg", cmd: "net_client_steamdatagram_enable_override", label: "Steam Datagram", type: "value", on: true, val: "1", tip: "1=force SDR relay. Lower ping to Valve servers." },
      { id: "cf_predict", cmd: "cl_predict", label: "cl_predict", type: "toggle", on: true, val: "1", tip: "Client-side prediction. Always keep on." },
      { id: "cf_lagcomp", cmd: "cl_lagcompensation", label: "cl_lagcompensation", type: "toggle", on: true, val: "1", tip: "Lag compensation. Always keep on." },
      { id: "cf_resend", cmd: "cl_resend", label: "cl_resend", type: "value", on: false, val: "2", tip: "Seconds before retry on failed connect. 1.5-20." },
      { id: "cf_netbuffer", cmd: "cl_net_buffer_ticks", label: "cl_net_buffer_ticks", type: "value", on: false, val: "0", tip: "Buffer ticks for snapshots. 0=auto, 1=minimal." },
      { id: "cf_clockrecv", cmd: "cl_clock_recvmargin_enable", label: "Clock recv margin", type: "toggle", on: false, val: "1", tip: "New clock sync strategy for better network perf." },
      { id: "cf_cqminqueue", cmd: "cl_cq_min_queue", label: "cl_cq_min_queue", type: "value", on: false, val: "0", tip: "-1=off, 0=server decides, >0=min queue size." },
      { id: "cf_telping", cmd: "cl_hud_telemetry_ping_show", label: "Telemetry ping", type: "value", on: false, val: "1", tip: "0=never, 1=when poor, 2=always show ping." },
      { id: "cf_telpingpoor", cmd: "cl_hud_telemetry_ping_poor", label: "Poor ping threshold", type: "value", on: false, val: "100", tip: "Ping (ms) considered poor for HUD telemetry." },
      { id: "cf_telft", cmd: "cl_hud_telemetry_frametime_show", label: "Telemetry frametime", type: "value", on: false, val: "0", tip: "0=never, 1=when poor, 2=always show frametime." },
      { id: "cf_telftpoor", cmd: "cl_hud_telemetry_frametime_poor", label: "Poor FT threshold", type: "value", on: false, val: "10", tip: "Frametime (ms) considered poor for HUD telemetry." },
      { id: "cf_telloss", cmd: "cl_hud_telemetry_net_misdelivery_show", label: "Telemetry loss", type: "value", on: false, val: "1", tip: "0=never, 1=when poor, 2=always show packet loss." },
      { id: "cf_tellosspoor", cmd: "cl_hud_telemetry_net_misdelivery_poor", label: "Poor loss threshold", type: "value", on: false, val: "5", tip: "Loss rate (%) considered poor for HUD telemetry." },
      { id: "cf_recvmargin", cmd: "cl_hud_telemetry_serverrecvmargin_graph_show", label: "Recv margin graph", type: "toggle", on: false, val: "0", tip: "Show server receive margin graph on HUD." },
    ],
  },

  /* ── Voice & Communication ────────────────────────────────── */
  {
    name: "Voice & Comms",
    commands: [
      { id: "cf_mute", cmd: "cl_mute_enemy_team", label: "Mute enemy team", type: "toggle", on: false, val: "0", tip: "Mute all enemy voice/text." },
      { id: "cf_mutefriends", cmd: "cl_mute_all_but_friends_and_party", label: "Mute non-friends", type: "toggle", on: false, val: "0", tip: "Only hear Steam friends and party." },
      { id: "cf_clutchmode", cmd: "cl_clutch_mode", label: "cl_clutch_mode", type: "toggle", on: false, val: "0", tip: "Auto-mute voice in clutch scenarios." },
      { id: "cf_sanitize", cmd: "cl_sanitize_player_names", label: "Sanitize names", type: "toggle", on: false, val: "0", tip: "Replace player names with generic labels." },
      { id: "cf_sanmuted", cmd: "cl_sanitize_muted_players", label: "Sanitize muted", type: "toggle", on: false, val: "0", tip: "Hide names/avatars of muted players." },
      { id: "cf_pingmute", cmd: "cl_player_ping_mute", label: "Mute ping sound", type: "toggle", on: false, val: "0", tip: "Mute the ping system audio." },
    ],
  },

  /* ── Buy & Economy ────────────────────────────────────────── */
  {
    name: "Buy & Economy",
    commands: [
      { id: "cf_buymenu", cmd: "cl_use_opens_buy_menu", label: "Use opens buy", type: "toggle", on: false, val: "0", tip: "Prevent E from opening buy menu." },
      { id: "cf_autowep", cmd: "cl_autowepswitch", label: "Auto weapon switch", type: "toggle", on: false, val: "0", tip: "Auto-switch to picked up weapons.", pri: true },
      { id: "cf_silencer", cmd: "cl_silencer_mode", label: "Silencer mode", type: "value", on: false, val: "0", tip: "0=toggle, 1=always on, 2=always off." },
      { id: "cf_buywarn", cmd: "cl_buywheel_nomousecentering", label: "Buy wheel no recentering", type: "toggle", on: false, val: "0", tip: "Prevent mouse recentering in buy menu." },
      { id: "cf_buydonate", cmd: "cl_buywheel_donate_key", label: "Donate key", type: "value", on: false, val: "0", tip: "Key to donate weapons in buy menu." },
      { id: "cf_showgrenade", cmd: "cl_grenadepreview", label: "cl_grenadepreview", type: "toggle", on: false, val: "0", tip: "Show grenade trajectory preview." },
    ],
  },

  /* ── Spectator & Demo ─────────────────────────────────────── */
  {
    name: "Spectator & Demo",
    commands: [
      { id: "cf_snaptarget", cmd: "cl_snaptarget", label: "cl_snaptarget", type: "toggle", on: false, val: "0", tip: "Snap spectator camera to targets." },
      { id: "cf_specswap", cmd: "cl_spec_swapplayersides", label: "Swap player sides", type: "toggle", on: false, val: "0", tip: "Swap team sides in spectator HUD." },
      { id: "cf_xraydefuse", cmd: "spec_xray_dropped_defusekits", label: "X-ray defuse kits", type: "toggle", on: false, val: "1", tip: "Highlight dropped defuse kits in spectator." },
      { id: "cf_xraydrop", cmd: "spec_xray_dropped_unoccluded", label: "X-ray C4/kits", type: "toggle", on: false, val: "1", tip: "Always show C4/kits through walls in spectator." },
    ],
  },

  /* ── Misc & QoL ───────────────────────────────────────────── */
  {
    name: "Misc & QoL",
    commands: [
      { id: "cf_console", cmd: "con_enable", label: "con_enable", type: "toggle", on: true, val: "1", tip: "Enable developer console (~).", pri: true },
      { id: "cf_autohelp", cmd: "cl_autohelp", label: "cl_autohelp", type: "toggle", on: false, val: "0", tip: "Disable in-game help messages." },
      { id: "cf_instructor", cmd: "gameinstructor_enable", label: "Game instructor", type: "toggle", on: false, val: "0", tip: "Disable tutorial tips." },
      { id: "cf_joinadv", cmd: "cl_join_advertise", label: "Friends can join", type: "value", on: false, val: "2", tip: "0=no, 1=friends, 2=friends of friends." },
      { id: "cf_maxping", cmd: "mm_dedicated_search_maxping", label: "Max MM ping", type: "value", on: false, val: "80", tip: "Max matchmaking ping." },
      { id: "cf_confilter", cmd: "con_filter_enable", label: "Console filter", type: "toggle", on: false, val: "0", tip: "Enable console output filtering." },
      { id: "cf_autoaccept", cmd: "ui_setting_advertiseforhire_auto", label: "Auto-accept lobby", type: "value", on: false, val: "1", tip: "1=auto-accept lobby invites." },
      { id: "cf_deathnum", cmd: "cl_deathnotices_show_numbers", label: "Killfeed numbers", type: "toggle", on: false, val: "0", tip: "Show numbers in killfeed." },
      { id: "cf_clanid", cmd: "cl_clanid", label: "cl_clanid", type: "value", on: false, val: "", tip: "Steam group tag (clan tag) to display." },
      { id: "cf_freezecam", cmd: "cl_disablefreezecam", label: "Disable freeze cam", type: "toggle", on: false, val: "0", tip: "Skip death freeze camera." },
      { id: "cf_showmem", cmd: "cl_showmem", label: "cl_showmem", type: "toggle", on: false, val: "0", tip: "Show memory usage overlay." },
      { id: "cf_autocursor", cmd: "cl_auto_cursor_scale", label: "Auto cursor scale", type: "toggle", on: true, val: "1", tip: "Scale cursor size with resolution." },
      { id: "cf_cursorscale", cmd: "cl_cursor_scale", label: "cl_cursor_scale", type: "value", on: false, val: "1", tip: "Manual cursor scale factor." },
    ],
  },
];

/* ── CFG helper functions ─────────────────────────────────────── */

function updateCfgCounter() {
  let n = 0;
  for (const cat of CFG)
    for (const c of cat.commands) {
      const el = document.getElementById(c.id) as HTMLInputElement | null;
      if (el?.checked) n++;
    }
  const d = document.getElementById("cfg-count");
  if (d) d.textContent = String(n);
}

function collectCfgContent(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 8);
  const theme = THEMES[currentThemeIdx].name;
  const ver = "1.1.2";

  // count active commands
  let totalActive = 0;
  for (const cat of CFG)
    for (const c of cat.commands) {
      const el = document.getElementById(c.id) as HTMLInputElement | null;
      if (el?.checked) totalActive++;
    }

  const W = 60; // banner width
  const border = (ch: string) => ch.repeat(W);
  const center = (txt: string) => {
    const pad = Math.max(0, Math.floor((W - 4 - txt.length) / 2));
    return `// ${" ".repeat(pad)}${txt}`;
  };

  const L: string[] = [
    `//${border("═")}`,
    center("aim.camp Player Agent — CS2 CFG"),
    center(`v${ver}  ·  ${theme} Theme`),
    center(`${date} ${time}  ·  ${totalActive} commands active`),
    `//${border("═")}`,
    "//",
    "// Place this file in your CS2 cfg folder as autoexec.cfg",
    "// Steam › CS2 › Properties › Launch Options: +exec autoexec.cfg",
    "//",
    `// Generated with ❤ by aim.camp Player Agent`,
    "// https://aim.camp",
    "//",
    "",
  ];

  for (const cat of CFG) {
    const cl: { cmd: string; comment: string }[] = [];
    for (const c of cat.commands) {
      const el = document.getElementById(c.id) as HTMLInputElement | null;
      if (!el?.checked) continue;
      let line: string;
      if (c.type === "toggle") {
        line = c.val === "" ? c.cmd : `${c.cmd} ${c.val}`;
      } else {
        const v = (document.getElementById(`${c.id}_v`) as HTMLInputElement | null)?.value || c.val;
        line = c.val === "" && !v ? c.cmd : `${c.cmd} ${v}`;
      }
      // build inline comment from tip (first sentence, max 50 chars)
      const raw = (c.tip || "").split(".")[0].trim();
      const comment = raw.length > 50 ? raw.slice(0, 47) + "..." : raw;
      cl.push({ cmd: line, comment });
    }
    if (cl.length) {
      // category banner
      const tag = ` ${cat.name.toUpperCase()} `;
      const half = Math.max(1, Math.floor((W - 4 - tag.length) / 2));
      L.push(`//${" "}${"─".repeat(half)}${tag}${"─".repeat(W - 4 - half - tag.length)}`, "");
      // find longest command for alignment
      const maxLen = Math.max(...cl.map((x) => x.cmd.length));
      for (const { cmd, comment } of cl) {
        if (comment) {
          const pad = " ".repeat(Math.max(1, maxLen - cmd.length + 2));
          L.push(`${cmd}${pad}// ${comment}`);
        } else {
          L.push(cmd);
        }
      }
      L.push("");
    }
  }

  L.push(`//${border("─")}`, "// End of autoexec.cfg", `//${border("─")}`);
  return L.join("\n");
}

function parseCfgContent(content: string) {
  for (const cat of CFG)
    for (const c of cat.commands) {
      setChecked(c.id, false);
      if (c.type === "value") setVal(`${c.id}_v`, c.val);
    }
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("//")) continue;
    for (const cat of CFG)
      for (const c of cat.commands) {
        const rx = new RegExp(`^${c.cmd.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(.+)$`, "i");
        const m = rx.exec(t);
        if (m) {
          setChecked(c.id, true);
          if (c.type === "value") setVal(`${c.id}_v`, m[1].trim());
        }
      }
  }
  updateCfgCounter();
}

function resetCfgDefaults() {
  for (const cat of CFG)
    for (const c of cat.commands) {
      setChecked(c.id, c.on);
      if (c.type === "value") setVal(`${c.id}_v`, c.val);
    }
  updateCfgCounter();
}

async function saveCfgFile() {
  try {
    const content = collectCfgContent();
    await invoke("save_cfg", { cfgContent: content });
    toast("CFG saved successfully");
  } catch (e) {
    console.error(e);
    toast("Error saving CFG", true);
  }
}

async function loadCfgFile() {
  try {
    const r = await invoke<{ path: string; content: string }>("load_cfg");
    parseCfgContent(r.content);
    toast(`Loaded: ${r.path.split("\\").pop()}`);
  } catch (e) {
    console.error(e);
  }
}

/* ================================================================
   Pro Player Configs
   ================================================================ */
interface ProConfig {
  name: string;
  team: string;
  sens: string;
  dpi: string;
  zoom: string;
  xhStyle: string;
  xhSize: string;
  xhGap: string;
  xhThick: string;
  xhColor: string;
  xhDot: boolean;
  xhOutline: boolean;
  vmFov: string;
  vmX: string;
  vmY: string;
  vmZ: string;
  res: string;
}

const PRO_CONFIGS: ProConfig[] = [
  {
    name: "s1mple",
    team: "NAVI",
    sens: "3.09",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "2",
    xhGap: "-3",
    xhThick: "0",
    xhColor: "1",
    xhDot: false,
    xhOutline: false,
    vmFov: "68",
    vmX: "2.5",
    vmY: "0",
    vmZ: "-1.5",
    res: "1280x960",
  },
  {
    name: "ZywOo",
    team: "Vitality",
    sens: "2",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "1.5",
    xhGap: "-3",
    xhThick: "0",
    xhColor: "1",
    xhDot: false,
    xhOutline: true,
    vmFov: "68",
    vmX: "2.5",
    vmY: "2",
    vmZ: "-2",
    res: "1280x960",
  },
  {
    name: "NiKo",
    team: "G2",
    sens: "1.58",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "3",
    xhGap: "-3",
    xhThick: "0",
    xhColor: "4",
    xhDot: false,
    xhOutline: true,
    vmFov: "68",
    vmX: "0",
    vmY: "0",
    vmZ: "0",
    res: "1920x1080",
  },
  {
    name: "donk",
    team: "Spirit",
    sens: "1.35",
    dpi: "800",
    zoom: "0.9",
    xhStyle: "4",
    xhSize: "1",
    xhGap: "-3",
    xhThick: "0",
    xhColor: "1",
    xhDot: false,
    xhOutline: false,
    vmFov: "68",
    vmX: "2.5",
    vmY: "2",
    vmZ: "-2",
    res: "1280x960",
  },
  {
    name: "m0NESY",
    team: "G2",
    sens: "1.68",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "1.5",
    xhGap: "-3",
    xhThick: "0",
    xhColor: "1",
    xhDot: false,
    xhOutline: true,
    vmFov: "68",
    vmX: "0",
    vmY: "2",
    vmZ: "-2",
    res: "1280x960",
  },
  {
    name: "device",
    team: "Astralis",
    sens: "1.8",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "2",
    xhGap: "-2",
    xhThick: "0",
    xhColor: "1",
    xhDot: false,
    xhOutline: true,
    vmFov: "68",
    vmX: "2.5",
    vmY: "2",
    vmZ: "-2",
    res: "1280x960",
  },
  {
    name: "ropz",
    team: "FaZe",
    sens: "1.77",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "1",
    xhGap: "-3",
    xhThick: "0",
    xhColor: "1",
    xhDot: true,
    xhOutline: false,
    vmFov: "68",
    vmX: "2.5",
    vmY: "0",
    vmZ: "-1.5",
    res: "1920x1080",
  },
  {
    name: "electronic",
    team: "VP",
    sens: "2.2",
    dpi: "400",
    zoom: "1.0",
    xhStyle: "4",
    xhSize: "2",
    xhGap: "-2",
    xhThick: "0",
    xhColor: "5",
    xhDot: false,
    xhOutline: true,
    vmFov: "68",
    vmX: "2",
    vmY: "0",
    vmZ: "-2",
    res: "1280x960",
  },
];

function applyProConfig(p: ProConfig) {
  setVal("cf_sens_v", p.sens);
  setChecked("cf_sens", true);
  setVal("cf_zoom_v", p.zoom);
  setChecked("cf_zoom", true);
  setVal("cf_xhstyle_v", p.xhStyle);
  setChecked("cf_xhstyle", true);
  setVal("cf_xhsize_v", p.xhSize);
  setChecked("cf_xhsize", true);
  setVal("cf_xhgap_v", p.xhGap);
  setChecked("cf_xhgap", true);
  setVal("cf_xhthick_v", p.xhThick);
  setChecked("cf_xhthick", true);
  setVal("cf_xhcolor_v", p.xhColor);
  setChecked("cf_xhcolor", true);
  setChecked("cf_xhdot", p.xhDot);
  setChecked("cf_xhoutline", p.xhOutline);
  setVal("cf_vmfov_v", p.vmFov);
  setChecked("cf_vmfov", true);
  setVal("cf_vmx_v", p.vmX);
  setChecked("cf_vmx", true);
  setVal("cf_vmy_v", p.vmY);
  setChecked("cf_vmy", true);
  setVal("cf_vmz_v", p.vmZ);
  setChecked("cf_vmz", true);
  updateCfgCounter();
  drawCrosshair();
  toast(`Loaded ${p.name} config`);
}

/* ================================================================
   Crosshair Preview
   ================================================================ */
function drawCrosshair() {
  const canvas = document.getElementById("xhair-cvs") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width,
    H = canvas.height;
  const cx = W / 2,
    cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  const gap = Number.parseFloat((document.getElementById("cf_xhgap_v") as HTMLInputElement)?.value || "-1");
  const size = Number.parseFloat((document.getElementById("cf_xhsize_v") as HTMLInputElement)?.value || "2.5");
  const thick = Math.max(1, Number.parseFloat((document.getElementById("cf_xhthick_v") as HTMLInputElement)?.value || "0.5"));
  const dot = (document.getElementById("cf_xhdot") as HTMLInputElement)?.checked || false;
  const outline = (document.getElementById("cf_xhoutline") as HTMLInputElement)?.checked || false;
  const tShape = (document.getElementById("cf_xht") as HTMLInputElement)?.checked || false;

  const colorMap: Record<string, string> = { "0": "#ff0000", "1": "#00ff00", "2": "#ffff00", "3": "#3344ff", "4": "#00ffff", "5": "#ff8800" };
  const colorIdx = (document.getElementById("cf_xhcolor_v") as HTMLInputElement)?.value || "1";
  const color = colorMap[colorIdx] || "#00ff00";

  const s = size * 3;
  const g = (gap + 4) * 1.5;
  const t = thick * 2;

  if (outline) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
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
  "chrome",
  "firefox",
  "msedge",
  "opera",
  "brave",
  "discord",
  "teams",
  "slack",
  "zoom",
  "icue",
  "icue4",
  "corsaircuesvc",
  "razersynapse",
  "synapse3",
  "nzxtcam",
  "asusaura",
  "lghub",
  "lcore",
  "steelseries",
  "obs64",
  "obs",
  "streamlabs",
  "xsplit",
  "onedrive",
  "dropbox",
  "googledrive",
  "mcafee",
  "norton",
  "avast",
  "avg",
  "wallpaperengine",
  "wallpaper32",
  "cortana",
  "widgets",
  "spotify",
  "itunes",
  "epicgameslauncher",
  "galaxyclient",
]);

/* ================================================================
   Network servers to ping (TCP connect — ICMP blocked on gameservers)
   ================================================================ */
const NET_SERVERS = [
  { name: "Valve (Steam API)", host: "api.steampowered.com", port: 443 },
  { name: "Steam Community", host: "steamcommunity.com", port: 443 },
  { name: "Steam CDN", host: "cdn.cloudflare.steamstatic.com", port: 443 },
  { name: "FACEIT (API)", host: "api.faceit.com", port: 443 },
  { name: "FACEIT (Play)", host: "play.faceit.com", port: 443 },
  { name: "Cloudflare (1.1.1.1)", host: "1.1.1.1", port: 443 },
  { name: "Google (8.8.8.8)", host: "8.8.8.8", port: 443 },
  { name: "AWS EU West", host: "s3.eu-west-1.amazonaws.com", port: 443 },
];

/* ================================================================
   Config State — collect / restore SYS+CFG input values
   ================================================================ */
function collectFullState(): Record<string, string | boolean> {
  const s: Record<string, string | boolean> = {};
  document.querySelectorAll<HTMLInputElement>("#tab-optimizer input, #tab-cfg input").forEach((el) => {
    if (!el.id) return;
    if (el.type === "checkbox") s[el.id] = el.checked;
    else s[el.id] = el.value;
  });
  document.querySelectorAll<HTMLTextAreaElement>("#tab-optimizer textarea, #tab-cfg textarea").forEach((el) => {
    if (el.id) s[el.id] = el.value;
  });
  return s;
}

function restoreFullState(s: Record<string, string | boolean>) {
  for (const [id, val] of Object.entries(s)) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) continue;
    if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = val as boolean;
    else el.value = val as string;
  }
  updateImpact();
  updateCfgCounter();
  drawCrosshair();
}

/** Migrate legacy csmooth_profiles to schemas (run once) */
function migrateProfilesToSchemas(): void {
  const raw = localStorage.getItem("csmooth_profiles");
  if (!raw) return;
  try {
    const profiles: Record<string, Record<string, string | boolean>> = JSON.parse(raw);
    for (const [name, values] of Object.entries(profiles)) {
      // Check if a schema with this name already exists
      const existing = getSchemas().find((s) => s.name === name);
      if (existing) {
        // Merge values into existing schema
        existing.values = values;
        existing.updatedAt = new Date().toISOString();
        const schemas = getSchemas();
        const idx = schemas.findIndex((s) => s.id === existing.id);
        if (idx >= 0) { schemas[idx] = existing; saveSchemas(schemas); }
      } else {
        // Create new schema from profile
        const s = createSchema(name);
        saveSchemaValues(s.id, values);
        // If no active schema, activate the first migrated one
        if (!getActiveSchemaId()) setActiveSchemaId(s.id);
      }
    }
    // Remove old profiles key
    localStorage.removeItem("csmooth_profiles");
  } catch { /* ignore bad data */ }
}

// Run migration on load
migrateProfilesToSchemas();

/* ================================================================
   HW / PROC / NET tab builders (called from build)
   ================================================================ */

function hwRow(label: string, value: string): HTMLDivElement {
  const r = document.createElement("div");
  r.className = "hw-row";
  r.innerHTML = `<span class="hw-label">${label}</span><span class="hw-value">${value}</span>`;
  return r;
}

function hwStatus(label: string, state: string): HTMLDivElement {
  const r = document.createElement("div");
  r.className = "hw-row";
  let cls: string;
  if (state === "ON") cls = "on";
  else if (state === "OFF") cls = "off";
  else cls = "unknown";
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

interface DriverUpdate {
  title: string;
  description: string;
  driver_model: string;
  driver_ver: string;
  driver_class: string;
  driver_mfr: string;
  hw_ids: string[];
  update_id: string;
  size_mb: number;
  download_url: string;
  is_mandatory: boolean;
}

interface ScriptReport {
  status: string;
  duration_secs: number;
  sections_run: number;
  commands_run: number;
  errors: string[];
  start_time: string;
  end_time: string;
}

const DRV_CATEGORY_ICONS: Record<string, string> = {
  GPU: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h4v4H6z"/><circle cx="16" cy="12" r="2"/></svg>',
  Monitor:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  Audio:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  Network:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  Mouse:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="7" x2="12" y2="11"/></svg>',
  Keyboard:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>',
  Controller:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="16" height="8" rx="4"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/></svg>',
};

const DRV_CATEGORY_LABELS: Record<string, string> = {
  GPU: "Graphics Card (GPU)",
  Monitor: "Monitor",
  Audio: "Audio",
  Network: "Network",
  Mouse: "Mouse",
  Keyboard: "Keyboard",
  Controller: "Game Controller",
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
  { value: "bug", label: "🐛 Bug / Error", color: "#ef4444" },
  { value: "feature", label: "💡 Suggestion / Feature", color: "#3b82f6" },
  { value: "ui", label: "🎨 Interface / UI", color: "#a855f7" },
  { value: "perf", label: "⚡ Performance", color: "#f59e0b" },
  { value: "other", label: "📝 Other", color: "#6b7280" },
];

function getCurrentTabName(): string {
  const active = document.querySelector(".sidebar-btn.active span");
  return active?.textContent || "SYS";
}

let feedbackScreenshotB64 = "";

async function captureAppScreenshot(): Promise<string> {
  try {
    const b64: string = await invoke("capture_screenshot");
    return b64;
  } catch (e) {
    console.warn("Screenshot capture failed:", e);
    return "";
  }
}

function showFeedbackModal(preScreenshot?: string) {
  const existing = document.querySelector(".fdbk-overlay");
  if (existing) existing.remove();

  const currentTab = getCurrentTabName();
  feedbackScreenshotB64 = preScreenshot || "";

  const overlay = document.createElement("div");
  overlay.className = "fdbk-overlay";

  overlay.innerHTML = `
    <div class="fdbk-modal">
      <div class="fdbk-modal-header">
        <h3>📝 New Suggestion / Feedback</h3>
        <button class="fdbk-close" id="fdbk-close">&times;</button>
      </div>

      <div class="fdbk-modal-body">
        <div class="fdbk-screenshot-area" id="fdbk-screenshot-area">
          ${
            feedbackScreenshotB64
              ? `<img src="data:image/png;base64,${feedbackScreenshotB64}" class="fdbk-screenshot-preview" />`
              : '<div class="fdbk-screenshot-placeholder">📷 Capturing screenshot...</div>'
          }
        </div>

        <div class="fdbk-form">
          <label class="fdbk-label">Category</label>
          <select id="fdbk-category" class="fdbk-select">
            ${FEEDBACK_CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join("")}
          </select>

          <label class="fdbk-label">Current Tab</label>
          <input type="text" id="fdbk-tab" class="fdbk-input" value="${currentTab}" readonly />

          <label class="fdbk-label">Description</label>
          <textarea id="fdbk-desc" class="fdbk-textarea" rows="5" placeholder="Describe the issue, suggestion or feedback...\n\nExample: Button X does not work when..."></textarea>

          <div class="fdbk-actions">
            <button class="fdbk-btn fdbk-btn-save" id="fdbk-save">💾 Save Locally</button>
            <button class="fdbk-btn fdbk-btn-discord" id="fdbk-send-discord">🎮 Send to Discord</button>
            <button class="fdbk-btn fdbk-btn-github" id="fdbk-send-github">🐙 Send to GitHub</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // If no screenshot yet, capture it now
  if (!feedbackScreenshotB64) {
    captureAppScreenshot().then((b64) => {
      feedbackScreenshotB64 = b64;
      const area = document.getElementById("fdbk-screenshot-area");
      if (area && b64) {
        area.innerHTML = `<img src="data:image/png;base64,${b64}" class="fdbk-screenshot-preview" />`;
      } else if (area) {
        area.innerHTML = '<div class="fdbk-screenshot-placeholder">⚠ Could not capture screenshot</div>';
      }
    });
  }

  // Close handlers
  document.getElementById("fdbk-close")!.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Save locally
  document.getElementById("fdbk-save")!.addEventListener("click", async () => {
    const desc = (document.getElementById("fdbk-desc") as HTMLTextAreaElement).value.trim();
    const cat = (document.getElementById("fdbk-category") as HTMLSelectElement).value;
    const tab = (document.getElementById("fdbk-tab") as HTMLInputElement).value;
    if (!desc) {
      toast("Please write a description");
      return;
    }

    const id = crypto.randomUUID();
    try {
      await invoke("save_feedback", {
        id,
        tab: `[${cat}] ${tab}`,
        description: desc,
        screenshotB64: feedbackScreenshotB64,
        sent: "local",
      });
      toast("✅ Feedback saved locally");
      overlay.remove();
      refreshFeedbackHistory();
    } catch (e) {
      toast(`Error saving: ${e}`);
    }
  });

  // Send to Discord
  document.getElementById("fdbk-send-discord")!.addEventListener("click", async () => {
    const desc = (document.getElementById("fdbk-desc") as HTMLTextAreaElement).value.trim();
    const cat = (document.getElementById("fdbk-category") as HTMLSelectElement).value;
    const tab = (document.getElementById("fdbk-tab") as HTMLInputElement).value;
    if (!desc) {
      toast("Please write a description");
      return;
    }

    const wh = getDiscordWebhook();
    if (!wh) {
      showDiscordModal(() => toast("Webhook saved. Try sending again."));
      return;
    }

    const id = crypto.randomUUID();
    const fullDesc = `**[${FEEDBACK_CATEGORIES.find((c) => c.value === cat)?.label || cat}]** Tab: ${tab}\n\n${desc}`;

    try {
      const btn = document.getElementById("fdbk-send-discord") as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = "⏳ Sending...";

      await invoke("send_feedback_discord_with_image", {
        webhookUrl: wh,
        description: fullDesc,
        tab,
        screenshotB64: feedbackScreenshotB64,
      });

      // Also save locally
      await invoke("save_feedback", {
        id,
        tab: `[${cat}] ${tab}`,
        description: desc,
        screenshotB64: feedbackScreenshotB64,
        sent: "discord",
      });

      toast("✅ Feedback sent to Discord!");
      overlay.remove();
      refreshFeedbackHistory();
    } catch (e) {
      toast(`Discord error: ${e}`);
      const btn = document.getElementById("fdbk-send-discord") as HTMLButtonElement;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🎮 Send to Discord";
      }
    }
  });

  // Send to GitHub
  document.getElementById("fdbk-send-github")!.addEventListener("click", async () => {
    const desc = (document.getElementById("fdbk-desc") as HTMLTextAreaElement).value.trim();
    const cat = (document.getElementById("fdbk-category") as HTMLSelectElement).value;
    const tab = (document.getElementById("fdbk-tab") as HTMLInputElement).value;
    if (!desc) {
      toast("Please write a description");
      return;
    }

    const token = localStorage.getItem("csmooth_github_token") || "";
    const repo = localStorage.getItem("csmooth_github_repo") || "";
    if (!token || !repo) {
      showGitHubConfigModal();
      return;
    }

    const id = crypto.randomUUID();
    const catLabel = FEEDBACK_CATEGORIES.find((c) => c.value === cat)?.label || cat;
    const title = `[${catLabel}] ${desc.substring(0, 80)}`;
    const body = `## Feedback — Player Agent\n\n**Category:** ${catLabel}\n**Tab:** ${tab}\n**Date:** ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n\n### Description\n${desc}\n\n---\n*Sent automatically by Player Agent*`;

    try {
      const btn = document.getElementById("fdbk-send-github") as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = "⏳ Creating issue...";

      await invoke("send_feedback_github", {
        token,
        repo,
        title,
        body,
        screenshotB64: feedbackScreenshotB64,
        labels: ["feedback", cat],
      });

      await invoke("save_feedback", {
        id,
        tab: `[${cat}] ${tab}`,
        description: desc,
        screenshotB64: feedbackScreenshotB64,
        sent: "github",
      });

      toast("✅ Issue created on GitHub!");
      overlay.remove();
      refreshFeedbackHistory();
    } catch (e) {
      toast(`GitHub error: ${e}`);
      const btn = document.getElementById("fdbk-send-github") as HTMLButtonElement;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🐙 Send to GitHub";
      }
    }
  });
}

function showGitHubConfigModal() {
  const existing = document.querySelector(".gh-overlay");
  if (existing) existing.remove();

  const token = localStorage.getItem("csmooth_github_token") || "";
  const repo = localStorage.getItem("csmooth_github_repo") || "";

  const overlay = document.createElement("div");
  overlay.className = "gh-overlay";
  overlay.innerHTML = `
    <div class="adv-modal">
      <h3>🐙 GitHub Configuration</h3>
      <label>Personal Access Token</label>
      <input type="password" id="gh-token" value="${token}" placeholder="ghp_xxxxxxxxxxxx" />
      <label>Repository (owner/repo)</label>
      <input type="text" id="gh-repo" value="${repo}" placeholder="username/aim.camp" />
      <div style="font-size:9px;opacity:0.4;margin-top:6px;">
        Create a <a href="#" id="gh-link" style="color:var(--primary);text-decoration:underline;">Personal Access Token</a> on GitHub with "repo" → Issues permission.
      </div>
      <div class="adv-modal-actions">
        <button class="adv-cancel" id="gh-cancel">Cancel</button>
        <button class="adv-save" id="gh-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("gh-cancel")!.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("gh-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    shellOpen("https://github.com/settings/tokens/new?scopes=repo&description=PlayerAgent+Feedback");
  });

  document.getElementById("gh-save")!.addEventListener("click", () => {
    const t = (document.getElementById("gh-token") as HTMLInputElement).value.trim();
    const r = (document.getElementById("gh-repo") as HTMLInputElement).value.trim();
    if (t) localStorage.setItem("csmooth_github_token", t);
    if (r) localStorage.setItem("csmooth_github_repo", r);
    overlay.remove();
    toast("GitHub configured!");
  });
}

async function refreshFeedbackHistory() {
  const el = document.getElementById("fdbk-history");
  if (!el) return;

  try {
    const entries = await invoke<FeedbackEntry[]>("load_feedback_history");

    if (!entries || entries.length === 0) {
      el.innerHTML = `
        <div class="fdbk-empty">
          <div class="fdbk-empty-icon">📝</div>
          <div class="fdbk-empty-text">No feedback recorded</div>
          <div class="fdbk-empty-hint">Right-click anywhere in the app to send suggestions, or use the button below.</div>
        </div>`;
      return;
    }

    // Sort newest first
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    el.innerHTML = `<div class="fdbk-count">${entries.length} feedback${entries.length === 1 ? "" : "s"} recorded</div>`;

    for (const entry of entries) {
      const card = document.createElement("div");
      card.className = "fdbk-card";

      let sentBadge: string;
      if (entry.sent === "discord") sentBadge = '<span class="fdbk-sent-badge discord">🎮 Discord</span>';
      else if (entry.sent === "github") sentBadge = '<span class="fdbk-sent-badge github">🐙 GitHub</span>';
      else sentBadge = '<span class="fdbk-sent-badge local">💾 Local</span>';

      const dateStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "N/A";

      card.innerHTML = `
        <div class="fdbk-card-header">
          <span class="fdbk-card-tab">${entry.tab}</span>
          ${sentBadge}
          <span class="fdbk-card-date">${dateStr}</span>
          <button class="fdbk-card-delete" data-id="${entry.id}" title="Delete">🗑</button>
        </div>
        ${entry.screenshot_b64 ? `<img src="data:image/png;base64,${entry.screenshot_b64}" class="fdbk-card-thumb" loading="lazy" />` : ""}
        <div class="fdbk-card-desc">${entry.description}</div>
      `;
      el.appendChild(card);

      // Delete handler
      card.querySelector(".fdbk-card-delete")?.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).dataset.id;
        if (!id) return;
        try {
          await invoke("delete_feedback", { id });
          toast("Feedback deleted");
          refreshFeedbackHistory();
        } catch (e) {
          toast(`Error deleting: ${e}`);
        }
      });

      // Click to resend
      card.addEventListener("click", () => {
        showFeedbackModal(entry.screenshot_b64);
        const descField = document.getElementById("fdbk-desc") as HTMLTextAreaElement;
        if (descField) descField.value = entry.description;
      });
    }
  } catch (e) {
    el.innerHTML = `<div class="fdbk-empty"><div class="fdbk-empty-text"></div></div>`;
    const errText = el.querySelector(".fdbk-empty-text");
    if (errText) errText.textContent = `Error loading history: ${str(e)}`;
  }
}

/* Right-click context menu for feedback */
function setupFeedbackContextMenu() {
  let ctxMenu: HTMLElement | null = null;

  function removeMenu() {
    if (ctxMenu) {
      ctxMenu.remove();
      ctxMenu = null;
    }
  }

  document.addEventListener("contextmenu", (e) => {
    // Don't override on inputs/textareas
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
    if (target.closest(".fdbk-overlay") || target.closest(".fdbk-context-menu")) return;

    e.preventDefault();
    removeMenu();

    ctxMenu = document.createElement("div");
    ctxMenu.className = "fdbk-context-menu";
    ctxMenu.innerHTML = `
      <div class="fdbk-ctx-item" id="fdbk-ctx-suggest">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>📝 Send Suggestion</span>
      </div>
      <div class="fdbk-ctx-item" id="fdbk-ctx-bug">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>🐛 Report Bug</span>
      </div>
    `;

    // Position
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;

    document.body.appendChild(ctxMenu);

    ctxMenu.querySelector("#fdbk-ctx-suggest")?.addEventListener("click", async () => {
      removeMenu();
      const b64 = await captureAppScreenshot();
      showFeedbackModal(b64);
      // Pre-select "feature"
      const sel = document.getElementById("fdbk-category") as HTMLSelectElement;
      if (sel) sel.value = "feature";
    });

    ctxMenu.querySelector("#fdbk-ctx-bug")?.addEventListener("click", async () => {
      removeMenu();
      const b64 = await captureAppScreenshot();
      showFeedbackModal(b64);
      // Pre-select "bug"
      const sel = document.getElementById("fdbk-category") as HTMLSelectElement;
      if (sel) sel.value = "bug";
    });

    // Close on click outside
    setTimeout(() => {
      const handler = (ev: MouseEvent) => {
        if (ctxMenu && !ctxMenu.contains(ev.target as Node)) {
          removeMenu();
          document.removeEventListener("click", handler);
        }
      };
      document.addEventListener("click", handler);
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

let _currentBenchResult: BenchmarkResult | null = null;
const benchHistory: BenchmarkResult[] = [];

function drawFrametimeChart(canvas: HTMLCanvasElement, result: BenchmarkResult, mode: "frametime" | "fps" = "frametime") {
  const ctx = canvas.getContext("2d");
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

  const data = mode === "fps" ? result.fps_values : result.frametimes;
  const ts = result.timestamps;
  if (data.length === 0) return;

  // Find range
  const sorted = [...data].sort((a, b) => a - b);
  const yMin = 0;
  // Use P99.5 as max to avoid extreme outliers dominating the chart
  const p995idx = Math.floor(data.length * 0.995);
  const yMax = sorted[Math.min(p995idx, sorted.length - 1)] * 1.15;
  const tMin = ts[0] || 0;
  const tMax = ts.at(-1) || 1;

  // Background
  ctx.fillStyle = "rgba(10,10,18,0.95)";
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 0.5;
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = pad.top + (ph * i) / gridSteps;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + pw, y);
    ctx.stroke();
    // Label
    const val = yMax - ((yMax - yMin) * i) / gridSteps;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(mode === "fps" ? 0 : 1) + (mode === "fps" ? "" : "ms"), pad.left - 4, y + 3);
  }

  // Time labels
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const x = pad.left + (pw * i) / 5;
    const t = tMin + ((tMax - tMin) * i) / 5;
    ctx.fillText(t.toFixed(1) + "s", x, h - 6);
  }

  // Average line
  const avgVal = mode === "fps" ? result.avg_fps : result.avg_frametime;
  const avgY = pad.top + ph * (1 - (avgVal - yMin) / (yMax - yMin));
  if (avgY > pad.top && avgY < pad.top + ph) {
    ctx.strokeStyle = "rgba(0,255,170,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, avgY);
    ctx.lineTo(pad.left + pw, avgY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0,255,170,0.5)";
    ctx.textAlign = "left";
    ctx.fillText(`avg ${avgVal.toFixed(mode === "fps" ? 0 : 1)}`, pad.left + pw + 2, avgY + 3);
  }

  // 1% low line (for FPS mode)
  if (mode === "fps") {
    const p1Y = pad.top + ph * (1 - (result.p1_fps - yMin) / (yMax - yMin));
    if (p1Y > pad.top && p1Y < pad.top + ph) {
      ctx.strokeStyle = "rgba(255,107,107,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, p1Y);
      ctx.lineTo(pad.left + pw, p1Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,107,107,0.5)";
      ctx.fillText(`1% low ${result.p1_fps.toFixed(0)}`, pad.left + pw + 2, p1Y + 3);
    }
  }

  // Data line
  ctx.strokeStyle = mode === "fps" ? "rgba(0,180,255,0.85)" : "rgba(255,180,60,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + ((ts[i] - tMin) / (tMax - tMin)) * pw;
    const y = pad.top + ph * (1 - (Math.min(data[i], yMax) - yMin) / (yMax - yMin));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Stutter highlights (frametime mode)
  if (mode === "frametime") {
    const threshold = result.avg_frametime * 2.5;
    ctx.fillStyle = "rgba(255,60,60,0.25)";
    for (let i = 0; i < data.length; i++) {
      if (data[i] > threshold) {
        const x = pad.left + ((ts[i] - tMin) / (tMax - tMin)) * pw;
        ctx.fillRect(x - 1, pad.top, 2, ph);
      }
    }
  }

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px JetBrains Mono, monospace";
  ctx.textAlign = "left";
  ctx.fillText(mode === "fps" ? "FPS over time" : "Frame Time (ms) over time", pad.left, pad.top - 6);
}

function drawFpsHistogram(canvas: HTMLCanvasElement, result: BenchmarkResult) {
  const ctx = canvas.getContext("2d");
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
  ctx.fillStyle = "rgba(10,10,18,0.95)";
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

    if (isLow) ctx.fillStyle = "rgba(255,107,107,0.6)";
    else if (isAvg) ctx.fillStyle = "rgba(0,255,170,0.6)";
    else ctx.fillStyle = "rgba(0,150,255,0.4)";
    ctx.fillRect(x, y, barW, barH);
  }

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "9px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const fps = fpsMin + ((fpsMax - fpsMin) * i) / 5;
    const x = pad.left + (i / 5) * pw;
    ctx.fillText(fps.toFixed(0) + " fps", x, h - 6);
  }

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "left";
  ctx.fillText("FPS Distribution", pad.left, pad.top - 6);
}

async function importBenchmarkFile() {
  try {
    const path = await invoke<string>("pick_benchmark_file");
    const result = await invoke<BenchmarkResult>("parse_benchmark_file", { path });
    _currentBenchResult = result;
    benchHistory.push(result);
    displayBenchmarkResult(result);
    toast(`Benchmark loaded: ${result.file_name}`);
  } catch (e) {
    if (String(e) !== "Cancelled") toast(`Error: ${e}`, true);
  }
}

async function scanCapFrameX() {
  try {
    const files = await invoke<string[]>("scan_capframex_folder");
    if (files.length === 0) {
      toast("CapFrameX not found or no captures");
      return;
    }
    showCapFrameXPicker(files);
  } catch (e) {
    toast(`Error: ${e}`, true);
  }
}

function showCapFrameXPicker(files: string[]) {
  const existing = document.querySelector(".cx-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "cx-overlay fdbk-overlay";
  overlay.innerHTML = `
    <div class="fdbk-modal" style="max-height:80vh;">
      <div class="fdbk-modal-header">
        <h3>CapFrameX Captures (${files.length})</h3>
        <button class="fdbk-close" id="cx-close">&times;</button>
      </div>
      <div class="fdbk-modal-body" style="max-height:60vh;overflow-y:auto;">
        ${files
          .map((f) => {
            const name = f.split("\\").pop() || f;
            return `<div class="cx-file-item" data-path="${f}" title="${f}">${name}</div>`;
          })
          .join("")}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById("cx-close")!.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelectorAll(".cx-file-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const path = (el as HTMLElement).dataset.path;
      if (!path) return;
      overlay.remove();
      try {
        const result = await invoke<BenchmarkResult>("parse_benchmark_file", { path });
        _currentBenchResult = result;
        benchHistory.push(result);
        displayBenchmarkResult(result);
        toast(`Benchmark loaded: ${result.file_name}`);
      } catch (e) {
        toast(`Error parsing: ${e}`, true);
      }
    });
  });
}

function stutterCls(pct: number): string {
  if (pct > 2) return "bad";
  if (pct > 0.5) return "warn";
  return "";
}

function displayBenchmarkResult(r: BenchmarkResult) {
  const el = document.getElementById("bench-content");
  if (!el) return;

  el.innerHTML = "";

  // Header info
  const info = document.createElement("div");
  info.className = "bench-info";
  info.innerHTML = `
    <span class="bench-info-label">📂 ${r.file_name}</span>
    <span class="bench-info-process">🎮 ${r.process_name}</span>
    <span class="bench-info-duration">⏱ ${r.duration_secs.toFixed(1)}s</span>
    <span class="bench-info-frames">${r.frame_count.toLocaleString()} frames</span>
  `;
  el.appendChild(info);

  // Metrics grid
  const metrics = document.createElement("div");
  metrics.className = "bench-metrics";

  const metricItems = [
    { label: "AVG FPS", value: r.avg_fps.toFixed(1), cls: "primary" },
    { label: "1% LOW", value: r.p1_fps.toFixed(1), cls: r.p1_fps < r.avg_fps * 0.5 ? "bad" : "warn" },
    { label: "0.1% LOW", value: r.p01_fps.toFixed(1), cls: r.p01_fps < r.avg_fps * 0.3 ? "bad" : "warn" },
    { label: "MEDIAN", value: r.median_fps.toFixed(1), cls: "" },
    { label: "MAX", value: r.max_fps.toFixed(0), cls: "" },
    { label: "MIN", value: r.min_fps.toFixed(0), cls: r.min_fps < 30 ? "bad" : "" },
    { label: "AVG FT", value: r.avg_frametime.toFixed(2) + "ms", cls: "" },
    { label: "P99 FT", value: r.p99_frametime.toFixed(2) + "ms", cls: r.p99_frametime > 33.3 ? "bad" : "" },
    { label: "STUTTERS", value: `${r.stutter_count} (${r.stutter_pct.toFixed(1)}%)`, cls: stutterCls(r.stutter_pct) },
    { label: "DROPPED", value: `${r.dropped_frames}`, cls: r.dropped_frames > 0 ? "warn" : "" },
  ];

  for (const m of metricItems) {
    const card = document.createElement("div");
    card.className = `bench-metric-card ${m.cls}`;
    card.innerHTML = `<div class="bench-metric-val">${m.value}</div><div class="bench-metric-label">${m.label}</div>`;
    metrics.appendChild(card);
  }
  el.appendChild(metrics);

  // CS2 context assessment
  const assessment = document.createElement("div");
  assessment.className = "bench-assessment";
  const tips: string[] = [];
  if (r.avg_fps >= 300) tips.push("✅ Excellent! Average FPS above 300 — ideal for 240Hz+ monitors.");
  else if (r.avg_fps >= 200) tips.push("👍 Good performance. Average FPS suitable for 144Hz-240Hz monitors.");
  else if (r.avg_fps >= 144) tips.push("⚠ Average FPS ok for 144Hz, but you may feel drops during intense fights.");
  else tips.push("🔴 Average FPS too low for competitive CS2. Consider lowering graphics settings.");

  if (r.p1_fps < r.avg_fps * 0.4) tips.push("⚠ 1% Low well below the average — indicates significant micro-stutters.");
  if (r.stutter_pct > 2) tips.push("🔴 High stutter rate (>" + r.stutter_pct.toFixed(1) + "%). Check background processes and drivers.");
  if (r.stutter_pct <= 0.5 && r.p1_fps > r.avg_fps * 0.6) tips.push("✅ Consistent frame pacing — smooth experience.");
  if (r.dropped_frames > 5) tips.push("⚠ Dropped frames detected — may indicate GPU bottleneck or VSync issues.");

  assessment.innerHTML = `<div class="bench-assessment-title">🎮 CS2 Analysis</div>` + tips.map((t) => `<div class="bench-tip">${t}</div>`).join("");
  el.appendChild(assessment);

  // Chart mode toggle
  const chartControls = document.createElement("div");
  chartControls.className = "bench-chart-controls";
  chartControls.innerHTML = `
    <button class="bench-chart-btn active" data-mode="frametime">Frame Time</button>
    <button class="bench-chart-btn" data-mode="fps">FPS</button>
  `;
  el.appendChild(chartControls);

  // Frame time chart
  const chartCanvas = document.createElement("canvas");
  chartCanvas.className = "bench-chart-canvas";
  chartCanvas.style.cssText = "width:100%;height:200px;border-radius:6px;";
  el.appendChild(chartCanvas);

  // FPS histogram
  const histCanvas = document.createElement("canvas");
  histCanvas.className = "bench-hist-canvas";
  histCanvas.style.cssText = "width:100%;height:140px;border-radius:6px;margin-top:8px;";
  el.appendChild(histCanvas);

  // Draw initial charts
  requestAnimationFrame(() => {
    drawFrametimeChart(chartCanvas, r, "frametime");
    drawFpsHistogram(histCanvas, r);
  });

  // Chart mode toggle handlers
  chartControls.querySelectorAll(".bench-chart-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      chartControls.querySelectorAll(".bench-chart-btn").forEach((b) => { b.classList.remove("active"); });
      btn.classList.add("active");
      const mode = (btn as HTMLElement).dataset.mode as "frametime" | "fps";
      drawFrametimeChart(chartCanvas, r, mode);
    });
  });

  // Comparison section (if multiple benchmarks)
  if (benchHistory.length > 1) {
    const cmpDiv = document.createElement("div");
    cmpDiv.className = "bench-comparison";
    cmpDiv.innerHTML = `<div class="bench-assessment-title">📊 Comparison (${benchHistory.length} captures)</div>`;

    const cmpTable = document.createElement("table");
    cmpTable.className = "drv-table";
    cmpTable.innerHTML = `
      <thead><tr><th>File</th><th>Process</th><th>AVG FPS</th><th>1% Low</th><th>0.1% Low</th><th>Stutters</th><th>Duration</th></tr></thead>
      <tbody>${benchHistory
        .map(
          (b) => `
        <tr>
          <td class="drv-device">${b.file_name}</td>
          <td>${b.process_name}</td>
          <td class="bench-metric-val">${b.avg_fps.toFixed(1)}</td>
          <td>${b.p1_fps.toFixed(1)}</td>
          <td>${b.p01_fps.toFixed(1)}</td>
          <td>${b.stutter_count} (${b.stutter_pct.toFixed(1)}%)</td>
          <td>${b.duration_secs.toFixed(1)}s</td>
        </tr>`,
        )
        .join("")}
      </tbody>
    `;
    cmpDiv.appendChild(cmpTable);
    el.appendChild(cmpDiv);
  }
}

async function refreshDriverInfo() {
  const el = document.getElementById("drv-content");
  if (!el) return;
  el.innerHTML = '<div class="net-status">Analyzing system drivers and peripherals...</div>';
  try {
    const drivers = await invoke<DriverEntry[]>("get_driver_info");
    el.innerHTML = '<div class="net-status">Checking for available updates...</div>';

    // Fetch available updates in parallel
    let updates: DriverUpdate[] = [];
    try {
      const uResult = await invoke<{ available: DriverUpdate[]; error: string | null }>("check_driver_updates");
      if (uResult.available) updates = uResult.available;
    } catch { /* non-fatal */ }

    el.innerHTML = "";

    // Summary stats
    const totalCount = drivers.length;
    const genericCount = drivers.filter((d) => d.is_generic).length;
    const outdatedCount = drivers.filter((d) => d.status === "outdated").length;
    const agingCount = drivers.filter((d) => d.status === "aging").length;
    const currentCount = drivers.filter((d) => d.status === "current").length;

    const summary = document.createElement("div");
    summary.className = "drv-summary";
    summary.innerHTML = `
      <div class="drv-summary-item"><span class="drv-summary-val">${totalCount}</span><span class="drv-summary-label">Total</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${genericCount > 0 ? " warn" : ""}">${genericCount}</span><span class="drv-summary-label">Generic</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${outdatedCount > 0 ? " bad" : ""}">${outdatedCount}</span><span class="drv-summary-label">Outdated</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${agingCount > 0 ? " warn" : ""}">${agingCount}</span><span class="drv-summary-label">&gt;6 months</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val">${currentCount}</span><span class="drv-summary-label">Current</span></div>
      <div class="drv-summary-item"><span class="drv-summary-val${updates.length > 0 ? " good" : ""}">${updates.length}</span><span class="drv-summary-label">Updates</span></div>
    `;
    el.appendChild(summary);

    // Gaming-specific recommendations
    const tips: string[] = [];
    const gpuDrivers = drivers.filter((d) => d.category === "GPU");
    const mouseDrivers = drivers.filter((d) => d.category === "Mouse");
    const audioDrivers = drivers.filter((d) => d.category === "Audio");
    const netDrivers = drivers.filter((d) => d.category === "Network");

    for (const gd of gpuDrivers) {
      if (gd.is_generic) tips.push("⚠ Your GPU uses a <b>generic Microsoft</b> driver. Install the official NVIDIA/AMD driver for the best CS2 performance.");
      if (gd.status === "outdated") tips.push("⚠ GPU driver is <b>over 1 year old</b>. Consider updating to the latest Game Ready version for CS2.");
      if (gd.driver_provider?.toLowerCase().includes("nvidia") && gd.status !== "current")
        tips.push("💡 For NVIDIA: use <b>GeForce Experience</b> or <b>nvidia.com/drivers</b> to get Game Ready drivers optimized for CS2.");
      if (gd.driver_provider?.toLowerCase().includes("amd") && gd.status !== "current")
        tips.push("💡 For AMD: use <b>AMD Adrenalin</b> to install optimized drivers. Enable <b>Anti-Lag</b> for CS2.");
    }
    for (const md of mouseDrivers) {
      if (md.is_generic) tips.push(`⚠ Mouse "<b>${md.device_name}</b>" uses a generic driver. Install the manufacturer's software for correct polling rate and DPI.`);
    }
    for (const ad of audioDrivers) {
      if (ad.is_generic)
        tips.push(`💡 Audio device "<b>${ad.device_name}</b>" uses a generic driver. For lower audio latency, install the manufacturer's driver (e.g., Realtek HD Audio, SteelSeries Sonar).`);
    }
    for (const nd of netDrivers) {
      if (nd.is_generic) tips.push(`💡 Network adapter "<b>${nd.device_name}</b>" uses a generic driver. The manufacturer's driver (Intel, Realtek, Killer) can improve network latency.`);
    }
    if (genericCount === 0 && outdatedCount === 0) tips.push("✅ Excellent! All your drivers are from the manufacturer and up to date. Your setup is optimized.");

    if (tips.length > 0) {
      const tipsDiv = document.createElement("div");
      tipsDiv.className = "drv-tips";
      tipsDiv.innerHTML = `<div class="drv-tips-header">🎮 CS2 Recommendations</div>` + tips.map((t) => `<div class="drv-tip-item">${t}</div>`).join("");
      el.appendChild(tipsDiv);
    }

    // Group by category
    const groups: Record<string, DriverEntry[]> = {};
    for (const d of drivers) {
      if (!groups[d.category]) groups[d.category] = [];
      groups[d.category].push(d);
    }

    const grid = document.createElement("div");
    grid.className = "drv-grid";

    const catOrder = ["GPU", "Monitor", "Audio", "Network", "Mouse", "Keyboard", "Controller"];
    for (const cat of catOrder) {
      const items = groups[cat];
      if (!items || items.length === 0) continue;

      const catDiv = document.createElement("div");
      catDiv.className = "drv-category";
      const hasIssues = items.some((d) => d.is_generic || d.status === "outdated");
      if (hasIssues) catDiv.classList.add("drv-cat-issue");

      const catHeader = document.createElement("div");
      catHeader.className = "drv-category-header";
      catHeader.innerHTML = `<span class="drv-cat-icon">${DRV_CATEGORY_ICONS[cat] || ""}</span><span class="drv-cat-name">${DRV_CATEGORY_LABELS[cat] || cat}</span>${hasIssues ? '<span class="drv-cat-warn">⚠</span>' : '<span class="drv-cat-ok">✔</span>'}<span class="drv-cat-count">${items.length}</span>`;
      catDiv.appendChild(catHeader);

      /* ── Device cards ── */
      const devicesWrap = document.createElement("div");
      devicesWrap.className = "drv-devices";
      for (const d of items) {
        const devCard = document.createElement("div");
        devCard.className = "drv-device-card";
        if (d.is_generic || d.status === "outdated") devCard.classList.add("drv-dev-warn");
        if (d.status === "current" && !d.is_generic) devCard.classList.add("drv-dev-ok");

        const typeBadge = d.is_generic ? '<span class="drv-badge generic">Generic</span>' : '<span class="drv-badge manufacturer">OEM</span>';

        let statusBadge = '<span class="drv-badge unknown">?</span>';
        if (d.status === "current") statusBadge = '<span class="drv-badge current">Current</span>';
        if (d.status === "aging") statusBadge = '<span class="drv-badge aging">&gt;6m</span>';
        if (d.status === "outdated") statusBadge = '<span class="drv-badge outdated">Outdated</span>';

        const signedHtml = d.is_signed ? '<span class="drv-signed yes">✓ Signed</span>' : '<span class="drv-signed no">✗ Not Signed</span>';

        // Match available update to this device
        const devNameLower = d.device_name.toLowerCase();
        const matchedUpdate = updates.find((u) => {
          const modelLower = (u.driver_model || u.title || "").toLowerCase();
          return modelLower.includes(devNameLower) || devNameLower.includes(modelLower) ||
            (u.driver_mfr && d.manufacturer && u.driver_mfr.toLowerCase().includes(d.manufacturer.toLowerCase()) &&
             u.driver_class && d.category && u.driver_class.toLowerCase().includes(d.category.toLowerCase()));
        });

        let updateHtml = "";
        if (matchedUpdate) {
          const dlLink = matchedUpdate.download_url
            ? `<a class="drv-update-link" href="#" title="Open download page"
                onclick="event.preventDefault(); window.__TAURI__?.shell?.open?.('${matchedUpdate.download_url}') || window.open('${matchedUpdate.download_url}','_blank')">⬇ Download</a>`
            : "";
          const sizeTxt = matchedUpdate.size_mb > 0 ? ` (${matchedUpdate.size_mb} MB)` : "";
          updateHtml = `
            <div class="drv-update-row" title="${matchedUpdate.title}\n${matchedUpdate.description}">
              <span class="drv-badge current">⬆ Update</span>
              <span class="drv-update-title">${matchedUpdate.title}${sizeTxt}</span>
              ${dlLink}
              <button class="drv-install-btn" data-update-id="${matchedUpdate.update_id}" title="Install driver in background (requires Admin)">⚡ Install</button>
            </div>`;
        }

        devCard.innerHTML = `
          <div class="drv-dev-top">
            ${typeBadge}${statusBadge}
            <span class="drv-dev-name" title="${d.device_name}">${d.device_name}</span>
          </div>
          <div class="drv-dev-details">
            <span class="drv-dev-val mono">${d.driver_version}</span>
            <span class="drv-dev-label">${d.driver_provider || d.manufacturer || ""}</span>
            <span class="drv-dev-val mono">${d.driver_date || ""}</span>
            ${signedHtml}
          </div>
          ${updateHtml}
        `;

        // Attach install button handler
        const installBtn = devCard.querySelector<HTMLButtonElement>(".drv-install-btn");
        if (installBtn) {
          installBtn.addEventListener("click", async () => {
            const uid = installBtn.dataset.updateId;
            if (!uid) return;
            installBtn.disabled = true;
            installBtn.textContent = "⏳ Installing...";
            try {
              const report = await invoke<{ status: string; error?: string; steps?: string[]; needs_reboot?: boolean }>("install_driver_update", { updateId: uid });
              if (report.status === "success") {
                installBtn.textContent = "✅ Installed";
                installBtn.classList.add("drv-install-done");
                if (report.needs_reboot) toast("Driver installed! Restart your PC to apply.");
                else toast("Driver installed successfully!");
              } else {
                installBtn.textContent = "❌ Failed";
                toast(report.error || "Driver installation failed", true);
              }
            } catch (e) {
              installBtn.textContent = "❌ Error";
              toast(`Error installing driver: ${e}`, true);
            }
          });
        }

        devicesWrap.appendChild(devCard);
      }
      catDiv.appendChild(devicesWrap);
      grid.appendChild(catDiv);
    }

    el.appendChild(grid);
  } catch (e) {
    el.innerHTML = `<div class="net-status"></div>`;
    const errDiv = el.querySelector(".net-status");
    if (errDiv) errDiv.textContent = `Failed to analyze drivers: ${str(e)}`;
  }
}

async function refreshHardwareInfo() {
  const el = document.getElementById("hw-content");
  if (!el) return;
  el.innerHTML = '<div class="net-status">Scanning hardware...</div>';
  try {
    const hw = await invoke<Record<string, unknown>>("get_hardware_info");
    el.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "hw-grid";

    const cCpu = card("CPU");
    cCpu.appendChild(hwRow("Model", str(hw.cpu_name, "N/A")));
    cCpu.appendChild(hwRow("Cores", str(hw.cpu_cores, "?")));
    cCpu.appendChild(hwRow("Threads", str(hw.cpu_threads, "?")));
    cCpu.appendChild(hwRow("Clock", `${str(hw.cpu_clock_mhz, "?")} MHz`));
    grid.appendChild(cCpu);

    const cGpu = card("GPU");
    cGpu.appendChild(hwRow("Model", str(hw.gpu_name, "N/A")));
    cGpu.appendChild(hwRow("VRAM", `${str(hw.gpu_vram_mb, "?")} MB`));
    cGpu.appendChild(hwRow("Driver", str(hw.gpu_driver, "N/A")));
    cGpu.appendChild(hwRow("Refresh Rate", `${str(hw.refresh_rate, "?")} Hz`));
    grid.appendChild(cGpu);

    const cRam = card("RAM / Storage");
    cRam.appendChild(hwRow("Total RAM", `${str(hw.ram_total_gb, "?")} GB`));
    cRam.appendChild(hwRow("Modules", str(hw.ram_modules, "?")));
    cRam.appendChild(hwRow("Speed", `${str(hw.ram_speed_mhz, "?")} MHz`));
    const disks = (hw.disks as Array<{ name: string; type: string; size_gb: number }>) || [];
    for (const d of disks) {
      cRam.appendChild(hwRow(d.name || "Disk", `${d.type} ${d.size_gb} GB`));
    }
    grid.appendChild(cRam);

    const cSys = card("System / Features");
    cSys.appendChild(hwRow("OS", str(hw.os_name, "N/A")));
    cSys.appendChild(hwRow("Build", str(hw.os_build, "?")));
    cSys.appendChild(hwStatus("HAGS", str(hw.hags, "N/A")));
    let rebarVal: string;
    if (hw.rebar === "N/A") rebarVal = "N/A";
    else if (Number(String(hw.rebar).replace(" MB", "")) > 256) rebarVal = "ON";
    else rebarVal = "OFF";
    cSys.appendChild(hwStatus("ReBAR", rebarVal));
    cSys.appendChild(hwStatus("XMP", str(hw.xmp, "N/A") === "Likely" ? "ON" : "N/A"));
    grid.appendChild(cSys);

    el.appendChild(grid);
  } catch (e) {
    el.innerHTML = `<div class="net-status"></div>`;
    const errDiv = el.querySelector(".net-status");
    if (errDiv) errDiv.textContent = `Failed: ${str(e)}`;
  }
}

async function refreshProcesses() {
  const list = document.getElementById("proc-list");
  if (!list) return;
  list.innerHTML = "";
  try {
    const procs = await invoke<Array<{ name: string; pid: number; ram_mb: number; cpu_s: number }>>("list_processes");
    for (const p of procs) {
      const row = document.createElement("div");
      const flagged = PROC_FLAGS.has(p.name.toLowerCase());
      row.className = "proc-item" + (flagged ? " flagged" : "");
      row.innerHTML = `<span class="proc-name" title="${p.name}">${p.name}</span><span class="proc-val">${p.ram_mb} MB</span><span class="proc-val">${p.cpu_s}s</span>`;
      const btn = document.createElement("button");
      btn.className = "proc-kill";
      btn.textContent = "END";
      btn.addEventListener("click", async () => {
        try {
          await invoke("kill_process", { pid: p.pid });
          toast(`${p.name} terminated`);
          refreshProcesses();
        } catch (err) {
          toast(`Failed: ${err}`, true);
        }
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  } catch (e) {
    list.innerHTML = `<div class="net-status"></div>`;
    const errDiv = list.querySelector(".net-status");
    if (errDiv) errDiv.textContent = `Failed: ${str(e)}`;
  }
}

async function runPingTests() {
  const list = document.getElementById("net-results");
  if (!list) return;
  list.innerHTML = '<div class="net-status">Testing connections (TCP latency)...</div>';
  const results: Array<{ name: string; avg: number; min: number; max: number; loss: number }> = [];
  for (const srv of NET_SERVERS) {
    try {
      // Show progress per server
      const statusEl = list.querySelector(".net-status");
      if (statusEl) statusEl.textContent = `Testing ${srv.name}...`;
      const r = await invoke<{ host: string; avg: number; min: number; max: number; loss: number; ok: boolean }>(
        "ping_server", { host: srv.host, port: srv.port ?? 443, count: 3 }
      );
      results.push({ name: srv.name, avg: r.avg, min: r.min, max: r.max, loss: r.loss ?? 0 });
    } catch {
      results.push({ name: srv.name, avg: -1, min: -1, max: -1, loss: 100 });
    }
  }
  list.innerHTML = "";
  const hdr = document.createElement("div");
  hdr.className = "ping-header";
  hdr.innerHTML = "<span>Server</span><span>Avg</span><span>Min</span><span>Max</span><span>Loss</span><span>Grade</span>";
  list.appendChild(hdr);
  for (const r of results) {
    const row = document.createElement("div");
    row.className = "ping-row";
    let cls: string;
    if (r.avg < 0) cls = "ping-bad";
    else if (r.avg < 50) cls = "ping-good";
    else if (r.avg < 120) cls = "ping-ok";
    else cls = "ping-bad";
    let grade: string;
    if (r.avg < 0) grade = "FAIL";
    else if (r.avg < 30) grade = "A+";
    else if (r.avg < 50) grade = "A";
    else if (r.avg < 80) grade = "B";
    else if (r.avg < 120) grade = "C";
    else grade = "D";
    const lossStr = r.avg < 0 ? "--" : (r.loss > 0 ? `${r.loss}%` : "0%");
    const lossCls = r.loss >= 50 ? "ping-bad" : r.loss > 0 ? "ping-ok" : "";
    row.innerHTML = `<span class="ping-host">${r.name}</span><span class="ping-val ${cls}">${r.avg < 0 ? "--" : r.avg + "ms"}</span><span class="ping-val">${r.min < 0 ? "--" : r.min + "ms"}</span><span class="ping-val">${r.max < 0 ? "--" : r.max + "ms"}</span><span class="ping-val ${lossCls}">${lossStr}</span><span class="ping-val ${cls}">${grade}</span>`;
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
  priority: "critical" | "high" | "medium" | "low";
}

const DEMO_TIPS: DemoReviewTip[] = [
  // CRITICAL — check every demo
  {
    icon: "🎯",
    title: "Crosshair Placement",
    desc: "Head level? Pre-aimed at angles? Track your crosshair in every engagement.",
    detail:
      "Pause at each fight. Was your crosshair at head height BEFORE the enemy appeared? Were you already aimed where enemies commonly peek? This is the #1 factor separating ranks. In every death, check if your crosshair was in no-man's-land or on a wall nobody peeks from.",
    priority: "critical",
  },
  {
    icon: "💀",
    title: "Death Analysis",
    desc: "For each death: could you have positioned differently? Was the peek necessary?",
    detail:
      "Every death in CS2 has a cause. Were you standing still in the open? Did you wide-peek an AWP? Did you stay in a position after being spotted? Go through each death and ask: what's the earliest decision I could have changed to survive? Focus on deaths where you had no information — those are positioning errors.",
    priority: "critical",
  },
  {
    icon: "⚔️",
    title: "Opening Duels",
    desc: "Win rate in first 15 seconds. Your positioning when the round starts matters most.",
    detail:
      "Opening kills/deaths define rounds. If you regularly die first without getting a kill, your opening positions are weak. Track: (1) How often you get the first kill, (2) How often you die first, (3) Your positioning when it happens. First kill win rate above 55% = strong, below 45% = rework openings.",
    priority: "critical",
  },
  {
    icon: "🔄",
    title: "Trade Positions",
    desc: "Are you in positions where teammates can trade your death within 2 seconds?",
    detail:
      "CS2 is a team game. If you die and nobody can refrag within 2 seconds, you were isolated. Check: When you peek, is a teammate watching from a crossfire angle? When a teammate dies, could you trade it? If you're often dying in positions where the trade is impossible, adjust your spacing.",
    priority: "critical",
  },

  // HIGH — check regularly
  {
    icon: "💣",
    title: "Utility Timing",
    desc: "Smoke before entry? Flash for teammate push? Molotov for deny? Track waste.",
    detail:
      "Utility wins rounds. Check: Did you throw smokes at the right time (not too early/late)? Were your flashes actually blinding enemies or just your team? Did you molotov key spots before pushing through? Count utility left at death — dying with 2+ nades means you wasted $600+.",
    priority: "high",
  },
  {
    icon: "💰",
    title: "Economy Decisions",
    desc: "Buy/save calls. Buying on eco rounds? Saving when team forces? Equipment at death.",
    detail:
      "Check every buy round: Did you buy correctly? Watch for: Buying on eco when team saves. Not buying head armor vs. AK/M4. Buying a Deagle + armor when you could have done a full eco. Dying with expensive guns you shouldn't have bought. Money management wins matches over 30 rounds.",
    priority: "high",
  },
  {
    icon: "🏁",
    title: "Post-Plant Play",
    desc: "After planting: position, crossfire, timing. After defuse start: re-peek or wait?",
    detail:
      "Post-plant is where rounds are won or lost. When you plant: Do you get to a crossfire position? Do you play for time or peek early? As retaking CT: Are you using utility to clear? Do you ever commit too early when the timer isn't urgent? Track your post-plant round win rate separately.",
    priority: "high",
  },
  {
    icon: "📡",
    title: "Information Usage",
    desc: "Did you act on callouts? Are you checking minimap? Reacting to footsteps?",
    detail:
      "When a teammate calls enemy positions, do you adjust? Watch for: Ignoring minimap intel and getting flanked. Not rotating when info says the bomb is going elsewhere. Missing audio cues that indicate enemy position. CS2 provides massive information — using 80% of it is better than aim.",
    priority: "high",
  },
  {
    icon: "🔁",
    title: "Repetitive Mistakes",
    desc: "Same position, same peek, same timing = predictable. Change patterns.",
    detail:
      "Watch 3+ rounds where you played the same site. Are you holding the exact same angle every round? If yes, a good opponent reads you by round 3. Track: How many different positions do you use per map side? Do you vary your timing? Unpredictability is a skill you can learn from demos.",
    priority: "high",
  },

  // MEDIUM — review weekly
  {
    icon: "🔃",
    title: "Rotation Speed",
    desc: "CT rotations: too slow = late retake. Too fast = faked out. Find balance.",
    detail:
      "Track how long your rotations take and whether you arrive in time for retakes. Getting faked and rotating too early is as bad as rotating too late. Key: Did you wait for confirmation (2nd flash, bomb sound, multiple contacts) before rotating? Or did you leave your site after one contact?",
    priority: "medium",
  },
  {
    icon: "🗺️",
    title: "Map Control",
    desc: "T-side: are you taking map control or just rushing? Mid control wins rounds.",
    detail:
      "On T-side, track: Do you take map control methodically (mid, banana, apps) or do you just run to a site? On CT-side, do you play for information early round? Map control = information = better decisions. If your T-side is always 5-man rushes, you're leaving free map control behind.",
    priority: "medium",
  },
  {
    icon: "👀",
    title: "Peek Selection",
    desc: "Right type of peek for the situation? Wide vs. jiggle vs. shoulder vs. holding.",
    detail:
      "Each peek type has a purpose. Wide peek: when you have info and want to fight. Jiggle: to bait shots and get info. Shoulder: to bait an AWP shot. Holding angle: with AWP or when you know they'll push. Track how often you use the wrong peek type — wide peeking an AWP is the most common mistake.",
    priority: "medium",
  },
  {
    icon: "💡",
    title: "Flash Coordination",
    desc: "Are you flashing FOR teammates or just throwing? Teammate flashes vs. self-flash.",
    detail:
      "Count: How many of your flashes actually helped a teammate peek? How many times did you flash your own team? A good flash that lets a teammate get a kill is worth more than a kill itself. Track pop-flash success rate and team flash incidents per game.",
    priority: "medium",
  },
  {
    icon: "⏱️",
    title: "Time Management",
    desc: "Watching the round timer. Planting before 0:30? Executing with enough time?",
    detail:
      "In T-side rounds, track when you execute or plant relative to the timer. Planting with less than 30 seconds left gives CTs advantage in retake. Planting with 45-55 seconds left is ideal. On CT side, check: Are you using time to your advantage or peeking unnecessarily early?",
    priority: "medium",
  },

  // LOW — awareness items
  {
    icon: "🔇",
    title: "Sound Discipline",
    desc: "Running when you should walk? Reloading at bad times? Giving away position.",
    detail:
      "Watch for: Running footsteps that give away your position before a fight. Reloading after 25/30 bullets when an enemy is near. Jumping on metal surfaces. Scoping/unscoping in enemy earshot. Every sound you make is free information for the enemy team.",
    priority: "low",
  },
  {
    icon: "🏃",
    title: "Movement Quality",
    desc: "Counter-strafing accuracy? Crouch-peeking too much? Stutter-stepping?",
    detail:
      "Focus on: Are you stopping before shooting (counter-strafe)? Do you crouch-peek every fight (makes you predictable and slow)? Are your spray transfers clean or do you lose control? Movement errors compound — each 10ms of not-stopped shooting reduces accuracy by huge margins.",
    priority: "low",
  },
  {
    icon: "📐",
    title: "Grenade Lineups",
    desc: "Consistent smokes? Are they landing correctly? Missing lineups = round lost.",
    detail:
      "A smoke that gaps is worse than no smoke (false sense of safety). Track: How many of your smokes land correctly? Which lineups do you miss most? Prioritize learning 3-4 smokes per map side perfectly rather than 10 approximate ones.",
    priority: "low",
  },
  {
    icon: "🎥",
    title: "Kill Replay",
    desc: "Re-watch your kills too, not just deaths. What made them work?",
    detail:
      "It's tempting to only review deaths. But reviewing kills teaches you WHAT WORKS. Did you get a kill because of good crosshair placement, a good flash, a good position, or just luck? Reinforce good habits by identifying them. If a kill was lucky, don't repeat that play expecting the same result.",
    priority: "low",
  },
];

// notes + ratings stored in localStorage
function getDemoMeta(): Record<string, { notes?: string; rating?: number; tags?: string[] }> {
  return JSON.parse(localStorage.getItem("csmooth_demo_meta") || "{}");
}

function setDemoMeta(name: string, data: { notes?: string; rating?: number }) {
  const all = getDemoMeta();
  all[name] = { ...all[name], ...data };
  localStorage.setItem("csmooth_demo_meta", JSON.stringify(all));
}

/* ================================================================
   Cloud Advisor — config, helpers, prompts
   ================================================================ */

interface AdvConfig {
  key: string;
  endpoint: string;
  model: string;
}

const ADV_DEFAULTS: AdvConfig = {
  key: "",
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  model: "llama-3.3-70b-versatile",
};

function getAdvConfig(): AdvConfig {
  const raw = localStorage.getItem("csmooth_adv_config");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return { ...ADV_DEFAULTS };
}

function setAdvConfig(cfg: AdvConfig) {
  localStorage.setItem("csmooth_adv_config", JSON.stringify(cfg));
}

function hasAdvKey(): boolean {
  return getAdvConfig().key.length > 5;
}

async function advChat(systemPrompt: string, userContent: string): Promise<string> {
  const cfg = getAdvConfig();
  if (!cfg.key) throw new Error("No API key configured. Click the advisor icon in the header to set up.");
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
  try {
    return await invoke<string>("advisor_chat", {
      apiKey: cfg.key,
      endpoint: cfg.endpoint,
      model: cfg.model,
      messages,
    });
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes("401")) {
      throw new Error("API key invalid or expired. Open advisor settings (header icon) and regenerate your key at console.groq.com/keys");
    }
    throw e;
  }
}

// simple markdown-to-html for advisor responses
function mdToHtml(md: string): string {
  return md
    .replaceAll(/### (.+)/g, "<h4>$1</h4>")
    .replaceAll(/## (.+)/g, "<h3>$1</h3>")
    .replaceAll(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replaceAll(/`([^`]+)`/g, "<code>$1</code>")
    .replaceAll(/^- (.+)/gm, "<li>$1</li>")
    .replaceAll(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replaceAll(/<\/ul>\s*<ul>/g, "")
    .replaceAll(/\n{2,}/g, "<br><br>")
    .replaceAll("\n", "<br>");
}

function showAdvModal() {
  const existing = document.querySelector(".adv-overlay");
  if (existing) existing.remove();

  const cfg = getAdvConfig();
  const overlay = document.createElement("div");
  overlay.className = "adv-overlay";

  overlay.innerHTML = `
    <div class="adv-modal">
      <h3>Advisor Settings</h3>
      <label>API Key</label>
      <input type="password" id="adv-key" value="${cfg.key}" placeholder="gsk_... (Groq) or sk-... (OpenAI)" />
      <label>Endpoint</label>
      <input type="text" id="adv-endpoint" value="${cfg.endpoint}" placeholder="${ADV_DEFAULTS.endpoint}" />
      <label>Model</label>
      <input type="text" id="adv-model" value="${cfg.model}" placeholder="${ADV_DEFAULTS.model}" />
      <div id="adv-test-result" style="font-size:10px;margin-top:6px;min-height:16px;"></div>
      <div class="adv-providers">
        <div class="adv-providers-label">Get a free API key from:</div>
        <div class="adv-providers-grid">
          <a href="#" class="adv-provider-link" data-url="https://console.groq.com/keys" data-endpoint="https://api.groq.com/openai/v1/chat/completions" data-model="llama-3.3-70b-versatile">
            <span class="adv-prov-icon">⚡</span><span class="adv-prov-name">Groq</span><span class="adv-prov-tag">Free</span>
          </a>
          <a href="#" class="adv-provider-link" data-url="https://platform.openai.com/api-keys" data-endpoint="https://api.openai.com/v1/chat/completions" data-model="gpt-4o-mini">
            <span class="adv-prov-icon">🟢</span><span class="adv-prov-name">OpenAI</span><span class="adv-prov-tag">Paid</span>
          </a>
          <a href="#" class="adv-provider-link" data-url="https://openrouter.ai/keys" data-endpoint="https://openrouter.ai/api/v1/chat/completions" data-model="meta-llama/llama-3.3-70b-instruct:free">
            <span class="adv-prov-icon">🔀</span><span class="adv-prov-name">OpenRouter</span><span class="adv-prov-tag">Free tier</span>
          </a>
          <a href="#" class="adv-provider-link" data-url="https://aistudio.google.com/apikey" data-endpoint="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" data-model="gemini-2.0-flash">
            <span class="adv-prov-icon">💎</span><span class="adv-prov-name">Google Gemini</span><span class="adv-prov-tag">Free</span>
          </a>
          <a href="#" class="adv-provider-link" data-url="https://github.com/ollama/ollama" data-endpoint="http://localhost:11434/v1/chat/completions" data-model="llama3.3">
            <span class="adv-prov-icon">🦙</span><span class="adv-prov-name">Ollama</span><span class="adv-prov-tag">Local</span>
          </a>
          <a href="#" class="adv-provider-link" data-url="https://console.mistral.ai/api-keys" data-endpoint="https://api.mistral.ai/v1/chat/completions" data-model="mistral-small-latest">
            <span class="adv-prov-icon">🌀</span><span class="adv-prov-name">Mistral</span><span class="adv-prov-tag">Free tier</span>
          </a>
        </div>
        <div style="font-size:8px;opacity:0.3;margin-top:4px;">Click a provider to open its key page and auto-fill endpoint + model. Works with any compatible chat API.</div>
      </div>
      <div class="adv-modal-actions">
        <button class="adv-cancel" id="adv-cancel">Cancel</button>
        <button class="adv-test" id="adv-test-btn">⚡ Test</button>
        <button class="adv-save" id="adv-save-cfg">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("adv-cancel")!.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Provider quick-links: click opens key page + auto-fills endpoint and model
  overlay.querySelectorAll(".adv-provider-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const el = link as HTMLElement;
      const url = el.dataset.url || "";
      const endpoint = el.dataset.endpoint || "";
      const model = el.dataset.model || "";
      if (url) shellOpen(url);
      if (endpoint) (document.getElementById("adv-endpoint") as HTMLInputElement).value = endpoint;
      if (model) (document.getElementById("adv-model") as HTMLInputElement).value = model;
    });
  });

  document.getElementById("adv-test-btn")!.addEventListener("click", async () => {
    const key = (document.getElementById("adv-key") as HTMLInputElement).value.trim();
    const endpoint = (document.getElementById("adv-endpoint") as HTMLInputElement).value.trim() || ADV_DEFAULTS.endpoint;
    const model = (document.getElementById("adv-model") as HTMLInputElement).value.trim() || ADV_DEFAULTS.model;
    const resultEl = document.getElementById("adv-test-result")!;
    if (!key || key.length < 5) {
      resultEl.innerHTML = `<span style="color:#ef4444">⚠ Enter an API key first</span>`;
      return;
    }
    resultEl.innerHTML = `<span style="color:var(--text-secondary)">Testing connection...</span>`;
    try {
      await invoke<string>("advisor_chat", {
        apiKey: key,
        endpoint,
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
      });
      resultEl.innerHTML = `<span style="color:#22c55e">✓ Connected — model responded</span>`;
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("401") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
        resultEl.innerHTML = `<span style="color:#ef4444">✗ Invalid or expired API key — <a href="#" id="adv-regen-link" style="color:var(--primary);text-decoration:underline;">regenerate at Groq</a></span>`;
        document.getElementById("adv-regen-link")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          shellOpen("https://console.groq.com/keys");
        });
      } else {
        resultEl.innerHTML = `<span style="color:#ef4444">✗ ${msg}</span>`;
      }
    }
  });

  document.getElementById("adv-save-cfg")!.addEventListener("click", () => {
    const key = (document.getElementById("adv-key") as HTMLInputElement).value.trim();
    const endpoint = (document.getElementById("adv-endpoint") as HTMLInputElement).value.trim();
    const model = (document.getElementById("adv-model") as HTMLInputElement).value.trim();
    setAdvConfig({ key, endpoint: endpoint || ADV_DEFAULTS.endpoint, model: model || ADV_DEFAULTS.model });
    overlay.remove();
    // update status dot
    document.querySelectorAll(".adv-status").forEach((d) => {
      d.className = "adv-status " + (key.length > 5 ? "connected" : "disconnected");
    });
    toast(key ? "Advisor configured" : "Key removed");
  });
}

// advisor system prompts per context
const ADV_PROMPTS = {
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
  return localStorage.getItem("csmooth_discord_webhook") || "";
}

function setDiscordWebhook(url: string) {
  localStorage.setItem("csmooth_discord_webhook", url);
}

function showDiscordModal(onSaved?: () => void) {
  const existing = document.querySelector(".adv-overlay");
  if (existing) existing.remove();

  const current = getDiscordWebhook();
  const overlay = document.createElement("div");
  overlay.className = "adv-overlay";
  overlay.innerHTML = `
    <div class="adv-modal">
      <h3>Discord Webhook</h3>
      <label>Webhook URL</label>
      <input type="text" id="discord-wh-url" value="${current}" placeholder="https://discord.com/api/webhooks/..." />
      <div style="font-size:9px;opacity:0.4;margin-top:6px;">
        Server Settings → Integrations → Webhooks → New Webhook → Copy URL
      </div>
      <div class="adv-modal-actions">
        <button class="adv-cancel" id="discord-cancel">Cancel</button>
        <button class="adv-save" id="discord-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("discord-cancel")!.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("discord-save")!.addEventListener("click", () => {
    const url = (document.getElementById("discord-wh-url") as HTMLInputElement).value.trim();
    setDiscordWebhook(url);
    overlay.remove();
    toast(url ? "Discord webhook saved" : "Discord webhook removed");
    if (onSaved) onSaved();
  });
}

// color to Discord embed int (strip # and parse hex)
function hexToDiscordColor(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

async function sendDiscord(title: string, description: string, fields: Array<{ name: string; value: string; inline?: boolean }>) {
  const wh = getDiscordWebhook();
  if (!wh) {
    showDiscordModal();
    return;
  }
  const t = THEMES[currentThemeIdx];
  const color = hexToDiscordColor(t.primary);
  const embedFields = fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? true }));
  try {
    const msg = await invoke<string>("send_to_discord", {
      webhookUrl: wh,
      title,
      description,
      color,
      fields: embedFields,
    });
    toast(msg);
  } catch (e) {
    toast(`Discord: ${e}`, true);
  }
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
    toast("Copied to clipboard");
  } catch {
    toast("Copy failed", true);
  }
}

// builds a share toolbar with Discord, X, Reddit, Clipboard
function buildShareBar(getContent: () => { title: string; text: string; fields: Array<{ name: string; value: string; inline?: boolean }> }): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "share-bar";

  const btnDiscord = document.createElement("button");
  btnDiscord.className = "share-btn share-discord";
  btnDiscord.title = "Send to Discord channel";
  btnDiscord.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/></svg>`;
  btnDiscord.addEventListener("click", () => {
    const c = getContent();
    sendDiscord(c.title, c.text, c.fields);
  });

  const btnX = document.createElement("button");
  btnX.className = "share-btn share-x";
  btnX.title = "Share on X";
  btnX.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  btnX.addEventListener("click", () => {
    const c = getContent();
    shareToX(`${c.title}\n${c.text}\n\n#CS2 #aimcamp #PlayerAgent`);
  });

  const btnReddit = document.createElement("button");
  btnReddit.className = "share-btn share-reddit";
  btnReddit.title = "Share on Reddit";
  btnReddit.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`;
  btnReddit.addEventListener("click", () => {
    const c = getContent();
    shareToReddit(c.title, c.text);
  });

  const btnCopy = document.createElement("button");
  btnCopy.className = "share-btn share-copy";
  btnCopy.title = "Copy to clipboard";
  btnCopy.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  btnCopy.addEventListener("click", () => {
    const c = getContent();
    const fieldsTxt = c.fields.map((f) => `${f.name}: ${f.value}`).join("\n");
    copyToClipboard(`${c.title}\n${c.text}\n${fieldsTxt}`);
  });

  bar.appendChild(btnDiscord);
  bar.appendChild(btnX);
  bar.appendChild(btnReddit);
  bar.appendChild(btnCopy);
  return bar;
}

let currentDemoFolder = "";
let currentDemos: Array<{ name: string; path: string; size_mb: number; modified: number; map_hint: string }> = [];
let selectedDemoIdx = -1;

async function scanDemoFolder(folder: string) {
  currentDemoFolder = folder;
  localStorage.setItem("csmooth_demo_folder", folder);
  const pathEl = document.getElementById("demo-path");
  if (pathEl) pathEl.textContent = folder;
  const listEl = document.getElementById("demo-list");
  if (!listEl) return;
  listEl.innerHTML = '<div class="demo-empty">Scanning...</div>';
  try {
    currentDemos = await invoke<typeof currentDemos>("scan_demos", { folder });
    renderDemoList();
  } catch (e) {
    listEl.innerHTML = `<div class="demo-empty"></div>`;
    const errDiv = listEl.querySelector(".demo-empty");
    if (errDiv) errDiv.textContent = `Error: ${str(e)}`;
  }
}

function renderDemoList() {
  const listEl = document.getElementById("demo-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  if (currentDemos.length === 0) {
    listEl.innerHTML = '<div class="demo-empty">No .dem files found</div>';
    return;
  }
  const hdr = document.createElement("div");
  hdr.className = "demo-list-header";
  hdr.innerHTML = "<span>Demo</span><span>Map</span><span>Size</span>";
  listEl.appendChild(hdr);
  currentDemos.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "demo-item" + (i === selectedDemoIdx ? " selected" : "");
    const meta = getDemoMeta()[d.name];
    const ratingStars = meta?.rating ? "★".repeat(meta.rating) : "";
    row.innerHTML = `<span class="demo-name" title="${d.name}">${ratingStars ? ratingStars + " " : ""}${d.name.replace(".dem", "")}</span><span class="demo-map">${d.map_hint || "?"}</span><span class="demo-size">${d.size_mb} MB</span>`;
    row.addEventListener("click", () => selectDemo(i));
    listEl.appendChild(row);
  });
}

async function selectDemo(idx: number) {
  selectedDemoIdx = idx;
  renderDemoList();
  const d = currentDemos[idx];
  const detailEl = document.getElementById("demo-detail");
  if (!detailEl || !d) return;
  detailEl.innerHTML = '<div class="demo-empty">Parsing header...</div>';
  try {
    const hdr = await invoke<Record<string, unknown>>("parse_demo_header", { path: d.path });
    const meta = getDemoMeta()[d.name] || {};
    const durS = Number(hdr.duration_s || 0);
    const durMin = durS > 0 ? `${Math.floor(durS / 60)}m ${Math.round(durS % 60)}s` : "N/A";
    const date = d.modified > 0 ? new Date(d.modified * 1000).toLocaleString() : "N/A";

    let html = '<div class="demo-info-grid">';
    html += infoRowHtml("Format", str(hdr.format, "N/A"));
    html += infoRowHtml("Map", str(hdr.map, d.map_hint || "N/A"));
    if (hdr.server) html += infoRowHtml("Server", str(hdr.server));
    if (hdr.client) html += infoRowHtml("Player", str(hdr.client));
    html += infoRowHtml("Duration", durMin);
    if (hdr.ticks) html += infoRowHtml("Ticks", str(hdr.ticks));
    if (hdr.tickrate) html += infoRowHtml("Tickrate", str(hdr.tickrate));
    if (hdr.est_rounds) html += infoRowHtml("Est. Rounds", str(hdr.est_rounds));
    html += infoRowHtml("File Size", `${str(hdr.file_size_mb, "") || str(d.size_mb, "")} MB`);
    html += infoRowHtml("Date", date);
    html += "</div>";

    // actions
    html += '<div class="demo-actions" style="display:flex;gap:6px;flex-wrap:wrap;">';
    html += `<button class="btn-export" id="demo-play-btn">Play in CS2</button>`;
    html += `<button class="btn-adv" id="demo-adv-btn">🤖 Analyze</button>`;
    html += "</div>";

    // response area
    html += '<div class="adv-response" id="demo-adv-response"></div>';

    // share bar
    html += '<div id="demo-share-mount"></div>';

    // rating
    html += '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">';
    html += '<span style="font-size:10px;color:var(--text-muted);font-weight:600;">Rating:</span>';
    html += '<div class="demo-rating" id="demo-rating">';
    for (let s = 1; s <= 5; s++) {
      html += `<span class="star${(meta.rating || 0) >= s ? " filled" : ""}" data-star="${s}">★</span>`;
    }
    html += "</div></div>";

    // notes
    html += '<div class="demo-notes" style="margin-top:4px;">';
    html += `<textarea id="demo-notes-ta" placeholder="Personal notes for this demo...">${meta.notes || ""}</textarea>`;
    html += "</div>";

    detailEl.innerHTML = html;

    // mount share bar
    const demoShareMount = document.getElementById("demo-share-mount");
    if (demoShareMount) {
      const mapName = str(hdr.map, d.map_hint || "unknown");
      const shareBar = buildShareBar(() => ({
        title: `CS2 Demo — ${mapName}`,
        text: `${d.name}\nMap: ${mapName} | Duration: ${durMin} | Size: ${str(hdr.file_size_mb, "") || str(d.size_mb, "")} MB`,
        fields: [
          { name: "Map", value: mapName, inline: true },
          { name: "Duration", value: durMin, inline: true },
          { name: "Format", value: str(hdr.format, "N/A"), inline: true },
          ...(hdr.tickrate ? [{ name: "Tickrate", value: str(hdr.tickrate), inline: true }] : []),
          ...(hdr.server ? [{ name: "Server", value: str(hdr.server), inline: true }] : []),
          ...(meta.rating ? [{ name: "Rating", value: "★".repeat(meta.rating) + "☆".repeat(5 - meta.rating), inline: true }] : []),
        ],
      }));
      demoShareMount.appendChild(shareBar);
    }

    // event: play
    document.getElementById("demo-play-btn")?.addEventListener("click", async () => {
      try {
        const msg = await invoke<string>("open_demo_in_cs2", { demoPath: d.path });
        toast(msg);
      } catch (e) {
        toast(`Failed: ${e}`, true);
      }
    });

    // event: rating stars
    document.querySelectorAll("#demo-rating .star").forEach((star) => {
      star.addEventListener("click", () => {
        const v = Number((star as HTMLElement).dataset.star || 0);
        setDemoMeta(d.name, { rating: v });
        document.querySelectorAll("#demo-rating .star").forEach((s, i) => {
          s.classList.toggle("filled", i < v);
        });
        renderDemoList();
      });
    });

    // event: notes
    const ta = document.getElementById("demo-notes-ta") as HTMLTextAreaElement;
    if (ta) {
      let noteTimer: ReturnType<typeof setTimeout>;
      ta.addEventListener("input", () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => setDemoMeta(d.name, { notes: ta.value }), 500);
      });
    }

    // event: analysis
    document.getElementById("demo-adv-btn")?.addEventListener("click", async () => {
      const btn = document.getElementById("demo-adv-btn") as HTMLButtonElement;
      const respEl = document.getElementById("demo-adv-response");
      if (!respEl || !btn) return;
      if (!hasAdvKey()) {
        showAdvModal();
        return;
      }
      btn.disabled = true;
      respEl.innerHTML = '<div class="adv-loading">Analyzing demo...</div>';
      const notesNow = (document.getElementById("demo-notes-ta") as HTMLTextAreaElement)?.value || "";
      const ratingNow = getDemoMeta()[d.name]?.rating || 0;
      const tipsList = DEMO_TIPS.map((t, i) => `TIP_${i + 1}: ${t.title} — ${t.desc}`).join("\n");
      const context = [
        `Demo: ${d.name}`,
        `Map: ${str(hdr.map, "") || str(d.map_hint, "unknown")}`,
        `Format: ${str(hdr.format, "unknown")}`,
        hdr.server ? `Server: ${str(hdr.server)}` : "",
        hdr.client ? `Player: ${str(hdr.client)}` : "",
        `Duration: ${durMin}`,
        hdr.ticks ? `Ticks: ${str(hdr.ticks)}` : "",
        hdr.tickrate ? `Tickrate: ${str(hdr.tickrate)}` : "",
        hdr.est_rounds ? `Est. Rounds: ${str(hdr.est_rounds)}` : "",
        `File Size: ${str(hdr.file_size_mb, "") || str(d.size_mb, "")} MB`,
        ratingNow ? `Player self-rating: ${ratingNow}/5` : "",
        notesNow ? `Player notes: ${notesNow}` : "",
        "",
        "--- REVIEW TIPS (evaluate each) ---",
        tipsList,
      ]
        .filter(Boolean)
        .join("\n");
      try {
        const result = await advChat(ADV_PROMPTS.demo, context);
        respEl.innerHTML = mdToHtml(result);
      } catch (e) {
        respEl.innerHTML = `<span style="color:#ef4444"></span>`;
        const errSpan = respEl.querySelector("span");
        if (errSpan) errSpan.textContent = `Error: ${str(e)}`;
      }
      btn.disabled = false;
    });
  } catch (e) {
    detailEl.innerHTML = `<div class="demo-empty"></div>`;
    const errDiv = detailEl.querySelector(".demo-empty");
    if (errDiv) errDiv.textContent = `Parse error: ${str(e)}`;
  }
}

function infoRowHtml(label: string, value: string): string {
  return `<div class="demo-info-row"><span class="di-label">${label}</span><span class="di-value">${value}</span></div>`;
}

/* ================================================================
   Build the UI
   ================================================================ */

function buildSubTabs(labels: string[], beforeSwitch?: () => boolean): { bar: HTMLElement; panels: HTMLElement[]; switchSub: (i: number) => void } {
  const bar = document.createElement("div");
  bar.className = "sub-tab-bar";
  const btns: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];
  labels.forEach((lbl, i) => {
    const btn = document.createElement("button");
    btn.className = "sub-tab-btn" + (i === 0 ? " active" : "");
    btn.textContent = lbl;
    btn.addEventListener("click", () => switchSub(i));
    bar.appendChild(btn);
    btns.push(btn);
    const panel = document.createElement("div");
    panel.className = "sub-tab-panel" + (i === 0 ? " active" : "");
    panels.push(panel);
  });
  function switchSub(idx: number) {
    if (beforeSwitch && !beforeSwitch()) return;
    btns.forEach((b, i) => { b.classList.toggle("active", i === idx); });
    panels.forEach((p, i) => { p.classList.toggle("active", i === idx); });
  }
  return { bar, panels, switchSub };
}

/* ================================================================
   Custom Modal Dialogs (replaces native prompt/confirm)
   ================================================================ */
function showInputModal(title: string, placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-title">${title}</div>
        <input type="text" class="modal-input" placeholder="${placeholder}" maxlength="32" autofocus />
        <div class="modal-actions">
          <button class="modal-btn modal-btn-ok">CREATE</button>
          <button class="modal-btn modal-btn-cancel">CANCEL</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector<HTMLInputElement>(".modal-input")!;
    const btnOk = overlay.querySelector<HTMLButtonElement>(".modal-btn-ok")!;
    const btnCancel = overlay.querySelector<HTMLButtonElement>(".modal-btn-cancel")!;
    setTimeout(() => input.focus(), 50);
    const close = (val: string | null) => { overlay.remove(); resolve(val); };
    btnOk.addEventListener("click", () => close(input.value.trim() || null));
    btnCancel.addEventListener("click", () => close(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(input.value.trim() || null);
      if (e.key === "Escape") close(null);
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
  });
}

function showConfirmModal(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-title">${title}</div>
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-danger">DELETE</button>
          <button class="modal-btn modal-btn-cancel">CANCEL</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const btnOk = overlay.querySelector<HTMLButtonElement>(".modal-btn-danger")!;
    const btnCancel = overlay.querySelector<HTMLButtonElement>(".modal-btn-cancel")!;
    const close = (val: boolean) => { overlay.remove(); resolve(val); };
    btnOk.addEventListener("click", () => close(true));
    btnCancel.addEventListener("click", () => close(false));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
  });
}

/* ================================================================
   Application build() — DOM construction
   ================================================================ */
function build() {
  const app = document.getElementById("app");
  if (!app) return;

  // ── Responsive scale: fill any resolution proportionally ─────
  // Design base: 1920×1080. Scale #app to fill the current screen.
  (function applyResponsiveScale() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    if (Math.abs(scale - 1) > 0.02) {
      app.style.width = "1920px";
      app.style.height = "1080px";
      app.style.flex = "none";
      app.style.transformOrigin = "0 0";
      app.style.transform = `scale(${scale.toFixed(5)})`;
      // Center on non-16:9 aspect ratios
      const ox = Math.max(0, (window.innerWidth - 1920 * scale) / 2);
      const oy = Math.max(0, (window.innerHeight - 1080 * scale) / 2);
      if (ox > 1) app.style.marginLeft = ox + "px";
      if (oy > 1) app.style.marginTop = oy + "px";
    }
  })();

  app.innerHTML = "";

  // Load saved theme
  const savedTheme = localStorage.getItem("aimcamp_theme");
  if (savedTheme) {
    const idx = parseInt(savedTheme, 10);
    if (!isNaN(idx) && idx >= 0 && idx < THEMES.length) {
      applyTheme(idx);
    }
  }

  /* ── Sidebar ─────────────────────────────────────────────────── */
  const sidebar = document.createElement("nav");
  sidebar.className = "app-sidebar";

  const btnConfig = document.createElement("button");
  btnConfig.className = "sidebar-btn active";
  btnConfig.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg><span>Configuration</span>`;
  attachTooltip(btnConfig, tipHtml("Configuration", "System Optimizer (SYS) + CFG Manager — Windows, BIOS, NVIDIA, Network, Services optimizations and full CS2 console command editor with 148+ commands, autoexec export, pro player configs and more.", "Up to +40% cumulative FPS gain", "Registry / PowerShell / autoexec.cfg"));

  const btnHwTab = document.createElement("button");
  btnHwTab.className = "sidebar-btn";
  btnHwTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/><path d="M20 9h2"/><path d="M20 14h2"/><path d="M2 9h2"/><path d="M2 14h2"/></svg><span>Hardware</span>`;
  attachTooltip(btnHwTab, tipHtml("Hardware", "Scans your full system hardware — CPU, GPU, RAM, motherboard, storage and monitors via WMI queries. Detects XMP status, GPU scheduling, power plan, HPET timer and more. Smart analysis available to identify bottlenecks."));

  const btnDrvTab = document.createElement("button");
  btnDrvTab.className = "sidebar-btn";
  btnDrvTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg><span>Drivers</span>`;
  attachTooltip(btnDrvTab, tipHtml("Drivers", "Lists all installed device drivers with version, date, manufacturer and digital signature status. Checks Windows Update for available driver updates and allows one-click background installation."));

  const btnProcTab = document.createElement("button");
  btnProcTab.className = "sidebar-btn";
  btnProcTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg><span>Task Manager</span>`;
  attachTooltip(btnProcTab, tipHtml("Task Manager", "Real-time process monitor focused on gaming. Flags known resource-heavy applications (overlays, RGB software, streaming tools) that compete with CS2 for CPU/GPU time. Kill processes directly to free resources.", "Varies — killing bloatware can free 5-15% CPU"));

  const btnNetTab = document.createElement("button");
  btnNetTab.className = "sidebar-btn";
  btnNetTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg><span>Network</span>`;
  attachTooltip(btnNetTab, tipHtml("Network", "Pings official Valve CS2 server regions worldwide and measures latency, jitter and packet loss. Helps identify the best server region for your connection. Smart analysis suggests network config improvements."));

  const btnDemoTab = document.createElement("button");
  btnDemoTab.className = "sidebar-btn";
  btnDemoTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg><span>Demos</span>`;
  attachTooltip(btnDemoTab, tipHtml("Demos", "Parses CS2 .dem files and extracts match metadata (map, duration, tickrate, rounds). Rate your performance and add notes. Coaching analysis scores 18 gameplay review tips with personalized feedback."));

  const btnFdbkTab = document.createElement("button");
  btnFdbkTab.className = "sidebar-btn";
  btnFdbkTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Feedback</span>`;
  attachTooltip(btnFdbkTab, tipHtml("Feedback", "Send bug reports, feature requests and general feedback directly to the development team via Discord webhook. Your input shapes future updates. All submissions are anonymous."));

  const btnBenchTab = document.createElement("button");
  btnBenchTab.className = "sidebar-btn";
  btnBenchTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg><span>Benchmark</span>`;
  attachTooltip(btnBenchTab, tipHtml("Benchmark", "Import PresentMon CSV or CapFrameX JSON benchmark captures. Visualizes FPS over time, frame time distribution, 1% / 0.1% lows, and stutter analysis. Compare before/after optimization runs."));

  /* ── Community placeholder buttons ─────────────────────────── */
  const sidebarSep = document.createElement("div");
  sidebarSep.className = "sidebar-sep";
  const sidebarLabel = document.createElement("div");
  sidebarLabel.className = "sidebar-label";
  sidebarLabel.textContent = "AIM.CAMP";

  const btnRankTab = document.createElement("button");
  btnRankTab.className = "sidebar-btn placeholder-btn";
  btnRankTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C6 4 6 7 6 7s0 3 1.5 3S9 7 9 7s0-3 1.5-3a2.5 2.5 0 0 1 0 5H9"/><path d="M6 9v12"/><path d="M9 9v12"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C18 4 18 7 18 7s0 3-1.5 3S15 7 15 7s0-3-1.5-3a2.5 2.5 0 0 0 0 5H15"/><path d="M15 9v12"/><path d="M18 9v12"/></svg><span>Rankings</span>`;
  attachTooltip(btnRankTab, tipHtml("Rankings", "Coming soon — Track your CS2 competitive rankings, ELO history, win rate trends and per-map statistics. Integrates with Steam and FACEIT profiles."));

  const btnServersTab = document.createElement("button");
  btnServersTab.className = "sidebar-btn placeholder-btn";
  btnServersTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg><span>Servers</span>`;
  attachTooltip(btnServersTab, tipHtml("Servers", "Coming soon — Browse community servers, retake/DM/FFA servers and organize 5v5 practice matches with your team through aim.camp matchmaking."));

  const btnMarketTab = document.createElement("button");
  btnMarketTab.className = "sidebar-btn placeholder-btn";
  btnMarketTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span>Market</span>`;
  attachTooltip(btnMarketTab, tipHtml("Market", "Coming soon — Track CS2 skin prices, inventory value, trade-up calculator and market trends. Price alerts and Steam Community Market integration."));

  const btnHubTab = document.createElement("button");
  btnHubTab.className = "sidebar-btn placeholder-btn";
  btnHubTab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Hub</span>`;
  attachTooltip(btnHubTab, tipHtml("Hub", "Coming soon — Central hub for the aim.camp community. News, guides, team finder, tournament brackets and direct integration with the aim.camp platform."));

  /* ── Sidebar watermark ─────────────────────────────────────── */
  const watermark = document.createElement("div");
  watermark.className = "sidebar-watermark";
  watermark.innerHTML = `<svg class="sidebar-watermark-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span class="sidebar-watermark-text">aim.camp</span>`;

  sidebar.appendChild(btnConfig);
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

  type TabId = "config" | "hw" | "drv" | "proc" | "net" | "demo" | "fdbk" | "bench" | "rank" | "servers" | "market" | "hub";
  const allBtns = [btnConfig, btnHwTab, btnDrvTab, btnProcTab, btnNetTab, btnDemoTab, btnFdbkTab, btnBenchTab, btnRankTab, btnServersTab, btnMarketTab, btnHubTab];
  const tabIds: { btn: HTMLButtonElement; tabId: string }[] = [
    { btn: btnConfig, tabId: "tab-config" },
    { btn: btnHwTab, tabId: "tab-hw" },
    { btn: btnDrvTab, tabId: "tab-drv" },
    { btn: btnProcTab, tabId: "tab-proc" },
    { btn: btnNetTab, tabId: "tab-net" },
    { btn: btnDemoTab, tabId: "tab-demo" },
    { btn: btnFdbkTab, tabId: "tab-fdbk" },
    { btn: btnBenchTab, tabId: "tab-bench" },
    { btn: btnRankTab, tabId: "tab-rank" },
    { btn: btnServersTab, tabId: "tab-servers" },
    { btn: btnMarketTab, tabId: "tab-market" },
    { btn: btnHubTab, tabId: "tab-hub" },
  ];

  /** Pulse the save button to alert the user they must save before leaving */
  let _saveAlertTimeout: ReturnType<typeof setTimeout> | null = null;
  function pulseLayoutSaveBtn() {
    const saveBtn = document.querySelector<HTMLElement>(".btn-schema-save");
    if (!saveBtn) return;

    // 1) Pulse the save button itself
    saveBtn.classList.remove("pulse-save");
    const _r1 = saveBtn.offsetWidth; // reflow
    saveBtn.classList.add("pulse-save");
    saveBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // 2) Don't stack multiple alerts
    if (_saveAlertTimeout) return;

    // 3) Dark overlay behind save area
    const overlay = document.createElement("div");
    overlay.className = "save-alert-overlay";
    document.body.appendChild(overlay);
    const _r2 = overlay.offsetWidth; // reflow
    overlay.classList.add("show");

    // 4) Floating toast warning
    const toast = document.createElement("div");
    toast.className = "save-alert-toast";
    toast.innerHTML = `<span class="save-alert-icon">⚠️</span> <span>Save the layout before leaving!</span> <span class="save-alert-arrow">▼</span>`;
    document.body.appendChild(toast);

    // Position toast above the save button
    const rect = saveBtn.getBoundingClientRect();
    toast.style.left = rect.left + rect.width / 2 + "px";
    toast.style.top = Math.max(8, rect.top - 54) + "px";
    const _r3 = toast.offsetWidth; // reflow
    toast.classList.add("show");

    // Click overlay = dismiss
    overlay.addEventListener("click", dismissSaveAlert);

    // Auto-dismiss after 3s
    _saveAlertTimeout = setTimeout(dismissSaveAlert, 3000);

    function dismissSaveAlert() {
      if (!_saveAlertTimeout) return;
      clearTimeout(_saveAlertTimeout);
      _saveAlertTimeout = null;
      overlay.classList.remove("show");
      toast.classList.remove("show");
      setTimeout(() => { overlay.remove(); toast.remove(); }, 300);
    }
  }

  function switchTab(t: TabId) {
    // Guard: block navigation away from CFG while in layout edit mode
    if (_layoutEditMode && t !== "config") {
      pulseLayoutSaveBtn();
      return;
    }
    const idx = ["config", "hw", "drv", "proc", "net", "demo", "fdbk", "bench", "rank", "servers", "market", "hub"].indexOf(t);
    allBtns.forEach((b, i) => { b.classList.toggle("active", i === idx); });
    tabIds.forEach((ti, i) => {
      document.getElementById(ti.tabId)?.classList.toggle("active", i === idx);
    });
    // auto-load data on first switch
    if (t === "hw" && !document.querySelector(".hw-grid")) refreshHardwareInfo();
    if (t === "drv" && !document.querySelector(".drv-grid")) refreshDriverInfo();
    if (t === "proc" && !document.querySelector(".proc-item")) refreshProcesses();
    if (t === "net" && !document.querySelector(".ping-header")) runPingTests();
    if (t === "demo" && !document.querySelector(".demo-list-header")) {
      const savedFolder = localStorage.getItem("csmooth_demo_folder");
      if (savedFolder) scanDemoFolder(savedFolder);
    }
    if (t === "fdbk" && !document.querySelector(".fdbk-card") && !document.querySelector(".fdbk-empty")) refreshFeedbackHistory();
  }
  btnConfig.addEventListener("click", () => switchTab("config"));
  btnHwTab.addEventListener("click", () => switchTab("hw"));
  btnDrvTab.addEventListener("click", () => switchTab("drv"));
  btnProcTab.addEventListener("click", () => switchTab("proc"));
  btnNetTab.addEventListener("click", () => switchTab("net"));
  btnDemoTab.addEventListener("click", () => switchTab("demo"));
  btnFdbkTab.addEventListener("click", () => switchTab("fdbk"));
  btnBenchTab.addEventListener("click", () => switchTab("bench"));
  btnRankTab.addEventListener("click", () => switchTab("rank"));
  btnServersTab.addEventListener("click", () => switchTab("servers"));
  btnMarketTab.addEventListener("click", () => switchTab("market"));
  btnHubTab.addEventListener("click", () => switchTab("hub"));

  const container = document.createElement("div");
  container.className = "app-container";

  /* ── Header ──────────────────────────────────────────────────── */
  const header = document.createElement("header");
  header.className = "app-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "header-left";
  headerLeft.innerHTML = `<span class="logo-feather"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span><div><h1>Player Agent</h1><p class="header-subtitle"><span class="header-community">aim.camp</span> CS2 Performance & Community Platform</p></div>`;

  const headerRight = document.createElement("div");
  headerRight.className = "header-right";

  /* ── Theme icon + dropdown ─────────────────────────────────── */
  const themeWrap = document.createElement("div");
  themeWrap.className = "theme-wrap";

  const themeBtn = document.createElement("button");
  themeBtn.className = "theme-btn";
  themeBtn.title = "Choose color theme";
  themeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/><circle cx="7.5" cy="11.5" r="1.5" fill="#f59e0b" stroke="none"/><circle cx="9" cy="7" r="1.5" fill="#ef4444" stroke="none"/><circle cx="14" cy="6" r="1.5" fill="#3b82f6" stroke="none"/><circle cx="17" cy="10" r="1.5" fill="#10b981" stroke="none"/></svg>`;

  const dropdown = document.createElement("div");
  dropdown.className = "theme-dropdown";
  dropdown.style.display = "none";

  THEMES.forEach((t, i) => {
    const opt = document.createElement("div");
    opt.className = "theme-option" + (i === currentThemeIdx ? " active" : "");
    const dot = document.createElement("span");
    dot.className = "theme-dot";
    dot.style.background = `linear-gradient(135deg, ${t.primary}, ${t.secondary})`;
    const name = document.createElement("span");
    name.className = "theme-name";
    name.textContent = t.name;
    opt.appendChild(dot);
    opt.appendChild(name);
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      applyTheme(i);
      dropdown.style.display = "none";
    });
    dropdown.appendChild(opt);
  });

  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener("click", () => {
    dropdown.style.display = "none";
  });

  themeWrap.appendChild(themeBtn);
  themeWrap.appendChild(dropdown);

  /* ── Schema profile selector (used inside Config tab) ──────── */
  const profileSel = document.createElement("select");
  profileSel.id = "profile-select";
  profileSel.title = "Select schema";

  function refreshProfileDropdown() {
    profileSel.innerHTML = "";
    const schemas = getSchemas();
    const activeId = getActiveSchemaId();
    if (schemas.length === 0) {
      const optE = document.createElement("option");
      optE.value = "";
      optE.textContent = "No schemas";
      profileSel.appendChild(optE);
      return;
    }
    for (const s of schemas) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      profileSel.appendChild(o);
    }
    // Pre-select the active schema
    if (activeId) profileSel.value = activeId;
  }
  refreshProfileDropdown();

  // Auto-load schema on selection change
  profileSel.addEventListener("change", () => {
    const selectedId = profileSel.value;
    if (!selectedId) return;
    const schema = getSchemas().find((s) => s.id === selectedId);
    if (!schema) return;
    setActiveSchemaId(schema.id);
    rebuildCfgLayout();
    toast(`Schema "${schema.name}" loaded ✔`);
  });

  /* ── Agent status badge ───────────────────────────────────────── */
  const agentBadge = document.createElement("div");
  agentBadge.className = "agent-status-badge";
  agentBadge.title = "Agent connection status";
  const agentDot = document.createElement("span");
  agentDot.className = "agent-status-dot connected";
  const agentLabel = document.createElement("span");
  agentLabel.textContent = "ON";
  agentBadge.appendChild(agentDot);
  agentBadge.appendChild(agentLabel);
  headerRight.appendChild(agentBadge);

  /* ── Settings button (header) ─────────────────────────────────── */
  const btnHeaderSettings = document.createElement("button");
  btnHeaderSettings.className = "adv-btn";
  btnHeaderSettings.title = "Application Settings";
  btnHeaderSettings.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/></svg>`;
  const settingsLabel = document.createElement("span");
  settingsLabel.textContent = "SETTINGS";
  btnHeaderSettings.appendChild(settingsLabel);
  btnHeaderSettings.addEventListener("click", showSettingsModal);
  headerRight.appendChild(btnHeaderSettings);

  /* ── Advisor config button ──────────────────────────────────────── */
  const advBtn = document.createElement("button");
  advBtn.className = "adv-btn";
  advBtn.title = "Advisor settings (credentials)";
  const advDot = document.createElement("span");
  advDot.className = "adv-status " + (hasAdvKey() ? "connected" : "disconnected");
  advBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.5" fill="currentColor" stroke="none"/><path d="M9 15h6"/></svg>`;
  advBtn.prepend(advDot);
  const advLabel = document.createElement("span");
  advLabel.textContent = "ADV";
  advBtn.appendChild(advLabel);
  advBtn.addEventListener("click", showAdvModal);
  headerRight.appendChild(advBtn);

  const btnMin = document.createElement("button");
  btnMin.className = "btn-minimize";
  btnMin.title = "Minimize to taskbar";
  btnMin.textContent = "—";
  btnMin.addEventListener("click", () => {
    appWindow.minimize();
  });

  const btnClose = document.createElement("button");
  btnClose.className = "btn-minimize btn-close";
  btnClose.title = "Close";
  btnClose.textContent = "✕";
  btnClose.addEventListener("click", () => {
    appWindow.close();
  });

  headerRight.appendChild(themeWrap);
  headerRight.appendChild(btnMin);
  headerRight.appendChild(btnClose);

  /* ── Settings Modal ──────────────────────────────────────────────── */
  function showSettingsModal() {
    const overlay = document.createElement("div");
    overlay.className = "adv-overlay";
    overlay.innerHTML = `
      <div class="adv-modal" style="width:80vw;max-width:1600px;max-height:80vh;overflow-y:auto;">
        <div class="adv-modal-header">
          <h3>⚙️ Application Settings</h3>
          <button class="adv-modal-close" id="settings-close">✕</button>
        </div>
        <div class="adv-modal-body" style="display:flex;flex-direction:column;gap:16px;">
          
          <!-- AI / Agent Configuration -->
          <div style="background:rgba(255,255,255,0.02);padding:14px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
            <h4 style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;margin:0 0 12px;color:var(--neon-cyan);letter-spacing:0.08em;">🤖 AI / LLM CONFIGURATION</h4>
            
            <!-- 1-Click Install Section -->
            <div style="background:rgba(0,255,180,0.04);border:1px solid rgba(0,255,180,0.15);border-radius:6px;padding:12px;margin-bottom:14px;">
              <div style="font-size:10px;font-weight:700;color:var(--neon-cyan);margin:0 0 10px;letter-spacing:0.06em;">📦 1-CLICK LOCAL LLM INSTALL</div>
              <div style="font-size:10px;opacity:0.6;margin-bottom:10px;line-height:1.5;">Run AI locally — no cloud subscription needed. Instala o Ollama (motor) e depois faz download do modelo desejado.</div>
              
              <!-- Step 1: Ollama Engine -->
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:4px;">
                <span style="flex:0 0 20px;font-size:14px;">1️⃣</span>
                <div style="flex:1;">
                  <div style="font-size:11px;font-weight:600;">Ollama <span style="opacity:0.5;font-weight:400;">(motor local — necessário)</span></div>
                  <div style="font-size:9px;opacity:0.5;margin-top:1px;">Executa modelos LLM localmente no teu PC</div>
                </div>
                <button id="install-btn-ollama" class="btn-export" style="font-size:10px;padding:5px 12px;white-space:nowrap;">📥 Instalar Ollama</button>
                <span id="install-status-ollama" style="font-size:10px;opacity:0.6;min-width:80px;text-align:right;"></span>
              </div>
              
              <!-- Step 2: Llama 3.2 3B -->
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:4px;">
                <span style="flex:0 0 20px;font-size:14px;">2️⃣</span>
                <div style="flex:1;">
                  <div style="font-size:11px;font-weight:600;">Llama 3.2 3B <span style="opacity:0.5;font-weight:400;">(Meta — recomendado, 2GB)</span></div>
                  <div style="font-size:9px;opacity:0.5;margin-top:1px;">Rápido, leve, funciona em qualquer GPU/CPU</div>
                </div>
                <button id="install-btn-llama" class="btn-export" style="font-size:10px;padding:5px 12px;white-space:nowrap;">⬇️ Download</button>
                <span id="install-status-llama" style="font-size:10px;opacity:0.6;min-width:80px;text-align:right;"></span>
              </div>
              
              <!-- Step 3: NVIDIA Nemotron-Mini 4B (text LLM, runs via Ollama) -->
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:4px;">
                <span style="flex:0 0 20px;font-size:14px;">3️⃣</span>
                <div style="flex:1;">
                  <div style="font-size:11px;font-weight:600;">Nemotron-Mini 4B <span style="opacity:0.5;font-weight:400;">(NVIDIA — texto, 2.7GB)</span></div>
                  <div style="font-size:9px;opacity:0.5;margin-top:1px;">LLM de texto NVIDIA para gaming PCs — requer GPU NVIDIA com 4GB+ VRAM</div>
                </div>
                <button id="install-btn-llama8b" class="btn-export" style="font-size:10px;padding:5px 12px;white-space:nowrap;">⬇️ Download</button>
                <span id="install-status-llama8b" style="font-size:10px;opacity:0.6;min-width:80px;text-align:right;"></span>
              </div>
              
              <!-- PersonaPlex info row -->
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(100,200,255,0.04);border:1px solid rgba(100,200,255,0.1);border-radius:4px;margin-top:4px;">
                <span style="flex:0 0 20px;font-size:14px;">🎙️</span>
                <div style="flex:1;">
                  <div style="font-size:11px;font-weight:600;">PersonaPlex 7B <span style="opacity:0.5;font-weight:400;">(NVIDIA — speech-to-speech)</span></div>
                  <div style="font-size:9px;opacity:0.5;margin-top:1px;">Modelo de voz conversacional (áudio→áudio) — requer Linux + GPU A100. Não é um LLM de texto.</div>
                </div>
                <button id="install-btn-personaplex" class="btn-adv" style="font-size:10px;padding:5px 12px;white-space:nowrap;">🔗 HuggingFace</button>
              </div>
              
              <div id="install-ollama-log" style="display:none;margin-top:8px;padding:6px 10px;background:rgba(0,0,0,0.3);border-radius:4px;font-size:9px;font-family:monospace;opacity:0.8;white-space:pre-wrap;max-height:60px;overflow-y:auto;"></div>
            </div>
            
            <!-- Provider Selection -->
            <div style="display:flex;gap:12px;margin-bottom:12px;">
              <div style="flex:1;">
                <label style="display:block;font-size:11px;margin-bottom:4px;font-weight:600;">LLM Provider</label>
                <select id="settings-llm-provider" style="width:100%;padding:8px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;cursor:pointer;">
                  <option value="" style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Selecionar provider...</option>
                  <option value="nemotron-mini" style="background:rgba(15,15,25,0.95);color:var(--neon-green);">💻 Nemotron-Mini 4B (NVIDIA) - 2.7GB Local</option>
                  <option value="llama-3.2-3b" style="background:rgba(15,15,25,0.95);color:var(--neon-green);">💻 Llama 3.2 3B - 2.0GB Local</option>
                  <option value="groq-llama" style="background:rgba(15,15,25,0.95);color:var(--neon-green);">☁️ Groq Cloud API - Fastest</option>
                  <option value="openai-compatible" style="background:rgba(15,15,25,0.95);color:var(--neon-green);">☁️ OpenAI Compatible API</option>
                </select>
              </div>
              <div style="flex:0 0 200px;">
                <label style="display:block;font-size:11px;margin-bottom:4px;font-weight:600;">Status</label>
                <div id="settings-llm-status" style="padding:8px 10px;font-size:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);font-family:Rajdhani,monospace;display:flex;align-items:center;gap:6px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.3);"></span>
                  <span>Não configurado</span>
                </div>
              </div>
            </div>

            <!-- Cloud Provider Config -->
            <div id="settings-cloud-config" style="display:none;border-top:1px solid rgba(255,255,255,0.05);padding-top:12px;margin-top:8px;">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="flex:0 0 120px;font-size:11px;">API Endpoint</label>
                <input type="text" id="settings-llm-endpoint" placeholder="https://api.groq.com/..." style="flex:1;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
              </div>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="flex:0 0 120px;font-size:11px;">API Key</label>
                <input type="password" id="settings-llm-apikey" placeholder="Inserir chave API" style="flex:1;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
              </div>
            </div>

            <!-- Local Provider Config -->
            <div id="settings-local-config" style="display:none;border-top:1px solid rgba(255,255,255,0.05);padding-top:12px;margin-top:8px;">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="flex:0 0 120px;font-size:11px;">GPU Layers</label>
                <input type="number" id="settings-llm-gpu-layers" value="35" min="0" max="100" style="flex:0 0 100px;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
                <span style="font-size:10px;opacity:0.6;">Camadas a processar na GPU (mais = mais rápido, requer VRAM)</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="flex:0 0 120px;font-size:11px;">Quantization</label>
                <select id="settings-llm-quant" style="flex:0 0 120px;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;cursor:pointer;">
                  <option value="q4" selected style="background:rgba(15,15,25,0.95);">Q4 (padrão)</option>
                  <option value="q5" style="background:rgba(15,15,25,0.95);">Q5 (melhor)</option>
                  <option value="q8" style="background:rgba(15,15,25,0.95);">Q8 (máximo)</option>
                </select>
                <span style="font-size:10px;opacity:0.6;">Qualidade do modelo (maior = melhor, mas mais lento)</span>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;">
                <button id="settings-llm-download" class="btn-export" style="font-size:10px;padding:6px 16px;">📥 Download Model</button>
                <div id="settings-llm-download-progress" style="display:none;flex:1;">
                  <div style="background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;height:28px;position:relative;">
                    <div id="settings-llm-progress-bar" style="background:linear-gradient(90deg,var(--neon-green),var(--neon-cyan));height:100%;width:0%;transition:width 0.3s;"></div>
                    <span id="settings-llm-progress-text" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:600;color:#000;mix-blend-mode:difference;">0%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);">
              <button id="settings-llm-test" class="btn-export" style="font-size:10px;padding:6px 16px;">🧪 Test Connection</button>
              <button id="settings-llm-save" class="btn-export" style="font-size:10px;padding:6px 16px;background:var(--neon-green);color:#000;">💾 Save Configuration</button>
              <div id="settings-llm-test-result" style="flex:1;padding:6px 10px;font-size:10px;opacity:0;transition:opacity 0.3s;"></div>
            </div>

            <p style="font-size:9px;opacity:0.5;margin:10px 0 0;line-height:1.4;">O AI Assistant usa LLMs para análise inteligente de hardware, sugestões personalizadas e explicação de features. Escolha entre modelos locais (privados, sem internet) ou cloud APIs (mais rápidos, requerem chave).</p>
          </div>

          <!-- Integrations & Webhooks -->
          <div style="background:rgba(255,255,255,0.02);padding:14px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
            <h4 style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;margin:0 0 8px;color:var(--neon-cyan);letter-spacing:0.08em;">🔗 INTEGRATIONS & WEBHOOKS</h4>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
              <label style="flex:0 0 150px;font-size:11px;">Discord Webhook URL</label>
              <input type="text" id="settings-discord-webhook" placeholder="https://discord.com/api/webhooks/..." style="flex:1;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
            </div>
            <button class="btn-export" style="margin-top:4px;margin-bottom:12px;font-size:10px;">Test Discord Webhook</button>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
              <label style="flex:0 0 150px;font-size:11px;">GitHub Personal Token</label>
              <input type="password" id="settings-github-token" placeholder="ghp_..." style="flex:1;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
            </div>
            <button class="btn-export" style="margin-top:4px;font-size:10px;">Verify GitHub Token</button>
            <p style="font-size:9px;opacity:0.5;margin:10px 0 0;line-height:1.4;">Discord webhook enables feedback submission to your Discord server. GitHub token allows creating issues directly from the app. Both are optional and stored locally.</p>
          </div>

          <!-- Theme Section -->
          <div style="background:rgba(255,255,255,0.02);padding:14px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
            <h4 style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;margin:0 0 8px;color:var(--neon-cyan);letter-spacing:0.08em;">🎨 THEME & APPEARANCE</h4>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
              <label style="flex:0 0 120px;font-size:11px;">Color Theme</label>
              <select id="settings-theme-select" style="flex:1;padding:6px 10px;font-size:11px;background:rgba(15,15,25,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;cursor:pointer;">
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Matrix</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Ocean</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Sunset</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Nord</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Tokyo Night</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Dracula</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Gruvbox</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Synthwave</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Solarized</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Amber</option>
                <option style="background:rgba(15,15,25,0.95);color:var(--neon-green);">Monochrome</option>
              </select>
            </div>
            <p style="font-size:9px;opacity:0.5;margin:4px 0 0;line-height:1.4;">Choose from 11 color themes. Changes apply immediately.</p>
          </div>

          <!-- Updates Section -->
          <div style="background:rgba(255,255,255,0.02);padding:14px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
            <h4 style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;margin:0 0 8px;color:var(--neon-cyan);letter-spacing:0.08em;">🔄 UPDATES & MAINTENANCE</h4>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-main);display:block;margin-bottom:2px;">Current Version</label>
                <span style="font-family:Orbitron,monospace;font-size:9px;opacity:0.65;">v1.3.8 (2026-02-18)</span>
              </div>
              <button class="btn-export" style="font-size:10px;padding:4px 12px;">Check for Updates</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="settings-auto-update" checked style="margin:0;">
              <label for="settings-auto-update" style="font-size:10px;cursor:pointer;">Auto-check for updates on startup</label>
            </div>
            <p style="font-size:9px;opacity:0.5;margin:8px 0 0;line-height:1.4;">Player Agent automatically checks for new releases on GitHub. Update notifications will appear in the app header.</p>
          </div>

          <!-- About Section -->
          <div style="background:rgba(255,255,255,0.02);padding:14px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
            <h4 style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;margin:0 0 12px;color:var(--neon-cyan);letter-spacing:0.08em;text-align:center;">ℹ️ ABOUT PLAYER AGENT</h4>
            <div style="text-align:center;">
              <div style="margin:0 auto 12px;width:48px;height:48px;background:linear-gradient(135deg, var(--neon-green), var(--neon-cyan));border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#020617" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <p style="font-size:10px;opacity:0.5;margin:0 0 12px;">CS2 Performance & Optimization Platform</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.02);padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);">
                  <div style="opacity:0.5;margin-bottom:2px;">Version</div>
                  <div style="font-family:Orbitron,monospace;color:var(--neon-green);">v1.3.8</div>
                </div>
                <div style="background:rgba(255,255,255,0.02);padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);">
                  <div style="opacity:0.5;margin-bottom:2px;">Release</div>
                  <div style="font-family:Orbitron,monospace;color:var(--neon-green);">2026-02-18</div>
                </div>
                <div style="background:rgba(255,255,255,0.02);padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);">
                  <div style="opacity:0.5;margin-bottom:2px;">License</div>
                  <div style="font-family:Orbitron,monospace;color:var(--neon-green);">MIT</div>
                </div>
                <div style="background:rgba(255,255,255,0.02);padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);">
                  <div style="opacity:0.5;margin-bottom:2px;">Framework</div>
                  <div style="font-family:Orbitron,monospace;color:var(--neon-green);">Tauri 1.8</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                <button class="btn-export" style="font-size:9px;padding:4px 10px;">📘 Docs</button>
                <button class="btn-export" style="font-size:9px;padding:4px 10px;">🐙 GitHub</button>
                <button class="btn-export" style="font-size:9px;padding:4px 10px;">💬 Discord</button>
              </div>
              <p style="font-size:8px;opacity:0.4;margin:12px 0 0;line-height:1.4;">Created by aim.camp team • Built with ❤️ for the CS2 community<br>Not affiliated with Valve Corporation</p>
            </div>
          </div>

        </div>
        <div class="adv-modal-actions" style="margin-top:12px;">
          <button class="adv-save" id="settings-save">SAVE & CLOSE</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Load current theme
    const themeSelect = document.getElementById("settings-theme-select") as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = THEMES[currentThemeIdx].name;
      themeSelect.addEventListener("change", () => {
        const idx = THEMES.findIndex(t => t.name === themeSelect.value);
        if (idx >= 0) applyTheme(idx);
      });
    }
    
    // LLM Provider Configuration
    const llmProviderSelect = document.getElementById("settings-llm-provider") as HTMLSelectElement;
    const llmStatus = document.getElementById("settings-llm-status");
    const cloudConfig = document.getElementById("settings-cloud-config");
    const localConfig = document.getElementById("settings-local-config");
    const llmEndpoint = document.getElementById("settings-llm-endpoint") as HTMLInputElement;
    const llmApiKey = document.getElementById("settings-llm-apikey") as HTMLInputElement;
    const llmGpuLayers = document.getElementById("settings-llm-gpu-layers") as HTMLInputElement;
    const llmQuant = document.getElementById("settings-llm-quant") as HTMLSelectElement;
    const llmDownloadBtn = document.getElementById("settings-llm-download") as HTMLButtonElement;
    const llmTestBtn = document.getElementById("settings-llm-test") as HTMLButtonElement;
    const llmSaveBtn = document.getElementById("settings-llm-save") as HTMLButtonElement;
    const llmTestResult = document.getElementById("settings-llm-test-result");
    const llmDownloadProgress = document.getElementById("settings-llm-download-progress");
    const llmProgressBar = document.getElementById("settings-llm-progress-bar");
    const llmProgressText = document.getElementById("settings-llm-progress-text");
    
    // Load active provider
    llmService.getActiveProvider().then(provider => {
      if (provider && llmProviderSelect) {
        llmProviderSelect.value = provider.id;
        updateLLMConfig(provider.id);
      }
    }).catch(console.error);
    
    function updateLLMConfig(providerId: string) {
      if (!providerId) {
        if (cloudConfig) cloudConfig.style.display = "none";
        if (localConfig) localConfig.style.display = "none";
        if (llmStatus) {
          llmStatus.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.3);"></span><span>Não configurado</span>`;
        }
        return;
      }
      
      llmService.getActiveProvider().then(provider => {
        if (!provider) return;
        
        const isCloud = provider.provider_type === "Cloud";
        if (cloudConfig) cloudConfig.style.display = isCloud ? "block" : "none";
        if (localConfig) localConfig.style.display = isCloud ? "none" : "block";
        
        // Update status
        const statusLabel = llmService.getStatusLabel(provider.status);
        const statusColor = provider.status === "Active" ? "var(--neon-green)" : 
                           provider.status === "Downloaded" ? "var(--neon-cyan)" :
                           typeof provider.status === "object" && "Downloading" in provider.status ? "var(--neon-cyan)" :
                           "rgba(255,100,100,0.8)";
        
        if (llmStatus) {
          llmStatus.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};"></span><span>${statusLabel}</span>`;
        }
        
        // Load config values
        if (isCloud) {
          if (llmEndpoint) llmEndpoint.value = provider.config.endpoint || "";
          if (llmApiKey) llmApiKey.value = provider.config.api_key || "";
        } else {
          if (llmGpuLayers) llmGpuLayers.value = String(provider.config.gpu_layers || 35);
          if (llmQuant) llmQuant.value = provider.config.quantization || "q4";
        }
      }).catch(console.error);
    }
    
    // Provider selection change
    if (llmProviderSelect) {
      llmProviderSelect.addEventListener("change", () => {
        updateLLMConfig(llmProviderSelect.value);
      });
    }
    
    // Test connection
    if (llmTestBtn) {
      llmTestBtn.addEventListener("click", async () => {
        if (!llmProviderSelect.value) {
          if (llmTestResult) {
            llmTestResult.textContent = "⚠️ Selecione um provider primeiro";
            llmTestResult.style.opacity = "1";
            llmTestResult.style.color = "rgba(255,200,100,0.9)";
          }
          return;
        }
        
        llmTestBtn.disabled = true;
        llmTestBtn.textContent = "🔄 Testing...";
        
        try {
          const requirements = await llmService.checkRequirements(llmProviderSelect.value);
          if (requirements.length === 0) {
            if (llmTestResult) {
              llmTestResult.textContent = "✅ Todos os requisitos satisfeitos";
              llmTestResult.style.opacity = "1";
              llmTestResult.style.color = "var(--neon-green)";
            }
          } else {
            if (llmTestResult) {
              llmTestResult.textContent = `⚠️ Requisitos em falta: ${requirements.join(", ")}`;
              llmTestResult.style.opacity = "1";
              llmTestResult.style.color = "rgba(255,200,100,0.9)";
            }
          }
        } catch (error) {
          if (llmTestResult) {
            llmTestResult.textContent = `❌ Erro: ${error}`;
            llmTestResult.style.opacity = "1";
            llmTestResult.style.color = "rgba(255,100,100,0.9)";
          }
        } finally {
          llmTestBtn.disabled = false;
          llmTestBtn.textContent = "🧪 Test Connection";
          setTimeout(() => {
            if (llmTestResult) llmTestResult.style.opacity = "0";
          }, 5000);
        }
      });
    }
    
    // Save configuration
    if (llmSaveBtn) {
      llmSaveBtn.addEventListener("click", async () => {
        if (!llmProviderSelect.value) {
          toast("⚠️ Selecione um provider primeiro");
          return;
        }
        
        llmSaveBtn.disabled = true;
        llmSaveBtn.textContent = "💾 Saving...";
        
        try {
          const provider = await llmService.getActiveProvider();
          if (!provider) throw new Error("Provider não encontrado");
          
          const isCloud = provider.provider_type === "Cloud";
          const config = isCloud ? {
            endpoint: llmEndpoint?.value || provider.config.endpoint,
            api_key: llmApiKey?.value || provider.config.api_key,
          } : {
            gpu_layers: Number(llmGpuLayers?.value || 35),
            quantization: llmQuant?.value || "q4",
          };
          
          await llmService.updateProviderConfig(llmProviderSelect.value, config);
          await llmService.setActiveProvider(llmProviderSelect.value);
          await llmService.enableProvider(llmProviderSelect.value, true);
          
          toast("✅ Configuração LLM salva com sucesso");
          updateLLMConfig(llmProviderSelect.value);
        } catch (error) {
          toast(`❌ Erro ao salvar: ${error}`);
        } finally {
          llmSaveBtn.disabled = false;
          llmSaveBtn.textContent = "💾 Save Configuration";
        }
      });
    }
    
    // Download model
    if (llmDownloadBtn) {
      llmDownloadBtn.addEventListener("click", async () => {
        if (!llmProviderSelect.value) {
          toast("⚠️ Selecione um provider local primeiro");
          return;
        }
        
        llmDownloadBtn.disabled = true;
        llmDownloadBtn.style.display = "none";
        if (llmDownloadProgress) llmDownloadProgress.style.display = "flex";
        
        try {
          await llmService.downloadModel(llmProviderSelect.value, (progress) => {
            if (llmProgressBar) llmProgressBar.style.width = `${progress}%`;
            if (llmProgressText) llmProgressText.textContent = `${Math.round(progress)}%`;
          });
          
          toast("✅ Modelo descarregado com sucesso");
          updateLLMConfig(llmProviderSelect.value);
        } catch (error) {
          toast(`❌ Erro no download: ${error}`);
        } finally {
          llmDownloadBtn.disabled = false;
          llmDownloadBtn.style.display = "inline-block";
          if (llmDownloadProgress) llmDownloadProgress.style.display = "none";
        }
      });
    }
    
    document.getElementById("settings-close")!.addEventListener("click", () => overlay.remove());
    document.getElementById("settings-save")!.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // ── 1-Click LLM install buttons ───────────────────────────────
    const installLog = document.getElementById("install-ollama-log");

    function setInstallStatus(id: string, msg: string, color?: string) {
      const el = document.getElementById(`install-status-${id}`);
      if (el) { el.textContent = msg; if (color) el.style.color = color; }
    }

    // Install Ollama engine
    document.getElementById("install-btn-ollama")?.addEventListener("click", async () => {
      const btn = document.getElementById("install-btn-ollama") as HTMLButtonElement;
      btn.disabled = true; btn.textContent = "⏳ Instalando...";
      setInstallStatus("ollama", "a instalar...", "var(--neon-cyan)");
      if (installLog) { installLog.style.display = "block"; installLog.textContent = "A descarregar OllamaSetup.exe..."; }
      try {
        const msg = await invoke<string>("llm_install_ollama");
        setInstallStatus("ollama", "✅ Instalado", "var(--neon-green)");
        if (installLog) installLog.textContent = msg;
        toast("Ollama instalado com sucesso!");
        btn.textContent = "✅ Instalado";
      } catch (e) {
        setInstallStatus("ollama", "❌ Erro", "#ef4444");
        if (installLog) installLog.textContent = String(e);
        btn.disabled = false; btn.textContent = "📥 Instalar Ollama";
      }
    });

    // Download Llama 3.2 3B
    document.getElementById("install-btn-llama")?.addEventListener("click", async () => {
      const btn = document.getElementById("install-btn-llama") as HTMLButtonElement;
      btn.disabled = true; btn.textContent = "⏳ Downloading...";
      setInstallStatus("llama", "a descarregar...", "var(--neon-cyan)");
      if (installLog) { installLog.style.display = "block"; installLog.textContent = "ollama pull llama3.2:3b (pode demorar vários minutos)..."; }
      try {
        const msg = await invoke<string>("llm_download_model", { providerId: "llama-3.2-3b" });
        setInstallStatus("llama", "✅ Pronto", "var(--neon-green)");
        if (installLog) installLog.textContent = msg;
        toast("Llama 3.2 3B pronto a usar!");
        btn.textContent = "✅ Download concluído";
      } catch (e) {
        setInstallStatus("llama", "❌ Erro", "#ef4444");
        if (installLog) installLog.textContent = `Erro: ${e}`;
        btn.disabled = false; btn.textContent = "⬇️ Download";
      }
    });

    // Download Nemotron-Mini 4B (NVIDIA text LLM — works on consumer RTX via Ollama)
    document.getElementById("install-btn-llama8b")?.addEventListener("click", async () => {
      const btn = document.getElementById("install-btn-llama8b") as HTMLButtonElement;
      btn.disabled = true; btn.textContent = "⏳ Downloading...";
      setInstallStatus("llama8b", "a descarregar...", "var(--neon-cyan)");
      if (installLog) { installLog.style.display = "block"; installLog.textContent = "ollama pull nemotron-mini (pode demorar vários minutos, ~2.7GB)..."; }
      try {
        const msg = await invoke<string>("llm_download_model", { providerId: "nemotron-mini" });
        setInstallStatus("llama8b", "✅ Pronto", "var(--neon-green)");
        if (installLog) installLog.textContent = msg;
        toast("Nemotron-Mini 4B pronto a usar!");
        btn.textContent = "✅ Download concluído";
      } catch (e) {
        setInstallStatus("llama8b", "❌ Erro", "#ef4444");
        if (installLog) installLog.textContent = `Erro: ${e}`;
        btn.disabled = false; btn.textContent = "⬇️ Download";
      }
    });

    // PersonaPlex — open HuggingFace page (not installable on gaming PCs via Ollama)
    document.getElementById("install-btn-personaplex")?.addEventListener("click", async () => {
      await shellOpen("https://huggingface.co/nvidia/personaplex-7b-v1");
    });
  } // end showSettingsModal

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  /* ── 1. BIOS (informational — must be set manually in BIOS/UEFI) ── */
  const c1 = card("BIOS (Manual)", "ℹ These are recommendations only — BIOS settings must be configured manually in your motherboard BIOS/UEFI setup. The app cannot change BIOS settings.");
  c1.dataset.section = "bios";
  c1.appendChild(infoRow("Disable SVM / Virtualization + Hyper-V", TIP.b_svm));
  c1.appendChild(infoRow("Disable C-States + force CPU 100%", TIP.b_cst));
  c1.appendChild(infoRow("Disable Cool'n'Quiet / SpeedStep", TIP.b_cool));
  c1.appendChild(infoRow("Enable XMP/DOCP (check RAM speed)", TIP.b_xmp));
  c1.appendChild(infoRow("Enable ReSize BAR (SAM)", TIP.b_rbar));
  c1.appendChild(infoRow("Enable Above 4G Decoding", TIP.b_4g));

  /* ── 2. Windows ── toggles are ONLY applied when you click the button below ── */
  const c2 = card("Windows", '⚠ Changes are only applied when you click "Apply Windows".');
  c2.dataset.section = "windows";
  c2.appendChild(toggle("w_power", "Ultimate Performance Plan", true, TIP.w_power));
  c2.appendChild(toggle("w_dvr", "Disable Game DVR", true, TIP.w_dvr));
  c2.appendChild(toggle("w_bar", "Disable Game Bar", true, TIP.w_bar));
  c2.appendChild(toggle("w_mode", "Disable Game Mode", true, TIP.w_mode));
  c2.appendChild(toggle("w_hib", "Disable Hibernation", true, TIP.w_hib));
  c2.appendChild(toggle("w_mouse", "Disable Mouse Accel", true, TIP.w_mouse));
  c2.appendChild(toggle("w_fso", "Disable Fullscreen Optim", true, TIP.w_fso));
  c2.appendChild(toggle("w_vis", "Disable Visual Effects", true, TIP.w_vis));
  c2.appendChild(toggle("w_trans", "Disable Transparency", true, TIP.w_trans));
  c2.appendChild(toggle("w_bgapps", "Disable Background Apps", true, TIP.w_bgapps));
  c2.appendChild(toggle("w_notif", "Disable Notifications", true, TIP.w_notif));
  c2.appendChild(toggle("w_cort", "Disable Cortana", true, TIP.w_cort));
  c2.appendChild(toggle("w_idx", "Disable Search Indexing", false, TIP.w_idx));
  c2.appendChild(toggle("w_hgs", "Hardware GPU Scheduling", true, TIP.w_hgs));
  c2.appendChild(toggle("w_hpet", "Disable HPET", true, TIP.w_hpet));
  c2.appendChild(toggle("w_pthrot", "Disable Power Throttling", true, TIP.w_pthrot));
  c2.appendChild(toggle("w_park", "Disable Core Parking", true, TIP.w_park));
  c2.appendChild(toggle("w_temp", "Clean Temp Files", false, TIP.w_temp));
  c2.appendChild(toggle("w_cs2gpu", "CS2: High Perf GPU", true, TIP.w_cs2gpu));
  c2.appendChild(toggle("w_deliver", "Disable Delivery Optim", true, TIP.w_deliver));
  c2.appendChild(toggle("w_widgets", "Disable Widgets (Win11)", false, TIP.w_widgets));
  c2.appendChild(toggle("w_memcomp", "Disable Memory Compress", false, TIP.w_memcomp));
  c2.appendChild(toggle("w_uxuser", "Disable Connected UX", true, TIP.w_uxuser));
  c2.appendChild(toggle("w_spectre", "Disable CPU Mitigations", false, TIP.w_spectre));
  c2.appendChild(toggle("w_lastaccess", "Disable NTFS Last Access", true, TIP.w_lastaccess));
  c2.appendChild(toggle("w_8dot3", "Disable 8.3 Name Creation", true, TIP.w_8dot3));
  c2.appendChild(toggle("w_mmcss", "MMCSS Gaming Priority", true, TIP.w_mmcss));
  c2.appendChild(toggle("w_largecache", "Disable Large System Cache", true, TIP.w_largecache));
  c2.appendChild(cardRecommendBtn("windows"));
  c2.appendChild(cardApplyBtn("Apply Windows", "windows", "🛡"));

  /* ── 3. Network ──────────────────────────────────────────────── */
  const c3 = card("Network", '⚠ Changes are only applied when you click "Apply Network".');
  c3.dataset.section = "network";
  c3.appendChild(toggle("n_nagle", "Disable Nagle (TcpNoDelay)", true, TIP.n_nagle));
  c3.appendChild(toggle("n_tcp", "Optimize TCP stack", true, TIP.n_tcp));
  c3.appendChild(toggle("n_dns", "Flush DNS", true, TIP.n_dns));
  c3.appendChild(toggle("n_wifi", "Disable Wi-Fi Power Save", false, TIP.n_wifi));
  c3.appendChild(toggle("n_throttle", "Disable Network Throttle", true, TIP.n_throttle));
  c3.appendChild(toggle("n_ecn", "Disable ECN Capability", true, TIP.n_ecn));
  c3.appendChild(toggle("n_rss", "Enable RSS (Recv Scaling)", true, TIP.n_rss));
  c3.appendChild(toggle("n_netbios", "Disable NetBIOS over TCP", true, TIP.n_netbios));
  c3.appendChild(toggle("n_lmhosts", "Disable LMHOSTS Lookup", true, TIP.n_lmhosts));
  c3.appendChild(toggle("n_ctcp", "Enable CTCP Congestion", true, TIP.n_ctcp));
  c3.appendChild(cardRecommendBtn("network"));
  c3.appendChild(cardApplyBtn("Apply Network", "network", "🛡"));

  /* ── 4. NVIDIA ───────────────────────────────────────────────── */
  const c4 = card("NVIDIA", '⚠ Changes are only applied when you click "Apply NVIDIA".');
  c4.dataset.section = "nvidia";
  c4.appendChild(toggle("nv_perf", "Max Performance Mode", true, TIP.nv_perf));
  c4.appendChild(toggle("nv_vsync", "Disable V-Sync global", true, TIP.nv_vsync));
  c4.appendChild(toggle("nv_lat", "Ultra Low Latency", true, TIP.nv_lat));
  c4.appendChild(toggle("nv_thread", "Threaded Optimization", true, TIP.nv_thread));
  c4.appendChild(toggle("nv_aniso", "AF: App-controlled", false, TIP.nv_aniso));
  c4.appendChild(toggle("nv_shader", "Clear Shader Cache", false, TIP.nv_shader));
  c4.appendChild(toggle("nv_reflex", "Force Reflex On+Boost", true, TIP.nv_reflex));
  c4.appendChild(toggle("nv_sharp", "Disable Image Sharpening", false, TIP.nv_sharp));
  c4.appendChild(toggle("nv_texfilt", "Texture Filtering: Perf", true, TIP.nv_texfilt));
  c4.appendChild(toggle("nv_prerender", "Pre-Rendered Frames = 1", true, TIP.nv_prerender));
  c4.appendChild(toggle("nv_ambient", "Disable Ambient Occlusion", true, TIP.nv_ambient));
  c4.appendChild(toggle("nv_fxaa", "Disable Global FXAA", true, TIP.nv_fxaa));
  c4.appendChild(cardRecommendBtn("nvidia"));
  c4.appendChild(cardApplyBtn("Apply NVIDIA", "nvidia", "🛡"));

  /* ── 5. Services ─────────────────────────────────────────────── */
  const c5 = card("Services", '⚠ Changes are only applied when you click "Apply Services".');
  c5.dataset.section = "services";
  c5.appendChild(toggle("s_sys", "SysMain (Superfetch)", true, TIP.s_sys));
  c5.appendChild(toggle("s_diag", "DiagTrack (Telemetry)", true, TIP.s_diag));
  c5.appendChild(toggle("s_ws", "Windows Search", false, TIP.s_ws));
  c5.appendChild(toggle("s_print", "Print Spooler", false, TIP.s_print));
  c5.appendChild(toggle("s_fax", "Fax", true, TIP.s_fax));
  c5.appendChild(toggle("s_xbox", "Xbox Services (all)", true, TIP.s_xbox));
  c5.appendChild(toggle("s_cdp", "Connected Devices Platform", true, TIP.s_cdp));
  c5.appendChild(toggle("s_wpn", "WpnUserService (Push)", true, TIP.s_wpn));
  c5.appendChild(toggle("s_diagpol", "Diagnostic Policy", false, TIP.s_diagpol));
  c5.appendChild(toggle("s_remote", "Remote Registry", true, TIP.s_remote));
  c5.appendChild(toggle("s_maps", "MapsBroker", true, TIP.s_maps));
  c5.appendChild(toggle("s_phonesvc", "Phone Service", true, TIP.s_phonesvc));
  c5.appendChild(toggle("s_retaildemo", "RetailDemo Service", true, TIP.s_retaildemo));
  c5.appendChild(cardRecommendBtn("services"));
  c5.appendChild(cardApplyBtn("Apply Services", "services", "🛡"));

  /* ── 6. autoexec.cfg ─────────────────────────────────────────── */
  const c6 = card("autoexec.cfg", '⚠ Changes are only applied when you click "Save autoexec".');
  c6.dataset.section = "autoexec";
  c6.appendChild(toggle("ae_on", "Generate autoexec.cfg", true, TIP.ae_on, false));
  c6.appendChild(numInput("ae_fps", "fps_max", "400"));
  c6.appendChild(numInput("ae_rate", "rate", "786432"));
  c6.appendChild(numInput("ae_int", "cl_interp", "0"));
  c6.appendChild(numInput("ae_ir", "cl_interp_ratio", "1"));
  c6.appendChild(numInput("ae_ur", "cl_updaterate", "128"));
  c6.appendChild(numInput("ae_cr", "cl_cmdrate", "128"));
  c6.appendChild(toggle("ae_raw", "m_rawinput 1", true, TIP.ae_raw, false));
  const customLabel = document.createElement("label");
  customLabel.textContent = "Custom commands:";
  customLabel.className = "helper";
  c6.appendChild(customLabel);
  c6.appendChild(textArea("ae_custom", 'bind "c" "toggle cl_righthand 0 1"'));
  {
    const btnAeRec = document.createElement("button");
    btnAeRec.className = "card-apply-btn card-recommend-btn";
    btnAeRec.innerHTML = "⚡ Recommended Config";
    btnAeRec.title = "Apply recommended autoexec values based on your hardware (fps_max, rate, threads, etc.)";
    btnAeRec.addEventListener("click", applyAutoexecRecommendations);
    c6.appendChild(btnAeRec);
    const btn = document.createElement("button");
    btn.className = "card-apply-btn card-apply-save";
    btn.innerHTML = "💾 Save autoexec.cfg";
    btn.title = "Generate and save the autoexec.cfg file to the CS2 folder";
    btn.addEventListener("click", () => runSectionAsAdmin("autoexec", "autoexec.cfg"));
    c6.appendChild(btn);
  }

  /* ── 7. Launch Options ───────────────────────────────────────── */
  const c7 = card("Launch Options", '⚠ Click "Copy" and paste in Steam → CS2 → Properties → Launch Options.');
  c7.dataset.section = "launch";
  c7.appendChild(toggle("lo_exec", "+exec autoexec.cfg", true, TIP.lo_exec, false));
  c7.appendChild(toggle("lo_nvid", "-novid", true, TIP.lo_nvid, false));
  c7.appendChild(toggle("lo_joy", "-nojoy", true, TIP.lo_joy, false));
  c7.appendChild(toggle("lo_high", "-high", true, TIP.lo_high, false));
  c7.appendChild(toggle("lo_allow", "-allow_third_party_software", false, TIP.lo_allow, false));
  c7.appendChild(numInput("lo_thr", "threads", ""));
  const argsLabel = document.createElement("label");
  argsLabel.textContent = "Extra args:";
  argsLabel.className = "helper";
  c7.appendChild(argsLabel);
  c7.appendChild(textArea("lo_custom", ""));
  {
    const btnLoRec = document.createElement("button");
    btnLoRec.className = "card-apply-btn card-recommend-btn";
    btnLoRec.innerHTML = "⚡ Recommended Config";
    btnLoRec.title = "Apply recommended launch options (threads based on your CPU cores)";
    btnLoRec.addEventListener("click", applyLaunchRecommendations);
    c7.appendChild(btnLoRec);
    const btn = document.createElement("button");
    btn.className = "card-apply-btn card-apply-copy";
    btn.innerHTML = "📋 Copy Launch Options";
    btn.title = "Copy the launch options to clipboard";
    btn.addEventListener("click", copyLaunchOptions);
    c7.appendChild(btn);
  }

  /* ── 8. Extras / FACEIT ──────────────────────────────────────── */
  const c8 = card("Extras & FACEIT", '⚠ Changes are only applied when you click "Apply Extras".');
  c8.dataset.section = "extras";
  c8.appendChild(infoRow("FACEIT Anti-Cheat status", TIP.x_faceit));
  c8.appendChild(toggle("x_steam", "Disable Steam Overlay", true, TIP.x_steam));
  c8.appendChild(toggle("x_disc", "Disable Discord Overlay", true, TIP.x_disc));
  c8.appendChild(toggle("x_resp", "SystemResponsiveness = 0", true, TIP.x_resp));
  c8.appendChild(toggle("x_gpup", "GPU Priority for games", true, TIP.x_gpup));
  c8.appendChild(toggle("x_prio", "PrioritySeparation tuned", true, TIP.x_prio));
  c8.appendChild(toggle("x_cs2p", "CS2: High Process Priority", true, TIP.x_cs2p));

  // CS2 CPU Affinity — physical cores only (HT/SMT disabled per-process)
  {
    const affinityRow = document.createElement("div");
    affinityRow.className = "toggle-row";
    affinityRow.style.cssText = "gap:6px;flex-wrap:wrap;align-items:center;";
    affinityRow.innerHTML = `
      <label title="${TIP.x_cs2_affinity}" style="flex:1;min-width:200px;cursor:help;">⚡ CS2: Physical Cores Apenas <span style="font-size:9px;opacity:0.4;font-weight:400;">(sem HT/SMT)</span></label>
      <span id="cs2-affinity-info" style="font-size:9px;opacity:0.45;font-family:monospace;min-width:140px;">a detectar CPU...</span>
      <button id="btn-cs2-affinity-apply" class="btn-export" style="font-size:10px;padding:3px 10px;">Aplicar</button>
      <button id="btn-cs2-affinity-restore" class="btn-adv" style="font-size:10px;padding:3px 10px;">Restaurar</button>
      <span id="cs2-affinity-status" style="font-size:10px;opacity:0.6;min-width:80px;"></span>
    `;
    c8.appendChild(affinityRow);

    // Populate CPU topology info
    invoke<string>("get_cpu_topology").then(info => {
      const el = affinityRow.querySelector<HTMLElement>("#cs2-affinity-info");
      if (el) el.textContent = info;
    }).catch(() => {});

    // Apply: physical cores only
    affinityRow.querySelector<HTMLButtonElement>("#btn-cs2-affinity-apply")?.addEventListener("click", async () => {
      const btn = affinityRow.querySelector<HTMLButtonElement>("#btn-cs2-affinity-apply")!;
      const status = affinityRow.querySelector<HTMLElement>("#cs2-affinity-status");
      btn.disabled = true; btn.textContent = "⏳...";
      try {
        const msg = await invoke<string>("set_cs2_cpu_affinity");
        if (status) { status.textContent = "✅ Aplicado"; status.style.color = "var(--neon-green)"; }
        toast(msg);
      } catch (e) {
        if (status) { status.textContent = "❌ Erro"; status.style.color = "#ef4444"; }
        toast(`Afinidade CPU: ${e}`, true);
      } finally { btn.disabled = false; btn.textContent = "Aplicar"; }
    });

    // Restore: all logical cores
    affinityRow.querySelector<HTMLButtonElement>("#btn-cs2-affinity-restore")?.addEventListener("click", async () => {
      const btn = affinityRow.querySelector<HTMLButtonElement>("#btn-cs2-affinity-restore")!;
      const status = affinityRow.querySelector<HTMLElement>("#cs2-affinity-status");
      btn.disabled = true; btn.textContent = "⏳...";
      try {
        const msg = await invoke<string>("restore_cs2_affinity");
        if (status) { status.textContent = "↩ Restaurado"; status.style.color = "rgba(255,255,255,0.5)"; }
        toast(msg);
      } catch (e) {
        if (status) { status.textContent = "❌ Erro"; status.style.color = "#ef4444"; }
        toast(`Restaurar afinidade: ${e}`, true);
      } finally { btn.disabled = false; btn.textContent = "Restaurar"; }
    });
  }
  c8.appendChild(toggle("x_telem", "Disable Telemetry Tasks", true, TIP.x_telem));
  c8.appendChild(toggle("x_timer", "Timer Resolution 0.5ms", false, TIP.x_timer));
  c8.appendChild(toggle("x_msimode", "MSI Mode for GPU", false, TIP.x_msimode));
  c8.appendChild(toggle("x_pcie", "PCIe Link State Off", true, TIP.x_pcie));
  c8.appendChild(toggle("x_ndis", "Interrupt Moderation Off", false, TIP.x_ndis));
  c8.appendChild(toggle("x_large", "Enable Large Pages", false, TIP.x_large));
  c8.appendChild(cardRecommendBtn("extras"));
  c8.appendChild(cardApplyBtn("Apply Extras", "extras", "🛡"));

  /* ── 9. AI / Agent Configuration ─────────────────────────────── */
  const c9 = card("AI / Agent Configuration", "Configure Cloud Advisor API endpoint and credentials for AI-powered recommendations.");
  c9.dataset.section = "ai-agent";
  c9.innerHTML += `
    <div class="toggle-row" style="margin-bottom:8px;">
      <label>Cloud Advisor Endpoint</label>
      <input type="text" id="cfg-adv-endpoint" placeholder="https://api.example.com" style="flex:1;padding:4px 8px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
    </div>
    <div class="toggle-row" style="margin-bottom:8px;">
      <label>API Key</label>
      <input type="password" id="cfg-adv-key" placeholder="Enter API key" style="flex:1;padding:4px 8px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
    </div>
    <button class="btn-export" style="margin-top:8px;">Test Connection</button>
    <p style="font-size:10px;opacity:0.5;margin:8px 0 0;line-height:1.4;">Cloud Advisor provides AI-powered analysis and recommendations for hardware bottlenecks, system configs and CS2 performance. Click the purple "ADV" button in the header to manage credentials and view recommendations.</p>
  `;

  /* ── 10. Integrations & Webhooks ─────────────────────────────── */
  const c10 = card("Integrations & Webhooks", "Connect Discord and GitHub for automated feedback and issue reporting.");
  c10.dataset.section = "integrations";
  c10.innerHTML += `
    <div class="toggle-row" style="margin-bottom:8px;">
      <label>Discord Webhook URL</label>
      <input type="text" id="cfg-discord-webhook" placeholder="https://discord.com/api/webhooks/..." style="flex:1;padding:4px 8px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
    </div>
    <button class="btn-export" style="margin-top:8px;margin-bottom:16px;">Test Discord Webhook</button>
    <div class="toggle-row" style="margin-bottom:8px;">
      <label>GitHub Personal Access Token</label>
      <input type="password" id="cfg-github-token" placeholder="ghp_..." style="flex:1;padding:4px 8px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--neon-green);font-family:Rajdhani,monospace;">
    </div>
    <button class="btn-export" style="margin-top:8px;">Verify GitHub Token</button>
    <p style="font-size:10px;opacity:0.5;margin:12px 0 0;line-height:1.4;">Discord webhook enables feedback submission to your Discord server. GitHub token allows creating issues directly from the app. Both are optional and stored locally. Configure these in the Feedback tab to enable auto-submit features.</p>
  `;

  /* ── PRO TIPS (not toggleable — pure informational guidance) ───── */
  /* We inject a tips section below the grid, before the actions bar */
  const tipsSection = document.createElement("section");
  tipsSection.className = "tips-section";
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
      <div class="tip-item" title="Windows 10/11 enable Large System Cache by default which competes with games for RAM. Set LargeSystemCache to 0 in HKLMSYSTEMCurrentControlSetControlSession ManagerMemory Management.">
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
  const actions = document.createElement("section");
  actions.className = "actions";

  const btnExport = document.createElement("button");
  btnExport.className = "btn-export";
  btnExport.textContent = "Export .ps1";
  btnExport.title = "Generate a PowerShell optimization script (.ps1) with all selected settings and save it to disk";

  const btnImport2 = document.createElement("button");
  btnImport2.className = "btn-import";
  btnImport2.textContent = "Import .ps1";
  btnImport2.title = "Load a previously exported .ps1 script and restore its toggle/input settings to the form";

  const btnRun2 = document.createElement("button");
  btnRun2.className = "btn-run";
  btnRun2.textContent = "🛡 Apply All (Admin)";
  btnRun2.title = "Generate and execute ALL sections at once with Administrator privileges";

  /* ── Impact prediction bar ───────────────────────────────────── */
  const impactBar = document.createElement("div");
  impactBar.className = "impact-bar";
  impactBar.title = "Estimated FPS improvement based on selected features. Features already active on your system (blue LED) are excluded from this estimate.";
  impactBar.innerHTML = `<span class="impact-label">Est. FPS Gain</span><span class="impact-pct"><span id="impact-pct-val">+0.0%</span></span><span class="impact-sep">│</span><span class="impact-fps"><span id="impact-fps-val">+0 FPS</span></span>`;

  /* ── One-Click Recommend All Button ──────────────────────────── */
  const btnRecAll = document.createElement("button");
  btnRecAll.className = "btn-recommend-all";
  btnRecAll.innerHTML = "⚡ One-Click Config";
  btnRecAll.title = "Apply ALL recommended settings based on your hardware (Windows + Network + NVIDIA + Services + Autoexec + Launch + Extras)";
  btnRecAll.addEventListener("click", applyAllSysRecommendations);

  actions.appendChild(btnExport);
  actions.appendChild(btnImport2);
  actions.appendChild(btnRun2);
  actions.appendChild(btnRecAll);
  actions.appendChild(impactBar);

  /* ── SYS Schema Import Button ────────────────────────────────── */
  /* ── Signature (inside actions bar) ───────────────────── */
  const signature = buildSignature(true);
  actions.appendChild(signature);

  /* ── Tab: System Optimizer ─────────────────────────────────────── */
  const tabSys = document.createElement("div");
  tabSys.id = "tab-optimizer";
  tabSys.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;gap:3px;";

  const sysSub = buildSubTabs(["BIOS & Windows", "Network & GPU", "Services & Config", "Extras & Tips"]);
  tabSys.appendChild(sysSub.bar);

  // sub 0: BIOS & Windows
  const sysPane0 = document.createElement("main");
  sysPane0.className = "app-main";
  sysPane0.appendChild(c1);
  sysPane0.appendChild(c2);
  sysSub.panels[0].appendChild(sysPane0);

  // sub 1: Network & GPU
  const sysPane1 = document.createElement("main");
  sysPane1.className = "app-main";
  sysPane1.appendChild(c3);
  sysPane1.appendChild(c4);
  sysSub.panels[1].appendChild(sysPane1);

  // sub 2: Services & Config
  const sysPane2 = document.createElement("main");
  sysPane2.className = "app-main";
  sysPane2.appendChild(c5);
  sysPane2.appendChild(c6);
  sysPane2.appendChild(c7);
  sysSub.panels[2].appendChild(sysPane2);

  // sub 3: Extras & Tips
  const sysPane3 = document.createElement("main");
  sysPane3.className = "app-main";
  sysPane3.appendChild(c8);
  sysPane3.appendChild(c9);
  sysPane3.appendChild(c10);
  sysSub.panels[3].appendChild(sysPane3);
  sysSub.panels[3].appendChild(tipsSection);

  for (const p of sysSub.panels) tabSys.appendChild(p);
  tabSys.appendChild(actions);

  /* ── Enable drag reorder within cards ────────────────────────── */
  function enableCardDrag(cardEl: HTMLElement, onReorder?: (ids: string[]) => void) {
    const rows = Array.from(cardEl.querySelectorAll<HTMLElement>(":scope > .toggle-row"));
    if (rows.length < 2) return; // nothing to drag
    let draggedRow: HTMLElement | null = null;

    rows.forEach((row) => {
      // Add drag grip handle
      const grip = document.createElement("span");
      grip.className = "row-drag-grip";
      grip.textContent = "⠿";
      row.insertBefore(grip, row.firstChild);
      row.setAttribute("draggable", "true");

      row.addEventListener("dragstart", (e) => {
        if (_layoutEditMode) return; // don't interfere with layout edit mode
        draggedRow = row;
        row.classList.add("row-dragging");
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", "");
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("row-dragging");
        cardEl.querySelectorAll(".row-drag-over").forEach((r) => { r.classList.remove("row-drag-over"); });
        if (draggedRow && onReorder) {
          const currentRows = Array.from(cardEl.querySelectorAll<HTMLElement>(":scope > .toggle-row"));
          const ids = currentRows
            .map((r) => {
              const cb = r.querySelector<HTMLInputElement>("input[type=checkbox]");
              return cb?.id || r.dataset.cmdId || "";
            })
            .filter(Boolean);
          onReorder(ids);
        }
        draggedRow = null;
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedRow && draggedRow !== row && draggedRow.parentElement === row.parentElement) {
          e.dataTransfer!.dropEffect = "move";
          // Show insert indicator
          const rect = row.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          row.classList.toggle("row-drag-over-above", e.clientY < midY);
          row.classList.toggle("row-drag-over-below", e.clientY >= midY);
          row.classList.add("row-drag-over");
        }
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("row-drag-over", "row-drag-over-above", "row-drag-over-below");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("row-drag-over", "row-drag-over-above", "row-drag-over-below");
        if (draggedRow && draggedRow !== row && draggedRow.parentElement === row.parentElement) {
          const rect = row.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            row.before(draggedRow);
          } else if (row.nextSibling) {
            row.nextSibling.before(draggedRow);
          } else {
            row.parentElement!.appendChild(draggedRow);
          }
        }
      });
    });
  }

  /* ── Enable drag reorder within SYS cards ────────────────────── */
  [c2, c3, c4, c5, c6, c7, c8].forEach((sysCard) => {
    restoreSysCardOrder(sysCard);
    enableCardDrag(sysCard, (ids) => {
      const sec = sysCard.dataset.section;
      if (sec) saveSysCardOrder(sec, ids);
    });
  });

  /* ── Tab: CFG Manager ────────────────────────────────────────── */
  const tabCfg = document.createElement("div");
  tabCfg.id = "tab-cfg";
  tabCfg.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;gap:3px;";

  /* Helper: build a CFG command row (toggle or value input) with star toggle */
  function buildCfgRow(cmd: CfgCmd, container: HTMLElement, isPri: boolean) {
    let row: HTMLDivElement;
    if (cmd.type === "toggle") {
      row = toggle(cmd.id, cmd.label, cmd.on, cmd.tip, false);
    } else {
      row = document.createElement("div");
      row.className = "toggle-row";
      if (cmd.tip) row.title = cmd.tip;
      const lbl = document.createElement("label");
      lbl.htmlFor = cmd.id;
      lbl.textContent = cmd.label;
      const vi = document.createElement("input");
      vi.type = "text";
      vi.id = `${cmd.id}_v`;
      vi.value = cmd.val;
      vi.style.cssText =
        'width:56px;text-align:center;padding:2px 4px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:var(--neon-green);font-family:"Rajdhani",monospace;';
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = cmd.id;
      cb.checked = cmd.on;
      row.appendChild(lbl);
      row.appendChild(vi);
      row.appendChild(cb);
    }
    row.dataset.cmdId = cmd.id;

    // X remove button — removes command from this tab's layout (edit mode only)
    const xDel = document.createElement("button");
    xDel.className = "row-x-btn";
    xDel.innerHTML = "✕";
    xDel.title = "Remove this feature from the layout";
    xDel.addEventListener("click", (e) => {
      e.stopPropagation();
      const parentCard = row.closest<HTMLElement>(".card");
      row.classList.add("card-removing");
      setTimeout(() => {
        row.remove();
        // Refresh the "add feature" dropdown for this card
        if (parentCard) refreshAddFeatureMenu(parentCard);
      }, 250);
    });
    row.appendChild(xDel);

    // Star toggle button — ★ = Primary, ☆ = Secondary
    const star = document.createElement("button");
    star.className = "row-star-btn" + (isPri ? " starred" : "");
    star.innerHTML = isPri ? "★" : "☆";
    star.title = isPri ? "Move to Secondary" : "Move to Primary";
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCmdPrincipal(cmd.id, !isPri);
      if (_layoutEditMode) {
        // Incremental update: just remove the row from the current grid.
        // The command now belongs to the other panel. It will appear
        // there after the next full build (save / cancel / tab switch).
        const parentCard = row.closest<HTMLElement>(".card");
        row.remove();
        // If the card's grid became empty, show a placeholder message
        if (parentCard) {
          const grid = parentCard.querySelector(".cfg-grid");
          if (grid?.children.length === 0) {
            const empty = document.createElement("p");
            empty.style.cssText =
              "text-align:center;color:rgba(255,255,255,0.3);font-size:12px;padding:12px;";
            empty.textContent = "No commands — use ★ to add";
            grid.appendChild(empty);
          }
        }
      } else {
        // Save current values before rebuild so they survive
        const as = getActiveSchema();
        if (as) saveSchemaValues(as.id, collectFullState());
        rebuildCfgLayout();
      }
    });
    row.appendChild(star);
    container.appendChild(row);
  }

  /** Find CfgCmd object by ID */
  function findCfgCmd(cmdId: string): CfgCmd | null {
    for (const cat of CFG) {
      const found = cat.commands.find((c) => c.id === cmdId);
      if (found) return found;
    }
    return null;
  }

  /** Get all command IDs for a given category name */
  function getCatCommandIds(catName: string): string[] {
    const cat = CFG.find((c) => c.name === catName);
    return cat ? cat.commands.map((c) => c.id) : [];
  }

  /** Get command IDs currently visible in a card element */
  function getCardVisibleIds(cardEl: HTMLElement): Set<string> {
    const ids = new Set<string>();
    cardEl.querySelectorAll<HTMLElement>("[data-cmd-id]").forEach((row) => {
      ids.add(row.dataset.cmdId!);
    });
    return ids;
  }

  /** Refresh the "add feature" dropdown options for a card */
  function refreshAddFeatureMenu(cardEl: HTMLElement) {
    const catName = cardEl.dataset.catName;
    if (!catName) return;
    const menu = cardEl.querySelector<HTMLElement>(".add-feature-menu");
    if (!menu) return;
    const allIds = getCatCommandIds(catName);
    const visibleIds = getCardVisibleIds(cardEl);
    const missingIds = allIds.filter((id) => !visibleIds.has(id));
    menu.innerHTML = "";
    // Helper to insert a cmd row back into the card
    const insertCmdRow = (cmd: CfgCmd) => {
      const tabView = getCurrentCfgTabView();
      const inPrincipal = tabView === "Principal";
      const addWrap = cardEl.querySelector(".add-feature-wrap");
      buildCfgRow(cmd, cardEl, inPrincipal);
      const newRow = cardEl.lastElementChild as HTMLElement;
      if (addWrap && newRow && newRow !== addWrap) {
        addWrap.before(newRow);
        newRow.classList.add("row-balloon");
        newRow.setAttribute("draggable", "true");
        newRow.querySelectorAll<HTMLInputElement>("input").forEach((inp) => { inp.disabled = true; });
      }
      refreshAddFeatureMenu(cardEl);
    };

    if (missingIds.length > 0) {
      for (const id of missingIds) {
        const cmd = findCfgCmd(id);
        if (!cmd) continue;
        const item = document.createElement("button");
        item.className = "add-feature-item";
        item.textContent = `➕ ${cmd.label}`;
        item.title = cmd.tip || "";
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          insertCmdRow(cmd);
        });
        menu.appendChild(item);
      }
    } else {
      const p = document.createElement("p");
      p.className = "add-feature-empty";
      p.textContent = "All catalog features are already in the layout";
      menu.appendChild(p);
    }

    // Separator + Custom command option (always present)
    const sep = document.createElement("div");
    sep.className = "add-feature-sep";
    menu.appendChild(sep);
    const customBtn = document.createElement("button");
    customBtn.className = "add-feature-item add-feature-custom";
    customBtn.innerHTML = `✏️ Custom command...`;
    customBtn.title = "Add a custom CS2 command with a name and value of your choice";
    customBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      menu.style.display = "none";
      const cmdName = await showInputModal("Command", "E.g.: cl_crosshairgap, sensitivity...");
      if (!cmdName?.trim()) return;
      const cmdVal = await showInputModal("Value", `Value for ${cmdName.trim()} (e.g.: 0, 1, 2.5)`);
      if (cmdVal === null) return;
      // Create a custom CfgCmd on the fly
      const customId = "custom_" + cmdName.trim().replaceAll(/\W/g, "_") + "_" + Date.now();
      const customCmd: CfgCmd = {
        id: customId,
        cmd: cmdName.trim(),
        label: cmdName.trim(),
        type: "value",
        on: true,
        val: cmdVal.trim(),
        tip: "Custom command",
      };
      insertCmdRow(customCmd);
      menu.style.display = "flex";
    });
    menu.appendChild(customBtn);
  }

  /** Build the "Add feature" button + dropdown for a category card */
  function buildAddFeatureBtn(cardEl: HTMLElement, catName: string) {
    cardEl.dataset.catName = catName;
    const wrap = document.createElement("div");
    wrap.className = "add-feature-wrap";
    const btn = document.createElement("button");
    btn.className = "add-feature-btn";
    btn.innerHTML = "➕ Add Feature";
    btn.title = `Add a removed feature back to "${catName}"`;
    const menu = document.createElement("div");
    menu.className = "add-feature-menu";
    menu.style.display = "none";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display !== "none";
      // Close all other open menus
      document.querySelectorAll<HTMLElement>(".add-feature-menu").forEach((m) => { m.style.display = "none"; });
      if (!isOpen) {
        refreshAddFeatureMenu(cardEl);
        menu.style.display = "flex";
      }
    });
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    cardEl.appendChild(wrap);
  }

  /** Guard for CFG sub-tab switching — blocks if layout edit mode is active */
  function cfgEditGuard(): boolean {
    if (_layoutEditMode) {
      pulseLayoutSaveBtn();
      return false;
    }
    return true;
  }
  const cfgSub = buildSubTabs(["⚡ Primary", "🔧 Secondary"], cfgEditGuard);

  /* ── Principal panel — most-used / urgent commands ───────────── */
  const priGrid = document.createElement("main");
  priGrid.className = "cfg-grid";
  const priSet = getPrincipalSet();

  for (const cat of CFG) {
    const priCmds = cat.commands.filter((c) => priSet.has(c.id));
    if (priCmds.length === 0) continue;
    const cc = card(cat.name);
    for (const cmd of priCmds) buildCfgRow(cmd, cc, true);
    buildAddFeatureBtn(cc, cat.name);
    priGrid.appendChild(cc);
  }
  cfgSub.panels[0].appendChild(priGrid);

  /* ── Crosshair Preview — inline in Principal tab ─────────────── */
  const xhCard = card("Crosshair Preview");
  xhCard.style.cssText = "margin:0 12px 8px;";
  const xhDiv = document.createElement("div");
  xhDiv.className = "xhair-preview";
  xhDiv.style.cssText = "min-height:120px;";
  const cvs = document.createElement("canvas");
  cvs.id = "xhair-cvs";
  cvs.className = "xhair-canvas";
  cvs.width = 200;
  cvs.height = 150;
  xhDiv.appendChild(cvs);
  xhCard.appendChild(xhDiv);
  cfgSub.panels[0].appendChild(xhCard);

  /* ── Secondary panel — remaining commands by theme ────────────── */
  const secLabels = ["Performance", "Crosshair", "HUD & Radar", "Audio", "Input & Network", "Other"];
  const secSub = buildSubTabs(secLabels, cfgEditGuard);
  secSub.bar.classList.add("inner-sub-tab-bar");
  secSub.bar.querySelectorAll(".sub-tab-btn").forEach((btn) => {
    btn.classList.add("inner-sub-tab-btn");
  });

  const secSubMap: Record<string, number> = {
    Performance: 0,
    Viewmodel: 0,
    Crosshair: 1,
    HUD: 2,
    Radar: 2,
    Audio: 3,
    "Mouse & Input": 4,
    Network: 4,
    "Voice & Comms": 5,
    "Buy & Economy": 5,
    "Spectator & Demo": 5,
    "Misc & QoL": 5,
  };
  const secGrids = secLabels.map(() => {
    const g = document.createElement("main");
    g.className = "cfg-grid";
    return g;
  });

  for (const cat of CFG) {
    const secCmds = cat.commands.filter((c) => !priSet.has(c.id));
    if (secCmds.length === 0) continue;
    const cc = card(cat.name);
    for (const cmd of secCmds) buildCfgRow(cmd, cc, false);
    buildAddFeatureBtn(cc, cat.name);
    const idx = secSubMap[cat.name] ?? 5;
    secGrids[idx].appendChild(cc);
  }

  cfgSub.panels[1].appendChild(secSub.bar);
  for (let i = 0; i < secLabels.length; i++) {
    secSub.panels[i].appendChild(secGrids[i]);
    cfgSub.panels[1].appendChild(secSub.panels[i]);
  }


  tabCfg.appendChild(cfgSub.bar);
  for (const p of cfgSub.panels) tabCfg.appendChild(p);

  /* ── Enable drag reorder within CFG cards ────────────────────── */
  function saveCfgCardOrder(cardEl: HTMLElement) {
    const schema = getActiveSchema();
    if (!schema) return;
    const tabView = getCurrentCfgTabView();
    const rows = Array.from(cardEl.querySelectorAll<HTMLElement>(":scope > .toggle-row"));
    const ids = rows.map((r) => r.dataset.cmdId || "").filter(Boolean);
    // Update only the IDs that belong to this card within the tab layout
    const layout = schema.cfgLayout[tabView];
    if (layout) {
      // Replace the matching subset in the layout's commands with the new order
      const cardIds = new Set(ids);
      const others = layout.commands.filter((id) => !cardIds.has(id));
      // Find where the first card ID was in the layout, insert reordered ones there
      const firstIdx = layout.commands.findIndex((id) => cardIds.has(id));
      if (firstIdx >= 0) {
        const before = layout.commands.slice(0, firstIdx).filter((id) => !cardIds.has(id));
        const after = layout.commands.slice(firstIdx).filter((id) => !cardIds.has(id));
        updateSchemaTabLayout(schema.id, tabView, [...before, ...ids, ...after]);
      } else {
        updateSchemaTabLayout(schema.id, tabView, [...others, ...ids]);
      }
    }
  }
  priGrid.querySelectorAll<HTMLElement>(".card").forEach((cc) => {
    enableCardDrag(cc, () => saveCfgCardOrder(cc));
  });
  secGrids.forEach((grid) => {
    grid.querySelectorAll<HTMLElement>(".card").forEach((cc) => {
      enableCardDrag(cc, () => saveCfgCardOrder(cc));
    });
  });

  // listen for crosshair value changes
  const xhIds = ["cf_xhstyle", "cf_xhsize", "cf_xhgap", "cf_xhthick", "cf_xhcolor", "cf_xhdot", "cf_xhoutline", "cf_xht"];
  setTimeout(() => {
    for (const id of xhIds) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      const vel = document.getElementById(id + "_v") as HTMLInputElement | null;
      if (el) el.addEventListener("change", drawCrosshair);
      if (vel) vel.addEventListener("input", drawCrosshair);
    }
    drawCrosshair();
  }, 50);

  /* ── CFG Actions Bar ─────────────────────────────────────────── */
  const cfgActions = document.createElement("section");
  cfgActions.className = "cfg-actions";

  /* Save .cfg — dropdown with Local / Drive / Email */
  const saveWrap = document.createElement("div");
  saveWrap.className = "cfg-dropdown-wrap";
  const btnSaveCfg = document.createElement("button");
  btnSaveCfg.className = "btn-export cfg-dropdown-trigger";
  btnSaveCfg.innerHTML = '💾 Save .cfg <span class="dd-arrow">▾</span>';
  const saveMenu = document.createElement("div");
  saveMenu.className = "cfg-dropdown-menu";
  saveMenu.innerHTML = `
    <button data-action="save-local" class="cfg-dd-item"><span class="cfg-dd-icon">📁</span> Save Locally</button>
    <button data-action="save-drive" class="cfg-dd-item"><span class="cfg-dd-icon">☁️</span> Google Drive</button>
    <button data-action="save-email" class="cfg-dd-item"><span class="cfg-dd-icon">✉️</span> Send by Email</button>
  `;
  saveWrap.appendChild(btnSaveCfg);
  saveWrap.appendChild(saveMenu);
  btnSaveCfg.addEventListener("click", (e) => {
    e.stopPropagation();
    saveMenu.classList.toggle("open");
    loadMenu.classList.remove("open");
  });
  saveMenu.addEventListener("click", async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!t) return;
    saveMenu.classList.remove("open");
    const action = t.dataset.action;
    if (action === "save-local") {
      await saveCfgFile();
    } else if (action === "save-drive") {
      const content = collectCfgContent();
      // Open Google Drive upload via Google Docs create-then-save-as flow
      const url = `https://drive.google.com/drive/my-drive`;
      shellOpen(url);
      // Copy to clipboard for paste
      await navigator.clipboard.writeText(content);
      toast("CFG copied to clipboard — paste into Google Drive");
    } else if (action === "save-email") {
      const content = collectCfgContent();
      const subject = encodeURIComponent("My CS2 autoexec.cfg — aim.camp Player Agent");
      const body = encodeURIComponent(content);
      const mailto = `mailto:?subject=${subject}&body=${body}`;
      globalThis.location.href = mailto;
      toast("Opening email client with CFG...");
    }
  });

  /* Load .cfg — dropdown with Pro Player / Drive / Local */
  const loadWrap = document.createElement("div");
  loadWrap.className = "cfg-dropdown-wrap";
  const btnLoadCfg = document.createElement("button");
  btnLoadCfg.className = "btn-import cfg-dropdown-trigger";
  btnLoadCfg.innerHTML = '📂 Load .cfg <span class="dd-arrow">▾</span>';
  const loadMenu = document.createElement("div");
  loadMenu.className = "cfg-dropdown-menu cfg-dd-load";
  // Build pro player sub-items
  let proHtml = '<div class="cfg-dd-section">Pro Players</div>';
  for (const p of PRO_CONFIGS) {
    proHtml += `<button data-action="load-pro" data-pro="${p.name}" class="cfg-dd-item cfg-dd-pro"><span class="cfg-dd-icon">🎯</span> ${p.name} <span class="cfg-dd-meta">${p.team} · ${p.sens}@${p.dpi}</span></button>`;
  }
  loadMenu.innerHTML = `
    ${proHtml}
    <div class="cfg-dd-divider"></div>
    <button data-action="load-drive" class="cfg-dd-item"><span class="cfg-dd-icon">☁️</span> Import from Google Drive</button>
    <button data-action="load-local" class="cfg-dd-item"><span class="cfg-dd-icon">📁</span> Import Local File</button>
  `;
  loadWrap.appendChild(btnLoadCfg);
  loadWrap.appendChild(loadMenu);
  btnLoadCfg.addEventListener("click", (e) => {
    e.stopPropagation();
    loadMenu.classList.toggle("open");
    saveMenu.classList.remove("open");
  });
  loadMenu.addEventListener("click", async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!t) return;
    loadMenu.classList.remove("open");
    const action = t.dataset.action;
    if (action === "load-pro") {
      const name = t.dataset.pro;
      const p = PRO_CONFIGS.find((x) => x.name === name);
      if (p) applyProConfig(p);
    } else if (action === "load-drive") {
      shellOpen("https://drive.google.com/drive/my-drive");
      toast("Open your .cfg from Drive, then use 'Import Local File'");
    } else if (action === "load-local") {
      await loadCfgFile();
    }
  });

  // Close dropdowns on outside click
  document.addEventListener("click", () => {
    saveMenu.classList.remove("open");
    loadMenu.classList.remove("open");
  });

  const btnResetCfg = document.createElement("button");
  btnResetCfg.className = "btn-run";
  btnResetCfg.textContent = "Reset";
  btnResetCfg.title = "Reset all commands to defaults";

  const btnCfgRecommend = document.createElement("button");
  btnCfgRecommend.className = "btn-recommend-all";
  btnCfgRecommend.innerHTML = "⚡ Competitive CFG";
  btnCfgRecommend.title = "Apply recommended competitive CS2 settings (Performance, Crosshair, Audio, Network, etc.) based on your hardware";
  btnCfgRecommend.addEventListener("click", applyCfgRecommendations);

  const btnCfgAdv = document.createElement("button");
  btnCfgAdv.className = "btn-adv";
  btnCfgAdv.innerHTML = "🔍 Suggest";
  btnCfgAdv.title = "Personalized config recommendations based on your hardware — requires Advisor key configured";

  const cfgAdvResp = document.createElement("div");
  cfgAdvResp.className = "adv-response";
  cfgAdvResp.id = "cfg-adv-response";

  btnCfgAdv.addEventListener("click", async () => {
    if (!hasAdvKey()) {
      showAdvModal();
      return;
    }
    btnCfgAdv.disabled = true;
    cfgAdvResp.innerHTML = '<div class="adv-loading">Generating config suggestions...</div>';
    const hwGrid = document.querySelector(".hw-grid");
    const hwData = hwGrid ? hwGrid.textContent || "" : "Hardware not scanned yet";
    // gather current CFG states
    const cfgStates: string[] = [];
    for (const cat of CFG) {
      for (const c of cat.commands) {
        const el = document.getElementById(c.id) as HTMLInputElement | null;
        const vel = document.getElementById(c.id + "_v") as HTMLInputElement | null;
        if (el?.checked) cfgStates.push(`${c.label}${vel ? " = " + vel.value : ""}`);
      }
    }
    const context = `Hardware:\n${hwData}\n\nActive config commands:\n${cfgStates.join("\n")}`;
    try {
      const result = await advChat(ADV_PROMPTS.cfg, context);
      cfgAdvResp.innerHTML = mdToHtml(result);
    } catch (e) {
      cfgAdvResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`;
    }
    btnCfgAdv.disabled = false;
  });

  const cfgCounter = document.createElement("div");
  cfgCounter.className = "cfg-counter";
  cfgCounter.innerHTML = '<span>Commands:</span> <span id="cfg-count">0</span>';

  /* ── Schema buttons (CFG) ────────────────────────────────────── */
  const btnCfgLayout = document.createElement("button");
  btnCfgLayout.className = "btn-schema";
  btnCfgLayout.innerHTML = "📐 Configure Layout";
  btnCfgLayout.title = "Edit layout — customize which commands appear and their order. Changes are saved to the active schema, allowing full per-schema customization.";

  const btnCfgLayoutSave = document.createElement("button");
  btnCfgLayoutSave.className = "btn-schema btn-schema-save";
  btnCfgLayoutSave.innerHTML = "💾 Save Layout";
  btnCfgLayoutSave.style.display = "none";

  const btnCfgLayoutCancel = document.createElement("button");
  btnCfgLayoutCancel.className = "btn-schema btn-schema-cancel";
  btnCfgLayoutCancel.innerHTML = "❌ Cancel";
  btnCfgLayoutCancel.style.display = "none";

  /* Enter layout edit mode */
  btnCfgLayout.addEventListener("click", () => {
    if (_layoutEditMode) return;
    const tabView = getCurrentCfgTabView();
    // Ensure we have an active schema, creating one if needed
    let schema = getActiveSchema();
    if (!schema) {
      schema = createSchema("Default");
      setActiveSchemaId(schema.id);
    }
    _layoutEditMode = true;
    _layoutEditTabView = tabView;
    const layout = schema.cfgLayout[tabView];
    _layoutEditOriginal = layout ? [...layout.commands] : [];

    // Find the currently active grid
    const cfgPanel = document.getElementById("tab-cfg");
    if (!cfgPanel) return;

    // Find the active sub-tab panel's cfg-grid
    const activePanel = cfgPanel.querySelector<HTMLElement>(".sub-tab-panel.active");
    // Within Secondary, look for the inner active panel
    let targetGrid: HTMLElement | null = null;
    if (tabView === "Principal") {
      targetGrid = activePanel?.querySelector<HTMLElement>(".cfg-grid") || null;
    } else {
      const innerActive = activePanel?.querySelector<HTMLElement>(".sub-tab-panel.active");
      targetGrid = innerActive?.querySelector<HTMLElement>(".cfg-grid") || activePanel?.querySelector<HTMLElement>(".cfg-grid") || null;
    }
    if (!targetGrid) { _layoutEditMode = false; return; }
    _layoutEditContainer = targetGrid;

    // Disable all inputs in the grid
    targetGrid.querySelectorAll<HTMLInputElement>("input").forEach((inp) => { inp.disabled = true; });

    // Transform cards into floating balloons with drag handles and X buttons
    targetGrid.classList.add("cfg-grid-edit-mode");
    targetGrid.querySelectorAll<HTMLElement>(".card").forEach((cardEl) => {
      cardEl.classList.add("card-balloon");
      cardEl.setAttribute("draggable", "true");

      // Add "X" remove button for entire card
      const xBtn = document.createElement("button");
      xBtn.className = "card-remove-btn";
      xBtn.innerHTML = "✕";
      xBtn.title = "Remove from this tab";
      xBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        cardEl.classList.add("card-removing");
        setTimeout(() => cardEl.remove(), 300);
      });
      cardEl.appendChild(xBtn);

      // Make individual toggle-rows draggable (row-x-btn already exists from buildCfgRow)
      cardEl.querySelectorAll<HTMLElement>(".toggle-row").forEach((row) => {
        row.classList.add("row-balloon");
        row.setAttribute("draggable", "true");
      });
    });

    // Drag & drop for reordering cards
    let dragSrc: HTMLElement | null = null;
    targetGrid.addEventListener("dragstart", (e: DragEvent) => {
      dragSrc = (e.target as HTMLElement).closest(".card-balloon, .row-balloon");
      if (dragSrc) {
        dragSrc.classList.add("dragging");
        e.dataTransfer?.setData("text/plain", "");
      }
    });
    targetGrid.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest<HTMLElement>(".card-balloon, .row-balloon");
      if (target && target !== dragSrc && dragSrc) {
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          target.parentElement?.insertBefore(dragSrc, target);
        } else {
          target.parentElement?.insertBefore(dragSrc, target.nextSibling);
        }
      }
    });
    targetGrid.addEventListener("dragend", () => {
      if (dragSrc) dragSrc.classList.remove("dragging");
      dragSrc = null;
    });

    // Show/hide buttons
    btnCfgLayout.style.display = "none";
    btnCfgLayoutSave.style.display = "";
    btnCfgLayoutCancel.style.display = "";
    toast("Edit mode active — drag to reorder, ✕ to remove");
  });

  /* Save layout */
  btnCfgLayoutSave.addEventListener("click", () => {
    if (!_layoutEditMode || !_layoutEditContainer) return;
    const schema = getActiveSchema();
    if (!schema) { _layoutEditMode = false; return; }

    // Collect current command IDs from the grid
    const commandIds: string[] = [];
    _layoutEditContainer.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((cb) => {
      commandIds.push(cb.id);
    });

    updateSchemaTabLayout(schema.id, _layoutEditTabView, commandIds);
    // Persist current values so they survive the rebuild
    saveSchemaValues(schema.id, collectFullState());
    exitLayoutEditMode();
    rebuildCfgLayout();
    toast("Layout saved ✔");
  });

  /* Cancel layout edit */
  btnCfgLayoutCancel.addEventListener("click", () => {
    // Persist current values so they survive the rebuild
    const schema = getActiveSchema();
    if (schema) saveSchemaValues(schema.id, collectFullState());
    exitLayoutEditMode();
    // Rebuild CFG content to restore original order
    rebuildCfgLayout();
    toast("Edit cancelled");
  });

  function exitLayoutEditMode() {
    _layoutEditMode = false;
    _layoutEditTabView = "";
    _layoutEditOriginal = [];

    if (_layoutEditContainer) {
      _layoutEditContainer.classList.remove("cfg-grid-edit-mode");
      _layoutEditContainer.querySelectorAll<HTMLElement>(".card").forEach((c) => {
        c.classList.remove("card-balloon");
        c.removeAttribute("draggable");
        c.querySelector(".card-remove-btn")?.remove();
      });
      _layoutEditContainer.querySelectorAll<HTMLElement>(".toggle-row").forEach((r) => {
        r.classList.remove("row-balloon");
        r.removeAttribute("draggable");
      });
      // Close any open add-feature menus
      _layoutEditContainer.querySelectorAll<HTMLElement>(".add-feature-menu").forEach((m) => {
        m.style.display = "none";
      });
      _layoutEditContainer.querySelectorAll<HTMLInputElement>("input").forEach((inp) => {
        inp.disabled = false;
      });
    }
    _layoutEditContainer = null;
    btnCfgLayout.style.display = "";
    btnCfgLayoutSave.style.display = "none";
    btnCfgLayoutCancel.style.display = "none";
  }

  /** Rebuild CFG layout according to active schema */
  function rebuildCfgLayout() {
    setTimeout(() => {
      build();
      setTimeout(() => {
        switchTab("config");
        // Switch to CFG sub-tab within Config
        const configBar = document.querySelector<HTMLElement>("#tab-config > .sub-tab-bar");
        if (configBar) {
          const btns = configBar.querySelectorAll<HTMLButtonElement>(".sub-tab-btn");
          if (btns[1]) btns[1].click();
        }
        updateCfgCounter();
        drawCrosshair();
        // Restore the active schema's values after rebuild
        const schema = getActiveSchema();
        if (schema?.values && Object.keys(schema.values).length > 0) {
          restoreFullState(schema.values);
        }
      }, 100);
    }, 50);
  }

  /** Build an author signature element with donation hover */
  function buildSignature(includeCommunity = false): HTMLElement {
    const sig = document.createElement("div");
    sig.className = "app-signature";
    const inner = `<span class="sig-by">by</span> <span class="sig-name">Rqdiniz</span> <span class="sig-tag">[ bu- ]</span>` +
      (includeCommunity ? ` <span class="sig-by">&middot;</span> <span class="sig-community">aim.camp</span>` : ``) +
      ` <span class="sig-support-hint" title="Support the project">☕</span>`;
    sig.innerHTML = inner;
    // Donation popup
    const popup = document.createElement("div");
    popup.className = "donate-popup";
    popup.innerHTML = `
      <div class="donate-title">☕ Support the project</div>
      <p class="donate-desc">If this optimizer helped you, consider supporting development!</p>
      <a href="https://paypal.me/rqdiniz" target="_blank" class="donate-link donate-paypal">
        <span class="donate-icon">💳</span> PayPal
      </a>
    `;
    document.body.appendChild(popup);
    // Toggle popup on click — position relative to the signature element
    sig.addEventListener("click", (e) => {
      e.stopPropagation();
      const isShowing = !popup.classList.contains("show");
      // Close all other donate popups first
      document.querySelectorAll(".donate-popup.show").forEach((p) => { p.classList.remove("show"); });
      if (isShowing) {
        const r = sig.getBoundingClientRect();
        popup.style.left = r.left + r.width / 2 + "px";
        popup.style.bottom = window.innerHeight - r.top + 8 + "px";
        popup.classList.add("show");
      }
    });
    // Close when clicking outside
    document.addEventListener("click", () => popup.classList.remove("show"));
    popup.addEventListener("click", (e) => e.stopPropagation());
    return sig;
  }

  const cfgSig = buildSignature();

  cfgActions.appendChild(saveWrap);
  cfgActions.appendChild(loadWrap);
  cfgActions.appendChild(btnResetCfg);
  cfgActions.appendChild(btnCfgRecommend);
  cfgActions.appendChild(btnCfgAdv);
  cfgActions.appendChild(cfgCounter);
  cfgActions.appendChild(cfgAdvResp);
  cfgActions.appendChild(cfgSig);
  tabCfg.appendChild(cfgActions);

  /* ── Tab: Hardware Info ──────────────────────────────────────── */
  const tabHw = document.createElement("div");
  tabHw.id = "tab-hw";
  tabHw.className = "tab-panel";

  const hwHeader = document.createElement("section");
  hwHeader.className = "hw-actions";
  hwHeader.style.cssText = "display:flex;gap:8px;padding:10px 12px;align-items:center;";
  const btnHwRefresh = document.createElement("button");
  btnHwRefresh.className = "btn-export";
  btnHwRefresh.textContent = "Refresh";
  btnHwRefresh.title = "Detect hardware via WMI";
  btnHwRefresh.addEventListener("click", refreshHardwareInfo);
  const btnHwAdv = document.createElement("button");
  btnHwAdv.className = "btn-adv";
  btnHwAdv.innerHTML = "🔍 Analysis";
  btnHwAdv.title = "Hardware bottleneck analysis + upgrade suggestions — requires Advisor key configured";
  const hwInfo = document.createElement("span");
  hwInfo.style.cssText = "font-size:10px;opacity:0.5;";
  hwInfo.textContent = "Reads CPU, GPU, RAM, disk, HAGS, ReBAR via PowerShell WMI";
  hwHeader.appendChild(btnHwRefresh);
  hwHeader.appendChild(btnHwAdv);
  const hwShareBar = buildShareBar(() => {
    const hwText = document.getElementById("hw-content")?.textContent || "No data";
    return { title: "aim.camp Player Agent — Hardware Specs", text: hwText.slice(0, 500), fields: [] };
  });
  hwHeader.appendChild(hwShareBar);
  hwHeader.appendChild(hwInfo);
  tabHw.appendChild(hwHeader);

  const hwContent = document.createElement("div");
  hwContent.id = "hw-content";
  hwContent.style.cssText = "padding:0 12px 12px;";
  hwContent.innerHTML = '<div class="net-status">Click "Scan Hardware" to detect your system</div>';
  tabHw.appendChild(hwContent);

  const hwAdvResp = document.createElement("div");
  hwAdvResp.className = "adv-response";
  hwAdvResp.id = "hw-adv-response";
  hwAdvResp.style.margin = "0 12px";
  tabHw.appendChild(hwAdvResp);

  btnHwAdv.addEventListener("click", async () => {
    if (!hasAdvKey()) {
      showAdvModal();
      return;
    }
    const hwText = document.getElementById("hw-content")?.textContent || "";
    if (hwText.includes('Click "Scan')) {
      toast("Scan hardware first", true);
      return;
    }
    btnHwAdv.disabled = true;
    hwAdvResp.innerHTML = '<div class="adv-loading">Analyzing hardware...</div>';
    try {
      const result = await advChat(ADV_PROMPTS.hw, hwText);
      hwAdvResp.innerHTML = mdToHtml(result);
    } catch (e) {
      hwAdvResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`;
    }
    btnHwAdv.disabled = false;
  });

  const hwSig = document.createElement("section");
  hwSig.className = "cfg-actions";
  hwSig.style.marginTop = "auto";
  hwSig.appendChild(buildSignature());
  tabHw.appendChild(hwSig);

  /* ── Tab: Drivers ────────────────────────────────────────────── */
  const tabDrv = document.createElement("div");
  tabDrv.id = "tab-drv";
  tabDrv.className = "tab-panel";

  const drvHeader = document.createElement("section");
  drvHeader.className = "hw-actions";
  drvHeader.style.cssText = "display:flex;gap:8px;padding:10px 12px;align-items:center;";
  const btnDrvRefresh = document.createElement("button");
  btnDrvRefresh.className = "btn-export";
  btnDrvRefresh.textContent = "Refresh";
  btnDrvRefresh.title = "Analyze system and peripheral drivers via WMI";
  btnDrvRefresh.addEventListener("click", refreshDriverInfo);
  const drvInfo = document.createElement("span");
  drvInfo.style.cssText = "font-size:10px;opacity:0.5;";
  drvInfo.textContent = "Detects GPU, audio, network, mouse, keyboard and controller drivers. Checks if they are generic or from the manufacturer.";
  drvHeader.appendChild(btnDrvRefresh);
  drvHeader.appendChild(drvInfo);
  tabDrv.appendChild(drvHeader);

  const drvContent = document.createElement("div");
  drvContent.id = "drv-content";
  drvContent.style.cssText = "padding:0;flex:1;overflow-y:auto;";
  drvContent.innerHTML = '<div class="net-status">Click "Analyze Drivers" to check your system drivers</div>';
  tabDrv.appendChild(drvContent);

  const drvSig = document.createElement("section");
  drvSig.className = "cfg-actions";
  drvSig.style.marginTop = "auto";
  drvSig.appendChild(buildSignature());
  tabDrv.appendChild(drvSig);

  /* ── Tab: Process Manager ────────────────────────────────────── */
  const tabProc = document.createElement("div");
  tabProc.id = "tab-proc";
  tabProc.className = "tab-panel";

  const procHeader = document.createElement("section");
  procHeader.style.cssText = "display:flex;gap:8px;padding:10px 12px;align-items:center;";
  const btnProcRefresh = document.createElement("button");
  btnProcRefresh.className = "btn-export";
  btnProcRefresh.textContent = "Refresh";
  btnProcRefresh.title = "List top 40 processes by RAM usage";
  btnProcRefresh.addEventListener("click", refreshProcesses);
  const btnProcAdv = document.createElement("button");
  btnProcAdv.className = "btn-adv";
  btnProcAdv.innerHTML = "🔍 Analyze";
  btnProcAdv.title = "Identifies resource-heavy and safe-to-kill processes — requires Advisor key configured";
  const procInfo = document.createElement("span");
  procInfo.style.cssText = "font-size:10px;opacity:0.5;";
  procInfo.textContent = "Shows top 40 processes (>10MB RAM). Yellow = known resource hog.";
  procHeader.appendChild(btnProcRefresh);
  procHeader.appendChild(btnProcAdv);
  const procShareBar = buildShareBar(() => {
    const procText = document.getElementById("proc-list")?.textContent || "No data";
    return { title: "aim.camp Player Agent — Process List", text: procText.slice(0, 500), fields: [] };
  });
  procHeader.appendChild(procShareBar);
  procHeader.appendChild(procInfo);
  tabProc.appendChild(procHeader);

  const procHdr = document.createElement("div");
  procHdr.className = "proc-header";
  procHdr.innerHTML = "<span>Process</span><span>RAM</span><span>CPU</span><span></span>";
  tabProc.appendChild(procHdr);

  const procList = document.createElement("div");
  procList.id = "proc-list";
  procList.className = "proc-list";
  procList.innerHTML = '<div class="net-status">Click "Refresh Processes" to scan</div>';
  tabProc.appendChild(procList);

  const procAdvResp = document.createElement("div");
  procAdvResp.className = "adv-response";
  procAdvResp.id = "proc-adv-response";
  procAdvResp.style.margin = "0 12px";
  tabProc.appendChild(procAdvResp);

  btnProcAdv.addEventListener("click", async () => {
    if (!hasAdvKey()) {
      showAdvModal();
      return;
    }
    const procText = document.getElementById("proc-list")?.textContent || "";
    if (procText.includes('Click "Refresh')) {
      toast("Refresh processes first", true);
      return;
    }
    btnProcAdv.disabled = true;
    procAdvResp.innerHTML = '<div class="adv-loading">Analyzing processes...</div>';
    try {
      const result = await advChat(ADV_PROMPTS.proc, procText);
      procAdvResp.innerHTML = mdToHtml(result);
    } catch (e) {
      procAdvResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`;
    }
    btnProcAdv.disabled = false;
  });

  const procSig = document.createElement("section");
  procSig.className = "cfg-actions";
  procSig.style.marginTop = "auto";
  procSig.appendChild(buildSignature());
  tabProc.appendChild(procSig);

  /* ── Tab: Network Diagnostics ────────────────────────────────── */
  const tabNet = document.createElement("div");
  tabNet.id = "tab-net";
  tabNet.className = "tab-panel";

  // Single scrollable panel — no sub-tabs
  const netPanel1 = document.createElement("div");
  netPanel1.style.cssText = "padding:10px 16px 20px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overflow-x:hidden;min-width:0;flex:1;";
  tabNet.appendChild(netPanel1);

  /* ── Server Latency section ── */
  const netServerCard = document.createElement("div");
  netServerCard.style.cssText = "border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;min-width:0;width:100%;box-sizing:border-box;";
  const netServerHdr = document.createElement("div");
  netServerHdr.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);";
  netServerHdr.innerHTML = `<span style="font-size:18px;flex-shrink:0">🌐</span><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:12.5px;letter-spacing:0.02em">Server Latency</div><div style="font-size:10px;opacity:0.5;margin-top:2px;line-height:1.35">TCP latency to Valve, FACEIT and DNS servers (~5–10s)</div></div>`;
  const netServerBody = document.createElement("div");
  netServerBody.style.cssText = "padding:10px 14px;display:flex;flex-direction:column;gap:8px;";
  netServerCard.appendChild(netServerHdr);
  netServerCard.appendChild(netServerBody);
  netPanel1.appendChild(netServerCard);

  const netHeader = document.createElement("div");
  netHeader.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
  const btnPingAll = document.createElement("button");
  btnPingAll.className = "btn-export";
  btnPingAll.textContent = "▶ Run Test";
  btnPingAll.title = "TCP latency test to Valve, FACEIT, DNS servers";
  btnPingAll.style.cssText += "padding:4px 14px;font-size:11px;";
  btnPingAll.addEventListener("click", async () => {
    btnPingAll.disabled = true;
    btnPingAll.textContent = "⏳ Testing...";
    await runPingTests();
    btnPingAll.disabled = false;
    btnPingAll.textContent = "▶ Run Test";
  });
  const btnNetAdv = document.createElement("button");
  btnNetAdv.className = "btn-adv";
  btnNetAdv.innerHTML = "🔍 Diagnose";
  btnNetAdv.title = "Network quality and latency diagnosis — requires Advisor key";
  btnNetAdv.style.cssText += "padding:4px 14px;font-size:11px;";
  const netShareBar = buildShareBar(() => {
    const netText = document.getElementById("net-results")?.textContent || "No data";
    return { title: "aim.camp Player Agent — Network Ping Results", text: netText.slice(0, 500), fields: [] };
  });
  netHeader.appendChild(btnPingAll);
  netHeader.appendChild(btnNetAdv);
  netHeader.appendChild(netShareBar);
  netServerBody.appendChild(netHeader);

  const netResults = document.createElement("div");
  netResults.id = "net-results";
  netResults.className = "net-grid";
  netResults.innerHTML = '<div class="net-status">Click "▶ Run Test" to test TCP latency to game servers</div>';
  netServerBody.appendChild(netResults);

  const netAdvResp = document.createElement("div");
  netAdvResp.className = "adv-response";
  netAdvResp.id = "net-adv-response";
  netServerBody.appendChild(netAdvResp);

  btnNetAdv.addEventListener("click", async () => {
    if (!hasAdvKey()) {
      showAdvModal();
      return;
    }
    const netText = document.getElementById("net-results")?.textContent || "";
    if (netText.includes('Run Test')) {
      toast("Run ping tests first", true);
      return;
    }
    btnNetAdv.disabled = true;
    netAdvResp.innerHTML = '<div class="adv-loading">Analyzing network...</div>';
    try {
      const result = await advChat(ADV_PROMPTS.net, netText);
      netAdvResp.innerHTML = mdToHtml(result);
    } catch (e) {
      netAdvResp.innerHTML = `<span style="color:#ef4444">Error: ${e}</span>`;
    }
    btnNetAdv.disabled = false;
  });

  function netOptCard(title: string, icon: string, desc: string): { wrap: HTMLElement; body: HTMLElement } {
    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;min-width:0;width:100%;box-sizing:border-box;";
    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);";
    hdr.innerHTML = `<span style="font-size:18px;flex-shrink:0">${icon}</span><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:12.5px;letter-spacing:0.02em">${title}</div><div style="font-size:10px;opacity:0.5;margin-top:2px;line-height:1.35;white-space:normal">${desc}</div></div>`;
    const body = document.createElement("div");
    body.style.cssText = "padding:10px 14px;display:flex;flex-direction:column;gap:8px;";
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    return { wrap, body };
  }

  function netStatusSpan(id: string): HTMLElement {
    const s = document.createElement("span");
    s.id = id;
    s.style.cssText = "font-size:10px;opacity:0.6;margin-left:8px;";
    return s;
  }

  function netActionRow(label: string, btnLabel: string, btnClass: string, onClick: () => Promise<void>, statusId?: string): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:12px;min-height:32px;";
    const lbl = document.createElement("span");
    lbl.style.cssText = "font-size:11px;opacity:0.75;flex:1;min-width:0;line-height:1.4;";
    lbl.textContent = label;
    const btnW = document.createElement("div");
    btnW.style.cssText = "display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:auto;";
    const btn = document.createElement("button");
    btn.className = btnClass;
    btn.textContent = btnLabel;
    btn.style.cssText += "padding:4px 10px;font-size:11px;";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "⏳";
      try { await onClick(); } catch (e) { toast(String(e), true); }
      btn.disabled = false;
      btn.textContent = prev;
    });
    btnW.appendChild(btn);
    if (statusId) btnW.appendChild(netStatusSpan(statusId));
    row.appendChild(lbl);
    row.appendChild(btnW);
    return row;
  }

  // ── Section: Optimizations ────────────────────────────────────
  const netOptLabel = document.createElement("div");
  netOptLabel.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0 2px;";
  netOptLabel.innerHTML = `<span style="font-size:9px;font-family:'Orbitron',monospace;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4;">⚡ Optimizations</span><div style="flex:1;height:1px;background:rgba(255,255,255,0.06);"></div>`;
  netPanel1.appendChild(netOptLabel);

  // ── DNS Optimizer ──────────────────────────────────────────────
  const { wrap: dnsWrap, body: dnsBody } = netOptCard(
    "DNS Optimizer",
    "🔧",
    "Switch DNS to lower latency resolvers — improves connection establishment speed"
  );

  const dnsPresets = [
    { label: "Cloudflare 1.1.1.1", p: "1.1.1.1", s: "1.0.0.1" },
    { label: "Google 8.8.8.8", p: "8.8.8.8", s: "8.8.4.4" },
    { label: "Quad9 (Secure)", p: "9.9.9.9", s: "149.112.112.112" },
  ];
  const dnsRow = document.createElement("div");
  dnsRow.style.cssText = "display:flex;gap:8px;align-items:center;";
  const dnsSelect = document.createElement("select");
  dnsSelect.className = "pro-select";
  dnsSelect.style.cssText = "flex:1;min-width:140px;font-size:11px;padding:4px 8px;height:28px;";
  for (const [i, p] of dnsPresets.entries()) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = p.label;
    dnsSelect.appendChild(opt);
  }
  const btnApplyDns = document.createElement("button");
  btnApplyDns.className = "btn-export";
  btnApplyDns.textContent = "Apply";
  btnApplyDns.style.cssText += "padding:4px 10px;font-size:11px;";
  const btnRestoreDns = document.createElement("button");
  btnRestoreDns.className = "btn-adv";
  btnRestoreDns.textContent = "Restore";
  btnRestoreDns.style.cssText += "padding:4px 10px;font-size:11px;";
  const dnsStatus = netStatusSpan("dns-opt-status");
  const dnsBtnGroup = document.createElement("div");
  dnsBtnGroup.style.cssText = "display:flex;align-items:center;gap:6px;flex-shrink:0;";
  dnsBtnGroup.appendChild(btnApplyDns);
  dnsBtnGroup.appendChild(btnRestoreDns);
  dnsBtnGroup.appendChild(dnsStatus);
  dnsRow.appendChild(dnsSelect);
  dnsRow.appendChild(dnsBtnGroup);
  dnsBody.appendChild(dnsRow);
  dnsBody.appendChild((() => {
    const info = document.createElement("div");
    info.style.cssText = "font-size:10px;opacity:0.4;";
    info.textContent = "Changes applied via netsh on the active network adapter. Runs as admin.";
    return info;
  })());

  btnApplyDns.addEventListener("click", async () => {
    btnApplyDns.disabled = true;
    const preset = dnsPresets[Number(dnsSelect.value)];
    dnsStatus.textContent = "Applying...";
    try {
      const msg = await invoke<string>("apply_dns", { primary: preset.p, secondary: preset.s });
      dnsStatus.textContent = `✅ ${msg}`;
      toast(`DNS set to ${preset.label}`);
    } catch (e) { dnsStatus.textContent = `❌ ${e}`; toast(String(e), true); }
    btnApplyDns.disabled = false;
  });
  btnRestoreDns.addEventListener("click", async () => {
    btnRestoreDns.disabled = true;
    dnsStatus.textContent = "Restoring...";
    try {
      const msg = await invoke<string>("restore_dns");
      dnsStatus.textContent = `✅ ${msg}`;
      toast("DNS restored to DHCP automatic");
    } catch (e) { dnsStatus.textContent = `❌ ${e}`; toast(String(e), true); }
    btnRestoreDns.disabled = false;
  });
  netPanel1.appendChild(dnsWrap);

  // ── QoS Gaming Mode ───────────────────────────────────────────
  const { wrap: qosWrap, body: qosBody } = netOptCard(
    "QoS Gaming Mode",
    "🎮",
    "Prioritize CS2 packets with DSCP marking — reduces latency spikes in crowded networks"
  );
  qosBody.appendChild(netActionRow(
    "Set high-priority QoS policy for CS2.exe and cs2.exe",
    "Enable", "btn-export",
    async () => {
      const msg = await invoke<string>("apply_qos_cs2");
      const s = document.getElementById("qos-opt-status");
      if (s) s.textContent = `✅ ${msg}`;
      toast("QoS policy for CS2 enabled");
    },
    "qos-opt-status"
  ));
  qosBody.appendChild(netActionRow(
    "Remove QoS policies added by this tool",
    "Disable", "btn-adv",
    async () => {
      const msg = await invoke<string>("remove_qos_cs2");
      const s = document.getElementById("qos-opt-status");
      if (s) s.textContent = `✅ ${msg}`;
      toast("QoS policies removed");
    }
  ));
  netPanel1.appendChild(qosWrap);

  // ── MTU Optimizer ─────────────────────────────────────────────
  const { wrap: mtuWrap, body: mtuBody } = netOptCard(
    "MTU Optimizer",
    "📦",
    "Find and apply the optimal MTU — prevents packet fragmentation which causes lag spikes"
  );
  const mtuRow = document.createElement("div");
  mtuRow.style.cssText = "display:flex;gap:8px;align-items:center;";
  const mtuPresets = [
    { label: "1500 (Default)", val: 1500 },
    { label: "1492 (PPPoE)", val: 1492 },
    { label: "1480 (VPN safe)", val: 1480 },
    { label: "1472 (Optimal test)", val: 1472 },
    { label: "1460 (Conservative)", val: 1460 },
  ];
  const mtuSelect = document.createElement("select");
  mtuSelect.className = "pro-select";
  mtuSelect.style.cssText = "flex:1;min-width:140px;font-size:11px;padding:4px 8px;height:28px;";
  for (const p of mtuPresets) {
    const opt = document.createElement("option");
    opt.value = String(p.val);
    opt.textContent = p.label;
    mtuSelect.appendChild(opt);
  }
  const btnApplyMtu = document.createElement("button");
  btnApplyMtu.className = "btn-export";
  btnApplyMtu.textContent = "Apply";
  btnApplyMtu.style.cssText += "padding:4px 10px;font-size:11px;";
  const mtuStatus = netStatusSpan("mtu-opt-status");
  const mtuBtnGroup = document.createElement("div");
  mtuBtnGroup.style.cssText = "display:flex;align-items:center;gap:6px;flex-shrink:0;";
  mtuBtnGroup.appendChild(btnApplyMtu);
  mtuBtnGroup.appendChild(mtuStatus);
  mtuRow.appendChild(mtuSelect);
  mtuRow.appendChild(mtuBtnGroup);
  mtuBody.appendChild(mtuRow);
  btnApplyMtu.addEventListener("click", async () => {
    btnApplyMtu.disabled = true;
    const val = Number(mtuSelect.value);
    mtuStatus.textContent = "Applying...";
    try {
      const msg = await invoke<string>("set_mtu", { mtu: val });
      mtuStatus.textContent = `✅ ${msg}`;
      toast(`MTU set to ${val}`);
    } catch (e) { mtuStatus.textContent = `❌ ${e}`; toast(String(e), true); }
    btnApplyMtu.disabled = false;
  });
  netPanel1.appendChild(mtuWrap);

  // ── Network Adapter Priority ─────────────────────────────────
  const { wrap: adpWrap, body: adpBody } = netOptCard(
    "Adapter Priority",
    "🔌",
    "Force Ethernet over Wi-Fi — ensures wired connection is always preferred"
  );
  adpBody.appendChild(netActionRow(
    "Set Ethernet as top-priority interface (lower route metric)",
    "Prioritize Ethernet", "btn-export",
    async () => {
      const msg = await invoke<string>("prioritize_ethernet");
      const s = document.getElementById("adp-opt-status");
      if (s) s.textContent = `✅ ${msg}`;
      toast("Ethernet prioritized");
    },
    "adp-opt-status"
  ));
  adpBody.appendChild(netActionRow(
    "Disable Wi-Fi adapter while Ethernet is active",
    "Disable Wi-Fi", "btn-adv",
    async () => {
      const msg = await invoke<string>("disable_wifi");
      const s = document.getElementById("adp-opt-status");
      if (s) s.textContent = `✅ ${msg}`;
      toast(msg);
    }
  ));
  netPanel1.appendChild(adpWrap);

  // ── Restore All Defaults ──────────────────────────────────────
  const restoreRow = document.createElement("div");
  restoreRow.style.cssText = "display:flex;justify-content:flex-end;padding:4px 0;";
  const btnRestoreAll = document.createElement("button");
  btnRestoreAll.className = "btn-adv";
  btnRestoreAll.textContent = "↩ Restore All Network Defaults";
  btnRestoreAll.style.cssText += "font-size:11px;";
  btnRestoreAll.addEventListener("click", async () => {
    if (!confirm("Restore all network settings to Windows defaults?")) return;
    btnRestoreAll.disabled = true;
    try {
      const msg = await invoke<string>("restore_network_defaults");
      toast(msg);
    } catch (e) { toast(String(e), true); }
    btnRestoreAll.disabled = false;
  });
  restoreRow.appendChild(btnRestoreAll);
  netPanel1.appendChild(restoreRow);

  const netSig = document.createElement("section");
  netSig.className = "cfg-actions";
  netSig.style.cssText = "margin-top:auto;padding:4px 16px 0;flex-shrink:0;";
  netSig.appendChild(buildSignature());
  netPanel1.appendChild(netSig);

  /* ── Tab: Demo Review ────────────────────────────────────────── */
  const tabDemo = document.createElement("div");
  tabDemo.id = "tab-demo";
  tabDemo.className = "tab-panel";

  const demoSub = buildSubTabs(["Library", "Review Guide"]);
  tabDemo.appendChild(demoSub.bar);

  // toolbar
  const demoToolbar = document.createElement("div");
  demoToolbar.className = "demo-toolbar";

  const btnDemoFolder = document.createElement("button");
  btnDemoFolder.className = "btn-import";
  btnDemoFolder.textContent = "Browse Folder";
  btnDemoFolder.title = "Select CS2 replays folder";
  btnDemoFolder.addEventListener("click", async () => {
    try {
      const f = await invoke<string>("pick_demo_folder");
      scanDemoFolder(f);
    } catch {
      /* cancelled */
    }
  });

  const btnDemoRefresh = document.createElement("button");
  btnDemoRefresh.className = "btn-export";
  btnDemoRefresh.textContent = "Scan";
  btnDemoRefresh.title = "Re-scan folder for .dem files";
  btnDemoRefresh.addEventListener("click", () => {
    if (currentDemoFolder) scanDemoFolder(currentDemoFolder);
  });

  const demoPathEl = document.createElement("span");
  demoPathEl.id = "demo-path";
  demoPathEl.className = "demo-path";
  demoPathEl.textContent = localStorage.getItem("csmooth_demo_folder") || "No folder selected";

  const demoCount = document.createElement("span");
  demoCount.style.cssText = "font-size:10px;opacity:0.5;";
  demoCount.textContent = "Select your CS2/replays folder or a custom folder with .dem files";

  demoToolbar.appendChild(btnDemoFolder);
  demoToolbar.appendChild(btnDemoRefresh);
  demoToolbar.appendChild(demoPathEl);
  demoToolbar.appendChild(demoCount);
  demoSub.panels[0].appendChild(demoToolbar);

  // body: left = demo list, right = detail
  const demoBody = document.createElement("div");
  demoBody.className = "demo-body";

  const demoListWrap = document.createElement("div");
  demoListWrap.className = "demo-list-wrap";
  demoListWrap.id = "demo-list";
  demoListWrap.innerHTML = '<div class="demo-empty">Select a folder to scan for demos</div>';
  demoBody.appendChild(demoListWrap);

  const demoDetailWrap = document.createElement("div");
  demoDetailWrap.className = "demo-detail";

  const demoDetailContent = document.createElement("div");
  demoDetailContent.id = "demo-detail";
  demoDetailContent.innerHTML = '<div class="demo-empty">Select a demo from the list</div>';
  demoDetailWrap.appendChild(demoDetailContent);

  demoBody.appendChild(demoDetailWrap);
  demoSub.panels[0].appendChild(demoBody);

  // review tips section (sub-tab 1)
  const tipsCard = card("Demo Review Guide");
  const tipsContainer = document.createElement("div");
  tipsContainer.className = "demo-tips";

  for (const tip of DEMO_TIPS) {
    const el = document.createElement("div");
    el.className = `demo-tip priority-${tip.priority}`;
    el.title = tip.detail;
    let prioLabel: string;
    if (tip.priority === "critical") prioLabel = "MUST";
    else if (tip.priority === "high") prioLabel = "CHECK";
    else if (tip.priority === "medium") prioLabel = "WEEKLY";
    else prioLabel = "AWARE";
    const prioClass = `prio-${tip.priority}`;
    el.innerHTML = `<span class="dt-icon">${tip.icon}</span><div class="dt-body"><span class="dt-title">${tip.title}</span> <span class="dt-desc">${tip.desc}</span></div><span class="dt-prio ${prioClass}">${prioLabel}</span>`;
    tipsContainer.appendChild(el);
  }
  tipsCard.appendChild(tipsContainer);
  demoSub.panels[1].appendChild(tipsCard);

  for (const p of demoSub.panels) tabDemo.appendChild(p);

  const demoSig = document.createElement("section");
  demoSig.className = "cfg-actions";
  demoSig.style.marginTop = "auto";
  demoSig.appendChild(buildSignature());
  tabDemo.appendChild(demoSig);

  // auto-load saved folder (fallback to test-demos for dev)
  const savedDemoFolder = localStorage.getItem("csmooth_demo_folder");
  const defaultDemoFolder = String.raw`D:\Projetos\CSmooth\test-demos`;
  const folderToLoad = savedDemoFolder || defaultDemoFolder;
  setTimeout(() => scanDemoFolder(folderToLoad), 100);

  /* ── Community Placeholder Tabs ────────────────────────────────── */
  function buildPlaceholder(opts: { id: string; icon: string; title: string; subtitle: string; desc: string; features: string[]; integrations: string[]; eta: string }): HTMLElement {
    const tab = document.createElement("div");
    tab.id = opts.id;
    tab.className = "tab-panel";
    tab.innerHTML = `
      <div class="placeholder-panel">
        <div class="placeholder-badge">IN DEVELOPMENT</div>
        <div class="placeholder-icon">${opts.icon}</div>
        <div class="placeholder-title">${opts.title}</div>
        <div class="placeholder-subtitle">${opts.subtitle}</div>
        <div class="placeholder-desc">${opts.desc}</div>
        <div class="placeholder-section-label">Features</div>
        <div class="placeholder-features">
          ${opts.features.map((f) => `<span class="placeholder-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${f}</span>`).join("")}
        </div>
        <div class="placeholder-section-label">Integrations</div>
        <div class="placeholder-integrations">
          ${opts.integrations.map((i) => `<span class="placeholder-integration">${i}</span>`).join("")}
        </div>
        <div class="placeholder-eta">${opts.eta}</div>
      </div>`;
    return tab;
  }

  /* ── Tab: Feedback & Suggestions ──────────────────────────────── */
  const tabFdbk = document.createElement("div");
  tabFdbk.id = "tab-fdbk";
  tabFdbk.className = "tab-panel";

  const fdbkToolbar = document.createElement("section");
  fdbkToolbar.className = "hw-actions";
  fdbkToolbar.style.cssText = "display:flex;gap:8px;padding:10px 12px;align-items:center;flex-wrap:wrap;";

  const btnFdbkNew = document.createElement("button");
  btnFdbkNew.className = "btn-export";
  btnFdbkNew.textContent = "📝 New Suggestion";
  btnFdbkNew.title = "Open feedback form";
  btnFdbkNew.addEventListener("click", async () => {
    const b64 = await captureAppScreenshot();
    showFeedbackModal(b64);
  });

  const btnFdbkRefresh = document.createElement("button");
  btnFdbkRefresh.className = "btn-import";
  btnFdbkRefresh.textContent = "🔄 Refresh";
  btnFdbkRefresh.title = "Reload history";
  btnFdbkRefresh.addEventListener("click", refreshFeedbackHistory);

  const btnFdbkGhCfg = document.createElement("button");
  btnFdbkGhCfg.className = "btn-import";
  btnFdbkGhCfg.textContent = "🐙 GitHub";
  btnFdbkGhCfg.title = "Configure GitHub";
  btnFdbkGhCfg.addEventListener("click", showGitHubConfigModal);

  const btnFdbkDiscordCfg = document.createElement("button");
  btnFdbkDiscordCfg.className = "btn-import";
  btnFdbkDiscordCfg.textContent = "🎮 Discord";
  btnFdbkDiscordCfg.title = "Configure Discord Webhook";
  btnFdbkDiscordCfg.addEventListener("click", () => showDiscordModal());

  const fdbkInfo = document.createElement("span");
  fdbkInfo.style.cssText = "font-size:10px;opacity:0.5;flex:1;";
  fdbkInfo.textContent = "Right-click anywhere in the app to send quick feedback.";

  fdbkToolbar.appendChild(btnFdbkNew);
  fdbkToolbar.appendChild(btnFdbkRefresh);
  fdbkToolbar.appendChild(btnFdbkGhCfg);
  fdbkToolbar.appendChild(btnFdbkDiscordCfg);
  fdbkToolbar.appendChild(fdbkInfo);
  tabFdbk.appendChild(fdbkToolbar);

  const fdbkHistory = document.createElement("div");
  fdbkHistory.id = "fdbk-history";
  fdbkHistory.style.cssText = "padding:8px 12px;flex:1;overflow-y:auto;";
  fdbkHistory.innerHTML =
    '<div class="fdbk-empty"><div class="fdbk-empty-icon">📝</div><div class="fdbk-empty-text">No feedback recorded</div><div class="fdbk-empty-hint">Right-click anywhere in the app to send suggestions, or use the button above.</div></div>';
  tabFdbk.appendChild(fdbkHistory);

  const fdbkSig = document.createElement("section");
  fdbkSig.className = "cfg-actions";
  fdbkSig.style.marginTop = "auto";
  fdbkSig.appendChild(buildSignature());
  tabFdbk.appendChild(fdbkSig);

  /* ── Tab: Benchmark / Frame Analysis ─────────────────────────── */
  const tabBench = document.createElement("div");
  tabBench.id = "tab-bench";
  tabBench.className = "tab-panel";

  const benchToolbar = document.createElement("section");
  benchToolbar.className = "hw-actions";
  benchToolbar.style.cssText = "display:flex;gap:8px;padding:10px 12px;align-items:center;flex-wrap:wrap;";

  const btnBenchImport = document.createElement("button");
  btnBenchImport.className = "btn-export";
  btnBenchImport.textContent = "📂 Import CSV/JSON";
  btnBenchImport.title = "Import PresentMon CSV or CapFrameX JSON file";
  btnBenchImport.addEventListener("click", importBenchmarkFile);

  const btnBenchCX = document.createElement("button");
  btnBenchCX.className = "btn-import";
  btnBenchCX.textContent = "📦 CapFrameX";
  btnBenchCX.title = "Search for CapFrameX captures";
  btnBenchCX.addEventListener("click", scanCapFrameX);

  const btnBenchClear = document.createElement("button");
  btnBenchClear.className = "btn-import";
  btnBenchClear.textContent = "🗑 Clear";
  btnBenchClear.title = "Clear benchmark data";
  btnBenchClear.addEventListener("click", () => {
    benchHistory.length = 0;
    _currentBenchResult = null;
    const el = document.getElementById("bench-content");
    if (el)
      el.innerHTML =
        '<div class="bench-empty"><div class="bench-empty-icon">📊</div><div class="bench-empty-title">Benchmark & Frame Analysis</div><div class="bench-empty-desc">Import a PresentMon (.csv) or CapFrameX (.json) file to analyze frame times, FPS and stutters of your system in CS2.</div><div class="bench-empty-hint">Lightweight alternative to CapFrameX — analyzes the same data with full metrics and interactive charts.</div><div class="bench-compat"><span class="bench-compat-item">✅ PresentMon CSV</span><span class="bench-compat-item">✅ CapFrameX JSON</span><span class="bench-compat-item">✅ OCAT CSV</span><span class="bench-compat-item">✅ FrameView CSV</span></div></div>';
  });

  const benchInfo = document.createElement("span");
  benchInfo.style.cssText = "font-size:10px;opacity:0.5;flex:1;";
  benchInfo.textContent = "Compatible with PresentMon, CapFrameX, OCAT and FrameView. Frame time, FPS, percentile and stutter analysis.";

  benchToolbar.appendChild(btnBenchImport);
  benchToolbar.appendChild(btnBenchCX);
  benchToolbar.appendChild(btnBenchClear);
  benchToolbar.appendChild(benchInfo);
  tabBench.appendChild(benchToolbar);

  const benchContent = document.createElement("div");
  benchContent.id = "bench-content";
  benchContent.style.cssText = "padding:0 12px;flex:1;overflow-y:auto;";
  benchContent.innerHTML =
    '<div class="bench-empty"><div class="bench-empty-icon">📊</div><div class="bench-empty-title">Benchmark & Frame Analysis</div><div class="bench-empty-desc">Import a PresentMon (.csv) or CapFrameX (.json) file to analyze frame times, FPS and stutters on your CS2 system.</div><div class="bench-empty-hint">Lightweight alternative to CapFrameX — analyzes the same data with full metrics and interactive charts.</div><div class="bench-compat"><span class="bench-compat-item">✅ PresentMon CSV</span><span class="bench-compat-item">✅ CapFrameX JSON</span><span class="bench-compat-item">✅ OCAT CSV</span><span class="bench-compat-item">✅ FrameView CSV</span></div></div>';
  tabBench.appendChild(benchContent);

  const benchSig = document.createElement("section");
  benchSig.className = "cfg-actions";
  benchSig.style.marginTop = "auto";
  benchSig.appendChild(buildSignature());
  tabBench.appendChild(benchSig);

  const tabRank = buildPlaceholder({
    id: "tab-rank",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    title: "RANKINGS & STATS",
    subtitle: "ELO \u00b7 Leaderboards \u00b7 Achievements",
    desc: "Global and monthly rankings, ELO tracking, stats per map and mode, unlockable achievements and player profiles with match history. Login via Steam, Discord or FACEIT.",
    features: ["ELO Tracker", "Global Leaderboard", "Map Stats", "Achievements & Badges", "Match History", "Player Profiles"],
    integrations: ["OAuth Steam", "OAuth Discord", "FACEIT API", "Node.js Backend"],
    eta: "OAuth + FACEIT Data API integration \u2014 in development",
  });

  const tabServers = buildPlaceholder({
    id: "tab-servers",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    title: "MATCH & SERVERS",
    subtitle: "Create Match \u00b7 5v5 \u00b7 Retakes \u00b7 Live Status",
    desc: "Launch CS2 servers directly via Discord Bot. Competitive 5v5 and Retakes modes with auto team balancing, voice channel creation and private player info. Real-time monitoring.",
    features: ["Create Match via Bot", "5v5 Competitive", "Retakes Mode", "Auto Team Balancing", "Server Status Live", "Quick Connect"],
    integrations: ["Discord Bot", "Docker + SteamCMD", "WebSocket", "Prometheus"],
    eta: "Docker + SteamCMD + Discord Bot infrastructure \u2014 in development",
  });

  const tabMarket = buildPlaceholder({
    id: "tab-market",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    title: "ITEM TRACKER",
    subtitle: "Inventory \u00b7 Prices \u00b7 Watchlist \u00b7 Alerts",
    desc: "Monitor your Steam CS2 inventory, track skin price history, create watchlists with price alerts and analyze market trends. Real-time data.",
    features: ["Steam Inventory", "Price History", "Watchlist & Alerts", "Market Trends", "Trade Tracker", "Float & Wear"],
    integrations: ["Steam Web API", "WebSocket Real-time", "Node.js Backend", "React Frontend"],
    eta: "Steam Web API + Price Tracking integration \u2014 in development",
  });

  const tabHub = buildPlaceholder({
    id: "tab-hub",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    title: "AIM.CAMP HUB",
    subtitle: "Wiki \u00b7 Events \u00b7 Discord \u00b7 Feedback",
    desc: "Central community hub for aim.camp: wiki with guides and strats, event and tournament calendar, Discord bridge, feedback and suggestions system. Knowledge shared by everyone.",
    features: ["Wiki & Guides", "Event Calendar", "Discord Bridge", "Feedback System", "Tournaments", "Member Profiles"],
    integrations: ["Discord OAuth", "React SPA", "WebSocket", "Grafana Dashboards"],
    eta: "Community platform aim.camp \u2014 in development",
  });

  /* ── Tab: Config (merges SYS + CFG) ─────────────────────────── */
  const tabConfig = document.createElement("div");
  tabConfig.id = "tab-config";
  tabConfig.className = "tab-panel active";
  const configSub = buildSubTabs(["🖥 SYS", "⚙️ CFG"], cfgEditGuard);
  configSub.panels[0].appendChild(tabSys);
  configSub.panels[1].appendChild(tabCfg);

  /* ── Schema bar (above SYS/CFG sub-tabs) ─────────────────── */
  const schemaBar = document.createElement("div");
  schemaBar.className = "config-schema-bar";

  const schemaLabel = document.createElement("span");
  schemaLabel.className = "config-schema-label";
  schemaLabel.textContent = "📋 Schema:";

  /* Inline schema action buttons */
  const btnSchemaSave = document.createElement("button");
  btnSchemaSave.className = "schema-bar-btn";
  btnSchemaSave.innerHTML = "💾 Save";
  btnSchemaSave.title = "Save current settings to the selected schema";
  btnSchemaSave.addEventListener("click", () => {
    const schema = getActiveSchema();
    if (!schema) { toast("No schema selected"); return; }
    saveSchemaValues(schema.id, collectFullState());
    toast(`Schema "${schema.name}" saved ✔`);
  });

  const btnSchemaLoad = document.createElement("button");
  btnSchemaLoad.className = "schema-bar-btn";
  btnSchemaLoad.innerHTML = "📂 Load";
  btnSchemaLoad.title = "Load the selected schema — restores all values and layout";
  btnSchemaLoad.addEventListener("click", () => {
    const schema = getActiveSchema();
    if (!schema) { toast("No schema selected"); return; }
    rebuildCfgLayout();
    toast(`Schema "${schema.name}" loaded ✔`);
  });

  const btnSchemaRename = document.createElement("button");
  btnSchemaRename.className = "schema-bar-btn";
  btnSchemaRename.innerHTML = "✏️ Rename";
  btnSchemaRename.title = "Rename the selected schema";
  btnSchemaRename.addEventListener("click", async () => {
    const schema = getActiveSchema();
    if (!schema) { toast("No schema selected"); return; }
    const newName = await showInputModal("Rename Schema", schema.name);
    if (!newName) return;
    renameSchema(schema.id, newName);
    refreshProfileDropdown();
    toast(`Renamed to "${newName}" ✔`);
  });

  const btnSchemaDelete = document.createElement("button");
  btnSchemaDelete.className = "schema-bar-btn schema-bar-btn-del";
  btnSchemaDelete.innerHTML = "🗑️ Delete";
  btnSchemaDelete.title = "Delete the selected schema";
  btnSchemaDelete.addEventListener("click", async () => {
    const schema = getActiveSchema();
    if (!schema) { toast("No schema selected"); return; }
    const ok = await showConfirmModal("Delete Schema", `Are you sure you want to delete <strong>${schema.name}</strong>?`);
    if (!ok) return;
    deleteSchema(schema.id);
    const remaining = getSchemas();
    if (remaining.length > 0) {
      setActiveSchemaId(remaining[0].id);
    } else {
      const def = createDefaultSchema();
      setActiveSchemaId(def.id);
    }
    refreshProfileDropdown();
    rebuildCfgLayout();
    toast(`Schema "${schema.name}" deleted`);
  });

  const btnSchemaNew = document.createElement("button");
  btnSchemaNew.className = "schema-bar-btn schema-bar-btn-new";
  btnSchemaNew.innerHTML = "+ New";
  btnSchemaNew.title = "Create a new schema from current settings";
  btnSchemaNew.addEventListener("click", async () => {
    const trimmed = await showInputModal("New Schema", "E.g.: Competitive, Practice, AWP...");
    if (!trimmed) return;
    const existing = getSchemas().find((s) => s.name === trimmed);
    if (existing) {
      saveSchemaValues(existing.id, collectFullState());
      setActiveSchemaId(existing.id);
      toast(`Schema "${trimmed}" updated ✔`);
    } else {
      const currentActive = getActiveSchema();
      const s = createSchema(trimmed);
      if (currentActive) {
        const allSchemas = getSchemas();
        const newS = allSchemas.find((x) => x.id === s.id);
        if (newS) {
          newS.cfgLayout = structuredClone(currentActive.cfgLayout);
          saveSchemas(allSchemas);
        }
      }
      saveSchemaValues(s.id, collectFullState());
      setActiveSchemaId(s.id);
      toast(`Schema "${trimmed}" created ✔`);
    }
    refreshProfileDropdown();
  });

  schemaBar.appendChild(schemaLabel);
  schemaBar.appendChild(profileSel);
  schemaBar.appendChild(btnSchemaSave);
  schemaBar.appendChild(btnSchemaLoad);
  schemaBar.appendChild(btnSchemaRename);
  schemaBar.appendChild(btnSchemaDelete);
  schemaBar.appendChild(btnSchemaNew);
  schemaBar.appendChild(btnCfgLayout);
  schemaBar.appendChild(btnCfgLayoutSave);
  schemaBar.appendChild(btnCfgLayoutCancel);

  tabConfig.appendChild(schemaBar);
  tabConfig.appendChild(configSub.bar);
  for (const p of configSub.panels) tabConfig.appendChild(p);

  /* ── Assemble ────────────────────────────────────────────────── */
  container.appendChild(header);
  container.appendChild(tabConfig);
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
  btnExport.addEventListener("click", exportScript);
  btnImport2.addEventListener("click", importScript);
  btnRun2.addEventListener("click", runConfigAsAdmin);
  btnResetCfg.addEventListener("click", resetCfgDefaults);

  /* CFG counter listeners */
  for (const cat of CFG)
    for (const c of cat.commands) {
      const el = document.getElementById(c.id) as HTMLInputElement | null;
      if (el) el.addEventListener("change", updateCfgCounter);
    }

  /* ── Initial calcs ─────────────────────────────────────────── */
  updateImpact();
  updateCfgCounter();
}

build();

// Restore saved theme
const savedTheme = localStorage.getItem("csmooth_theme");
if (savedTheme !== null) applyTheme(Number.parseInt(savedTheme, 10));

/* ================================================================
   Dazzling Progress Bar for data loading
   ================================================================ */
function createProgressBar(): { container: HTMLElement; update: (label: string, progress: number) => void; remove: () => void } {
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    text-align: center;
    color: var(--text-primary);
    font-family: 'Orbitron', monospace;
  `;

  const title = document.createElement("div");
  title.textContent = "INITIALIZING PLAYER AGENT...";
  title.style.cssText = `
    font-size: 24px;
    margin-bottom: 32px;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: bold;
    letter-spacing: 2px;
  `;

  const label = document.createElement("div");
  label.style.cssText = `
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 1px;
  `;

  // Progress bar with animated gradient
  const barBg = document.createElement("div");
  barBg.style.cssText = `
    width: 300px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    margin-bottom: 16px;
  `;

  const barFill = document.createElement("div");
  barFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    border-radius: 3px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px var(--primary);
  `;
  barBg.appendChild(barFill);

  const percent = document.createElement("div");
  percent.style.cssText = `
    font-size: 11px;
    opacity: 0.6;
    margin-top: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  `;

  // Animated dots
  const dots = document.createElement("div");
  dots.style.cssText = `
    margin-top: 24px;
    font-size: 20px;
    letter-spacing: 4px;
    animation: pulse 1.5s infinite;
  `;
  dots.textContent = "●●●";

  // Add animation if not already present
  if (!document.querySelector("style[data-progress-animation]")) {
    const style = document.createElement("style");
    style.setAttribute("data-progress-animation", "true");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 10px var(--primary); }
        50% { box-shadow: 0 0 20px var(--primary), 0 0 30px var(--secondary); }
      }
    `;
    document.head.appendChild(style);
  }

  content.appendChild(title);
  content.appendChild(label);
  content.appendChild(barBg);
  content.appendChild(percent);
  content.appendChild(dots);
  container.appendChild(content);
  document.body.appendChild(container);

  return {
    container,
    update: (text: string, progress: number) => {
      label.textContent = text;
      barFill.style.width = `${Math.min(progress, 100)}%`;
      percent.textContent = `${Math.round(progress)}%`;
    },
    remove: () => {
      container.style.opacity = "0";
      container.style.transition = "opacity 0.3s ease";
      setTimeout(() => container.remove(), 300);
    },
  };
}

/* ================================================================
   Parallel Data Pre-loading on Startup
   ================================================================ */
async function preloadAllData() {
  const progress = createProgressBar();
  const tasks = [
    { name: "Hardware Analysis", fn: refreshHardwareInfo, weight: 20 },
    { name: "Driver Detection", fn: refreshDriverInfo, weight: 35 },
    { name: "Process Scanning", fn: refreshProcesses, weight: 15 },
    { name: "Network Diagnostics", fn: runPingTests, weight: 20 },
  ];

  let completed = 0;
  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);

  // Start all tasks in parallel
  const promises = tasks.map(async (task) => {
    try {
      progress.update(task.name, (completed / totalWeight) * 100);
      await task.fn();
      completed += task.weight;
      progress.update(task.name, Math.min((completed / totalWeight) * 100, 99));
    } catch (e) {
      console.error(`Error loading ${task.name}:`, e);
      completed += task.weight;
    }
  });

  await Promise.all(promises);
  progress.update("Finalizing...", 100);
  
  // Give a moment to show 100% before closing
  await new Promise(resolve => setTimeout(resolve, 500));
  progress.remove();

  // Voice agent welcome greeting
  greetVoiceAgent();
}

/* ================================================================
   Voice Agent Welcome Greeting
   ================================================================ */
async function greetVoiceAgent() {
  try {
    const llmProvider = await llmService.getActiveProvider();
    if (!llmProvider) return; // No LLM configured yet

    const greeting = `🎮 Welcome, Player! I'm your AI Coach, ready to help you optimize your CS2 setup and improve your game. Ask me anything about your hardware, configs, or gameplay. Let's get you winning! 🚀`;
    
    // Show toast notification
    const toast_el = document.createElement("div");
    toast_el.className = "status-toast";
    toast_el.style.cssText = `
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: var(--text-primary);
      padding: 16px;
      border-radius: 8px;
      margin: 12px;
      font-size: 14px;
      max-width: 400px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    `;
    toast_el.textContent = greeting;
    document.body.appendChild(toast_el);
    
    setTimeout(() => {
      toast_el.style.opacity = "0";
      toast_el.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast_el.remove(), 300);
    }, 5000);

    console.log("🤖 Voice Agent activated:", llmProvider.name);
  } catch (e) {
    console.log("Voice agent not configured (this is normal on first run)");
  }
}

// Restore last active schema values on startup OR sync with system state on first run
(async () => {
  const activeSchema = getActiveSchema();
  if (activeSchema?.values && Object.keys(activeSchema.values).length > 0) {
    // User has a profile/schema — restore saved values
    restoreFullState(activeSchema.values);
    // Update LEDs to show current system state
    refreshSystemState();
  } else {
    // First run or no active schema — sync toggles with actual system state
    await syncTogglesWithSystemState();
  }

  // Pre-load all data in parallel with progress bar
  // Delay slightly to let the UI fully render first
  setTimeout(() => preloadAllData(), 100);
})();

// ── Auto-update check on startup ────────────────────────────────
// Small delay to let the UI render first
(async () => {
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const info = await invoke<{
      update_available: boolean;
      current_version: string;
      latest_version: string;
      release_name: string;
      release_notes: string;
      html_url: string;
      msi_url: string;
      nsis_url: string;
      portable_url: string;
      is_portable: boolean;
      published_at: string;
      error?: string;
    }>("check_for_update");

    if (info.update_available) {
      // Store last dismissed version to avoid nagging
      const dismissed = localStorage.getItem("aimcamp_dismissed_version");
      if (dismissed !== info.latest_version) {
        showUpdateModal(info);
      }
    }
  } catch {
    /* silent fail — no network is ok */
  }
})();

function showUpdateModal(info: { current_version: string; latest_version: string; release_name: string; release_notes: string; html_url: string; msi_url: string; nsis_url: string; portable_url: string; is_portable: boolean }) {
  const existing = document.querySelector(".update-overlay");
  if (existing) existing.remove();

  const notes = (info.release_notes || "No release notes.").replaceAll("\n", "<br>").replaceAll(/#{1,3}\s/g, "");
  const isPortable = info.is_portable;
  const downloadBtnLabel = isPortable ? "⬇️ Download Versão Portátil" : "⬇️ Download and Install";

  const overlay = document.createElement("div");
  overlay.className = "update-overlay fdbk-overlay";
  overlay.innerHTML = `
    <div class="fdbk-modal update-modal" style="max-width:480px;">
      <div class="fdbk-modal-header">
        <h3>🔄 Update Available</h3>
        <button class="fdbk-close" id="update-close">&times;</button>
      </div>
      <div class="fdbk-modal-body" style="padding:16px;">
        <div class="update-versions">
          <span class="update-ver-current">v${info.current_version}</span>
          <span class="update-arrow">→</span>
          <span class="update-ver-new">v${info.latest_version}</span>
        </div>
        ${info.release_name ? `<div class="update-name">${info.release_name}</div>` : ""}
        <div class="update-notes">${notes}</div>
        <div class="update-preserve-msg">
          ${isPortable
            ? "ℹ️ A nova versão portátil será guardada na pasta <code>Downloads</code>. Os teus dados (configs, schemas, temas) ficam preservados em <code>%LOCALAPPDATA%</code>."
            : "ℹ️ Your data (feedback, screenshots, configs, themes) is automatically preserved — stored in <code>%LOCALAPPDATA%</code>."
          }
        </div>
        <div class="update-actions">
          <button class="update-btn update-btn-download" id="update-download">
            ${downloadBtnLabel}
          </button>
          <a class="update-btn update-btn-github" href="${info.html_url}" target="_blank">
            🐙 View on GitHub
          </a>
          <button class="update-btn update-btn-skip" id="update-skip">
            Skip this version
          </button>
          <button class="update-btn update-btn-later" id="update-later">
            Later
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("update-close")!.addEventListener("click", () => overlay.remove());
  document.getElementById("update-later")!.addEventListener("click", () => overlay.remove());

  document.getElementById("update-skip")!.addEventListener("click", () => {
    localStorage.setItem("aimcamp_dismissed_version", info.latest_version);
    overlay.remove();
    toast("Version skipped. You'll be notified of the next one.");
  });

  document.getElementById("update-download")!.addEventListener("click", async () => {
    const btn = document.getElementById("update-download") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "⏳ A transferir...";
    try {
      if (isPortable) {
        const url = info.portable_url;
        if (!url) {
          toast("Portable não encontrado na release. Usa o GitHub.", true);
          btn.disabled = false;
          btn.textContent = downloadBtnLabel;
          return;
        }
        const path = await invoke<string>("download_update", { url });
        btn.textContent = "📂 A abrir...";
        await invoke("open_in_explorer", { path });
        toast(`✅ Portátil guardado — clica duas vezes para lançar a nova versão.`);
        overlay.remove();
      } else {
        const url = info.msi_url || info.nsis_url;
        if (!url) {
          toast("No installer found. Visit GitHub.", true);
          btn.disabled = false;
          btn.textContent = downloadBtnLabel;
          return;
        }
        const path = await invoke<string>("download_update", { url });
        btn.textContent = "🚀 Starting installer...";
        await invoke("run_installer", { path });
        toast("Installer started. The app will close.");
        setTimeout(() => window.close(), 2000);
      }
    } catch (e) {
      toast(`Erro: ${e}`, true);
      btn.disabled = false;
      btn.textContent = downloadBtnLabel;
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
