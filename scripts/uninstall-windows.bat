@echo off
REM Coder Desktop Force Uninstall - Batch Wrapper
REM Runs the PowerShell uninstall script with proper execution policy

powershell.exe -ExecutionPolicy Bypass -File "%~dp0uninstall-windows.ps1" %*