# aim.camp Player Agent - System State Check
# Returns JSON: true = applied, false = not applied, null = cannot determine
$ErrorActionPreference = 'SilentlyContinue'
$s = @{}

function CR($Path, $Name, $Expected) {
    try {
        $val = (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name
        return [bool]($val -eq $Expected)
    } catch { return $null }
}

function CS($ServiceName) {
    try {
        $svc = Get-Service -Name $ServiceName -ErrorAction Stop
        return [bool]($svc.StartType -eq 'Disabled')
    } catch { return $null }
}

# ── BIOS ──
$h = bcdedit /enum '{current}' 2>$null | Out-String
if ($h -and $h.Length -gt 20) {
    $s['b_svm'] = [bool]($h -match 'hypervisorlaunchtype\s+Off')
} else { $s['b_svm'] = $null }

$q = powercfg /query SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 2>$null | Out-String
if ($q -match 'Current AC Power Setting Index:\s+0x([0-9a-fA-F]+)') {
    $s['b_cst'] = ([convert]::ToInt32($Matches[1], 16) -eq 100)
} else { $s['b_cst'] = $null }

$s['b_cool'] = $null
$s['b_xmp']  = $null
$s['b_rbar'] = $null
$s['b_4g']   = $null

# ── WINDOWS ──
$plan = powercfg /getactivescheme 2>$null
if ($plan) {
    $s['w_power'] = [bool]($plan -match 'e9a42b02' -or $plan -match '8c5e7fda')
} else { $s['w_power'] = $null }

$s['w_dvr']    = CR 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled' 0
$s['w_bar']    = CR 'HKCU:\SOFTWARE\Microsoft\GameBar' 'UseNexusForGameBarEnabled' 0
$s['w_mode']   = CR 'HKCU:\SOFTWARE\Microsoft\GameBar' 'AutoGameModeEnabled' 0
$s['w_hib']    = CR 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled' 0
$s['w_mouse']  = CR 'HKCU:\Control Panel\Mouse' 'MouseSpeed' '0'

$layers = Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers' -EA SilentlyContinue
if ($layers) {
    $cs2Match = $layers.PSObject.Properties | Where-Object { $_.Name -match 'cs2\.exe' }
    if ($cs2Match) {
        $s['w_fso'] = [bool](($cs2Match | ForEach-Object { $_.Value }) -match 'DISABLEDXMAXIMIZEDWINDOWEDMODE')
    } else { $s['w_fso'] = $false }
} else { $s['w_fso'] = $null }

$s['w_vis']    = CR 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' 'VisualFXSetting' 2
$s['w_trans']  = CR 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize' 'EnableTransparency' 0
$s['w_bgapps'] = CR 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications' 'GlobalUserDisabled' 1
$s['w_notif']  = CR 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PushNotifications' 'ToastEnabled' 0
$s['w_cort']   = CR 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search' 'AllowCortana' 0
$s['w_idx']    = CS 'WSearch'
$s['w_hgs']    = CR 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 2

if ($h -match 'useplatformtick\s+Yes') { $s['w_hpet'] = $true }
else { $s['w_hpet'] = $null }

$s['w_pthrot'] = CR 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' 'PowerThrottlingOff' 1

$cp = powercfg /query SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 2>$null | Out-String
if ($cp -match 'Current AC Power Setting Index:\s+0x([0-9a-fA-F]+)') {
    $s['w_park'] = ([convert]::ToInt32($Matches[1], 16) -eq 100)
} else { $s['w_park'] = $null }

$s['w_temp'] = $null

$gpuPref = Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences' -EA SilentlyContinue
if ($gpuPref) {
    $cs2Gpu = $gpuPref.PSObject.Properties | Where-Object { $_.Name -match 'cs2\.exe' -and $_.Value -match 'GpuPreference=2' }
    $s['w_cs2gpu'] = [bool]($null -ne $cs2Gpu)
} else { $s['w_cs2gpu'] = $null }

# ── NETWORK ──
$adapters = Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces' -EA SilentlyContinue
if ($adapters) {
    $nf = $false
    foreach ($a in $adapters) {
        $nd = (Get-ItemProperty $a.PSPath -Name 'TCPNoDelay' -EA SilentlyContinue).TCPNoDelay
        if ($nd -eq 1) { $nf = $true; break }
    }
    $s['n_nagle'] = $nf
} else { $s['n_nagle'] = $null }

$tcp = netsh int tcp show global 2>$null | Out-String
if ($tcp) { $s['n_tcp'] = [bool]($tcp -match 'ecncapability\s*:\s*disabled') }
else { $s['n_tcp'] = $null }

$s['n_dns']  = $null
$s['n_wifi'] = $null

# ── NVIDIA ──
$nvBase = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
$nvPath = $null
foreach ($k in @('0000','0001','0002','0003')) {
    $test = Join-Path $nvBase $k
    if (Test-Path $test) {
        $desc = (Get-ItemProperty $test -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc
        if ($desc -match 'NVIDIA|GeForce|RTX|GTX') { $nvPath = $test; break }
    }
}
if ($nvPath) {
    $pm = (Get-ItemProperty $nvPath -Name 'PowerMizerLevel' -EA SilentlyContinue).PowerMizerLevel
    $s['nv_perf'] = [bool]($pm -eq 1)

    $nvt = Get-ItemProperty 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak' -Name 'Gestalt' -EA SilentlyContinue
    if ($nvt) { $s['nv_vsync'] = [bool]($nvt.Gestalt -eq 1) }
    else { $s['nv_vsync'] = $null }

    $rd = (Get-ItemProperty $nvPath -Name 'RMDelayCycles' -EA SilentlyContinue).RMDelayCycles
    if ($null -ne $rd) { $s['nv_lat'] = [bool]($rd -eq 31) }
    else { $s['nv_lat'] = $null }

    $to = (Get-ItemProperty $nvPath -Name 'ThreadedOptimization' -EA SilentlyContinue).ThreadedOptimization
    if ($null -ne $to) { $s['nv_thread'] = [bool]($to -eq 1) }
    else { $s['nv_thread'] = $null }
} else {
    $s['nv_perf'] = $null; $s['nv_vsync'] = $null
    $s['nv_lat'] = $null; $s['nv_thread'] = $null
}
$s['nv_aniso']  = $null
$s['nv_shader'] = $null

# ── SERVICES ──
$s['s_sys']   = CS 'SysMain'
$s['s_diag']  = CS 'DiagTrack'
$s['s_ws']    = CS 'WSearch'
$s['s_print'] = CS 'Spooler'
$s['s_fax']   = CS 'Fax'
$xbl = Get-Service 'XblAuthManager' -EA SilentlyContinue
if ($xbl) { $s['s_xbox'] = [bool]($xbl.StartType -eq 'Disabled') }
else { $s['s_xbox'] = $null }

# ── AUTOEXEC ──
$cfgFound = $false
$steamBases = @('C:\Program Files (x86)\Steam','D:\Steam','D:\SteamLibrary','E:\SteamLibrary')
$steamReg = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam' -Name 'InstallPath' -EA SilentlyContinue).InstallPath
if ($steamReg) { $steamBases += $steamReg }
foreach ($b in $steamBases) {
    $cfg = Join-Path $b 'steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\autoexec.cfg'
    if (Test-Path $cfg) { $cfgFound = $true; break }
}
$s['ae_on']  = $cfgFound
$s['ae_raw'] = $null
$s['ae_ng']  = $null

# ── LAUNCH OPTIONS ── (cannot detect from system)
$s['lo_exec'] = $null; $s['lo_nvid'] = $null; $s['lo_tick'] = $null
$s['lo_joy']  = $null; $s['lo_high'] = $null

# ── EXTRAS ──
try { $fc = Get-Service 'FACEITService' -EA Stop; $s['x_faceit'] = [bool]($fc.Status -eq 'Running') }
catch { $s['x_faceit'] = $null }

$s['x_steam'] = CR 'HKCU:\SOFTWARE\Valve\Steam' 'GameOverlayDisabled' 1
$s['x_disc']  = $null
$s['x_resp']  = CR 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' 'SystemResponsiveness' 0
$s['x_gpup']  = CR 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' 'GPU Priority' 8
$s['x_prio']  = CR 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' 'Win32PrioritySeparation' 38

$cs2Proc = Get-Process 'cs2' -EA SilentlyContinue
if ($cs2Proc) { $s['x_cs2p'] = [bool]($cs2Proc.PriorityClass -eq 'High') }
else { $s['x_cs2p'] = $null }

# Output
$s | ConvertTo-Json -Compress
