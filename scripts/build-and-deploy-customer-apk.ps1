$ErrorActionPreference = "Stop"

$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$customerAppDir = Join-Path $root "apps\customer-app"
$distDir = Join-Path $customerAppDir "dist_bundle"
$bundleFile = Join-Path $distDir "index.android.bundle"
$hbcFile = Join-Path $distDir "index.android.bundle.hbc"
$hermesc = Join-Path $root "node_modules\react-native\sdks\hermesc\win64-bin\hermesc.exe"
$npxCmd = "C:\nvm4w\nodejs\npx.cmd"
$nodePath = "C:\nvm4w\nodejs"
$env:PATH = "$nodePath;$env:PATH"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " STEP 1: EXPORTING METRO BUNDLE FOR CUSTOMER" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$env:EXPO_PUBLIC_API_URL = "https://proven-differences-sole-replace.trycloudflare.com"
Write-Host "Using EXPO_PUBLIC_API_URL = $env:EXPO_PUBLIC_API_URL" -ForegroundColor Green

Set-Location $customerAppDir
& $npxCmd expo export:embed --entry-file index.js --platform android --dev false --bundle-output $bundleFile --assets-dest $distDir
if ($LASTEXITCODE -ne 0) {
    throw "Metro export failed with exit code $LASTEXITCODE"
}
Write-Host "Metro bundle generated successfully ($((Get-Item $bundleFile).Length) bytes)" -ForegroundColor Green

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " STEP 2: COMPILING HERMES BYTECODE (hermesc)  " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

& $hermesc -emit-binary -out $hbcFile $bundleFile
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $hbcFile)) {
    throw "Hermes compilation failed with exit code $LASTEXITCODE"
}
Write-Host "Hermes bytecode created: $((Get-Item $hbcFile).Length) bytes" -ForegroundColor Green

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " STEP 3: GENERATING LAUNCHER ICONS (NEW MASTER)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$genScript = Join-Path $root "scripts\generate-launcher-icons.js"
& node $genScript
if ($LASTEXITCODE -ne 0) {
    throw "generate-launcher-icons.js failed with exit code $LASTEXITCODE"
}

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " STEP 4: REPACKAGING, ZIPALIGN & SIGNING APK  " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$updateScript = Join-Path $root "scripts\update-customer-apk.ps1"
& powershell.exe -ExecutionPolicy Bypass -File $updateScript
if ($LASTEXITCODE -ne 0) {
    throw "update-customer-apk.ps1 failed with exit code $LASTEXITCODE"
}

$finalApk = Join-Path $root "kandy-cabs-customer.apk"
Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " CUSTOMER APK BUILD COMPLETED SUCCESSFULLY!   " -ForegroundColor Cyan
Write-Host " Output file: $finalApk ($([Math]::Round((Get-Item $finalApk).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
