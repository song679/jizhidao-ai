[CmdletBinding()]
param(
  [string]$BaseUrl = "https://www.jizhidao-ai.com",
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Add-Result {
  param(
    [System.Collections.Generic.List[object]]$Results,
    [string]$Name,
    [bool]$Passed,
    [string]$Details
  )

  $Results.Add(
    [pscustomobject]@{
      Check = $Name
      Status = if ($Passed) { "PASS" } else { "FAIL" }
      Details = $Details
    }
  )
}

function Get-HeaderValue {
  param(
    [object]$Headers,
    [string]$Name
  )

  $value = $Headers[$Name]
  if ($null -eq $value) {
    return ""
  }

  return [string]$value
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$baseUri = [uri]$BaseUrl
$isLocalTarget = $baseUri.Host -in @("localhost", "127.0.0.1", "::1")

if ($baseUri.Scheme -ne "https" -and -not $isLocalTarget) {
  Write-Error "Production smoke tests require HTTPS unless the target is localhost."
  exit 1
}

if (-not $isLocalTarget) {
  try {
    $addresses = [System.Net.Dns]::GetHostAddresses($baseUri.Host)
    if ($addresses.Count -eq 0) {
      throw "No IP addresses were returned."
    }

    Write-Host "DNS resolved: $($baseUri.Host) -> $($addresses.IPAddressToString -join ', ')"
  }
  catch {
    $publicAddresses = @()

    if (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue) {
      try {
        $publicAddresses = @(
          Resolve-DnsName `
            -Name $baseUri.Host `
            -Type A `
            -Server "1.1.1.1" `
            -ErrorAction Stop |
            Where-Object { $_.IPAddress } |
            Select-Object -ExpandProperty IPAddress
        )
      }
      catch {
        $publicAddresses = @()
      }
    }

    if (
      $publicAddresses.Count -eq 0 -and
      (Get-Command nslookup.exe -ErrorAction SilentlyContinue)
    ) {
      $previousErrorActionPreference = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      $nslookupOutput = & nslookup.exe $baseUri.Host "1.1.1.1" 2>&1 |
        Out-String
      $ErrorActionPreference = $previousErrorActionPreference
      $nslookupSucceeded =
        $nslookupOutput -match "(?im)^Name:\s+\S+" -and
        $nslookupOutput -notmatch "(?i)Non-existent domain|can't find"

      if ($nslookupSucceeded) {
        $publicAddresses = @(
          [regex]::Matches(
            $nslookupOutput,
            "\b(?:\d{1,3}\.){3}\d{1,3}\b"
          ) |
            ForEach-Object { $_.Value } |
            Where-Object { $_ -ne "1.1.1.1" } |
            Select-Object -Unique
        )

        if ($publicAddresses.Count -eq 0) {
          $publicAddresses = @("resolved through public DNS")
        }
      }
    }

    Write-Host ""
    if ($publicAddresses.Count -gt 0) {
      Write-Host "Public DNS is healthy, but the Windows resolver still has stale DNS data." -ForegroundColor Yellow
      Write-Host "$($baseUri.Host) -> $($publicAddresses -join ', ')"
      Write-Host "Run ipconfig /flushdns, restart the browser, or temporarily use DNS 1.1.1.1."
      exit 2
    }

    Write-Host "DNS preflight failed for $($baseUri.Host)." -ForegroundColor Red
    Write-Host "The domain does not currently resolve. Check the registrar, nameservers, and Vercel domain records."
    Write-Host $_.Exception.Message
    exit 1
  }
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$results = [System.Collections.Generic.List[object]]::new()
$publicPaths = @(
  "/",
  "/login",
  "/chat",
  "/pricing",
  "/terms",
  "/privacy",
  "/refund",
  "/support",
  "/robots.txt",
  "/sitemap.xml"
)

$responses = @{}

foreach ($path in $publicPaths) {
  $url = "$BaseUrl$path"

  try {
    $response = Invoke-WebRequest `
      -Uri $url `
      -UseBasicParsing `
      -TimeoutSec $TimeoutSec `
      -MaximumRedirection 5 `
      -Headers @{ "User-Agent" = "Jizhidao-Smoke-Test/1.0" }

    $responses[$path] = $response
    $statusCode = [int]$response.StatusCode
    $finalUri = $response.BaseResponse.ResponseUri
    $statusPassed = $statusCode -ge 200 -and $statusCode -lt 400
    $hostPassed = $isLocalTarget -or $finalUri.Host -eq $baseUri.Host
    $body = [string]$response.Content
    $localhostPassed = $isLocalTarget -or $body -notmatch "https?://(?:localhost|127\.0\.0\.1)(?::\d+)?"

    Add-Result $results "GET $path" $statusPassed "HTTP $statusCode"
    Add-Result $results "Final host $path" $hostPassed $finalUri.AbsoluteUri
    Add-Result $results "No localhost reference $path" $localhostPassed "HTML response scan"
  }
  catch {
    Add-Result $results "GET $path" $false $_.Exception.Message
  }
}

try {
  $healthResponse = Invoke-WebRequest `
    -Uri "$BaseUrl/api/health" `
    -UseBasicParsing `
    -TimeoutSec $TimeoutSec `
    -Headers @{ "User-Agent" = "Jizhidao-Smoke-Test/1.0" }

  $health = $healthResponse.Content | ConvertFrom-Json
  $healthPassed =
    [int]$healthResponse.StatusCode -eq 200 -and
    $health.status -eq "healthy" -and
    $health.services.app -eq "ok" -and
    $health.services.database -eq "ok"

  Add-Result `
    $results `
    "API health" `
    $healthPassed `
    "HTTP $($healthResponse.StatusCode); status=$($health.status); database=$($health.services.database)"

  $cacheControl = Get-HeaderValue $healthResponse.Headers "Cache-Control"
  Add-Result `
    $results `
    "Health no-store" `
    ($cacheControl -match "no-store") `
    "Cache-Control: $cacheControl"
}
catch {
  Add-Result $results "API health" $false $_.Exception.Message
}

try {
  $modelConfigResponse = Invoke-WebRequest `
    -Uri "$BaseUrl/api/chat/config" `
    -UseBasicParsing `
    -TimeoutSec $TimeoutSec `
    -Headers @{ "User-Agent" = "Jizhidao-Smoke-Test/1.0" }

  $modelConfig = $modelConfigResponse.Content | ConvertFrom-Json
  $models = @($modelConfig.models)
  $hasSelectedModel =
    [int]$modelConfigResponse.StatusCode -eq 200 -and
    -not [string]::IsNullOrWhiteSpace([string]$modelConfig.provider) -and
    -not [string]::IsNullOrWhiteSpace([string]$modelConfig.model) -and
    -not [string]::IsNullOrWhiteSpace([string]$modelConfig.modelId)
  $hasModelOptions =
    $models.Count -gt 0 -and
    @($models | Where-Object {
      -not [string]::IsNullOrWhiteSpace([string]$_.id) -and
      -not [string]::IsNullOrWhiteSpace([string]$_.provider) -and
      -not [string]::IsNullOrWhiteSpace([string]$_.model) -and
      -not [string]::IsNullOrWhiteSpace([string]$_.displayName) -and
      -not [string]::IsNullOrWhiteSpace([string]$_.label) -and
      [int]$_.pointCost -gt 0
    }).Count -eq $models.Count

  Add-Result `
    $results `
    "AI model config selected" `
    $hasSelectedModel `
    "provider=$($modelConfig.provider); model=$($modelConfig.model); modelId=$($modelConfig.modelId)"

  Add-Result `
    $results `
    "AI model config options" `
    $hasModelOptions `
    "models=$($models.Count)"
}
catch {
  Add-Result $results "AI model config" $false $_.Exception.Message
}

try {
  $paymentStatusResponse = Invoke-WebRequest `
    -Uri "$BaseUrl/api/payments/status" `
    -UseBasicParsing `
    -TimeoutSec $TimeoutSec `
    -Headers @{ "User-Agent" = "Jizhidao-Smoke-Test/1.0" }

  $paymentStatus = $paymentStatusResponse.Content | ConvertFrom-Json
  $paymentStatusPassed =
    [int]$paymentStatusResponse.StatusCode -eq 200 -and
    $null -ne $paymentStatus.mode -and
    $null -ne $paymentStatus.manualRechargeEnabled -and
    $null -ne $paymentStatus.onlinePaymentEnabled -and
    $null -ne $paymentStatus.provider -and
    $null -ne $paymentStatus.adapterImplemented -and
    $null -ne $paymentStatus.warnings
  $paymentCacheControl = Get-HeaderValue `
    $paymentStatusResponse.Headers `
    "Cache-Control"

  Add-Result `
    $results `
    "Payment runtime status" `
    $paymentStatusPassed `
    "mode=$($paymentStatus.mode); provider=$($paymentStatus.provider); online=$($paymentStatus.onlinePaymentEnabled)"

  Add-Result `
    $results `
    "Payment status no-store" `
    ($paymentCacheControl -match "no-store") `
    "Cache-Control: $paymentCacheControl"
}
catch {
  Add-Result $results "Payment runtime status" $false $_.Exception.Message
}

if ($responses.ContainsKey("/")) {
  $homeResponse = $responses["/"]
  $requiredHeaders = @{
    "Content-Security-Policy" = "default-src"
    "Strict-Transport-Security" = "max-age="
    "X-Content-Type-Options" = "nosniff"
    "X-Frame-Options" = "DENY"
    "Referrer-Policy" = "strict-origin"
  }

  foreach ($headerName in $requiredHeaders.Keys) {
    $headerValue = Get-HeaderValue $homeResponse.Headers $headerName
    $headerPassed = $headerValue -match [regex]::Escape($requiredHeaders[$headerName])
    Add-Result $results "Header $headerName" $headerPassed $headerValue
  }
}

if ($responses.ContainsKey("/robots.txt")) {
  $robots = [string]$responses["/robots.txt"].Content
  Add-Result `
    $results `
    "Robots protects admin" `
    ($robots -match "Disallow:\s*/admin/") `
    "robots.txt"
  Add-Result `
    $results `
    "Robots protects API" `
    ($robots -match "Disallow:\s*/api/") `
    "robots.txt"
}

if ($responses.ContainsKey("/sitemap.xml")) {
  $sitemap = [string]$responses["/sitemap.xml"].Content
  $sitemapPassed =
    $sitemap -match [regex]::Escape("$BaseUrl/login") -and
    $sitemap -match [regex]::Escape("$BaseUrl/pricing")
  Add-Result $results "Sitemap core routes" $sitemapPassed "login and pricing URLs"
}

Write-Host ""
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -eq "FAIL" })
Write-Host ""
Write-Host "Checks: $($results.Count); Passed: $($results.Count - $failed.Count); Failed: $($failed.Count)"

if ($failed.Count -gt 0) {
  Write-Host "Production smoke test failed." -ForegroundColor Red
  exit 1
}

Write-Host "Production smoke test passed." -ForegroundColor Green
