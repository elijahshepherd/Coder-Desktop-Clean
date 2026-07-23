; Coder Desktop NSIS Installer Customization
; This script provides custom logic for the installer and uninstaller

!include "MUI2.nsh"
!include "LogicLib.nsh"

; ============================================================================
; Custom Installer Pages & Logic
; ============================================================================

; Coder Desktop NSIS Installer Customization
; This script provides custom logic for the installer and uninstaller

!include "MUI2.nsh"
!include "LogicLib.nsh"

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
  ; Set modern UI defaults
  !define MUI_ABORTWARNING
  !define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
  !define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!macroend

; ============================================================================
; Uninstaller Custom Logic
; ============================================================================

!macro customUninstallInit
  ; Ensure we run with appropriate privileges for cleanup
  RequestExecutionLevel user
!macroend

!macro customUninstallFiles
  ; Additional cleanup after main uninstall
  DetailPrint "Performing additional cleanup..."
  
  ; Remove any leftover shortcuts
  Delete "$SMPROGRAMS\Coder Desktop.lnk"
  Delete "$DESKTOP\Coder Desktop.lnk"
  
  ; Clean up Start Menu folder if empty
  RMDir /r "$SMPROGRAMS\Coder Desktop"
  
  ; Remove uninstall registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  
  DetailPrint "Cleanup complete."
!macroend

; ============================================================================
; Force Uninstall Support (for recovery when normal uninstall fails)
; ============================================================================

; This function can be called from command line: uninstall.exe /FORCE
Function ForceUninstall
  ; Check for /FORCE flag
  ${GetParameters} $0
  ${StrStr} $0 "/FORCE" $1
  StrCmp $1 "" NormalUninstall
  
  DetailPrint "Force uninstall requested - performing aggressive cleanup"
  
  ; Kill any running instances
  nsExec::Exec `"$CmdPath" /C taskkill /IM "Coder Desktop.exe" /F /T`
  Pop $0
  Sleep 1000
  
  ; Call the standard uninstall but with force flags
  Call ForceCleanup
  
  ; Exit immediately
  Quit
  
NormalUninstall:
FunctionEnd

Function ForceCleanup
  DetailPrint "Force cleaning Coder Desktop installation..."
  
  ; Remove installed files
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$SMPROGRAMS\Coder Desktop.lnk"
  Delete "$DESKTOP\Coder Desktop.lnk"
  RMDir /r "$SMPROGRAMS\Coder Desktop"
  
  ; Remove registry keys (both HKCU and HKLM)
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKCU "Software\Coder Desktop"
  DeleteRegKey HKLM "Software\Coder Desktop"
  
  ; Remove AppUserModelId registration
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop"
  DeleteRegKey HKLM "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop"
  
  DetailPrint "Force cleanup complete."
FunctionEnd

; ============================================================================
; Custom Uninstaller Page (shows force uninstall option)
; ============================================================================

!macro customUninstallConfirm
  ; Add a checkbox for force uninstall option
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
FunctionEnd

!macro customUninstallLeave
  ${NSD_GetState} $ForceUninstallCheckbox $0
  StrCmp $0 ${BST_CHECKED} ForceUninstallSelected
  ; Normal uninstall path
  Goto NormalUninstallPath
  
ForceUninstallSelected:
  ; Set a flag for force uninstall
  WriteRegStr HKCU "Software\Coder Desktop" "ForceUninstall" "1"
  
NormalUninstallPath:
FunctionEnd

; ============================================================================
; Installer Finish Page - Offer to launch app
; ============================================================================

!macro customFinish
  ; Check if we should launch the app
  ${NSD_CreateCheckbox} 0 0 100% 12u "Launch Coder Desktop"
  Pop $LaunchAppCheckbox
  ${NSD_SetState} $LaunchAppCheckbox 1
FunctionEnd

!macro customFinishLeave
  ${NSD_GetState} $LaunchAppCheckbox $0
  StrCmp $0 ${BST_CHECKED} LaunchApp
  Goto NoLaunchApp
  
LaunchApp:
  Exec '"$INSTDIR\Coder Desktop.exe"'
  
NoLaunchApp:
FunctionEnd

; ============================================================================
; Pre/Post Install/Uninstall Hooks
; ============================================================================

Function .onInit
  ; Check for force uninstall flag
  ${GetParameters} $0
  ${StrStr} $0 "/FORCE" $1
  StrCmp $1 "" NoForceFlag
  
  ; Force uninstall mode
  Call ForceUninstall
  
NoForceFlag:
FunctionEnd

