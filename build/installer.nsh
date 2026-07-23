; Coder Desktop NSIS Installer Customization
; This script provides custom logic for the installer and uninstaller

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "StrFunc.nsh"

; Declare StrStr for GetParameters support
${StrStr}

; ============================================================================
; Variables
; ============================================================================

Var ForceUninstallCheckbox
Var LaunchAppCheckbox

; ============================================================================
; Custom Installer Pages & Logic
; ============================================================================

!macro customCheckAppRunning
  DetailPrint "Closing Coder Desktop before installing."
  nsExec::Exec `"$CmdPath" /C taskkill /IM "Coder Desktop.exe" /F /T`
  Pop $0
  Sleep 800
!macroend

!macro customInstallerInit
  !define MUI_ABORTWARNING
  !define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
  !define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!macroend

; ============================================================================
; Uninstaller Custom Logic
; ============================================================================

!macro customUninstallInit
  RequestExecutionLevel user
!macroend

!macro customUninstallFiles
  DetailPrint "Performing additional cleanup..."
  Delete "$SMPROGRAMS\Coder Desktop.lnk"
  Delete "$DESKTOP\Coder Desktop.lnk"
  RMDir /r "$SMPROGRAMS\Coder Desktop"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DetailPrint "Cleanup complete."
!macroend

; ============================================================================
; Force Uninstall Support (for recovery when normal uninstall fails)
; Called via command line: uninstall.exe /FORCE
; ============================================================================

Function ForceUninstall
  ${GetParameters} $0
  ${StrStr} $0 "/FORCE" $1
  StrCmp $1 "" NormalUninstall

  DetailPrint "Force uninstall requested - performing aggressive cleanup"
  nsExec::Exec `"$CmdPath" /C taskkill /IM "Coder Desktop.exe" /F /T`
  Pop $0
  Sleep 1000
  Call ForceCleanup
  Quit

NormalUninstall:
FunctionEnd

Function ForceCleanup
  DetailPrint "Force cleaning Coder Desktop installation..."
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\Coder Desktop.lnk"
  Delete "$DESKTOP\Coder Desktop.lnk"
  RMDir /r "$SMPROGRAMS\Coder Desktop"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKCU "Software\Coder Desktop"
  DeleteRegKey HKLM "Software\Coder Desktop"
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop"
  DeleteRegKey HKLM "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop"
  DetailPrint "Force cleanup complete."
FunctionEnd

; ============================================================================
; Custom Uninstaller Page (shows force uninstall option)
; ============================================================================

!macro customUninstallConfirm
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 12u "Coder Desktop will be removed from your computer."
  Pop $0
  ${NSD_CreateCheckbox} 0 20u 100% 12u "Force removal (use if normal uninstall failed)"
  Pop $ForceUninstallCheckbox
  ${NSD_SetState} $ForceUninstallCheckbox 0
  ${NSD_CreateLabel} 0 40u 100% 12u "Your settings and data will be preserved."
  Pop $0
  nsDialogs::Show
!macroend

!macro customUninstallLeave
  ${NSD_GetState} $ForceUninstallCheckbox $0
  StrCmp $0 ${BST_CHECKED} ForceUninstallSelected
  Goto NormalUninstallPath
ForceUninstallSelected:
  WriteRegStr HKCU "Software\Coder Desktop" "ForceUninstall" "1"
NormalUninstallPath:
!macroend

; ============================================================================
; Post-Install: Register AppUserModelId for taskbar grouping
; ============================================================================

Function .onInstSuccess
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop" "" "$INSTDIR\Coder Desktop.exe"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop" "DisplayName" "Coder Desktop"
FunctionEnd
