@echo off
set "PAGE=%~dp0index.html"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%PAGE%" & exit /b
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%PAGE%" & exit /b
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%PAGE%" & exit /b
start "" "%PAGE%"
