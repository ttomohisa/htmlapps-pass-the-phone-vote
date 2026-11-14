param(
  [string]$Version = ""
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$configPath = Join-Path $Root 'app.config.json'
$configVersion = [string]((Get-Content -Raw -Encoding UTF8 -LiteralPath $configPath | ConvertFrom-Json).version)

if ($configVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {
  throw 'app.config.json must use stable SemVer (MAJOR.MINOR.PATCH)'
}
if (-not [string]::IsNullOrWhiteSpace($Version) -and $Version -ne $configVersion) {
  throw "Requested release version $Version does not match app.config.json ($configVersion)"
}
$Version = $configVersion

$prefix = "htmlapps-pass-the-phone-vote-v$Version"
$out = Join-Path $Root 'release-assets'
$bundle = Join-Path $Root 'release-bundle'
New-Item -ItemType Directory -Force -Path $out, $bundle | Out-Null

$readable = Join-Path $Root 'dist/index.html'
$selfExtract = Join-Path $Root 'dist/index.self-extract.html'
if (!(Test-Path -LiteralPath $readable -PathType Leaf)) { throw "Missing standalone build: $readable" }
if (!(Test-Path -LiteralPath $selfExtract -PathType Leaf)) { throw "Missing self-extract build: $selfExtract" }

Copy-Item -LiteralPath $readable -Destination (Join-Path $out "$prefix.html") -Force
Copy-Item -LiteralPath $selfExtract -Destination (Join-Path $out "$prefix.self-extract.html") -Force

$zipFiles = @(
  @{ Source = 'dist/index.html'; Name = 'index.html' },
  @{ Source = 'dist/index.self-extract.html'; Name = 'index.self-extract.html' },
  @{ Source = 'dist/dependency-manifest.json'; Name = 'dependency-manifest.json' },
  @{ Source = 'dist/self-extract-manifest.json'; Name = 'self-extract-manifest.json' },
  @{ Source = 'README.md'; Name = 'README.md' },
  @{ Source = 'README.ja.md'; Name = 'README.ja.md' },
  @{ Source = 'LICENSE'; Name = 'LICENSE' },
  @{ Source = 'THIRD_PARTY_NOTICES.md'; Name = 'THIRD_PARTY_NOTICES.md' }
)
foreach ($entry in $zipFiles) {
  $source = Join-Path $Root ([string]$entry.Source)
  if (!(Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Release file is missing: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $bundle ([string]$entry.Name)) -Force
}

$zipPath = Join-Path $out "$prefix.zip"
Compress-Archive -Path (Join-Path $bundle '*') -DestinationPath $zipPath -Force

$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $expected = @($zipFiles | ForEach-Object { [string]$_.Name } | Sort-Object)
  $actual = @($archive.Entries | ForEach-Object { $_.FullName } | Sort-Object)
  if (($expected -join '|') -ne ($actual -join '|')) {
    throw 'Release ZIP is missing a required file or contains unexpected entries'
  }
} finally {
  $archive.Dispose()
}

$assetNames = @("$prefix.html", "$prefix.self-extract.html", "$prefix.zip")
$lines = foreach ($name in $assetNames) {
  $file = Join-Path $out $name
  if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing release asset: $name" }
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $name"
}
$checksumPath = Join-Path $out 'SHA256SUMS.txt'
[System.IO.File]::WriteAllText(
  $checksumPath,
  (($lines -join [char]10) + [char]10),
  [System.Text.UTF8Encoding]::new($false)
)

foreach ($line in [System.IO.File]::ReadAllLines($checksumPath, [System.Text.Encoding]::UTF8)) {
  if ($line -match '^([0-9a-f]{64})  (.+)
}

Write-Host "[OK] Versioned release archive and SHA-256 checksums verified: $prefix" -ForegroundColor Green
) {
    $expectedHash = $Matches[1]
    $assetName = $Matches[2]
    $actualHash = (Get-FileHash -LiteralPath (Join-Path $out $assetName) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) { throw "Checksum mismatch for $assetName" }
  } else {
    throw 'Malformed SHA256SUMS entry'
  }
}

Write-Host "[OK] Versioned release archive and SHA-256 checksums verified: $prefix" -ForegroundColor Green
