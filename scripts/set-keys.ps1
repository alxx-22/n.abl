<#
.SYNOPSIS
    Put API keys where the tooling expects them, without ever writing
    one into a tracked file.

.DESCRIPTION
    Upserts values into .env.local at the repository root, which is where
    `node --env-file-if-exists` picks them up. Existing lines for a key
    are replaced and everything else in the file is left alone, so
    running it twice is safe and changing one key does not wipe another.

    THERE IS NO PLACEHOLDER TO EDIT, ON PURPOSE. The obvious design is a
    variable at the top of the script that you paste over. This file is
    tracked in git, so a key left in it is a key one `git add -A` away
    from being published — and revoking a leaked key is a worse evening
    than typing it at a prompt. So it is passed in or typed in, and it
    only ever lands in the file that is ignored.

    It never echoes a key, only a masked form, because terminal
    scrollback ends up in screenshots and chat windows.

.EXAMPLE
    pwsh ./scripts/set-keys.ps1
    Prompts for each key. Typing is hidden.

.EXAMPLE
    pwsh ./scripts/set-keys.ps1 -GeminiApiKey $env:MY_KEY
    Non-interactive. Avoid typing a literal key here — it would land in
    your shell history.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\set-keys.ps1
    Windows PowerShell 5.1.
#>
[CmdletBinding()]
param(
    # aistudio.google.com/apikey — free, no card.
    [string]$GeminiApiKey,

    # Search Console → add property → HTML tag. Copy only the content value.
    [string]$GscVerification,

    # developer.company-information.service.gov.uk → Your applications →
    # a REST key, Live environment. For the lead puller.
    [string]$CompaniesHouseApiKey,

    # A SECOND Google AI Studio project's key, for the puller's prospector.
    # Must not be the same key as GeminiApiKey: a separate project is a
    # separate quota pool, and that is the only reason it exists.
    [string]$GeminiDiscoveryApiKey,

    # Skip the prompts for anything not passed as a parameter.
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

function Mask([string]$v) {
    if ([string]::IsNullOrWhiteSpace($v)) { return "(empty)" }
    if ($v.Length -le 8) { return "*" * $v.Length }
    return $v.Substring(0, 4) + ("*" * ($v.Length - 8)) + $v.Substring($v.Length - 4)
}

function ReadSecret([string]$prompt) {
    $secure = Read-Host -Prompt $prompt -AsSecureString
    if (-not $secure -or $secure.Length -eq 0) { return "" }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# Repo root, so this works from any working directory.
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$root    = Split-Path -Parent $here
$envFile = Join-Path $root ".env.local"

Write-Host ""
Write-Host "  repository: $root"
Write-Host "  target:     .env.local"
Write-Host ""

# --- Gather ----------------------------------------------------------
if (-not $GeminiApiKey -and -not $NonInteractive) {
    Write-Host "  Gemini API key — writes the outreach observations."
    Write-Host "  Leave blank to skip. Typing is hidden."
    $GeminiApiKey = ReadSecret "  GEMINI_API_KEY"
    Write-Host ""
}
if (-not $GscVerification -and -not $NonInteractive) {
    Write-Host "  Search Console token — verifies the site. Optional."
    Write-Host "  Leave blank to skip."
    $GscVerification = ReadSecret "  GSC_VERIFICATION"
    Write-Host ""
}
if (-not $CompaniesHouseApiKey -and -not $NonInteractive) {
    Write-Host "  Companies House REST key — the lead puller. Leave blank to skip."
    Write-Host "  developer.company-information.service.gov.uk → Your applications → a REST key, Live."
    $CompaniesHouseApiKey = ReadSecret "  COMPANIES_HOUSE_API_KEY"
    Write-Host ""
}
if (-not $GeminiDiscoveryApiKey -and -not $NonInteractive) {
    Write-Host "  A SECOND Google project's key — the puller's prospector only. Blank to skip."
    Write-Host "  Not your GEMINI_API_KEY: a separate project is a separate quota pool."
    $GeminiDiscoveryApiKey = ReadSecret "  GEMINI_DISCOVERY_API_KEY"
    Write-Host ""
}

$pending = [ordered]@{}
if ($GeminiApiKey)    { $pending["GEMINI_API_KEY"]   = $GeminiApiKey.Trim() }
if ($GscVerification) { $pending["GSC_VERIFICATION"] = $GscVerification.Trim() }
if ($CompaniesHouseApiKey)  { $pending["COMPANIES_HOUSE_API_KEY"]  = $CompaniesHouseApiKey.Trim() }
if ($GeminiDiscoveryApiKey) { $pending["GEMINI_DISCOVERY_API_KEY"] = $GeminiDiscoveryApiKey.Trim() }

if ($pending.Count -eq 0) {
    Write-Host "  Nothing given, nothing written." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# --- A Google key has a recognisable shape. Say so now rather than let
# --- a typo surface as a 400 three minutes into a run. ----------------
foreach ($g in @("GEMINI_API_KEY", "GEMINI_DISCOVERY_API_KEY")) {
    if ($pending.Contains($g) -and $pending[$g] -notmatch '^AIza[0-9A-Za-z_\-]{30,}$') {
        Write-Host "  WARNING: $g does not look like a Google API key." -ForegroundColor Yellow
        Write-Host "           They normally begin 'AIza' and run about 39 characters."
        if ($NonInteractive) {
            Write-Host "           Continuing because -NonInteractive was passed."
        } else {
            $answer = Read-Host "           Write it anyway? (y/N)"
            if ($answer -ne "y") { Write-Host "  Stopped, nothing written."; exit 1 }
        }
    }
}

# --- The same key twice defeats the point of the second project: both
# --- would spend one quota pool. Refuse rather than write it. ---------
# Companies House keys have no published shape, so none is enforced — a
# guessed format that rejected a real key would be worse than no check.
if ($pending.Contains("GEMINI_DISCOVERY_API_KEY")) {
    $writer = $pending["GEMINI_API_KEY"]
    if (-not $writer -and (Test-Path $envFile)) {
        $line = @([System.IO.File]::ReadAllLines($envFile)) | Where-Object { $_ -match '^\s*GEMINI_API_KEY\s*=' } | Select-Object -Last 1
        if ($line) { $writer = ($line -split '=', 2)[1].Trim() }
    }
    if ($writer -and $writer -eq $pending["GEMINI_DISCOVERY_API_KEY"]) {
        Write-Host "  STOP: GEMINI_DISCOVERY_API_KEY is the same key as GEMINI_API_KEY." -ForegroundColor Red
        Write-Host "        It has to come from a different Google project, or it shares the writer's quota."
        Write-Host ""
        exit 1
    }
}

Push-Location $root
try {
    # --- Confirm the target really is ignored BEFORE writing a secret -
    git check-ignore -q ".env.local" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  STOP: .env.local is not gitignored in this checkout." -ForegroundColor Red
        Write-Host "        Writing a key there could commit it. Add '.env.local' to .gitignore first."
        Write-Host ""
        exit 1
    }

    # --- Upsert, leaving every other line alone ----------------------
    $lines = @()
    if (Test-Path $envFile) { $lines = @([System.IO.File]::ReadAllLines($envFile)) }

    foreach ($name in $pending.Keys) {
        $line  = "$name=$($pending[$name])"
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$([regex]::Escape($name))\s*=") {
                $lines[$i] = $line; $found = $true; break
            }
        }
        if (-not $found) { $lines += $line }
        Write-Host ("  {0,-24} {1}  {2}" -f $name, (Mask $pending[$name]), $(if ($found) { "updated" } else { "added" }))
    }

    # UTF-8 with no BOM. A BOM on line one makes the first key name
    # unreadable to the env parser, and the resulting error says nothing
    # about why.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envFile, ($lines -join "`n") + "`n", $utf8NoBom)

    Write-Host ""
    Write-Host "  Written to .env.local." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Confirm it is picked up, without spending a request:"
    Write-Host "    npm run sourcing:write:dry                              (the writer)"
    Write-Host "    npm run sourcing:pull:dry -- --location Nottingham      (the lead puller)"
    Write-Host ""
    Write-Host "  Then the real run:"
    Write-Host "    npm run sourcing:write"
    Write-Host "    npm run sourcing:pull -- --location Nottingham --sic 432"
    Write-Host ""
    Write-Host "  If a key ever leaks, revoke it at aistudio.google.com/apikey and run"
    Write-Host "  this again. Nothing in the repo depends on the old value."
    Write-Host ""
}
finally {
    Pop-Location
}
