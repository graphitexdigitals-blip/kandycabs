$ErrorActionPreference = "Stop"
$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$driverAppDir = Join-Path $root "apps\driver-app"
$distDir = Join-Path $driverAppDir "dist_bundle"
$bundleFile = Join-Path $distDir "index.android.bundle"
$hbcFile = Join-Path $distDir "index.android.bundle.hbc"
$hermesc = Join-Path $root "node_modules\react-native\sdks\hermesc\win64-bin\hermesc.exe"

Write-Host "Compiling Hermes bytecode..." -ForegroundColor Cyan
& $hermesc -emit-binary -out $hbcFile $bundleFile
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $hbcFile)) {
    throw "Hermes compilation failed with exit code $LASTEXITCODE"
}
Write-Host "Hermes bytecode created: $((Get-Item $hbcFile).Length) bytes" -ForegroundColor Green

Write-Host "Generating patched launcher icons..." -ForegroundColor Cyan
$patchScript = Join-Path $root "scripts\patch-driver-apk-icons.js"
& node $patchScript

Write-Host "Updating APK bundle and aligning..." -ForegroundColor Cyan
$updateScript = Join-Path $root "scripts\update-driver-apk.ps1"
& powershell.exe -ExecutionPolicy Bypass -File $updateScript

Write-Host "Done!" -ForegroundColor Green
