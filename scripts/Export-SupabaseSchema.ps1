[CmdletBinding()]
param(
  [string]$OutputPath,
  [switch]$Linked
)

$ErrorActionPreference = "Stop"

function Stop-WithMessage {
  param([string]$Message)

  Write-Error $Message
  exit 1
}

function Assert-DockerReady {
  $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue

  if (-not $dockerCommand) {
    Stop-WithMessage @"
Docker Desktop is not installed or the docker command is not available.
Install Docker Desktop for Windows, restart the terminal, and start Docker Desktop:
https://docs.docker.com/desktop/setup/install/windows-install/

Then verify:
docker version
"@
  }

  & $dockerCommand.Source info *> $null
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage @"
Docker is installed but the Docker engine is not running.
Start Docker Desktop, wait until it reports that the engine is running, then retry:
npm run db:schema:export
"@
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $projectRoot "supabase\schema-snapshots\public-schema-$timestamp.sql"
}
elseif (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $projectRoot $OutputPath
}

$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$snapshotRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $projectRoot "supabase\schema-snapshots")
).TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
  [System.IO.Path]::DirectorySeparatorChar

if (-not $OutputPath.StartsWith($snapshotRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  Stop-WithMessage "The output file must be inside supabase/schema-snapshots."
}

if (Test-Path -LiteralPath $OutputPath) {
  Stop-WithMessage "The output file already exists and will not be overwritten: $OutputPath"
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npxCommand) {
  Stop-WithMessage "npx.cmd was not found. Install Node.js first."
}

Assert-DockerReady

$arguments = @(
  "--yes",
  "supabase",
  "db",
  "dump",
  "--schema",
  "public",
  "--file",
  $OutputPath
)

if ($Linked) {
  $arguments += "--linked"
}
else {
  if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
    Stop-WithMessage @"
SUPABASE_DB_URL is not set.
Copy the database connection URI from Supabase and set it only for this PowerShell session:
`$env:SUPABASE_DB_URL='postgresql://...'
Then run: npm run db:schema:export
Alternatively, link the project with the Supabase CLI and run:
.\scripts\Export-SupabaseSchema.ps1 -Linked
"@
  }

  $arguments += @("--db-url", $env:SUPABASE_DB_URL)
}

Write-Host "Exporting the public schema (schema only, no business data)..."
& $npxCommand.Source @arguments

if ($LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }
  Stop-WithMessage "Supabase schema export failed. The incomplete file was removed."
}

if (-not (Test-Path -LiteralPath $OutputPath)) {
  Stop-WithMessage "The command completed without creating a schema file."
}

$schemaText = Get-Content -LiteralPath $OutputPath -Raw -Encoding utf8

$dataStatementPattern = "(?im)^\s*(COPY\s+public\.|INSERT\s+INTO\s+public\.)"
if ($schemaText -match $dataStatementPattern) {
  Remove-Item -LiteralPath $OutputPath -Force
  Stop-WithMessage "Business data statements were detected. The export was removed."
}

$secretPattern = "(?i)(sk-[a-z0-9_-]{12,}|sb_secret_[a-z0-9_-]{12,})"
if ($schemaText -match $secretPattern) {
  Remove-Item -LiteralPath $OutputPath -Force
  Stop-WithMessage "A possible API key was detected. The export was removed."
}

$expectedTables = @(
  "user_points",
  "point_transactions",
  "chat_sessions",
  "chat_messages",
  "chat_request_ledger",
  "recharge_orders"
)

$missingTables = @()
foreach ($table in $expectedTables) {
  $escapedTable = [regex]::Escape($table)
  $tablePattern = '(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?public"?\s*\.\s*"?{0}"?\s*\(' -f $escapedTable
  if ($schemaText -notmatch $tablePattern) {
    $missingTables += $table
  }
}

$hash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$hashPath = "$OutputPath.sha256"
"$hash  $([System.IO.Path]::GetFileName($OutputPath))" |
  Set-Content -LiteralPath $hashPath -Encoding ascii

Write-Host ""
Write-Host "Schema snapshot created:" -ForegroundColor Green
Write-Host $OutputPath
Write-Host "SHA256: $hash"

if ($missingTables.Count -gt 0) {
  Write-Warning "Expected tables were not found: $($missingTables -join ', ')"
  Write-Warning "Do not commit this snapshot until the database connection is verified."
  exit 2
}

Write-Host ""
Write-Host "All six core business tables were found." -ForegroundColor Green
Write-Host "Review the file before committing it. It should contain only schema, functions, grants, and RLS policies."
