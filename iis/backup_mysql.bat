@echo off
:: =============================================================================
:: AEMS — Automated Daily MySQL Backup Script for Windows Server
:: Can be scheduled in Windows Task Scheduler to run daily (e.g. 02:00 AM)
:: =============================================================================

set BACKUP_DIR=C:\aems\backups
set MYSQL_BIN="C:\Program Files\MySQL\MySQL Server 8.0\bin"
set DB_NAME=aems
set DB_USER=root
set DB_PASS=YOUR_MYSQL_PASSWORD_HERE

:: Format date as YYYY-MM-DD_HHMM
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,4%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [%date% %time%] Starting AEMS MySQL Backup...
%MYSQL_BIN%\mysqldump.exe -u %DB_USER% -p%DB_PASS% --single-transaction --quick --routines --triggers %DB_NAME% > "%BACKUP_DIR%\aems_backup_%TIMESTAMP%.sql"

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] Backup successfully created: %BACKUP_DIR%\aems_backup_%TIMESTAMP%.sql
) else (
    echo [%date% %time%] ERROR: Backup failed with code %ERRORLEVEL%
)

:: Optional: Delete backups older than 30 days to save disk space
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path"

echo [%date% %time%] Backup process complete.
