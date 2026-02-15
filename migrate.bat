@echo off
REM ─────────────────────────────────────────────────────────────
REM Migration Script - Backlink Engine (2026-02-15) - Windows
REM ─────────────────────────────────────────────────────────────

echo 🚀 Backlink Engine - Migration 2026-02-15
echo ==========================================
echo.

REM Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker command not found in PATH
    echo.
    echo Please make sure Docker Desktop is installed and running.
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✅ Docker found
echo.

REM Check if containers are running
docker compose ps | findstr "bl-postgres" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  PostgreSQL container not running
    echo Starting containers...
    docker compose up -d postgres
    echo Waiting 10 seconds for PostgreSQL to be ready...
    timeout /t 10 /nobreak >nul
)

echo ✅ PostgreSQL container is running
echo.

REM Execute migrations
echo 📝 Executing migrations SQL...
echo.

echo [1/4] Migration timezone + firstName/lastName...
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma\migrations\20260215_add_timezone_firstname_lastname\migration.sql

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Migration 1/4 failed!
    pause
    exit /b 1
)

echo ✅ Migration 1/4 completed
echo.

echo [2/4] Migration Tags System...
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma\migrations\20260215_add_tags_system\migration.sql

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Migration 2/4 failed!
    pause
    exit /b 1
)

echo ✅ Migration 2/4 completed
echo.

echo [3/4] Migration Contact Forms + Message Templates...
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma\migrations\20260215_add_contact_form_detection_and_templates\migration.sql

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Migration 3/4 failed!
    pause
    exit /b 1
)

echo ✅ Migration 3/4 completed
echo.

echo [4/4] Migration Impactful Templates (blogger, media, influencer...)
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma\migrations\20260215_add_impactful_category_templates\migration.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Migration executed successfully!
    echo.

    REM Verify columns and tables
    echo 🔍 Verifying new columns and tables...
    docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('prospects', 'contacts') AND column_name IN ('timezone', 'firstName', 'lastName', 'contactFormFields', 'hasCaptcha') ORDER BY table_name, column_name;"

    echo.
    echo 🔍 Verifying message templates...
    docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT language, LEFT(subject, 40) as subject_preview FROM message_templates ORDER BY language;"

    echo.
    echo 🔄 Restarting enrichment worker...
    docker compose restart worker-enrichment

    echo.
    echo ✅ MIGRATION COMPLETE!
    echo.
    echo Next steps:
    echo   1. Test adding a prospect with firstName/lastName
    echo   2. Check that timezone is auto-detected
    echo   3. Verify email validation is working
    echo   4. Test contact form auto-detection
    echo   5. Edit message templates in admin UI
    echo.
) else (
    echo.
    echo ❌ Migration failed!
    echo Check the error message above.
    pause
    exit /b 1
)

pause
