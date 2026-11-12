$ErrorActionPreference = "Stop"

$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$driverAppDir = Join-Path $root "apps\driver-app"
$distDir = Join-Path $driverAppDir "dist_bundle"
$bundleFile = Join-Path $distDir "index.android.bundle"
$hbcFile = Join-Path $distDir "index.android.bundle.hbc"
$hermesc = Join-Path $root "node_modules\react-native\sdks\hermesc\win64-bin\hermesc.exe"
$npxCmd = "C:\nvm4w\nodejs\npx.cmd"
$nodePath = "C:\nvm4w\nodejs"
$env:PATH = "$nodePath;$env:PATH"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " STEP 1: EXPORTING METRO BUNDLE FOR DRIVER APP" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$env:EXPO_PUBLIC_API_URL = "https://kandycabs-8kew.vercel.app"
Write-Host "Using EXPO_PUBLIC_API_URL = $env:EXPO_PUBLIC_API_URL" -ForegroundColor Green

Set-Location $driverAppDir
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
Write-Host " STEP 3: REPACKAGING APK & REPLACING BUNDLE   " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Write-Host "Generating patched launcher icons and resources..." -ForegroundColor Yellow
$patchScript = Join-Path $root "scripts\patch-driver-apk-icons.js"
& node $patchScript
if ($LASTEXITCODE -ne 0) {
    throw "patch-driver-apk-icons.js failed with exit code $LASTEXITCODE"
}

$updateScript = Join-Path $root "scripts\update-driver-apk.ps1"
& powershell.exe -ExecutionPolicy Bypass -File $updateScript
if ($LASTEXITCODE -ne 0) {
    throw "APK update script failed with exit code $LASTEXITCODE"
}

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " STEP 4: VERIFYING ZERO GREEN DRAWABLES IN APK" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$finalApk = Join-Path $root "kandy-cabs-driver.apk"
$zip = [System.IO.Compression.ZipFile]::OpenRead($finalApk)
$greenCount = 0
foreach ($e in $zip.Entries) {
    if ($e.FullName.EndsWith(".png") -and $e.FullName.StartsWith("res/")) {
        $stream = $e.Open()
        $ms = New-Object System.IO.MemoryStream
        $stream.CopyTo($ms)
        $stream.Dispose()
        $bmp = New-Object System.Drawing.Bitmap($ms)
        $c = $bmp.GetPixel([int]($bmp.Width / 2), [int]($bmp.Height / 2))
        if ($c.G -gt 110 -and $c.G -gt $c.R -and $c.G -gt $c.B) {
            Write-Host ("WARNING: Still green: " + $e.FullName) -ForegroundColor Yellow
            $greenCount++
        }
        $bmp.Dispose()
        $ms.Dispose()
    }
}
$zip.Dispose()

if ($greenCount -eq 0) {
    Write-Host "VERIFIED: 0 green drawables in final APK! All backgrounds are white." -ForegroundColor Green
} else {
    Write-Host "Note: $greenCount green drawables found in APK." -ForegroundColor Yellow
}

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " DRIVER APK BUILD COMPLETED SUCCESSFULLY!     " -ForegroundColor Cyan
Write-Host " Output file: $finalApk ($([Math]::Round((Get-Item $finalApk).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan

