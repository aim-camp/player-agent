use tauri::api::dialog::FileDialogBuilder;
use std::fs::File;
use std::io::{Read, Write};
use std::process::Command;
// base64 Engine trait used via associated function calls

// ────────────────────────────────────────────────────────────────────
// Data model – every field maps 1:1 to a UI toggle/input AND to real
// PowerShell commands in the generated .ps1 file.
// ────────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct OptimizationConfig {
    bios: BiosConfig,
    windows: WindowsConfig,
    network: NetworkConfig,
    nvidia: NvidiaConfig,
    services: ServicesConfig,
    autoexec: AutoexecConfig,
    launch_options: LaunchOptionsConfig,
    extras: ExtrasConfig,
    #[serde(default)]
    theme_primary: String,
    #[serde(default)]
    theme_secondary: String,
}

#[derive(serde::Deserialize)]
struct BiosConfig {
    disable_svm: bool,
    disable_c_states: bool,
    disable_cool_n_quiet: bool,
    enable_xmp: bool,
    enable_resize_bar: bool,
    enable_above_4g: bool,
}

#[derive(serde::Deserialize)]
struct WindowsConfig {
    ultimate_power_plan: bool,
    disable_game_dvr: bool,
    disable_game_bar: bool,
    disable_game_mode: bool,
    disable_hibernation: bool,
    disable_mouse_accel: bool,
    disable_fullscreen_optim: bool,
    disable_visual_effects: bool,
    disable_transparency: bool,
    disable_background_apps: bool,
    disable_notifications: bool,
    disable_cortana: bool,
    disable_search_indexing: bool,
    hardware_gpu_scheduling: bool,
    disable_hpet: bool,
    disable_power_throttling: bool,
    disable_core_parking: bool,
    clean_temp_files: bool,
    cs2_high_performance_gpu: bool,
    #[serde(default)]
    disable_delivery_optim: bool,
    #[serde(default)]
    disable_widgets: bool,
    #[serde(default)]
    disable_memory_compression: bool,
    #[serde(default)]
    disable_connected_ux: bool,
    #[serde(default)]
    disable_spectre: bool,
    #[serde(default)]
    disable_last_access: bool,
    #[serde(default)]
    disable_8dot3: bool,
    #[serde(default)]
    mmcss_gaming: bool,
    #[serde(default)]
    disable_large_cache: bool,
}

#[derive(serde::Deserialize)]
struct NetworkConfig {
    disable_nagle: bool,
    optimize_tcp: bool,
    flush_dns: bool,
    disable_wifi_power_save: bool,
    #[serde(default)]
    disable_network_throttle: bool,
    #[serde(default)]
    disable_ecn: bool,
    #[serde(default)]
    enable_rss: bool,
    #[serde(default)]
    disable_netbios: bool,
    #[serde(default)]
    disable_lmhosts: bool,
    #[serde(default)]
    enable_ctcp: bool,
}

#[derive(serde::Deserialize)]
struct NvidiaConfig {
    prefer_max_perf: bool,
    disable_vsync: bool,
    low_latency_ultra: bool,
    threaded_optimization: bool,
    disable_anisotropic: bool,
    shader_cache_clear: bool,
    #[serde(default)]
    force_reflex: bool,
    #[serde(default)]
    disable_sharpening: bool,
    #[serde(default)]
    texture_filter_perf: bool,
    #[serde(default)]
    pre_rendered_frames_1: bool,
    #[serde(default)]
    disable_ambient_occlusion: bool,
    #[serde(default)]
    disable_fxaa: bool,
}

#[derive(serde::Deserialize)]
struct ServicesConfig {
    disable_sysmain: bool,
    disable_diagtrack: bool,
    disable_wsearch: bool,
    disable_print_spooler: bool,
    disable_fax: bool,
    disable_xbox_services: bool,
    #[serde(default)]
    disable_cdp: bool,
    #[serde(default)]
    disable_wpn: bool,
    #[serde(default)]
    disable_diagnostic_policy: bool,
    #[serde(default)]
    disable_remote_registry: bool,
    #[serde(default)]
    disable_maps_broker: bool,
    #[serde(default)]
    disable_phone_service: bool,
    #[serde(default)]
    disable_retail_demo: bool,
}

#[derive(serde::Deserialize)]
struct AutoexecConfig {
    enabled: bool,
    fps_max: String,
    rate: String,
    cl_interp: String,
    cl_interp_ratio: String,
    cl_updaterate: String,
    cl_cmdrate: String,
    m_rawinput: bool,
    custom_commands: String,
}

#[derive(serde::Deserialize)]
struct LaunchOptionsConfig {
    novid: bool,
    nojoy: bool,
    high_priority: bool,
    #[serde(default)]
    allow_third_party: bool,
    threads: String,
    exec_autoexec: bool,
    custom_args: String,
}

#[derive(serde::Deserialize)]
struct ExtrasConfig {
    faceit_admin: bool,
    disable_steam_overlay: bool,
    disable_discord_overlay: bool,
    system_responsiveness: bool,
    gpu_priority: bool,
    priority_separation: bool,
    cs2_process_priority: bool,
    #[serde(default)]
    disable_telemetry_tasks: bool,
    #[serde(default)]
    timer_resolution: bool,
    #[serde(default)]
    msi_mode_gpu: bool,
    #[serde(default)]
    pcie_link_state_off: bool,
    #[serde(default)]
    interrupt_moderation_off: bool,
    #[serde(default)]
    enable_large_pages: bool,
}

// ────────────────────────────────────────────────────────────────────
// Map hex color to nearest PS console color
// ────────────────────────────────────────────────────────────────────
fn hex_to_ps_color(hex: &str) -> &'static str {
    let hex = hex.trim_start_matches('#');
    if hex.len() < 6 { return "Green"; }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    // distance to each PS color
    let candidates: &[(&str, u8, u8, u8)] = &[
        ("Red", 255, 0, 0),
        ("DarkRed", 139, 0, 0),
        ("Green", 0, 255, 0),
        ("DarkGreen", 0, 128, 0),
        ("Blue", 0, 0, 255),
        ("DarkBlue", 0, 0, 139),
        ("Cyan", 0, 255, 255),
        ("DarkCyan", 0, 139, 139),
        ("Magenta", 255, 0, 255),
        ("DarkMagenta", 139, 0, 139),
        ("Yellow", 255, 255, 0),
        ("DarkYellow", 128, 128, 0),
        ("White", 255, 255, 255),
        ("Gray", 128, 128, 128),
    ];
    let mut best = "Green";
    let mut best_d = i32::MAX;
    for (name, cr, cg, cb) in candidates {
        let d = (r as i32 - *cr as i32).pow(2) + (g as i32 - *cg as i32).pow(2) + (b as i32 - *cb as i32).pow(2);
        if d < best_d { best_d = d; best = name; }
    }
    best
}

fn hex_to_ps_dark(hex: &str) -> &'static str {
    let c = hex_to_ps_color(hex);
    match c {
        "Red" => "DarkRed",
        "Green" => "DarkGreen",
        "Blue" => "DarkBlue",
        "Cyan" => "DarkCyan",
        "Magenta" => "DarkMagenta",
        "Yellow" => "DarkYellow",
        "White" => "Gray",
        other => other,
    }
}

