$ErrorActionPreference = "Stop"
$env:PATH = "C:\nvm4w\nodejs;$env:PATH"
$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$distDir = "$root\apps\customer-app\dist_bundle"
$bundleFile = "$distDir\index.android.bundle"
$hbcFile = "$distDir\index.android.bundle.hbc"
$hermesc = "$root\node_modules\react-native\sdks\hermesc\win64-bin\hermesc.exe"

Set-Location $root

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " STEP 1: EXPORTING METRO BUNDLE FOR CUSTOMER APP" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$env:EXPO_PUBLIC_API_URL = "https://kandycabs-8kew.vercel.app"
Write-Host "Using EXPO_PUBLIC_API_URL = $env:EXPO_PUBLIC_API_URL" -ForegroundColor Green

Set-Location "$root\apps\customer-app"
& "C:\nvm4w\nodejs\npx.cmd" expo export:embed --entry-file index.js --platform android --dev false --bundle-output $bundleFile --assets-dest $distDir
if ($LASTEXITCODE -ne 0) {
    throw "Metro export failed with exit code $LASTEXITCODE"
}
Write-Host "Metro bundle generated successfully ($((Get-Item $bundleFile).Length) bytes)" -ForegroundColor Green

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " STEP 2: COMPILING HERMES BYTECODE (hermesc)    " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

Set-Location $root
& $hermesc -emit-binary -out $hbcFile $bundleFile
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $hbcFile)) {
    throw "Hermes compilation failed with exit code $LASTEXITCODE"
}
Write-Host "Hermes bytecode created: $((Get-Item $hbcFile).Length) bytes" -ForegroundColor Green

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " STEP 3: REPACKAGING, ZIPALIGNING & SIGNING APK " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

& powershell.exe -ExecutionPolicy Bypass -File "$root\scripts\update-customer-apk.ps1"
if ($LASTEXITCODE -ne 0) {
    throw "APK update script failed with exit code $LASTEXITCODE"
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " CUSTOMER APK UPDATED SUCCESSFULLY!             " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
