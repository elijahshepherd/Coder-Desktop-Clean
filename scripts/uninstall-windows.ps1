<# 
.SYNOPSIS
    Force uninstall Coder Desktop application from Windows

.DESCRIPTION
    This script forcefully removes Coder Desktop from the system, including:
    - Application files and directories
    - Start Menu shortcuts
    - Registry entries (Uninstall, AppUserModelId, Run keys)
    - User data directories (optional)
    - Running processes

.PARAMETER Force
    Force uninstall without confirmation prompts

.PARAMETER RemoveUserData
    Also remove user data directories (AppData/Roaming/Coder Desktop, AppData/Local/Coder Desktop)

.PARAMETER NoWait
    Don't wait for user input before exiting

.EXAMPLE
    .\uninstall-windows.ps1 -Force

.EXAMPLE
    .\uninstall-windows.ps1 -Force -RemoveUserData

.NOTES
    Run as Administrator for complete removal of per-machine installations.
    For per-user installations, standard user rights are sufficient.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $false)]
    [switch]$Force,

    [Parameter(Mandatory = $false)]
    [switch]$RemoveUserData,

    [Parameter(Mandatory = $false)]
    [switch]$NoWait
)

# Require Windows
if ($IsWindows -ne $true) {
    Write-Error "This script only runs on Windows."
    exit 1
}

function Write-Status {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Write-ErrorDetail {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
}

function Write-Success {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] SUCCESS: $Message" -ForegroundColor Green
}

function Confirm-Action {
    param([string]$Message)
    if ($Force) { return $true }
    $response = Read-Host "$Message (y/N)"
    return $response -eq 'y' -or $response -eq 'Y'
}

# Find uninstall strings in registry
function Get-UninstallStrings {
    $paths = @(
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    
    $results = @()
    foreach ($path in $paths) {
        try {
            $items = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                if ($item.DisplayName -and $item.DisplayName -like '*Coder Desktop*') {
                    $results += $item
                }
            }
        } catch { }
    }
    return $results
}

# Kill running processes
function Stop-CoderProcesses {
    Write-Status "Checking for running Coder Desktop processes..."
    $processes = Get-Process -Name "*Coder*Desktop*" -ErrorAction SilentlyContinue
    $processes += Get-Process -Name "*coder-desktop*" -ErrorAction SilentlyContinue
    $processes += Get-Process -Name "Coder Desktop" -ErrorAction SilentlyContinue
    
    if ($processes.Count -gt 0) {
        Write-Status "Found $($processes.Count) running process(es). Stopping..."
        foreach ($proc in $processes) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Write-Success "Stopped process $($proc.Id) ($($proc.ProcessName))"
            } catch {
                Write-ErrorDetail "Failed to stop process $($proc.Id): $_"
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Status "No running processes found."
    }
}

# Remove application directories
function Remove-AppDirectories {
    Write-Status "Removing application directories..."
    
    $uninstallEntries = Get-UninstallStrings
    $installPaths = @()
    
    foreach ($entry in $uninstallEntries) {
        if ($entry.InstallLocation) {
            $installPaths += $entry.InstallLocation
        }
        if ($entry.UninstallString) {
            # Extract path from uninstall string
            $match = [regex]::Match($entry.UninstallString, '"([^"]+)"')
            if ($match.Success) {
                $installPaths += (Split-Path $match.Groups[1].Value)
            }
        }
    }
    
    # Add common default paths
    $installPaths += @(
        "${env:LOCALAPPDATA}\Programs\Coder Desktop",
        "${env:ProgramFiles}\Coder Desktop",
        "${env:ProgramFiles(x86)}\Coder Desktop",
        "${env:LOCALAPPDATA}\Coder Desktop"
    )
    
    $installPaths = $installPaths | Select-Object -Unique
    
    foreach ($path in $installPaths) {
        if (Test-Path $path) {
            if ($PSCmdlet.ShouldProcess($path, "Remove application directory")) {
                try {
                    Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                    Write-Success "Removed: $path"
                } catch {
                    Write-ErrorDetail "Failed to remove $path: $_"
                }
            }
        }
    }
}

