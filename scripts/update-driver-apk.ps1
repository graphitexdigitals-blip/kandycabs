Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$baseApk = Join-Path $root "apps\driver-app\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $baseApk)) {
    $baseApk = Join-Path $root "kandy-cabs-driver.apk"
}
$distDir = Join-Path $root "apps\driver-app\dist_bundle"
$tempUnsigned = Join-Path $distDir "temp_unsigned.apk"
$tempAligned = Join-Path $distDir "temp_aligned.apk"
$tempSigned = Join-Path $distDir "temp_signed.apk"
$finalRootApk = Join-Path $root "kandy-cabs-driver.apk"
$finalDriverApk = Join-Path $root "apps\driver-app\kandy-cabs-driver.apk"
$finalWebApk = Join-Path $root "apps\web\public\kandy-cabs-driver.apk"
$hbcFile = Join-Path $distDir "index.android.bundle.hbc"

$zipalign = "C:\Users\Rakshith\AppData\Local\Android\Sdk\build-tools\34.0.0\zipalign.exe"
$apksigner = "C:\Users\Rakshith\AppData\Local\Android\Sdk\build-tools\34.0.0\apksigner.bat"
$keystore = Join-Path $root "apps\driver-app\android\app\debug.keystore"

Write-Output "1. Copying base APK..."
Copy-Item $baseApk $tempUnsigned -Force

Write-Output "2. Updating zip entries in APK..."
$zip = [System.IO.Compression.ZipFile]::Open($tempUnsigned, [System.IO.Compression.ZipArchiveMode]::Update)

$toDelete = @()
foreach ($entry in $zip.Entries) {
    if ($entry.FullName.StartsWith("META-INF/") -or $entry.FullName -eq "assets/index.android.bundle") {
        $toDelete += $entry
    }
}
foreach ($entry in $toDelete) {
    $entry.Delete()
}

# Insert compiled Hermes bytecode as the new bundle
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $hbcFile, "assets/index.android.bundle")
Write-Output "Inserted new Hermes bundle."

# Update drawable assets exported by Metro
Get-ChildItem -Path $distDir -Directory -Filter "drawable-*" | ForEach-Object {
    $dpiFolder = $_.Name
    Get-ChildItem -Path $_.FullName -File | ForEach-Object {
        $entryName = "res/$dpiFolder/" + $_.Name
        $existing = $zip.GetEntry($entryName)
        if ($null -ne $existing) { $existing.Delete() }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
    }
}

# Update raw assets (fonts, sounds, etc.)
$rawDir = Join-Path $distDir "raw"
if (Test-Path $rawDir) {
    Get-ChildItem -Path $rawDir -File | ForEach-Object {
        $entryName = "res/raw/" + $_.Name.ToLower()
        $existing = $zip.GetEntry($entryName)
        if ($null -ne $existing) { $existing.Delete() }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
    }
}

# Embed custom fonts in APK assets/fonts/
$fontsDir = Join-Path $root "apps\driver-app\assets\fonts"
if (Test-Path $fontsDir) {
    Get-ChildItem -Path $fontsDir -File -Filter "*.ttf" | ForEach-Object {
        $entryName = "assets/fonts/" + $_.Name
        $existing = $zip.GetEntry($entryName)
        if ($null -ne $existing) { $existing.Delete() }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
        Write-Output "Embedded font: $entryName"
    }
}

# Add any files under dist_bundle/assets (locale JSON, images, etc.)
$assetsDir = Join-Path $distDir "assets"
if (Test-Path $assetsDir) {
    Get-ChildItem -Path $assetsDir -File -Recurse | ForEach-Object {
        $rel = $_.FullName.Substring($distDir.Length).TrimStart('\', '/') -replace '\\', '/'
        $existing = $zip.GetEntry($rel)
        if ($null -ne $existing) { $existing.Delete() }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel)
    }
}