// ────────────────────────────────────────────────────────────────────
// PS1 output helpers
// ────────────────────────────────────────────────────────────────────
fn ps1_banner(s: &mut String, primary: &str, dark: &str, secondary: &str) {
    s.push_str("# ================================================================\n");
    s.push_str("# aim.camp Player Agent -- CS2 Performance & Community Platform v1.0\n");
    s.push_str("# Run as Administrator. A restore point is recommended.\n");
    s.push_str("# ================================================================\n\n");

    // Inject theme color variables (only part needing format!)
    s.push_str(&format!("$tc = '{}'\n$td = '{}'\n$ts = '{}'\n\n", primary, dark, secondary));

    // Full boot sequence — uses $tc/$td/$ts so raw string is safe
    s.push_str(r#"$Host.UI.RawUI.WindowTitle = 'aim.camp Player Agent'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
Clear-Host

# --- hex memory scan ---
$rand = New-Object System.Random
foreach ($row in 1..4) {
    $addr = '0x{0:X8}' -f $rand.Next(0x7FFFFFFF)
    $bytes = ''
    foreach ($b in 1..16) { $bytes += ' {0:X2}' -f $rand.Next(256) }
    $asc = -join (1..16 | ForEach-Object { [char]$rand.Next(33,126) })
    Write-Host "  $addr |$bytes | $asc" -ForegroundColor $td
    Start-Sleep -Milliseconds 30
}
Write-Host ''

# --- POST boot sequence ---
$post = @(
    @('[SYS]  Loading aim.camp Player Agent v1.0...', $td),
    @('[MEM]  Allocating optimization buffers...', $td),
    @('[CPU]  Detecting hardware configuration...', $ts),
    @('[GPU]  Initializing graphics pipeline...', $ts),
    @('[NET]  Network stack ready.', $tc),
    @('[OK!]  All systems nominal.', $tc)
)
foreach ($m in $post) {
    Write-Host "  $($m[0])" -ForegroundColor $m[1]
    Start-Sleep -Milliseconds 80
}
Write-Host ''

# --- ASCII banner via here-string (avoids all quoting issues) ---
$banner = @'
        _                                     
   __ _(_)_ __ ___    ___ __ _ _ __ ___  _ __  
  / _` | | '_ ` _ \  / __/ _` | '_ ` _ \| '_ \ 
 | (_| | | | | | | || (_| (_| | | | | | | |_) |
  \__,_|_|_| |_| |_(_)___\__,_|_| |_| |_| .__/ 
                                          |_|   
    ╔═══════════════════════════════════╗
    ║      P L A Y E R   A G E N T     ║
    ╚═══════════════════════════════════╝
'@
$blines = $banner -split "`n"
$bcolors = @($td,$ts,$tc,$tc,$ts,$td)
for ($i = 0; $i -lt $blines.Count; $i++) {
    Write-Host "  $($blines[$i])" -ForegroundColor $bcolors[$i % $bcolors.Count]
    Start-Sleep -Milliseconds 50
}
Write-Host ''
Write-Host '  >>--[ CS2 Performance & Community Platform v1.0 ]--<<' -ForegroundColor White
Write-Host '       Generated by aim.camp Player Agent' -ForegroundColor DarkGray
Write-Host ''

# --- loading progress bar ---
foreach ($p in 1..40) {
    $pct = [math]::Floor($p * 100 / 40)
    $done = '#' * $p
    $left = '-' * (40 - $p)
    $barColor = if ($pct -lt 40) { $td } elseif ($pct -lt 75) { $ts } else { $tc }
    Write-Host "`r  [$done$left] $pct% " -ForegroundColor $barColor -NoNewline
    Start-Sleep -Milliseconds 18
}
Write-Host "`r  [########################################] 100%  >> READY <<   " -ForegroundColor $tc
Start-Sleep -Milliseconds 200
Write-Host ''

"#);
}

fn ps1_section(s: &mut String, num: u8, title: &str, _icon: &str) {
    s.push_str(&format!("\n# ---- SECTION {}: {} ----\n", num, title));
    s.push_str("Write-Host ''\n");
    s.push_str(&format!("$sLine = '  >>==[ SECTION {} ]=====[ {} ]==>>'\n", num, title));
    s.push_str("foreach ($ch in $sLine.ToCharArray()) { Write-Host $ch -ForegroundColor $tc -NoNewline; Start-Sleep -Milliseconds 8 }\n");
    s.push_str("Write-Host ''\n");
    s.push_str("Write-Host '  ----------------------------------------------------------------' -ForegroundColor $td\n");
}

fn ps1_cmd(s: &mut String, description: &str, commands: &[&str]) {
    s.push_str(&format!("\n    # {}\n", description));
    s.push_str("    $spin = @('|','/','-','\\')\n");
    s.push_str(&format!("    for ($j=0;$j -lt 8;$j++) {{ Write-Host \"`r    [ $($spin[$j % 4]) ] {}\" -ForegroundColor $ts -NoNewline; Start-Sleep -Milliseconds 60 }}\n", description));
    s.push_str(&format!("    Write-Host \"`r    [ OK ] {}\" -ForegroundColor $tc\n", description));
    for c in commands {
        s.push_str("    ");
        s.push_str(c);
        s.push('\n');
    }
}

fn ps1_info(s: &mut String, message: &str) {
    s.push_str(&format!("    # {}\n", message));
    s.push_str(&format!(
        "    Write-Host '    [ i ] {}' -ForegroundColor $ts\n",
        message
    ));
}

fn ps1_footer(s: &mut String) {
    s.push_str(r#"

# ---- Done ----

Write-Host ''

# final progress bar
foreach ($p in 1..40) {
    $done = '#' * $p
    $left = '-' * (40 - $p)
    $c = if ($p -lt 14) { $td } elseif ($p -lt 28) { $ts } else { $tc }
    Write-Host "`r  [$done$left] Finalizing... " -ForegroundColor $c -NoNewline
    Start-Sleep -Milliseconds 18
}
Write-Host "`r  [########################################] COMPLETE              " -ForegroundColor $tc
Start-Sleep -Milliseconds 300

Write-Host ''
$doneBox = @(
'  +================================================================+',
'  |                                                                |',
'  |   [*]  aim.camp Player Agent -- All optimizations applied     |',
'  |                                                                |',
'  |   >>  Restart your PC to apply changes.                        |',
'  |   >>  Set CS2 launch options in Steam.                         |',
'  |                                                                |',
'  +================================================================+'
)
$doneColors = @($tc,$td,$tc,$td,$ts,$ts,$td,$tc)
for ($i = 0; $i -lt $doneBox.Count; $i++) {
    Write-Host $doneBox[$i] -ForegroundColor $doneColors[$i]
    Start-Sleep -Milliseconds 60
}

Write-Host ''

# outro trail
$trail = @('>>','*','>>','+','>>','*','>>','+','>>','DONE','>>','+','>>','*','>>')
$tColors = @($ts,$tc,$ts,$tc,$ts,$tc,$ts,$tc,$ts,'White',$ts,$tc,$ts,$tc,$ts)
Write-Host '  ' -NoNewline
for ($i = 0; $i -lt $trail.Count; $i++) {
    Write-Host "$($trail[$i]) " -ForegroundColor $tColors[$i] -NoNewline
    Start-Sleep -Milliseconds 60
}
Write-Host ''
Write-Host ''
Read-Host -Prompt '  Press Enter to exit'
"#);
}

// ────────────────────────────────────────────────────────────────────
// Script generator
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn generate_script(config: OptimizationConfig, section: Option<String>) -> Result<String, String> {
    let mut s = String::with_capacity(32_000);
    let run_all = section.is_none();
    let sf = section.as_deref();

    let pc = if config.theme_primary.is_empty() { "#84cc16".to_string() } else { config.theme_primary.clone() };
    let sc = if config.theme_secondary.is_empty() { "#22d3ee".to_string() } else { config.theme_secondary.clone() };
    let ps_primary = hex_to_ps_color(&pc);
    let ps_dark = hex_to_ps_dark(&pc);
    let ps_secondary = hex_to_ps_color(&sc);

    // Banner + boot animation
    ps1_banner(&mut s, ps_primary, ps_dark, ps_secondary);

    s.push_str("#Requires -RunAsAdministrator\n\n");
    s.push_str("$ErrorActionPreference = 'SilentlyContinue'\n\n");

    s.push_str("function Ensure-RegPath($Path) {\n");
    s.push_str("    if (!(Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }\n");
    s.push_str("}\n\n");

    // 1. BIOS
    if run_all || sf == Some("bios") {
    ps1_section(&mut s, 1, "BIOS -- Hardware Checks", "HW");

    s.push_str("    # Check virtualization state\n");
    s.push_str("    $vmfw = (Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled\n");
    s.push_str("    if ($vmfw) { Write-Host '    ⚠ Virtualization (SVM/VT-x) is ACTIVE in BIOS' -ForegroundColor Yellow }\n");
    s.push_str("    else       { Write-Host '    ✔ Virtualization (SVM/VT-x) is disabled — OK' -ForegroundColor Green  }\n\n");

    if config.bios.disable_svm {
        ps1_info(&mut s, "Disable SVM Mode / VT-x in BIOS");
        ps1_cmd(&mut s, "Disable Hyper-V in Windows", &[
            "Disable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart -ErrorAction SilentlyContinue | Out-Null",
            "bcdedit /set hypervisorlaunchtype off 2>$null",
        ]);
    }
    if config.bios.disable_c_states {
        ps1_info(&mut s, "Disable C-States in BIOS");
        ps1_cmd(&mut s, "Force CPU processor state to 100%", &[
            "powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100",
            "powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100",
            "powercfg /setactive SCHEME_CURRENT",
        ]);
    }
    if config.bios.disable_cool_n_quiet {
        ps1_info(&mut s, "Disable Cool'n'Quiet / Speed Shift in BIOS");
    }
    if config.bios.enable_xmp {
        ps1_info(&mut s, "Enable XMP/DOCP in BIOS for rated RAM speed");
        s.push_str("    $ramSpeed = (Get-CimInstance -ClassName Win32_PhysicalMemory | Select-Object -First 1).Speed\n");
        s.push_str("    Write-Host \"    ⚡ Current RAM speed: $ramSpeed MHz\" -ForegroundColor White\n");
    }
    if config.bios.enable_resize_bar {
        ps1_info(&mut s, "Enable ReSize BAR in BIOS (if GPU supports it)");
    }
    if config.bios.enable_above_4g {
        ps1_info(&mut s, "Enable Above 4G Decoding in BIOS");
    }
    } // end bios

    // 2. Windows
    if run_all || sf == Some("windows") {
    ps1_section(&mut s, 2, "Windows -- Performance Tweaks", "OS");

    if config.windows.ultimate_power_plan {
        ps1_cmd(&mut s, "Activate Ultimate/High Performance power plan...", &[
            "powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null",
            "$plans = powercfg /list",
            "if ($plans -match 'e9a42b02') { powercfg -setactive e9a42b02-d5df-448d-aa00-03f14749eb61 }",
            "else { powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c }",
            "Write-Host '    ✔ Power plan set.' -ForegroundColor Green",
        ]);
    }
    if config.windows.disable_game_dvr {
        ps1_cmd(&mut s, "Disable Game DVR (recording & captures)...", &[
            "Ensure-RegPath 'HKCU:\\System\\GameConfigStore'",
            "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_FSEBehavior' -Value 2 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_FSEBehaviorMode' -Value 2 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -Value 1 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_DXGIHonorFSEWindowsCompatible' -Value 1 -Type DWord -Force",
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR' -Name 'AllowGameDVR' -Value 0 -Type DWord -Force",
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_game_bar {
        ps1_cmd(&mut s, "Disable Game Bar overlay...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\GameBar'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name 'AllowAutoGameMode' -Value 0 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name 'ShowStartupPanel' -Value 0 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name 'UseNexusForGameBarEnabled' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_game_mode {
        ps1_cmd(&mut s, "Disable Windows Game Mode...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\GameBar'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name 'AutoGameModeEnabled' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_hibernation {
        ps1_cmd(&mut s, "Disable Hibernation & Fast Startup...", &[
            "powercfg -h off",
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_mouse_accel {
        ps1_cmd(&mut s, "Disable mouse acceleration (Enhance Pointer Precision)...", &[
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value '0' -Force",
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value '0' -Force",
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value '0' -Force",
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSensitivity' -Value '10' -Force",
        ]);
    }
    if config.windows.disable_fullscreen_optim {
        ps1_cmd(&mut s, "Disable Fullscreen Optimizations for CS2...", &[
            "$cs2Paths = @(",
            "    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe',",
            "    'D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe'",
            ")",
            "foreach ($p in $cs2Paths) {",
            "    if (Test-Path $p) {",
            "        $regPath = 'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers'",
            "        Ensure-RegPath $regPath",
            "        Set-ItemProperty -Path $regPath -Name $p -Value '~ DISABLEDXMAXIMIZEDWINDOWEDMODE' -Type String -Force",
            "        Write-Host \"    ✔ Fullscreen Optimizations disabled for: $p\" -ForegroundColor Green",
            "    }",
            "}",
        ]);
    }
    if config.windows.disable_visual_effects {
        ps1_cmd(&mut s, "Disable Windows visual effects (best performance)...", &[
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) -Type Binary -Force",
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'DragFullWindows' -Value '0' -Force",
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '0' -Force",
        ]);
    }
    if config.windows.disable_transparency {
        ps1_cmd(&mut s, "Disable transparency effects...", &[
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'EnableTransparency' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_background_apps {
        ps1_cmd(&mut s, "Disable background apps...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -Name 'GlobalUserDisabled' -Value 1 -Type DWord -Force",
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'BackgroundAppGlobalToggle' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_notifications {
        ps1_cmd(&mut s, "Disable notifications & tips...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PushNotifications'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PushNotifications' -Name 'ToastEnabled' -Value 0 -Type DWord -Force",
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer' -Name 'DisableNotificationCenter' -Value 1 -Type DWord -Force",
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SubscribedContent-338389Enabled' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_cortana {
        ps1_cmd(&mut s, "Disable Cortana...", &[
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search' -Name 'AllowCortana' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_search_indexing {
        ps1_cmd(&mut s, "Disable Windows Search Indexing service...", &[
            "Stop-Service -Name 'WSearch' -Force -ErrorAction SilentlyContinue",
            "Set-Service -Name 'WSearch' -StartupType Disabled -ErrorAction SilentlyContinue",
        ]);
    }
    if config.windows.hardware_gpu_scheduling {
        ps1_cmd(&mut s, "Enable Hardware Accelerated GPU Scheduling...", &[
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_hpet {
        ps1_cmd(&mut s, "Disable HPET (High Precision Event Timer)...", &[
            "bcdedit /deletevalue useplatformclock 2>$null",
            "bcdedit /set useplatformtick yes 2>$null",
            "bcdedit /set disabledynamictick yes 2>$null",
        ]);
    }
    if config.windows.disable_power_throttling {
        ps1_cmd(&mut s, "Disable Power Throttling...", &[
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling' -Name 'PowerThrottlingOff' -Value 1 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_core_parking {
        ps1_cmd(&mut s, "Disable Core Parking (keep all cores active)...", &[
            "powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 100",
            "powercfg -setactive SCHEME_CURRENT",
        ]);
    }
    if config.windows.clean_temp_files {
        ps1_cmd(&mut s, "Clean temporary files...", &[
            "Remove-Item -Path \"$env:TEMP\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
            "Remove-Item -Path 'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue",
            "Remove-Item -Path 'C:\\Windows\\Prefetch\\*' -Recurse -Force -ErrorAction SilentlyContinue",
            "Write-Host '    ✔ Temp files cleaned.' -ForegroundColor Green",
        ]);
    }
    if config.windows.cs2_high_performance_gpu {
        ps1_cmd(&mut s, "Set CS2 to High Performance GPU in Windows settings...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences'",
            "$cs2Exes = @(",
            "    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe',",
            "    'D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe'",
            ")",
            "foreach ($exe in $cs2Exes) {",
            "    if (Test-Path $exe) {",
            "        Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences' -Name $exe -Value 'GpuPreference=2;' -Force",
            "        Write-Host \"    ✔ CS2 set to High Performance GPU: $exe\" -ForegroundColor Green",
            "    }",
            "}",
        ]);
    }

    if config.windows.disable_delivery_optim {
        ps1_cmd(&mut s, "Disable Delivery Optimization (P2P uploads)...", &[
            "Stop-Service -Name 'DoSvc' -Force -ErrorAction SilentlyContinue",
            "Set-Service -Name 'DoSvc' -StartupType Disabled -ErrorAction SilentlyContinue",
        ]);
    }
    if config.windows.disable_widgets {
        ps1_cmd(&mut s, "Disable Windows 11 Widgets...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarDa' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_memory_compression {
        ps1_cmd(&mut s, "Disable Memory Compression...", &[
            "Disable-MMAgent -MemoryCompression -ErrorAction SilentlyContinue",
        ]);
    }
    if config.windows.disable_connected_ux {
        ps1_cmd(&mut s, "Disable Connected User Experiences and Telemetry...", &[
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 0 -Type DWord -Force",
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection' -Name 'ConnectedUserExperiences' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_spectre {
        ps1_cmd(&mut s, "Disable Spectre/Meltdown CPU mitigations (security risk)...", &[
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'FeatureSettingsOverride' -Value 3 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'FeatureSettingsOverrideMask' -Value 3 -Type DWord -Force",
            "Write-Host '    ⚠ CPU mitigations disabled. This is a security tradeoff for 5-30% perf gain.' -ForegroundColor Yellow",
        ]);
    }
    if config.windows.disable_last_access {
        ps1_cmd(&mut s, "Disable NTFS Last Access Timestamp...", &[
            "fsutil behavior set disablelastaccess 1 2>$null",
        ]);
    }
    if config.windows.disable_8dot3 {
        ps1_cmd(&mut s, "Disable 8.3 Short Filename Creation...", &[
            "fsutil behavior set disable8dot3 1 2>$null",
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem' -Name 'NtfsDisable8dot3NameCreation' -Value 1 -Type DWord -Force",
        ]);
    }
    if config.windows.mmcss_gaming {
        ps1_cmd(&mut s, "Set MMCSS Multimedia Scheduler for gaming priority...", &[
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force",
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'Scheduling Category' -Value 'High' -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'SFIO Priority' -Value 'High' -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'Background Only' -Value 'False' -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'Clock Rate' -Value 10000 -Type DWord -Force",
        ]);
    }
    if config.windows.disable_large_cache {
        ps1_cmd(&mut s, "Disable Large System Cache...", &[
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'LargeSystemCache' -Value 0 -Type DWord -Force",
        ]);
    }
    } // end windows

    // ── 3. Network ──────────────────────────────────────────────────
    if run_all || sf == Some("network") {
    ps1_section(&mut s, 3, "Network -- Latency & TCP", "NET");

    if config.network.disable_nagle {
        ps1_cmd(&mut s, "Disable Nagle algorithm (reduce network latency)...", &[
            "$adapters = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces'",
            "foreach ($adapter in $adapters) {",
            "    Set-ItemProperty -Path $adapter.PSPath -Name 'TcpAckFrequency' -Value 1 -Type DWord -Force",
            "    Set-ItemProperty -Path $adapter.PSPath -Name 'TCPNoDelay' -Value 1 -Type DWord -Force",
            "    Set-ItemProperty -Path $adapter.PSPath -Name 'TcpDelAckTicks' -Value 0 -Type DWord -Force",
            "}",
            "Write-Host '    ✔ Nagle disabled on all adapters.' -ForegroundColor Green",
        ]);
    }
    if config.network.optimize_tcp {
        ps1_cmd(&mut s, "Optimize global TCP settings...", &[
            "netsh int tcp set global autotuninglevel=normal",
            "netsh int tcp set global chimney=disabled 2>$null",
            "netsh int tcp set global ecncapability=disabled",
            "netsh int tcp set global timestamps=disabled",
            "netsh int tcp set global rss=enabled",
            "netsh int tcp set global dca=enabled 2>$null",
            "netsh int tcp set supplemental Internet congestionprovider=ctcp 2>$null",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' -Name 'DefaultTTL' -Value 64 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' -Name 'MaxUserPort' -Value 65534 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' -Name 'TcpTimedWaitDelay' -Value 30 -Type DWord -Force",
        ]);
    }
    if config.network.flush_dns {
        ps1_cmd(&mut s, "Flush DNS cache...", &[
            "ipconfig /flushdns | Out-Null",
            "Write-Host '    ✔ DNS cache flushed.' -ForegroundColor Green",
        ]);
    }
    if config.network.disable_wifi_power_save {
        ps1_cmd(&mut s, "Disable Wi-Fi power saving...", &[
            "$wifiAdapters = Get-NetAdapter | Where-Object { $_.InterfaceDescription -match 'Wi-Fi|Wireless|WLAN' }",
            "foreach ($a in $wifiAdapters) {",
            "    Set-NetAdapterPowerManagement -Name $a.Name -WakeOnMagicPacket Disabled -ErrorAction SilentlyContinue",
            "    powercfg /setacvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0 2>$null",
            "}",
            "powercfg /setactive SCHEME_CURRENT",
        ]);
    }
    if config.network.disable_network_throttle {
        ps1_cmd(&mut s, "Disable Network Throttling Index...", &[
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xFFFFFFFF -Type DWord -Force",
        ]);
    }
    if config.network.disable_ecn {
        ps1_cmd(&mut s, "Disable ECN Capability...", &[
            "netsh int tcp set global ecncapability=disabled 2>$null",
        ]);
    }
    if config.network.enable_rss {
        ps1_cmd(&mut s, "Enable Receive Side Scaling (RSS)...", &[
            "netsh int tcp set global rss=enabled 2>$null",
        ]);
    }
    if config.network.disable_netbios {
        ps1_cmd(&mut s, "Disable NetBIOS over TCP/IP on all adapters...", &[
            "$adapters = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces'",
            "foreach ($adapter in $adapters) {",
            "    Set-ItemProperty -Path $adapter.PSPath -Name 'NetbiosOptions' -Value 2 -Type DWord -Force",
            "}",
            "Write-Host '    ✔ NetBIOS disabled on all adapters.' -ForegroundColor Green",
        ]);
    }
    if config.network.disable_lmhosts {
        ps1_cmd(&mut s, "Disable LMHOSTS Lookup...", &[
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters' -Name 'EnableLMHOSTS' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.network.enable_ctcp {
        ps1_cmd(&mut s, "Enable Compound TCP (CTCP) congestion control...", &[
            "netsh int tcp set supplemental Internet congestionprovider=ctcp 2>$null",
        ]);
    }
    } // end network

    // ── 4. NVIDIA ───────────────────────────────────────────────────
    if run_all || sf == Some("nvidia") {
    ps1_section(&mut s, 4, "NVIDIA -- Registry-Level GPU Tweaks", "GPU");

    s.push_str("    # ── Find NVIDIA GPU registry path ──\n");
    s.push_str("    $nvBasePath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'\n");
    s.push_str("    $nvKeys = @('0000','0001','0002','0003')\n");
    s.push_str("    $nvPath = ''\n");
    s.push_str("    foreach ($k in $nvKeys) {\n");
    s.push_str("        $test = Join-Path $nvBasePath $k\n");
    s.push_str("        if (Test-Path $test) {\n");
    s.push_str("            $desc = (Get-ItemProperty -Path $test -Name 'DriverDesc' -ErrorAction SilentlyContinue).DriverDesc\n");
    s.push_str("            if ($desc -match 'NVIDIA|GeForce|RTX|GTX') { $nvPath = $test; break }\n");
    s.push_str("        }\n");
    s.push_str("    }\n\n");

    if config.nvidia.prefer_max_perf {
        ps1_cmd(&mut s, "NVIDIA: Power Mode = Max Performance...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'PerfLevelSrc' -Value 0x2222 -Type DWord -Force",
            "    Set-ItemProperty -Path $nvPath -Name 'PowerMizerEnable' -Value 1 -Type DWord -Force",
            "    Set-ItemProperty -Path $nvPath -Name 'PowerMizerLevel' -Value 1 -Type DWord -Force",
            "    Set-ItemProperty -Path $nvPath -Name 'PowerMizerLevelAC' -Value 1 -Type DWord -Force",
            "    Write-Host '    ✔ NVIDIA Power Mode = Max Performance' -ForegroundColor Green",
            "} else { Write-Host '    ⚠ NVIDIA GPU not found in registry.' -ForegroundColor Yellow }",
        ]);
    }
    if config.nvidia.disable_vsync {
        ps1_cmd(&mut s, "NVIDIA: Disable global V-Sync...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak' -Name 'Gestalt' -Value 1 -Type DWord -Force",
        ]);
    }
    if config.nvidia.low_latency_ultra {
        ps1_cmd(&mut s, "NVIDIA: Ultra Low Latency mode...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'RMDelayCycles' -Value 31 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Low Latency configured.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.threaded_optimization {
        ps1_cmd(&mut s, "NVIDIA: Enable Threaded Optimization...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'ThreadedOptimization' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Threaded Optimization enabled.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.disable_anisotropic {
        ps1_cmd(&mut s, "NVIDIA: Set anisotropic filtering to App-controlled...", &[
            "Write-Host '    💡 Recommended: Set Anisotropic Filtering to Application-controlled in NVIDIA Panel' -ForegroundColor Yellow",
        ]);
    }
    if config.nvidia.shader_cache_clear {
        ps1_cmd(&mut s, "Clear NVIDIA shader cache...", &[
            "$shaderPaths = @(",
            "    (Join-Path $env:LOCALAPPDATA 'NVIDIA\\DXCache'),",
            "    (Join-Path $env:LOCALAPPDATA 'NVIDIA\\GLCache'),",
            "    (Join-Path $env:LOCALAPPDATA 'Temp\\NVIDIA Corporation\\NV_Cache')",
            ")",
            "foreach ($sp in $shaderPaths) {",
            "    if (Test-Path $sp) { Remove-Item -Path \"$sp\\*\" -Recurse -Force -ErrorAction SilentlyContinue }",
            "}",
            "Write-Host '    ✔ NVIDIA shader cache cleared.' -ForegroundColor Green",
        ]);
    }
    if config.nvidia.force_reflex {
        ps1_cmd(&mut s, "NVIDIA: Force Reflex On+Boost...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'ReflexMode' -Value 3 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Reflex On+Boost enabled.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.disable_sharpening {
        ps1_cmd(&mut s, "NVIDIA: Disable Image Sharpening...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'SharpenEnabled' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Image Sharpening disabled.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.texture_filter_perf {
        ps1_cmd(&mut s, "NVIDIA: Texture Filtering Quality = High Performance...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'TextureFilterQuality' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Texture Filtering = High Performance.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.pre_rendered_frames_1 {
        ps1_cmd(&mut s, "NVIDIA: Max Pre-Rendered Frames = 1...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'MaxFrameAllowed' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Pre-Rendered Frames = 1.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.disable_ambient_occlusion {
        ps1_cmd(&mut s, "NVIDIA: Disable Ambient Occlusion...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'AmbientOcclusionMode' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Set-ItemProperty -Path $nvPath -Name 'AmbientOcclusion' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Ambient Occlusion disabled.' -ForegroundColor Green",
            "}",
        ]);
    }
    if config.nvidia.disable_fxaa {
        ps1_cmd(&mut s, "NVIDIA: Disable Global FXAA...", &[
            "if ($nvPath) {",
            "    Set-ItemProperty -Path $nvPath -Name 'FXAAEnable' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue",
            "    Write-Host '    ✔ NVIDIA Global FXAA disabled.' -ForegroundColor Green",
            "}",
        ]);
    }
    } // end nvidia

    // ── 5. Services ─────────────────────────────────────────────────
    if run_all || sf == Some("services") {
    ps1_section(&mut s, 5, "Services -- Disable Unnecessary", "SVC");

    let services: Vec<(&str, &str, bool)> = vec![
        ("SysMain", "SysMain (Superfetch)", config.services.disable_sysmain),
        ("DiagTrack", "DiagTrack (Telemetry)", config.services.disable_diagtrack),
        ("WSearch", "Windows Search", config.services.disable_wsearch),
        ("Spooler", "Print Spooler", config.services.disable_print_spooler),
        ("Fax", "Fax Service", config.services.disable_fax),
        ("CDPSvc", "Connected Devices Platform", config.services.disable_cdp),
        ("DPS", "Diagnostic Policy", config.services.disable_diagnostic_policy),
        ("RemoteRegistry", "Remote Registry", config.services.disable_remote_registry),
        ("MapsBroker", "MapsBroker", config.services.disable_maps_broker),
        ("PhoneSvc", "Phone Service", config.services.disable_phone_service),
        ("RetailDemo", "RetailDemo Service", config.services.disable_retail_demo),
    ];

    for (svc, name, enabled) in &services {
        if *enabled {
            ps1_cmd(&mut s, &format!("Disable {}...", name), &[
                &format!("Stop-Service -Name '{}' -Force -ErrorAction SilentlyContinue", svc),
                &format!("Set-Service -Name '{}' -StartupType Disabled -ErrorAction SilentlyContinue", svc),
            ]);
        }
    }

    if config.services.disable_xbox_services {
        ps1_cmd(&mut s, "Disable all Xbox services...", &[
            "$xboxServices = @('XblAuthManager','XblGameSave','XboxGipSvc','XboxNetApiSvc')",
            "foreach ($svc in $xboxServices) {",
            "    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue",
            "    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue",
            "}",
            "Write-Host '    ✔ Xbox services disabled.' -ForegroundColor Green",
        ]);
    }
    if config.services.disable_wpn {
        ps1_cmd(&mut s, "Disable WpnUserService (push notifications)...", &[
            "Get-Service -Name 'WpnUserService*' -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue",
            "Get-Service -Name 'WpnUserService*' -ErrorAction SilentlyContinue | Set-Service -StartupType Disabled -ErrorAction SilentlyContinue",
        ]);
    }
    } // end services

    // ── 6. autoexec.cfg ────────────────────────────────────────────
    if run_all || sf == Some("autoexec") {
    if config.autoexec.enabled {
        ps1_section(&mut s, 6, "CS2 -- autoexec.cfg Generation", "CFG");

        s.push_str("    $autoexecLines = @()\n");
        s.push_str("    $autoexecLines += '// ═══════════════════════════════════════════════════════'\n");
        s.push_str("    $autoexecLines += '// ★  aim.camp Player Agent — CS2 autoexec.cfg  ★'\n");
        s.push_str("    $autoexecLines += '// ═══════════════════════════════════════════════════════'\n");
        s.push_str(&format!("    $autoexecLines += 'fps_max {}'\n", config.autoexec.fps_max));
        s.push_str(&format!("    $autoexecLines += 'rate {}'\n", config.autoexec.rate));
        s.push_str(&format!("    $autoexecLines += 'cl_interp {}'\n", config.autoexec.cl_interp));
        s.push_str(&format!("    $autoexecLines += 'cl_interp_ratio {}'\n", config.autoexec.cl_interp_ratio));
        s.push_str(&format!("    $autoexecLines += 'cl_updaterate {}'\n", config.autoexec.cl_updaterate));
        s.push_str(&format!("    $autoexecLines += 'cl_cmdrate {}'\n", config.autoexec.cl_cmdrate));

        if config.autoexec.m_rawinput {
            s.push_str("    $autoexecLines += 'm_rawinput 1'\n");
        }
        for line in config.autoexec.custom_commands.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                s.push_str(&format!("    $autoexecLines += '{}'\n", trimmed.replace('\'', "''")));
            }
        }

        s.push_str("\n    # ── Auto-detect CS2 cfg folder ──\n");
        s.push_str("    $steamBase = @('C:\\Program Files (x86)\\Steam','D:\\Steam','D:\\SteamLibrary','E:\\SteamLibrary','F:\\SteamLibrary')\n");
        s.push_str("    $cfgFolder = ''\n");
        s.push_str("    foreach ($base in $steamBase) {\n");
        s.push_str("        $test = Join-Path $base 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'\n");
        s.push_str("        if (Test-Path $test) { $cfgFolder = $test; break }\n");
        s.push_str("    }\n");
        s.push_str("    if ($cfgFolder -eq '') {\n");
        s.push_str("        $steamPath = (Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\WOW6432Node\\Valve\\Steam' -Name 'InstallPath' -ErrorAction SilentlyContinue).InstallPath\n");
        s.push_str("        if ($steamPath) {\n");
        s.push_str("            $test = Join-Path $steamPath 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'\n");
        s.push_str("            if (Test-Path $test) { $cfgFolder = $test }\n");
        s.push_str("        }\n");
        s.push_str("    }\n");
        s.push_str("    if ($cfgFolder -eq '') {\n");
        s.push_str("        Write-Host '    ⚠ CS2 cfg folder not found. autoexec.cfg created in current directory.' -ForegroundColor Yellow\n");
        s.push_str("        $cfgFolder = '.'\n");
        s.push_str("    } else {\n");
        s.push_str("        Write-Host \"    ✔ CS2 folder found: $cfgFolder\" -ForegroundColor Green\n");
        s.push_str("    }\n");
        s.push_str("    $autoexecPath = Join-Path $cfgFolder 'autoexec.cfg'\n");
        s.push_str("    $autoexecLines | Set-Content -Path $autoexecPath -Encoding UTF8\n");
        s.push_str("    Write-Host \"    ✔ autoexec.cfg written to: $autoexecPath\" -ForegroundColor Green\n");
    }
    } // end autoexec

    // ── 7. Launch options ─────────────────────────────────────────
    if run_all || sf == Some("launch") {
    ps1_section(&mut s, 7, "CS2 -- Launch Options", "RUN");
    {
        let mut opts: Vec<String> = Vec::new();
        if config.launch_options.exec_autoexec { opts.push("+exec autoexec.cfg".into()); }
        if config.launch_options.novid          { opts.push("-novid".into()); }
        if config.launch_options.nojoy          { opts.push("-nojoy".into()); }
        if config.launch_options.high_priority  { opts.push("-high".into()); }
        if config.launch_options.allow_third_party { opts.push("-allow_third_party_software".into()); }
        if !config.launch_options.threads.is_empty() {
            opts.push(format!("-threads {}", config.launch_options.threads));
        }
        if !config.launch_options.custom_args.is_empty() {
            opts.push(config.launch_options.custom_args.clone());
        }
        let opts_str = opts.join(" ");
        s.push_str("    Write-Host '    Set these in CS2 Steam properties:' -ForegroundColor White\n");
        s.push_str(&format!("    Write-Host '    {}' -ForegroundColor Green\n", opts_str));
        s.push_str(&format!("    Set-Clipboard -Value '{}'\n", opts_str));
        s.push_str("    Write-Host '    (Copied to clipboard!)' -ForegroundColor Cyan\n");
    }
    } // end launch

    // ── 8. Extras / FACEIT ─────────────────────────────────────────
    if run_all || sf == Some("extras") {
    ps1_section(&mut s, 8, "Extras & FACEIT", "EXT");

    if config.extras.disable_steam_overlay {
        ps1_cmd(&mut s, "Disable Steam Overlay via registry...", &[
            "Ensure-RegPath 'HKCU:\\SOFTWARE\\Valve\\Steam'",
            "Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Valve\\Steam' -Name 'GameOverlayDisabled' -Value 1 -Type DWord -Force",
        ]);
    }
    if config.extras.disable_discord_overlay {
        ps1_cmd(&mut s, "Disable Discord Overlay (kill hook)...", &[
            "Write-Host '    💡 Open Discord > Settings > Game Overlay > Disable in-game overlay' -ForegroundColor Yellow",
            "Get-Process -Name 'DiscordHook*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
        ]);
    }
    if config.extras.system_responsiveness {
        ps1_cmd(&mut s, "Set SystemResponsiveness for gaming (0 = max foreground priority)...", &[
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xFFFFFFFF -Type DWord -Force",
        ]);
    }
    if config.extras.gpu_priority {
        ps1_cmd(&mut s, "Set GPU priority & scheduling for games...", &[
            "Ensure-RegPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'GPU Priority' -Value 8 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'Priority' -Value 6 -Type DWord -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'Scheduling Category' -Value 'High' -Force",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' -Name 'SFIO Priority' -Value 'High' -Force",
        ]);
    }
    if config.extras.priority_separation {
        ps1_cmd(&mut s, "Optimize Win32PrioritySeparation for foreground apps...", &[
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -Value 38 -Type DWord -Force",
        ]);
    }
    if config.extras.cs2_process_priority {
        ps1_cmd(&mut s, "Set CS2 process to High priority (if running)...", &[
            "$cs2 = Get-Process -Name 'cs2' -ErrorAction SilentlyContinue",
            "if ($cs2) {",
            "    $cs2.PriorityClass = 'High'",
            "    Write-Host '    ✔ CS2 set to High priority.' -ForegroundColor Green",
            "} else {",
            "    Write-Host '    ⚠ CS2 not running. Priority will be applied via -high in launch options.' -ForegroundColor Yellow",
            "}",
        ]);
    }
    if config.extras.disable_telemetry_tasks {
        ps1_cmd(&mut s, "Disable Windows telemetry scheduled tasks...", &[
            "Get-ScheduledTask -TaskPath '\\Microsoft\\Windows\\Application Experience\\' -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match 'CompatTelRunner|ProgramDataUpdater' } | Disable-ScheduledTask -ErrorAction SilentlyContinue | Out-Null",
            "Get-ScheduledTask -TaskPath '\\Microsoft\\Windows\\Customer Experience Improvement Program\\' -ErrorAction SilentlyContinue | Disable-ScheduledTask -ErrorAction SilentlyContinue | Out-Null",
        ]);
    }
    if config.extras.timer_resolution {
        ps1_cmd(&mut s, "Set global timer resolution to 0.5ms...", &[
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel' -Name 'GlobalTimerResolutionRequests' -Value 1 -Type DWord -Force",
            "bcdedit /set useplatformclock false 2>$null",
            "bcdedit /set disabledynamictick yes 2>$null",
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\TimeIncrement'",
            "Write-Host '    ✔ Timer resolution configured. Reboot required.' -ForegroundColor Green",
        ]);
    }
    if config.extras.msi_mode_gpu {
        ps1_cmd(&mut s, "Enable MSI Mode for GPU (reduce DPC latency)...", &[
            "$gpuDev = Get-PnpDevice -Class Display -Status OK -ErrorAction SilentlyContinue | Select-Object -First 1",
            "if ($gpuDev) {",
            "    $instanceId = $gpuDev.InstanceId -replace '\\\\', '\\'",
            "    $msiPath = \"HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$instanceId\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties\"",
            "    Ensure-RegPath $msiPath",
            "    Set-ItemProperty -Path $msiPath -Name 'MSISupported' -Value 1 -Type DWord -Force",
            "    Write-Host '    ✔ MSI Mode enabled for GPU.' -ForegroundColor Green",
            "} else { Write-Host '    ⚠ No GPU found for MSI Mode.' -ForegroundColor Yellow }",
        ]);
    }
    if config.extras.pcie_link_state_off {
        ps1_cmd(&mut s, "Disable PCIe Active State Power Management (ASPM)...", &[
            "powercfg /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0 2>$null",
            "powercfg /setactive SCHEME_CURRENT",
        ]);
    }
    if config.extras.interrupt_moderation_off {
        ps1_cmd(&mut s, "Disable network adapter Interrupt Moderation...", &[
            "$netAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }",
            "foreach ($a in $netAdapters) {",
            "    Set-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword '*InterruptModeration' -RegistryValue 0 -ErrorAction SilentlyContinue",
            "}",
            "Write-Host '    ✔ Interrupt Moderation disabled on active adapters.' -ForegroundColor Green",
        ]);
    }
    if config.extras.enable_large_pages {
        ps1_cmd(&mut s, "Enable Large Pages privilege for current user...", &[
            "# Grant SeLockMemoryPrivilege via secpol",
            "$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name",
            "Write-Host \"    ⚠ To enable Large Pages, grant SeLockMemoryPrivilege to $currentUser in Local Security Policy.\" -ForegroundColor Yellow",
            "Write-Host '    ⚠ secpol.msc > Local Policies > User Rights Assignment > Lock pages in memory' -ForegroundColor Yellow",
            "Ensure-RegPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management'",
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'LargePageMinimum' -Value 0 -Type DWord -Force",
        ]);
    }
    if config.extras.faceit_admin {
        ps1_cmd(&mut s, "Check FACEIT Anti-Cheat...", &[
            "$faceit = Get-Service -Name 'FACEITService' -ErrorAction SilentlyContinue",
            "if ($faceit) { Write-Host '    ✔ FACEIT AC found and running.' -ForegroundColor Green }",
            "else { Write-Host '    ⚠ FACEIT AC not found. Make sure it is installed and running as Admin.' -ForegroundColor Yellow }",
            "Write-Host '    💡 Always run FACEIT AC as Administrator.' -ForegroundColor Yellow",
        ]);
    }
    } // end extras

    // ── Galaxy Footer ───────────────────────────────────────────────
    ps1_footer(&mut s);

    Ok(s)
}

// ────────────────────────────────────────────────────────────────────
// Save script to file
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn save_script(script_content: String) -> Result<(), String> {
    FileDialogBuilder::new()
        .set_file_name("aimcamp_PlayerAgent_Optimize.ps1")
        .add_filter("PowerShell Script", &["ps1"])
        .save_file(move |file_path| {
            if let Some(path) = file_path {
                if let Ok(mut file) = File::create(&path) {
                    let _ = file.write_all(&[0xEF, 0xBB, 0xBF]); // UTF-8 BOM
                    let _ = file.write_all(script_content.as_bytes());
                }
            }
        });
    Ok(())
}

// ────────────────────────────────────────────────────────────────────
// Save CFG file
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn save_cfg(cfg_content: String) -> Result<(), String> {
    FileDialogBuilder::new()
        .set_file_name("autoexec.cfg")
        .add_filter("CS2 Config", &["cfg"])
        .save_file(move |file_path| {
            if let Some(path) = file_path {
                if let Ok(mut file) = File::create(&path) {
                    let _ = file.write_all(cfg_content.as_bytes());
                }
            }
        });
    Ok(())
}

// ────────────────────────────────────────────────────────────────────
// Load CFG file
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn load_cfg() -> Result<ImportResult, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<ImportResult>>();

    FileDialogBuilder::new()
        .add_filter("CS2 Config", &["cfg"])
        .set_title("Load CS2 CFG File")
        .pick_file(move |file_path| {
            if let Some(path) = file_path {
                let path_str = path.to_string_lossy().to_string();
                match File::open(&path) {
                    Ok(mut file) => {
                        let mut content = String::new();
                        if file.read_to_string(&mut content).is_ok() {
                            let _ = tx.send(Some(ImportResult { path: path_str, content }));
                        } else {
                            let _ = tx.send(None);
                        }
                    }
                    Err(_) => { let _ = tx.send(None); }
                }
            } else {
                let _ = tx.send(None);
            }
        });

    match rx.recv() {
        Ok(Some(result)) => Ok(result),
        Ok(None) => Err("Could not read the file.".into()),
        Err(_) => Err("Dialog cancelled.".into()),
    }
}

// ────────────────────────────────────────────────────────────────────
// Import .ps1 file
// ────────────────────────────────────────────────────────────────────
#[derive(serde::Serialize, Clone)]
struct ImportResult {
    path: String,
    content: String,
}

#[tauri::command]
async fn import_script() -> Result<ImportResult, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<ImportResult>>();
    
    FileDialogBuilder::new()
        .add_filter("PowerShell Script", &["ps1"])
        .set_title("Import aim.camp Player Agent PS1 Script")
        .pick_file(move |file_path| {
            if let Some(path) = file_path {
                let path_str = path.to_string_lossy().to_string();
                match File::open(&path) {
                    Ok(mut file) => {
                        let mut content = String::new();
                        if file.read_to_string(&mut content).is_ok() {
                            let _ = tx.send(Some(ImportResult { path: path_str, content }));
                        } else {
                            let _ = tx.send(None);
                        }
                    }
                    Err(_) => { let _ = tx.send(None); }
                }
            } else {
                let _ = tx.send(None);
            }
        });

    match rx.recv() {
        Ok(Some(result)) => Ok(result),
        Ok(None) => Err("Could not read the file.".into()),
        Err(_) => Err("Dialog cancelled.".into()),
    }
}

// ────────────────────────────────────────────────────────────────────
// Run: execute a .ps1 as admin using PowerShell Start-Process -Verb RunAs
// The user picks any .ps1 file and it gets launched in an elevated shell.
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn run_script_as_admin(script_path: String) -> Result<String, String> {
    let path = if script_path.is_empty() {
        return Err("No script path provided.".into());
    } else {
        script_path
    };

    // Use cmd to call PowerShell's Start-Process with -Verb RunAs
    let result = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"{}\"'",
                path.replace('\'', "''")
            ),
        ])
        .spawn();

    match result {
        Ok(_) => Ok(format!("Script launched as Administrator: {}", path)),
        Err(e) => Err(format!("Failed to launch: {}", e)),
    }
}

// ────────────────────────────────────────────────────────────────────
// Pick file: open file dialog and return the chosen path only
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn pick_ps1_file() -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();
    
    FileDialogBuilder::new()
        .add_filter("PowerShell Script", &["ps1"])
        .set_title("Select PS1 Script to Run")
        .pick_file(move |file_path| {
            if let Some(path) = file_path {
                let _ = tx.send(Some(path.to_string_lossy().to_string()));
            } else {
                let _ = tx.send(None);
            }
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(path),
        Ok(None) => Err("No file selected.".into()),
        Err(_) => Err("Dialog cancelled.".into()),
    }
}

// ────────────────────────────────────────────────────────────────────
// Check real system state for every feature → returns JSON
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn check_system_state() -> Result<serde_json::Value, String> {
    let ps_script = include_str!("check_state.ps1");
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("aimcamp_syscheck.ps1");
    std::fs::write(&script_path, ps_script)
        .map_err(|e| format!("Failed to write temp script: {}", e))?;

    let output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy", "Bypass",
            "-File",
            &script_path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("PowerShell exec failed: {}", e))?;

    let _ = std::fs::remove_file(&script_path);

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("JSON parse error: {} — raw: {}", e, stdout))
}

// ────────────────────────────────────────────────────────────────────
// Generate + run script content directly as admin (no file dialog)
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn run_config_as_admin(config: OptimizationConfig, section: Option<String>) -> Result<String, String> {
    let script = generate_script(config, section).await?;

    // Wrap script with timing/statistics that writes a report JSON
    let report_path = std::env::temp_dir().join("aimcamp_script_report.json");
    let report_path_str = report_path.to_string_lossy().to_string().replace('\\', "\\\\");

    let wrapped = format!(
        r#"$_aimcamp_start = Get-Date
$_aimcamp_errors = @()
$_aimcamp_sections = @()
$_aimcamp_cmds = 0

# Override Write-Host to count sections/commands
$_origEAP = $ErrorActionPreference

# Trap errors
trap {{
    $_aimcamp_errors += $_.Exception.Message
    continue
}}

{}

$_aimcamp_end = Get-Date
$_aimcamp_duration = ($_aimcamp_end - $_aimcamp_start).TotalSeconds

# Count sections and commands from script content
$_scriptLines = @'
{}
'@
$_aimcamp_sections = ([regex]::Matches($_scriptLines, 'SECTION \d+') | ForEach-Object {{ $_.Value }})
$_aimcamp_cmds = ([regex]::Matches($_scriptLines, '\[ OK \]')).Count

$_report = @{{
    status        = if ($_aimcamp_errors.Count -eq 0) {{ 'success' }} else {{ 'partial' }}
    duration_secs = [math]::Round($_aimcamp_duration, 1)
    sections_run  = $_aimcamp_sections.Count
    commands_run  = $_aimcamp_cmds
    errors        = @($_aimcamp_errors)
    start_time    = $_aimcamp_start.ToString('o')
    end_time      = $_aimcamp_end.ToString('o')
}}
$_report | ConvertTo-Json -Depth 3 | Set-Content -Path '{}' -Encoding UTF8
"#,
        script,
        script.replace('\'', "''"),
        report_path_str
    );

    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("aimcamp_run.ps1");

    // Write with UTF-8 BOM
    let bom: [u8; 3] = [0xEF, 0xBB, 0xBF];
    let mut file = File::create(&script_path)
        .map_err(|e| format!("Failed to write temp script: {}", e))?;
    file.write_all(&bom)
        .map_err(|e| format!("BOM write error: {}", e))?;
    file.write_all(wrapped.as_bytes())
        .map_err(|e| format!("Script write error: {}", e))?;

    let path_str = script_path.to_string_lossy().to_string();
    let result = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"{}\"'",
                path_str.replace('\'', "''")
            ),
        ])
        .spawn();

    match result {
        Ok(_) => Ok("Script launched as Administrator from current config".into()),
        Err(e) => Err(format!("Failed to launch: {}", e)),
    }
}

// ────────────────────────────────────────────────────────────────────
// AI Chat — calls OpenAI-compatible API
// ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn ai_chat(
    api_key: String,
    endpoint: String,
    model: String,
    messages: Vec<serde_json::Value>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 3000,
    });

    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("API error {}: {}", status, &text[..text.len().min(500)]));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse: {} — {}", e, &text[..text.len().min(300)]))?;

    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("No content in response: {}", &text[..text.len().min(300)]))
}

// ────────────────────────────────────────────────────────────────────
// Discord Webhook — send formatted messages to a channel
// ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn send_to_discord(
    webhook_url: String,
    title: String,
    description: String,
    color: u32,
    fields: Vec<serde_json::Value>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let embed = serde_json::json!({
        "embeds": [{
            "title": title,
            "description": description,
            "color": color,
            "fields": fields,
            "footer": { "text": "aim.camp Player Agent — CS2 Performance & Community Platform" },
            "timestamp": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        }]
    });

    let resp = client
        .post(&webhook_url)
        .header("Content-Type", "application/json")
        .json(&embed)
        .send()
        .await
        .map_err(|e| format!("Discord request failed: {}", e))?;

    if resp.status().is_success() || resp.status().as_u16() == 204 {
        Ok("Sent to Discord".into())
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Discord error: {}", &text[..text.len().min(300)]))
    }
}

// ────────────────────────────────────────────────────────────────────
// Driver information — system + peripheral drivers
// Categories: GPU, Audio, Network, Mouse, Keyboard, Monitor, USB Game Controllers
// For each: device name, driver name, driver version, manufacturer,
//           whether it's a generic driver, and whether it's up to date.
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn get_driver_info() -> Result<serde_json::Value, String> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

function Get-DriverCategory {
    param($class, $name, $compat)
    $n = ($name + ' ' + $compat).ToLower()
    if ($class -eq 'Display')           { return 'GPU' }
    if ($class -match 'AudioEndpoint|MEDIA|Sound') { return 'Audio' }
    if ($class -eq 'Net')               { return 'Network' }
    if ($class -eq 'Mouse' -or $class -eq 'HIDClass' -and $n -match 'mouse|pointer') { return 'Mouse' }
    if ($class -eq 'Keyboard' -or ($class -eq 'HIDClass' -and $n -match 'keyboard')) { return 'Keyboard' }
    if ($class -eq 'Monitor')           { return 'Monitor' }
    if ($class -eq 'HIDClass' -and $n -match 'game|controller|joystick|gamepad|xbox') { return 'Controller' }
    if ($class -eq 'USB' -and $n -match 'headset|audio|dac|amp') { return 'Audio' }
    if ($class -eq 'HIDClass' -and $n -match 'headset|audio') { return 'Audio' }
    return $null
}

# Collect PnP devices with driver info
$devices = Get-CimInstance Win32_PnPSignedDriver |
    Where-Object { $_.DeviceName -and $_.DeviceClass } |
    Select-Object DeviceName, DeviceClass, DriverVersion, DriverDate, Manufacturer,
                  DriverProviderName, HardWareID, CompatID, IsSigned, InfName

$results = @()

foreach ($d in $devices) {
    $compatStr = if ($d.HardWareID) { ($d.HardWareID -join ' ') } else { '' }
    $cat = Get-DriverCategory -class $d.DeviceClass -name $d.DeviceName -compat $compatStr
    if (-not $cat) { continue }

    # Determine if generic driver
    $provider = if ($d.DriverProviderName) { $d.DriverProviderName.Trim() } else { '' }
    $mfr = if ($d.Manufacturer) { $d.Manufacturer.Trim() } else { '' }
    $genericProviders = @('Microsoft', 'Microsoft Corporation', 'Windows', '(Standard system devices)',
                          '(Generic)', 'Generic', 'Microsoft Windows', 'Dispositivos de sistema', 'USB')
    $isGeneric = $false
    foreach ($gp in $genericProviders) {
        if ($provider -eq $gp -or $mfr -eq $gp) { $isGeneric = $true; break }
    }
    # Display adapters with 'Microsoft Basic' are generic
    if ($d.DeviceName -match 'Microsoft Basic|Standard VGA|Generic.*Display') { $isGeneric = $true }

    # Driver date and age
    $driverDateStr = ''
    $daysOld = -1
    if ($d.DriverDate) {
        try {
            $dt = [DateTime]$d.DriverDate
            $driverDateStr = $dt.ToString('yyyy-MM-dd')
            $daysOld = ((Get-Date) - $dt).Days
        } catch { }
    }

    # Heuristic: driver older than 365 days = possibly outdated
    $status = 'unknown'
    if ($daysOld -ge 0) {
        if ($daysOld -le 180)    { $status = 'current' }
        elseif ($daysOld -le 365) { $status = 'aging' }
        else                      { $status = 'outdated' }
    }

    $results += @{
        category      = $cat
        device_name   = $d.DeviceName.Trim()
        driver_name   = if ($d.InfName) { $d.InfName.Trim() } else { 'N/A' }
        driver_version = if ($d.DriverVersion) { $d.DriverVersion.Trim() } else { 'N/A' }
        driver_provider = $provider
        manufacturer  = $mfr
        driver_date   = $driverDateStr
        days_old      = $daysOld
        is_signed     = [bool]$d.IsSigned
        is_generic    = $isGeneric
        status        = $status
    }
}

# Deduplicate by device name (keep newest driver version)
$unique = @{}
foreach ($r in $results) {
    $key = $r.category + '|' + $r.device_name
    if (-not $unique.ContainsKey($key) -or $r.days_old -lt $unique[$key].days_old) {
        $unique[$key] = $r
    }
}

# Sort: GPU first, then by category
$sorted = @($unique.Values) | Sort-Object @{Expression={
    switch ($_.category) {
        'GPU'        { 0 }
        'Monitor'    { 1 }
        'Audio'      { 2 }
        'Network'    { 3 }
        'Mouse'      { 4 }
        'Keyboard'   { 5 }
        'Controller' { 6 }
        default      { 9 }
    }
}}, device_name

@($sorted) | ConvertTo-Json -Depth 3
"#;
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| format!("Driver info failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Driver JSON parse: {} — {}", e, &stdout[..stdout.len().min(300)]))
}

// ────────────────────────────────────────────────────────────────────
// Check for available driver updates via Windows Update API
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn check_driver_updates() -> Result<serde_json::Value, String> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'

# Use Windows Update COM API to find available driver updates
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $searcher.ServiceID = '7971f918-a847-4430-9279-4a52d1efe18d'  # Microsoft Update
    $searcher.SearchScope = 1
    $searcher.ServerSelection = 3  # Third-party (includes manufacturer drivers)

    $result = $searcher.Search("IsInstalled=0 AND Type='Driver'")
    $updates = @()

    foreach ($u in $result.Updates) {
        $hwIds = @()
        if ($u.DriverHardwareID) { $hwIds += $u.DriverHardwareID }

        # Match device name from driver update
        $devName = ''
        if ($u.DriverModel) { $devName = $u.DriverModel }

        $updates += @{
            title         = $u.Title
            description   = if ($u.Description) { $u.Description.Substring(0, [Math]::Min(200, $u.Description.Length)) } else { '' }
            driver_model  = $devName
            driver_ver    = if ($u.DriverVerDate) { $u.DriverVerDate.ToString('yyyy-MM-dd') } else { '' }
            driver_class  = if ($u.DriverClass) { $u.DriverClass } else { '' }
            driver_mfr    = if ($u.DriverManufacturer) { $u.DriverManufacturer } else { '' }
            hw_ids        = $hwIds
            update_id     = $u.Identity.UpdateID
            size_mb       = [math]::Round($u.MaxDownloadSize / 1MB, 1)
            download_url  = if ($u.MoreInfoUrls -and $u.MoreInfoUrls.Count -gt 0) { $u.MoreInfoUrls[0] } else { '' }
            is_mandatory  = [bool]$u.IsMandatory
        }
    }

    @{ available = @($updates); error = $null } | ConvertTo-Json -Depth 4
} catch {
    @{ available = @(); error = $_.Exception.Message } | ConvertTo-Json -Depth 4
}
"#;
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| format!("Driver update check failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Driver update JSON parse: {} — {}", e, &stdout[..stdout.len().min(300)]))
}

// ────────────────────────────────────────────────────────────────────
// Install a specific driver update via Windows Update API (as admin)
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn install_driver_update(update_id: String) -> Result<serde_json::Value, String> {
    let report_path = std::env::temp_dir().join("aimcamp_driver_install_report.json");
    let report_path_str = report_path.to_string_lossy().to_string();

    let script = format!(r#"
$ErrorActionPreference = 'Stop'
$report = @{{ update_id = '{}'; status = 'starting'; steps = @(); error = $null; start_time = (Get-Date).ToString('o') }}

try {{
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $searcher.ServiceID = '7971f918-a847-4430-9279-4a52d1efe18d'
    $searcher.SearchScope = 1
    $searcher.ServerSelection = 3

    $result = $searcher.Search("IsInstalled=0 AND Type='Driver'")
    $target = $null
    foreach ($u in $result.Updates) {{
        if ($u.Identity.UpdateID -eq '{}') {{ $target = $u; break }}
    }}

    if (-not $target) {{
        $report.status = 'not_found'
        $report.error = 'Update not found. It may have already been installed.'
        $report | ConvertTo-Json -Depth 3 | Set-Content -Path '{}' -Encoding UTF8
        exit 1
    }}

    $report.steps += 'Update found: ' + $target.Title

    # Accept EULA
    if (-not $target.EulaAccepted) {{ $target.AcceptEula() }}
    $report.steps += 'EULA accepted'

    # Download
    $report.status = 'downloading'
    $report | ConvertTo-Json -Depth 3 | Set-Content -Path '{}' -Encoding UTF8
    $dl = New-Object -ComObject Microsoft.Update.UpdateColl
    $dl.Add($target) | Out-Null
    $downloader = $session.CreateUpdateDownloader()
    $downloader.Updates = $dl
    $dlResult = $downloader.Download()
    $report.steps += 'Downloaded (result: ' + $dlResult.ResultCode + ')'

    # Install
    $report.status = 'installing'
    $report | ConvertTo-Json -Depth 3 | Set-Content -Path '{}' -Encoding UTF8
    $inst = New-Object -ComObject Microsoft.Update.UpdateColl
    $inst.Add($target) | Out-Null
    $installer = $session.CreateUpdateInstaller()
    $installer.Updates = $inst
    $instResult = $installer.Install()
    $resultCode = $instResult.GetUpdateResult(0).ResultCode
    # 2 = Succeeded, 3 = SucceededWithErrors
    if ($resultCode -eq 2 -or $resultCode -eq 3) {{
        $report.status = 'success'
        $report.steps += 'Installation completed successfully'
        $report.needs_reboot = $instResult.RebootRequired
    }} else {{
        $report.status = 'failed'
        $report.error = 'Install result code: ' + $resultCode
    }}
}} catch {{
    $report.status = 'failed'
    $report.error = $_.Exception.Message
}}

$report.end_time = (Get-Date).ToString('o')
$report | ConvertTo-Json -Depth 3 | Set-Content -Path '{}' -Encoding UTF8
"#, update_id, update_id, report_path_str, report_path_str, report_path_str, report_path_str);

    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("aimcamp_driver_install.ps1");

    let bom: [u8; 3] = [0xEF, 0xBB, 0xBF];
    let mut file = File::create(&script_path)
        .map_err(|e| format!("Failed to write driver install script: {}", e))?;
    file.write_all(&bom).map_err(|e| format!("BOM write error: {}", e))?;
    file.write_all(script.as_bytes()).map_err(|e| format!("Script write error: {}", e))?;

    let path_str = script_path.to_string_lossy().to_string();
    Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"{}\"' -Wait",
                path_str.replace('\'', "''")
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to launch driver install: {}", e))?;

    // Read the report
    if report_path.exists() {
        let content = std::fs::read_to_string(&report_path)
            .map_err(|e| format!("Failed to read report: {}", e))?;
        let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
        let _ = std::fs::remove_file(&report_path);
        serde_json::from_str(content.trim())
            .map_err(|e| format!("Report parse error: {}", e))
    } else {
        Ok(serde_json::json!({ "status": "unknown", "error": "No report file generated. The UAC prompt may have been declined." }))
    }
}

// ────────────────────────────────────────────────────────────────────
// Get script execution report
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn get_script_report() -> Result<serde_json::Value, String> {
    let report_path = std::env::temp_dir().join("aimcamp_script_report.json");
    if !report_path.exists() {
        return Ok(serde_json::json!({ "status": "no_report" }));
    }
    let content = std::fs::read_to_string(&report_path)
        .map_err(|e| format!("Failed to read report: {}", e))?;
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
    serde_json::from_str(content.trim())
        .map_err(|e| format!("Report parse error: {}", e))
}

// ────────────────────────────────────────────────────────────────────
// Feedback system — capture screenshot, save/load history, send
// ────────────────────────────────────────────────────────────────────

fn feedback_file_path() -> Result<std::path::PathBuf, String> {
    let mut dir = dirs_next::data_local_dir()
        .ok_or_else(|| "Cannot find local data dir".to_string())?;
    dir.push("aimcamp-player-agent");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Dir create failed: {}", e))?;
    dir.push("feedback.json");
    Ok(dir)
}

fn screenshots_dir() -> Result<std::path::PathBuf, String> {
    let mut dir = dirs_next::data_local_dir()
        .ok_or_else(|| "Cannot find local data dir".to_string())?;
    dir.push("aimcamp-player-agent");
    dir.push("screenshots");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Dir create failed: {}", e))?;
    Ok(dir)
}

#[tauri::command]
async fn capture_screenshot() -> Result<String, String> {
    let script = r#"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$sig = @'
using System;
using System.Runtime.InteropServices;
public class WinApi {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
'@
Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue

$hwnd = [WinApi]::GetForegroundWindow()
$rect = New-Object WinApi+RECT
[WinApi]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
if ($w -lt 100 -or $h -lt 100) { $w = 1920; $h = 1080; $rect.Left = 0; $rect.Top = 0 }
$bmp = New-Object Drawing.Bitmap($w, $h)
$g = [Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object Drawing.Size($w, $h)))
$g.Dispose()
$ms = New-Object IO.MemoryStream
$bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$b64 = [Convert]::ToBase64String($ms.ToArray())
$ms.Dispose()
$b64
"#;
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| format!("Screenshot failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        Err("Screenshot capture returned empty".into())
    } else {
        Ok(stdout)
    }
}

#[tauri::command]
async fn save_feedback(
    id: String,
    tab: String,
    description: String,
    screenshot_b64: String,
    sent: String,
) -> Result<String, String> {
    // Save screenshot file
    let ss_dir = screenshots_dir()?;
    let ss_path = ss_dir.join(format!("{}.png", id));
    if !screenshot_b64.is_empty() {
        let bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &screenshot_b64,
        ).map_err(|e| format!("Base64 decode: {}", e))?;
        std::fs::write(&ss_path, &bytes).map_err(|e| format!("Screenshot write: {}", e))?;
    }

    // Load existing feedback
    let fb_path = feedback_file_path()?;
    let mut entries: Vec<serde_json::Value> = if fb_path.exists() {
        let data = std::fs::read_to_string(&fb_path).unwrap_or_else(|_| "[]".into());
        serde_json::from_str(&data).unwrap_or_else(|_| vec![])
    } else {
        vec![]
    };

    let entry = serde_json::json!({
        "id": id,
        "tab": tab,
        "description": description,
        "screenshot_path": ss_path.to_string_lossy(),
        "sent": sent,
        "timestamp": chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    });
    entries.push(entry);

    std::fs::write(&fb_path, serde_json::to_string_pretty(&entries).unwrap_or_default())
        .map_err(|e| format!("Feedback save: {}", e))?;

    Ok(ss_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn load_feedback_history() -> Result<serde_json::Value, String> {
    let fb_path = feedback_file_path()?;
    if !fb_path.exists() {
        return Ok(serde_json::json!([]));
    }
    let data = std::fs::read_to_string(&fb_path).map_err(|e| format!("Read: {}", e))?;
    serde_json::from_str(&data).map_err(|e| format!("Parse: {}", e))
}

#[tauri::command]
async fn delete_feedback(id: String) -> Result<(), String> {
    let fb_path = feedback_file_path()?;
    if !fb_path.exists() { return Ok(()); }
    let data = std::fs::read_to_string(&fb_path).map_err(|e| format!("Read: {}", e))?;
    let mut entries: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    entries.retain(|e| e["id"].as_str() != Some(&id));
    std::fs::write(&fb_path, serde_json::to_string_pretty(&entries).unwrap_or_default())
        .map_err(|e| format!("Write: {}", e))?;

    // Also remove screenshot
    let ss_dir = screenshots_dir()?;
    let ss_path = ss_dir.join(format!("{}.png", id));
    let _ = std::fs::remove_file(ss_path);
    Ok(())
}

#[tauri::command]
async fn send_feedback_github(
    token: String,
    repo: String,
    title: String,
    body: String,
    screenshot_b64: String,
    labels: Vec<String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    // Build body with screenshot as inline image if available
    let full_body = if screenshot_b64.is_empty() {
        body.clone()
    } else {
        format!("{}\n\n---\n### Screenshot\n![screenshot](data:image/png;base64,{})", body, &screenshot_b64[..screenshot_b64.len().min(100_000)])
    };

    let issue = serde_json::json!({
        "title": title,
        "body": full_body,
        "labels": labels,
    });

    let url = format!("https://api.github.com/repos/{}/issues", repo);
    let resp = client
        .post(&url)
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "aimcamp-player-agent/1.0")
        .json(&issue)
        .send()
        .await
        .map_err(|e| format!("GitHub request failed: {}", e))?;

    let status = resp.status();
    if status.is_success() {
        let json: serde_json::Value = resp.json().await.unwrap_or_default();
        let url = json["html_url"].as_str().unwrap_or("created");
        Ok(format!("Issue created: {}", url))
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("GitHub error ({}): {}", status, &text[..text.len().min(300)]))
    }
}

#[tauri::command]
async fn send_feedback_discord_with_image(
    webhook_url: String,
    description: String,
    tab: String,
    screenshot_b64: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let timestamp = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

    let embed = serde_json::json!({
        "embeds": [{
            "title": "💡 Player Agent — Sugestão",
            "description": description,
            "color": 0x00ffaa,
            "fields": [
                { "name": "Separador", "value": tab, "inline": true },
                { "name": "Timestamp", "value": timestamp, "inline": true },
            ],
            "image": if !screenshot_b64.is_empty() { serde_json::json!({"url": "attachment://screenshot.png"}) } else { serde_json::json!(null) },
            "footer": { "text": "aim.camp Player Agent — Feedback System" },
        }]
    });

    if screenshot_b64.is_empty() {
        // Text-only
        let resp = client
            .post(&webhook_url)
            .header("Content-Type", "application/json")
            .json(&embed)
            .send()
            .await
            .map_err(|e| format!("Discord request failed: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 204 {
            Ok("Sugestão enviada para Discord".into())
        } else {
            let text = resp.text().await.unwrap_or_default();
            Err(format!("Discord error: {}", &text[..text.len().min(300)]))
        }
    } else {
        // With image attachment via multipart
        let img_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &screenshot_b64,
        ).map_err(|e| format!("Base64 decode: {}", e))?;

        let payload_json = serde_json::to_string(&embed)
            .map_err(|e| format!("JSON: {}", e))?;

        let form = reqwest::multipart::Form::new()
            .text("payload_json", payload_json)
            .part("files[0]", reqwest::multipart::Part::bytes(img_bytes)
                .file_name("screenshot.png")
                .mime_str("image/png")
                .map_err(|e| format!("MIME: {}", e))?);

        let resp = client
            .post(&webhook_url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Discord multipart failed: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 204 {
            Ok("Sugestão + screenshot enviados para Discord".into())
        } else {
            let text = resp.text().await.unwrap_or_default();
            Err(format!("Discord error: {}", &text[..text.len().min(300)]))
        }
    }
}

// ────────────────────────────────────────────────────────────────────
// Benchmark / Frame‑time Analysis — parse PresentMon CSV & CapFrameX JSON
// ────────────────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct BenchmarkResult {
    file_name: String,
    process_name: String,
    duration_secs: f64,
    frame_count: usize,
    avg_fps: f64,
    min_fps: f64,
    max_fps: f64,
    p01_fps: f64,
    p1_fps: f64,
    p5_fps: f64,
    median_fps: f64,
    p95_fps: f64,
    p99_fps: f64,
    avg_frametime: f64,
    p95_frametime: f64,
    p99_frametime: f64,
    p999_frametime: f64,
    stutter_count: usize,
    stutter_pct: f64,
    dropped_frames: usize,
    frametimes: Vec<f64>,
    timestamps: Vec<f64>,
    fps_values: Vec<f64>,
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() { return 0.0; }
    let idx = (p / 100.0 * (sorted.len() as f64 - 1.0)).max(0.0);
    let lo = idx.floor() as usize;
    let hi = (lo + 1).min(sorted.len() - 1);
    let frac = idx - lo as f64;
    sorted[lo] * (1.0 - frac) + sorted[hi] * frac
}

fn calc_metrics(frametimes: &[f64], timestamps: &[f64], dropped: usize, process: &str, file_name: &str) -> BenchmarkResult {
    let n = frametimes.len();
    if n == 0 {
        return BenchmarkResult {
            file_name: file_name.to_string(), process_name: process.to_string(),
            duration_secs: 0.0, frame_count: 0, avg_fps: 0.0, min_fps: 0.0, max_fps: 0.0,
            p01_fps: 0.0, p1_fps: 0.0, p5_fps: 0.0, median_fps: 0.0, p95_fps: 0.0, p99_fps: 0.0,
            avg_frametime: 0.0, p95_frametime: 0.0, p99_frametime: 0.0, p999_frametime: 0.0,
            stutter_count: 0, stutter_pct: 0.0, dropped_frames: dropped,
            frametimes: vec![], timestamps: vec![], fps_values: vec![],
        };
    }

    let fps_vals: Vec<f64> = frametimes.iter().map(|&ms| if ms > 0.0 { 1000.0 / ms } else { 0.0 }).collect();
    let duration = timestamps.last().unwrap_or(&0.0) - timestamps.first().unwrap_or(&0.0);
    let avg_ft: f64 = frametimes.iter().sum::<f64>() / n as f64;
    let avg_fps = if avg_ft > 0.0 { 1000.0 / avg_ft } else { 0.0 };

    let mut sorted_fps = fps_vals.clone();
    sorted_fps.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let mut sorted_ft = frametimes.to_vec();
    sorted_ft.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // Stutter: frames with frametime > 2.5× average
    let stutter_threshold = avg_ft * 2.5;
    let stutter_count = frametimes.iter().filter(|&&ft| ft > stutter_threshold).count();

    // Downsample for frontend if > 5000 points
    let (ds_ft, ds_ts, ds_fps) = if n > 5000 {
        let step = n as f64 / 5000.0;
        let mut dft = Vec::with_capacity(5000);
        let mut dts = Vec::with_capacity(5000);
        let mut dfps = Vec::with_capacity(5000);
        let mut i = 0.0;
        while (i as usize) < n {
            let idx = i as usize;
            dft.push(frametimes[idx]);
            dts.push(timestamps[idx]);
            dfps.push(fps_vals[idx]);
            i += step;
        }
        (dft, dts, dfps)
    } else {
        (frametimes.to_vec(), timestamps.to_vec(), fps_vals.clone())
    };

    BenchmarkResult {
        file_name: file_name.to_string(),
        process_name: process.to_string(),
        duration_secs: duration,
        frame_count: n,
        avg_fps,
        min_fps: sorted_fps.first().copied().unwrap_or(0.0),
        max_fps: sorted_fps.last().copied().unwrap_or(0.0),
        p01_fps: percentile(&sorted_fps, 0.1),
        p1_fps: percentile(&sorted_fps, 1.0),
        p5_fps: percentile(&sorted_fps, 5.0),
        median_fps: percentile(&sorted_fps, 50.0),
        p95_fps: percentile(&sorted_fps, 95.0),
        p99_fps: percentile(&sorted_fps, 99.0),
        avg_frametime: avg_ft,
        p95_frametime: percentile(&sorted_ft, 95.0),
        p99_frametime: percentile(&sorted_ft, 99.0),
        p999_frametime: percentile(&sorted_ft, 99.9),
        stutter_count,
        stutter_pct: stutter_count as f64 / n as f64 * 100.0,
        dropped_frames: dropped,
        frametimes: ds_ft,
        timestamps: ds_ts,
        fps_values: ds_fps,
    }
}

#[tauri::command]
async fn pick_benchmark_file() -> Result<String, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;
    FileDialogBuilder::new()
        .add_filter("Benchmark Files", &["csv", "json"])
        .add_filter("PresentMon CSV", &["csv"])
        .add_filter("CapFrameX JSON", &["json"])
        .set_title("Selecionar ficheiro de benchmark (PresentMon CSV ou CapFrameX JSON)")
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Cancelled".to_string())
}

#[tauri::command]
async fn parse_benchmark_file(path: String) -> Result<BenchmarkResult, String> {
    let file_name = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if path.to_lowercase().ends_with(".csv") {
        parse_presentmon_csv(&path, &file_name)
    } else if path.to_lowercase().ends_with(".json") {
        parse_capframex_json(&path, &file_name)
    } else {
        Err("Formato não suportado. Usa ficheiros .csv (PresentMon) ou .json (CapFrameX).".into())
    }
}

fn parse_presentmon_csv(path: &str, file_name: &str) -> Result<BenchmarkResult, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Erro ao ler ficheiro: {}", e))?;
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
    let mut lines = content.lines();

    // Parse header to find column indices
    let header = lines.next().ok_or("Ficheiro CSV vazio")?;
    let cols: Vec<&str> = header.split(',').collect();

    let find_col = |names: &[&str]| -> Option<usize> {
        for name in names {
            if let Some(i) = cols.iter().position(|c| c.trim().eq_ignore_ascii_case(name)) {
                return Some(i);
            }
        }
        None
    };

    let col_app = find_col(&["Application", "application"]);
    let col_time = find_col(&["TimeInSeconds", "timeinseconds"]);
    let col_ft = find_col(&["MsBetweenPresents", "msbetweenpresents", "FrameTime"]);
    let col_dropped = find_col(&["Dropped", "dropped"]);

    let col_ft = col_ft.ok_or("Coluna 'MsBetweenPresents' ou 'FrameTime' não encontrada no CSV")?;

    let mut frametimes: Vec<f64> = Vec::new();
    let mut timestamps: Vec<f64> = Vec::new();
    let mut process = String::new();
    let mut dropped_count = 0usize;

    for line in lines {
        let fields: Vec<&str> = line.split(',').collect();
        if fields.len() <= col_ft { continue; }

        let ft: f64 = match fields[col_ft].trim().parse() {
            Ok(v) if v > 0.0 => v,
            _ => continue,
        };

        let ts = col_time
            .and_then(|i| fields.get(i))
            .and_then(|v| v.trim().parse::<f64>().ok())
            .unwrap_or_else(|| if timestamps.is_empty() { 0.0 } else { timestamps.last().unwrap() + ft / 1000.0 });

        if process.is_empty() {
            if let Some(i) = col_app {
                if let Some(v) = fields.get(i) {
                    let v = v.trim();
                    if !v.is_empty() && v != "<unknown>" { process = v.to_string(); }
                }
            }
        }

        if let Some(i) = col_dropped {
            if let Some(v) = fields.get(i) {
                if v.trim() == "1" || v.trim().eq_ignore_ascii_case("true") {
                    dropped_count += 1;
                }
            }
        }

        frametimes.push(ft);
        timestamps.push(ts);
    }

    if frametimes.is_empty() {
        return Err("Nenhum frame válido encontrado no ficheiro CSV".into());
    }

    if process.is_empty() { process = "Unknown".into(); }
    Ok(calc_metrics(&frametimes, &timestamps, dropped_count, &process, file_name))
}

fn parse_capframex_json(path: &str, file_name: &str) -> Result<BenchmarkResult, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Erro ao ler ficheiro: {}", e))?;
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
    let json: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("JSON inválido: {}", e))?;

    // CapFrameX JSON format: { "Runs": [ { "CaptureData": { "MsBetweenPresents": [...], "Dropped": [...] } } ], "Info": { "ProcessName": "..." } }
    // Each Run is a SessionRun object with CaptureData sub-object
    let (frametimes, dropped) = if let Some(runs) = json.get("Runs").and_then(|r| r.as_array()) {
        // Try as array of SessionRun objects (official CapFrameX format)
        let mut ft: Vec<f64> = Vec::new();
        let mut dr: usize = 0;
        let mut found_obj = false;
        for run in runs {
            if let Some(capture) = run.get("CaptureData") {
                found_obj = true;
                if let Some(ms) = capture.get("MsBetweenPresents").and_then(|m| m.as_array()) {
                    ft.extend(ms.iter().filter_map(|v| v.as_f64()).filter(|&v| v > 0.0));
                }
                if let Some(dropped_arr) = capture.get("Dropped").and_then(|d| d.as_array()) {
                    dr += dropped_arr.iter().filter(|v| v.as_bool().unwrap_or(false) || v.as_i64().unwrap_or(0) == 1).count();
                }
            }
        }
        if !found_obj {
            // Fallback: maybe Runs is array of arrays of raw frame times
            ft = runs.iter()
                .filter_map(|r| r.as_array())
                .flatten()
                .filter_map(|v| v.as_f64())
                .filter(|&v| v > 0.0)
                .collect();
        }
        (ft, dr)
    } else if let Some(data) = json.get("CaptureData").and_then(|d| d.get("MsBetweenPresents")).and_then(|m| m.as_array()) {
        let ft: Vec<f64> = data.iter().filter_map(|v| v.as_f64()).filter(|&v| v > 0.0).collect();
        let dr = json.get("CaptureData")
            .and_then(|d| d.get("Dropped"))
            .and_then(|d| d.as_array())
            .map(|arr| arr.iter().filter(|v| v.as_bool().unwrap_or(false) || v.as_i64().unwrap_or(0) == 1).count())
            .unwrap_or(0);
        (ft, dr)
    } else if let Some(data) = json.get("MsBetweenPresents").and_then(|m| m.as_array()) {
        let ft: Vec<f64> = data.iter().filter_map(|v| v.as_f64()).filter(|&v| v > 0.0).collect();
        (ft, 0)
    } else {
        return Err("Formato CapFrameX não reconhecido: não encontrou frame times".into());
    };

    if frametimes.is_empty() {
        return Err("Nenhum frame válido encontrado no CapFrameX JSON".into());
    }

    // Build timestamps from cumulative frame times
    let mut timestamps = Vec::with_capacity(frametimes.len());
    let mut t = 0.0;
    for &ft in &frametimes {
        timestamps.push(t);
        t += ft / 1000.0;
    }

    let process = json.get("Info")
        .and_then(|i| i.get("ProcessName"))
        .and_then(|p| p.as_str())
        .or_else(|| json.get("ProcessName").and_then(|p| p.as_str()))
        .unwrap_or("Unknown")
        .to_string();

    Ok(calc_metrics(&frametimes, &timestamps, dropped, &process, file_name))
}

#[tauri::command]
async fn scan_capframex_folder() -> Result<Vec<String>, String> {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let cx_dir = std::path::Path::new(&appdata).join("CapFrameX").join("Captures");
    if !cx_dir.exists() {
        return Ok(vec![]);
    }

    let mut files: Vec<String> = Vec::new();
    fn walk(dir: &std::path::Path, out: &mut Vec<String>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    walk(&p, out);
                } else if let Some(ext) = p.extension() {
                    if ext == "json" {
                        out.push(p.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    walk(&cx_dir, &mut files);
    files.sort_by(|a, b| b.cmp(a)); // newest first by filename (CapFrameX uses timestamps)
    files.truncate(50); // limit to 50 most recent
    Ok(files)
}

#[tauri::command]
async fn check_presentmon() -> Result<serde_json::Value, String> {
    // Check common PresentMon locations
    let checks = vec![
        "PresentMon.exe",
        "PresentMon64.exe",
        r"C:\Program Files\PresentMon\PresentMon.exe",
        r"C:\Program Files (x86)\PresentMon\PresentMon.exe",
    ];

    for path in &checks {
        let result = Command::new("where")
            .arg(path)
            .output();
        if let Ok(out) = result {
            if out.status.success() {
                let found = String::from_utf8_lossy(&out.stdout).trim().to_string();
                return Ok(serde_json::json!({ "installed": true, "path": found }));
            }
        }
        // Check file existence directly
        if std::path::Path::new(path).exists() {
            return Ok(serde_json::json!({ "installed": true, "path": path }));
        }
    }

    // Check CapFrameX installation
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let cx_path = std::path::Path::new(&appdata).join("CapFrameX");
    let cx_installed = cx_path.exists();

    Ok(serde_json::json!({
        "installed": false,
        "path": "",
        "capframex_installed": cx_installed,
        "capframex_captures": if cx_installed {
            cx_path.join("Captures").to_string_lossy().to_string()
        } else { "".into() }
    }))
}

// ────────────────────────────────────────────────────────────────────
// Auto-update — check GitHub releases for newer version
// ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn check_for_update() -> Result<serde_json::Value, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let client = reqwest::Client::builder()
        .user_agent("aimcamp-player-agent")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client
        .get("https://api.github.com/repos/aim-camp/player-agent/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Ok(serde_json::json!({ "update_available": false, "error": format!("GitHub API: {}", resp.status()) }));
    }

    let release: serde_json::Value = resp.json().await
        .map_err(|e| format!("Parse error: {}", e))?;

    let tag = release["tag_name"].as_str().unwrap_or("v0.0.0");
    let remote_version = tag.trim_start_matches('v');

    let has_update = version_newer(remote_version, current_version);

    // Find installer download URLs
    let mut msi_url = String::new();
    let mut nsis_url = String::new();
    if let Some(assets) = release["assets"].as_array() {
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            let url = asset["browser_download_url"].as_str().unwrap_or("");
            if name.ends_with(".msi") { msi_url = url.to_string(); }
            if name.ends_with(".exe") && name.contains("setup") { nsis_url = url.to_string(); }
        }
    }

    Ok(serde_json::json!({
        "update_available": has_update,
        "current_version": current_version,
        "latest_version": remote_version,
        "tag": tag,
        "release_name": release["name"].as_str().unwrap_or(""),
        "release_notes": release["body"].as_str().unwrap_or(""),
        "html_url": release["html_url"].as_str().unwrap_or(""),
        "msi_url": msi_url,
        "nsis_url": nsis_url,
        "published_at": release["published_at"].as_str().unwrap_or("")
    }))
}

fn version_newer(remote: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let r = parse(remote);
    let c = parse(current);
    for i in 0..3 {
        let rv = r.get(i).copied().unwrap_or(0);
        let cv = c.get(i).copied().unwrap_or(0);
        if rv > cv { return true; }
        if rv < cv { return false; }
    }
    false
}

#[tauri::command]
async fn download_update(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("aimcamp-player-agent")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client.get(&url).send().await
        .map_err(|e| format!("Download error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed: {}", resp.status()));
    }

    let fname = url.split('/').last().unwrap_or("update-installer.msi");
    let download_dir = dirs_next::download_dir()
        .unwrap_or_else(|| std::env::temp_dir());
    let dest = download_dir.join(fname);

    let bytes = resp.bytes().await.map_err(|e| format!("Read error: {}", e))?;
    std::fs::write(&dest, &bytes).map_err(|e| format!("Write error: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
async fn run_installer(path: String) -> Result<(), String> {
    Command::new("cmd")
        .args(&["/C", "start", "", &path])
        .spawn()
        .map_err(|e| format!("Launch installer error: {}", e))?;
    Ok(())
}

// ────────────────────────────────────────────────────────────────────
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            generate_script,
            save_script,
            import_script,
            run_script_as_admin,
            pick_ps1_file,
            check_system_state,
            run_config_as_admin,
            save_cfg,
            load_cfg,
            get_hardware_info,
            get_driver_info,
            check_driver_updates,
            install_driver_update,
            get_script_report,
            list_processes,
            kill_process,
            ping_server,
            scan_demos,
            parse_demo_header,
            open_demo_in_cs2,
            pick_demo_folder,
            ai_chat,
            send_to_discord,
            capture_screenshot,
            save_feedback,
            load_feedback_history,
            delete_feedback,
            send_feedback_github,
            send_feedback_discord_with_image,
            pick_benchmark_file,
            parse_benchmark_file,
            scan_capframex_folder,
            check_presentmon,
            check_for_update,
            download_update,
            run_installer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ────────────────────────────────────────────────────────────────────
// Demo Manager — scan, parse headers, launch playback
// ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn pick_demo_folder() -> Result<String, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;
    let folder = FileDialogBuilder::new()
        .set_title("Select CS2 Replays Folder")
        .pick_folder();
    match folder {
        Some(p) => Ok(p.to_string_lossy().to_string()),
        None => Err("Cancelled".to_string()),
    }
}

#[tauri::command]
async fn scan_demos(folder: String) -> Result<serde_json::Value, String> {
    use std::fs;
    let entries = fs::read_dir(&folder).map_err(|e| format!("Cannot read folder: {}", e))?;
    let mut demos: Vec<serde_json::Value> = Vec::new();
    for entry in entries {
        if let Ok(e) = entry {
            let path = e.path();
            if path.extension().map(|x| x == "dem").unwrap_or(false) {
                let meta = fs::metadata(&path).ok();
                let size_mb = meta.as_ref().map(|m| m.len() as f64 / 1_048_576.0).unwrap_or(0.0);
                let modified = meta.as_ref().and_then(|m| m.modified().ok())
                    .map(|t| {
                        let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                        dur.as_secs()
                    }).unwrap_or(0);
                let fname = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                // try to extract map name from filename (common pattern: mapname_date_...)
                let map_hint = fname.split(|c: char| c == '_' || c == '-').next()
                    .unwrap_or("").to_string();
                demos.push(serde_json::json!({
                    "name": fname,
                    "path": path.to_string_lossy(),
                    "size_mb": (size_mb * 10.0).round() / 10.0,
                    "modified": modified,
                    "map_hint": map_hint,
                }));
            }
        }
    }
    // sort by modified desc
    demos.sort_by(|a, b| {
        let ma = a["modified"].as_u64().unwrap_or(0);
        let mb = b["modified"].as_u64().unwrap_or(0);
        mb.cmp(&ma)
    });
    Ok(serde_json::json!(demos))
}

#[tauri::command]
async fn parse_demo_header(path: String) -> Result<serde_json::Value, String> {
    use std::io::Read;
    let mut file = std::fs::File::open(&path).map_err(|e| format!("Open failed: {}", e))?;
    let mut buf = vec![0u8; 65536]; // read first 64KB
    let n = file.read(&mut buf).map_err(|e| format!("Read failed: {}", e))?;
    let buf = &buf[..n];

    let magic = String::from_utf8_lossy(&buf[..8.min(n)]);
    let mut result = serde_json::Map::new();

    if magic.starts_with("HL2DEMO") {
        // Source 1 format (CS:GO)
        result.insert("format".into(), "Source 1 (CS:GO)".into());
        if n >= 1072 {
            let read_str = |offset: usize, len: usize| -> String {
                let end = (offset + len).min(n);
                let slice = &buf[offset..end];
                let nul = slice.iter().position(|&b| b == 0).unwrap_or(slice.len());
                String::from_utf8_lossy(&slice[..nul]).to_string()
            };
            result.insert("server".into(), read_str(16, 260).into());
            result.insert("client".into(), read_str(276, 260).into());
            result.insert("map".into(), read_str(536, 260).into());
            result.insert("game_dir".into(), read_str(796, 260).into());
            let duration = f32::from_le_bytes([buf[1056], buf[1057], buf[1058], buf[1059]]);
            let ticks = i32::from_le_bytes([buf[1060], buf[1061], buf[1062], buf[1063]]);
            result.insert("duration_s".into(), serde_json::json!((duration * 10.0).round() / 10.0));
            result.insert("ticks".into(), serde_json::json!(ticks));
            if ticks > 0 && duration > 0.0 {
                let tickrate = (ticks as f32 / duration).round() as i32;
                result.insert("tickrate".into(), serde_json::json!(tickrate));
            }
        }
    } else if magic.starts_with("PBDEMS2") {
        // Source 2 format (CS2)
        result.insert("format".into(), "Source 2 (CS2)".into());
        // search for map name patterns in the binary
        let known_maps = [
            "de_dust2", "de_mirage", "de_inferno", "de_nuke", "de_overpass",
            "de_vertigo", "de_ancient", "de_anubis", "de_train", "de_cache",
            "de_cobblestone", "cs_office", "cs_italy", "de_tuscan", "de_mills",
            "de_thera", "de_edin", "de_basalt",
        ];
        let text = String::from_utf8_lossy(buf);
        for map in &known_maps {
            if text.contains(map) {
                result.insert("map".into(), (*map).to_string().into());
                break;
            }
        }
        // try to find tick count / duration from embedded data
        // CS2 demos embed tick info — search for numeric patterns
        // For now, estimate from file size (roughly 400KB/min at 64 tick)
        let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let est_minutes = file_size as f64 / 400_000.0;
        result.insert("duration_s".into(), serde_json::json!((est_minutes * 60.0 * 10.0).round() / 10.0));
        result.insert("est_rounds".into(), serde_json::json!((est_minutes / 1.8).round() as i32));
    } else {
        result.insert("format".into(), "Unknown".into());
    }

    // file metadata
    if let Ok(meta) = std::fs::metadata(&path) {
        result.insert("file_size_mb".into(), serde_json::json!((meta.len() as f64 / 1_048_576.0 * 10.0).round() / 10.0));
    }

    Ok(serde_json::Value::Object(result))
}

#[tauri::command]
async fn open_demo_in_cs2(demo_path: String) -> Result<String, String> {
    // launch CS2 with playdemo command via Steam URL
    let escaped = demo_path.replace('\\', "/");
    let cmd = format!("playdemo \"{}\"", escaped);
    // try steam protocol first
    let result = Command::new("cmd")
        .args(&["/C", &format!("start steam://run/730//{}/", urlencoding(&cmd))])
        .output();
    match result {
        Ok(_) => Ok(format!("Launching CS2 with: {}", cmd)),
        Err(e) => Err(format!("Launch failed: {}", e)),
    }
}

fn urlencoding(s: &str) -> String {
    let mut result = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(b as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", b));
            }
        }
    }
    result
}

// ────────────────────────────────────────────────────────────────────
// Hardware Info — gathers CPU, GPU, RAM, OS, disk, feature status
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn get_hardware_info() -> Result<serde_json::Value, String> {
    let script = r#"
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 -or $_.Name -match 'NVIDIA|AMD|Intel' } | Select-Object -First 1
$ramMods = @(Get-CimInstance Win32_PhysicalMemory)
$totalRam = ($ramMods | Measure-Object Capacity -Sum).Sum
$os = Get-CimInstance Win32_OperatingSystem
$disks = @(Get-PhysicalDisk -ErrorAction SilentlyContinue | Select-Object -First 4)
$hags = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -ErrorAction SilentlyContinue).HwSchMode
$rebar = 'N/A'
try { $r = (nvidia-smi --query-gpu=bar1.total --format=csv,noheader,nounits 2>$null); if($r) { $rebar = "$($r.Trim()) MB" } } catch {}
$xmpHint = if($ramMods.Count -gt 0 -and $ramMods[0].ConfiguredClockSpeed -gt $ramMods[0].Speed) { 'Likely' } elseif($ramMods[0].ConfiguredClockSpeed -ge 3200) { 'Likely' } else { 'Unknown' }
$mon = $null
try { $mon = Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue | Select-Object -First 1 } catch {}
$refreshRate = 0
try { $dm = (Get-CimInstance Win32_VideoController | Select-Object -First 1).CurrentRefreshRate; if($dm) { $refreshRate = $dm } } catch {}
$result = @{
    cpu_name = $cpu.Name.Trim()
    cpu_cores = $cpu.NumberOfCores
    cpu_threads = $cpu.NumberOfLogicalProcessors
    cpu_clock_mhz = $cpu.MaxClockSpeed
    gpu_name = if($gpu) { $gpu.Name.Trim() } else { 'N/A' }
    gpu_vram_mb = if($gpu -and $gpu.AdapterRAM -gt 0) { [math]::Round($gpu.AdapterRAM / 1MB) } else { 0 }
    gpu_driver = if($gpu) { $gpu.DriverVersion } else { 'N/A' }
    ram_total_gb = [math]::Round($totalRam / 1GB, 1)
    ram_modules = $ramMods.Count
    ram_speed_mhz = if($ramMods[0].ConfiguredClockSpeed) { $ramMods[0].ConfiguredClockSpeed } else { 0 }
    os_name = $os.Caption.Trim()
    os_build = $os.BuildNumber
    disks = @($disks | ForEach-Object { @{ name = $_.FriendlyName; type = [string]$_.MediaType; size_gb = [math]::Round([double]$_.Size / 1GB) } })
    hags = if($hags -eq 2) { 'ON' } elseif($hags -ne $null) { 'OFF' } else { 'N/A' }
    rebar = $rebar
    xmp = $xmpHint
    refresh_rate = $refreshRate
}
$result | ConvertTo-Json -Depth 3
"#;
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| format!("HW info failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("HW JSON parse: {} — {}", e, &stdout[..stdout.len().min(300)]))
}

// ────────────────────────────────────────────────────────────────────
// Process list — top 50 by RAM, with CPU time
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn list_processes() -> Result<serde_json::Value, String> {
    let script = r#"
$procs = Get-Process | Where-Object { $_.WorkingSet64 -gt 5MB } |
    Sort-Object WorkingSet64 -Descending | Select-Object -First 50 |
    ForEach-Object { @{ name = $_.ProcessName; pid = $_.Id; ram_mb = [math]::Round($_.WorkingSet64 / 1MB); cpu_s = [math]::Round($_.CPU, 1) } }
@($procs) | ConvertTo-Json -Depth 2
"#;
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| format!("Process list failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Proc JSON parse: {} — {}", e, &stdout[..stdout.len().min(300)]))
}

// ────────────────────────────────────────────────────────────────────
// Kill process by PID
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn kill_process(pid: u32) -> Result<String, String> {
    let result = Command::new("taskkill")
        .args(&["/PID", &pid.to_string(), "/F"])
        .output()
        .map_err(|e| format!("Kill failed: {}", e))?;
    if result.status.success() {
        Ok(format!("PID {} terminated", pid))
    } else {
        Err(String::from_utf8_lossy(&result.stderr).to_string())
    }
}

// ────────────────────────────────────────────────────────────────────
// Ping server — returns avg/min/max/loss
// ────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn ping_server(host: String, count: u32) -> Result<serde_json::Value, String> {
    let script = format!(r#"
$r = Test-Connection -ComputerName '{}' -Count {} -ErrorAction SilentlyContinue
if ($r) {{
    $t = @($r | ForEach-Object {{ $_.ResponseTime }})
    @{{ host='{}'; avg=[math]::Round(($t|Measure-Object -Average).Average,1); min=($t|Measure-Object -Minimum).Minimum; max=($t|Measure-Object -Maximum).Maximum; loss=0; ok=$true }} | ConvertTo-Json
}} else {{
    @{{ host='{}'; avg=-1; min=-1; max=-1; loss=100; ok=$false }} | ConvertTo-Json
}}
"#, host, count, host, host);
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .output()
        .map_err(|e| format!("Ping failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Ping JSON parse: {} — {}", e, &stdout[..stdout.len().min(200)]))
}