Function .onInstSuccess
  ; Register AppUserModelId for proper taskbar grouping
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop" "" "$INSTDIR\Coder Desktop.exe"
FunctionEnd

!macro customInstallerInit
  ; Set modern UI defaults
  !define MUI_ABORTWARNING
  !define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
  !define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!macroend

; ============================================================================
; Uninstaller Custom Logic
; ============================================================================

!macro customUninstallInit
  ; Ensure we run with appropriate privileges for cleanup
  RequestExecutionLevel user
!macroend

!macro customUninstallFiles
  ; Additional cleanup after main uninstall
  DetailPrint "Performing additional cleanup..."
  
  ; Remove any leftover shortcuts
  Delete "$SMPROGRAMS\Coder Desktop.lnk"
  Delete "$DESKTOP\Coder Desktop.lnk"
  
  ; Clean up Start Menu folder if empty
  RMDir /r "$SMPROGRAMS\Coder Desktop"
  
  ; Remove uninstall registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  
  DetailPrint "Cleanup complete."
!macroend

; ============================================================================
; Force Uninstall Support (for recovery when normal uninstall fails)
; ============================================================================

; This function can be called from command line: uninstall.exe /FORCE
Function ForceUninstall
  ; Check for /FORCE flag
  ${GetParameters} $0
  ${StrStr} $0 "/FORCE" $1
  StrCmp $1 "" NormalUninstall
  
  DetailPrint "Force uninstall requested - performing aggressive cleanup"
  
  ; Kill any running instances
  nsExec::Exec `"$CmdPath" /C taskkill /IM "Coder Desktop.exe" /F /T`
  Pop $0
  Sleep 1000
  
  ; Call the standard uninstall but with force flags
  Call ForceCleanup
  
  ; Exit immediately
  Quit
  
NormalUninstall:
FunctionEnd

Function ForceCleanup
  DetailPrint "Force cleaning Coder Desktop installation..."
  
  ; Remove installed files
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$SMPROGRAMS\Coder Desktop.lnk"
  Delete "$DESKTOP\Coder Desktop.lnk"
  RMDir /r "$SMPROGRAMS\Coder Desktop"
  
  ; Remove registry keys (both HKCU and HKLM)
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Coder Desktop"
  DeleteRegKey HKCU "Software\Coder Desktop"
  DeleteRegKey HKLM "Software\Coder Desktop"
  
  ; Remove AppUserModelId registration
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop"
  DeleteRegKey HKLM "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop"
  
  DetailPrint "Force cleanup complete."
FunctionEnd

; ============================================================================
; Custom Uninstaller Page (shows force uninstall option)
; ============================================================================

!macro customUninstallConfirm
  ; Add a checkbox for force uninstall option
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
FunctionEnd

!macro customUninstallLeave
  ${NSD_GetState} $ForceUninstallCheckbox $0
  StrCmp $0 ${BST_CHECKED} ForceUninstallSelected
  ; Normal uninstall path
  Goto NormalUninstallPath
  
ForceUninstallSelected:
  ; Set a flag for force uninstall
  WriteRegStr HKCU "Software\Coder Desktop" "ForceUninstall" "1"
  
NormalUninstallPath:
FunctionEnd

; ============================================================================
; Installer Finish Page - Offer to launch app
; ============================================================================

!macro customFinish
  ; Check if we should launch the app
  ${NSD_CreateCheckbox} 0 0 100% 12u "Launch Coder Desktop"
  Pop $LaunchAppCheckbox
  ${NSD_SetState} $LaunchAppCheckbox 1
FunctionEnd

!macro customFinishLeave
  ${NSD_GetState} $LaunchAppCheckbox $0
  StrCmp $0 ${BST_CHECKED} LaunchApp
  Goto NoLaunchApp
  
LaunchApp:
  Exec '"$INSTDIR\Coder Desktop.exe"'
  
NoLaunchApp:
FunctionEnd

; ============================================================================
; Pre/Post Install/Uninstall Hooks
; ============================================================================

Function .onInit
  ; Check for force uninstall flag
  ${GetParameters} $0
  ${StrStr} $0 "/FORCE" $1
  StrCmp $1 "" NoForceFlag
  
  ; Force uninstall mode
  Call ForceUninstall
  
NoForceFlag:
FunctionEnd

Function .onInstSuccess
  ; Register AppUserModelId for proper taskbar grouping
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop" "" "$INSTDIR\Coder Desktop.exe"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.elijahshepherd.coderdesktop" "DisplayName" "Coder Desktop"
FunctionEnd

; ============================================================================
; Variables
; ============================================================================

Var ForceUninstallCheckbox
Var LaunchAppCheckbox