# Remove Start Menu shortcuts
function Remove-StartMenuShortcuts {
    Write-Status "Removing Start Menu shortcuts..."
    
    $startMenuPaths = @(
        "${env:ProgramData}\Microsoft\Windows\Start Menu\Programs\Coder Desktop*",
        "${env:APPDATA}\Microsoft\Windows\Start Menu\Programs\Coder Desktop*"
    )
    
    foreach ($pattern in $startMenuPaths) {
        $items = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            if ($PSCmdlet.ShouldProcess($item.FullName, "Remove Start Menu shortcut")) {
                try {
                    Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction Stop
                    Write-Success "Removed: $($item.FullName)"
                } catch {
                    Write-ErrorDetail "Failed to remove $($item.FullName): $_"
                }
            }
        }
    }
}

# Remove registry entries
function Remove-RegistryEntries {
    Write-Status "Removing registry entries..."
    
    # Uninstall keys
    $uninstallPaths = @(
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    
    foreach ($path in $uninstallPaths) {
        try {
            $items = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                if ($item.DisplayName -and $item.DisplayName -like '*Coder Desktop*') {
                    $keyPath = $item.PSPath
                    if ($PSCmdlet.ShouldProcess($keyPath, "Remove uninstall registry key")) {
                        try {
                            Remove-Item -Path $keyPath -Recurse -Force -ErrorAction Stop
                            Write-Success "Removed uninstall key: $($item.DisplayName)"
                        } catch {
                            Write-ErrorDetail "Failed to remove uninstall key: $_"
                        }
                    }
                }
            }
        } catch { }
    }
    
    # AppUserModelId registration
    $appUserModelPaths = @(
        "HKCU:\Software\Classes\AppUserModelId\CoderDesktop*",
        "HKLM:\Software\Classes\AppUserModelId\CoderDesktop*"
    )
    
    foreach ($path in $appUserModelPaths) {
        if (Test-Path $path) {
            if ($PSCmdlet.ShouldProcess($path, "Remove AppUserModelId registration")) {
                try {
                    Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                    Write-Success "Removed AppUserModelId: $path"
                } catch {
                    Write-ErrorDetail "Failed to remove AppUserModelId $path: $_"
                }
            }
        }
    }
    
    # Run keys (auto-start)
    $runKeys = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
    )
    
    foreach ($runKey in $runKeys) {
        try {
            $props = Get-ItemProperty -Path $runKey -ErrorAction SilentlyContinue
            foreach ($prop in $props.PSObject.Properties) {
                if ($prop.Name -like '*Coder*Desktop*' -or $prop.Value -like '*Coder*Desktop*') {
                    if ($PSCmdlet.ShouldProcess("$runKey\$($prop.Name)", "Remove Run key")) {
                        try {
                            Remove-ItemProperty -Path $runKey -Name $prop.Name -Force -ErrorAction Stop
                            Write-Success "Removed Run key: $($prop.Name)"
                        } catch {
                            Write-ErrorDetail "Failed to remove Run key $($prop.Name): $_"
                        }
                    }
                }
            }
        } catch { }
    }
}

# Remove user data directories
function Remove-UserData {
    if (-not $RemoveUserData) { return }
    
    Write-Status "Removing user data directories..."
    
    $dataPaths = @(
        "${env:APPDATA}\Coder Desktop",
        "${env:LOCALAPPDATA}\Coder Desktop",
        "${env:APPDATA}\coder-desktop",
        "${env:LOCALAPPDATA}\coder-desktop"
    )
    
    foreach ($path in $dataPaths) {
        if (Test-Path $path) {
            if ($PSCmdlet.ShouldProcess($path, "Remove user data directory")) {
                try {
                    Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                    Write-Success "Removed user data: $path"
                } catch {
                    Write-ErrorDetail "Failed to remove user data $path: $_"
                }
            }
        }
    }
}

# Main execution
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Coder Desktop Force Uninstall Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Force -and -not $NoWait) {
    Write-Warning "This will permanently remove Coder Desktop from your system."
    if (-not (Confirm-Action "Are you sure you want to continue?")) {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Check for admin rights if needed
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Status "Running without Administrator privileges. Per-machine components may not be fully removed." -Color Yellow
}

Stop-CoderProcesses
Remove-AppDirectories
Remove-StartMenuShortcuts
Remove-RegistryEntries
Remove-UserData

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Uninstall Complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

if (-not $NoWait) {
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}