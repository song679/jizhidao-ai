[CmdletBinding()]
param(
  [string]$OutputPath,
  [string]$PostgresImage = "postgres:17-alpine"
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

function Get-SafeDatabaseError {
  param(
    [string]$Output,
    [string]$ConnectionString
  )

  $safeOutput = $Output
  if (-not [string]::IsNullOrWhiteSpace($ConnectionString)) {
    $safeOutput = $safeOutput.Replace($ConnectionString, "[REDACTED_DATABASE_URL]")
  }

  $safeOutput = $safeOutput `
    -replace '(?i)postgres(?:ql)?://[^\s]+', '[REDACTED_DATABASE_URL]' `
    -replace '(?i)(password=)[^\s]+', '$1[REDACTED]'

  if ($safeOutput -match '(?i)password authentication failed|authentication failed') {
    return "Database authentication failed. Check the database password and copy a fresh Session pooler connection string."
  }

  if ($safeOutput -match '(?i)could not translate host name|no such host|name or service not known') {
    return "The database host could not be resolved. Copy the Session pooler connection string again and check the network."
  }

  if ($safeOutput -match '(?i)connection timed out|timeout expired|network is unreachable') {
    return "The database connection timed out. Check the network, firewall, and Supabase project status."
  }

  if ($safeOutput -match '(?i)ssl|certificate') {
    return "The database SSL connection failed. Use the unmodified Session pooler string from Supabase Connect."
  }

  if ($safeOutput -match '(?i)permission denied') {
    return "Docker could not write the snapshot folder. Restart Docker Desktop and this terminal, then retry."
  }

  $lines = $safeOutput -split "\r?\n" |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Last 8

  if ($lines.Count -gt 0) {
    return "Database export failed. Safe diagnostic output:`n$($lines -join "`n")"
  }

  return "Database export failed without diagnostic output."
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

Assert-DockerReady

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
  Stop-WithMessage @"
SUPABASE_DB_URL is not set.
Copy the Session pooler connection URI from Supabase and keep the
[YOUR-PASSWORD] placeholder. Set it only for this PowerShell session:
`$env:SUPABASE_DB_URL='postgresql://...:[YOUR-PASSWORD]@...'
Set the password separately:
`$env:SUPABASE_DB_PASSWORD='...'
Then run: npm run db:schema:export
"@
}

$databaseUrl = $env:SUPABASE_DB_URL.Trim()
$databasePassword = $env:SUPABASE_DB_PASSWORD

if ($databaseUrl.Contains("[YOUR-PASSWORD]")) {
  if ([string]::IsNullOrWhiteSpace($databasePassword)) {
    Stop-WithMessage "SUPABASE_DB_PASSWORD is not set. Keep [YOUR-PASSWORD] in the connection URI and provide the password separately."
  }

  $databaseUrl = $databaseUrl.Replace(":[YOUR-PASSWORD]@", "@")
}

$databaseUri = $null
if (-not [System.Uri]::TryCreate(
  $databaseUrl,
  [System.UriKind]::Absolute,
  [ref]$databaseUri
)) {
  Stop-WithMessage "SUPABASE_DB_URL is not a valid absolute connection URI."
}

if ($databaseUri.Scheme -notin @("postgres", "postgresql")) {
  Stop-WithMessage "SUPABASE_DB_URL must start with postgres:// or postgresql://."
}

if ([string]::IsNullOrWhiteSpace($databaseUri.UserInfo)) {
  Stop-WithMessage "The database connection URI does not contain a username."
}

if (-not [string]::IsNullOrWhiteSpace($databaseUri.Fragment)) {
  Stop-WithMessage "The database password contains an unencoded # character. URL-encode special characters or reset the password to letters and numbers."
}

Write-Host "Exporting the public schema (schema only, no business data)..."
$outputFileName = [System.IO.Path]::GetFileName($OutputPath)
$previousSnapshotFile = $env:SUPABASE_SNAPSHOT_FILE
$previousDatabaseUrl = $env:SUPABASE_DB_URL_RUNTIME
$env:SUPABASE_SNAPSHOT_FILE = $outputFileName
$env:SUPABASE_DB_URL_RUNTIME = $databaseUrl

try {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $dockerOutput = & docker run --rm `
      --env SUPABASE_DB_URL `
      --env SUPABASE_DB_URL_RUNTIME `
      --env SUPABASE_DB_PASSWORD `
      --env SUPABASE_SNAPSHOT_FILE `
      --volume "${outputDirectory}:/output" `
      $PostgresImage `
      sh -c 'PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump --dbname="$SUPABASE_DB_URL_RUNTIME" --schema-only --schema=public --no-owner --file="/output/$SUPABASE_SNAPSHOT_FILE"' 2>&1 |
    ForEach-Object { $_.ToString() }
  $dockerExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
}
finally {
  $ErrorActionPreference = $previousErrorActionPreference
  if ($null -eq $previousSnapshotFile) {
    Remove-Item Env:SUPABASE_SNAPSHOT_FILE -ErrorAction SilentlyContinue
  }
  else {
    $env:SUPABASE_SNAPSHOT_FILE = $previousSnapshotFile
  }

  if ($null -eq $previousDatabaseUrl) {
    Remove-Item Env:SUPABASE_DB_URL_RUNTIME -ErrorAction SilentlyContinue
  }
  else {
    $env:SUPABASE_DB_URL_RUNTIME = $previousDatabaseUrl
  }
}

if ($dockerExitCode -ne 0) {
  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }
  $safeError = Get-SafeDatabaseError `
    -Output ($dockerOutput -join "`n") `
    -ConnectionString $databaseUrl
  Stop-WithMessage "$safeError`nThe incomplete file was removed."
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