# Inject patched icons, resources.arsc (navy iconBackground), and AndroidManifest.xml (versionCode 15)
$patchManifest = Join-Path $root "apps\driver-app\dist_bundle\icon_patch\manifest.json"
if (Test-Path $patchManifest) {
    Write-Output "Injecting patched brand launcher icons, resources.arsc, and AndroidManifest..."
    $patchData = Get-Content $patchManifest | ConvertFrom-Json
    foreach ($item in $patchData) {
        $entryName = $item.entry
        $filePath = $item.file
        if (Test-Path $filePath) {
            $existing = $zip.GetEntry($entryName)
            if ($null -ne $existing) { $existing.Delete() }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $filePath, $entryName)
            Write-Output "Injected patched asset: $entryName"
        }
    }
}

# Now inject high-res official Kandy Cabs logo into wide splash/header drawables (res/6p.png and res/7n.png)
$logoPath = Join-Path $root "apps\driver-app\assets\images\logo.png"
if (Test-Path $logoPath) {
    $logoBmp = New-Object System.Drawing.Bitmap($logoPath)
    foreach ($logoEntry in @("res/6p.png", "res/7n.png")) {
        $existing = $zip.GetEntry($logoEntry)
        $targetW = 990
        $targetH = 497
        if ($null -ne $existing) {
            try {
                $s = $existing.Open()
                $m = New-Object System.IO.MemoryStream
                $s.CopyTo($m)
                $s.Dispose()
                $b = New-Object System.Drawing.Bitmap($m)
                $targetW = $b.Width
                $targetH = $b.Height
                $b.Dispose()
                $m.Dispose()
            } catch {}
            $existing.Delete()
        }

        $canvas = New-Object System.Drawing.Bitmap($targetW, $targetH)
        $g = [System.Drawing.Graphics]::FromImage($canvas)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)

        # Preserve exact 1158x598 aspect ratio, fit and center well-proportioned logo on transparent canvas
        $maxScale = [Math]::Min($targetW / $logoBmp.Width, $targetH / $logoBmp.Height)
        $scale = $maxScale * 0.65
        $drawW = [int]($logoBmp.Width * $scale)
        $drawH = [int]($logoBmp.Height * $scale)
        $drawX = [int](($targetW - $drawW) / 2)
        $drawY = [int](($targetH - $drawH) / 2)

        $g.DrawImage($logoBmp, $drawX, $drawY, $drawW, $drawH)
        $g.Dispose()

        $tempLogo = [System.IO.Path]::GetTempFileName() + ".png"
        $canvas.Save($tempLogo, [System.Drawing.Imaging.ImageFormat]::Png)
        $canvas.Dispose()

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $tempLogo, $logoEntry)
        Remove-Item $tempLogo -Force
        Write-Output "Injected clean undistorted logo: $logoEntry ($targetW x $targetH, rendered ${drawW}x${drawH})"
    }
    $logoBmp.Dispose()
}

$zip.Dispose()

Write-Output "3. Running zipalign..."
if (Test-Path $tempAligned) { Remove-Item $tempAligned -Force }
& $zipalign -p -f 4 $tempUnsigned $tempAligned

Write-Output "4. Signing APK with debug key..."
if (Test-Path $tempSigned) { Remove-Item $tempSigned -Force }
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out $tempSigned $tempAligned

Write-Output "5. Verifying APK signature..."
& $apksigner verify $tempSigned

Write-Output "6. Deploying updated APK..."
Copy-Item $tempSigned $finalRootApk -Force
Copy-Item $tempSigned $finalDriverApk -Force
Copy-Item $tempSigned $finalWebApk -Force

Write-Output "7. Cleaning up temporary files..."
Remove-Item $tempUnsigned -Force -ErrorAction SilentlyContinue
Remove-Item $tempAligned -Force -ErrorAction SilentlyContinue
Remove-Item $tempSigned -Force -ErrorAction SilentlyContinue
Remove-Item "$tempSigned.idsig" -Force -ErrorAction SilentlyContinue

Write-Output "=== DRIVER APK SUCCESSFULLY UPDATED ==="
Get-Item $finalRootApk, $finalWebApk | Select-Object Name, Length, LastWriteTime

