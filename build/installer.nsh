!macro customCheckAppRunning
  DetailPrint "Closing Coder Desktop before installing."
  nsExec::Exec `"$CmdPath" /C taskkill /IM "Coder Desktop.exe" /F /T`
  Pop $0
  Sleep 800
!macroend