Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$baseApk = Join-Path $root "kandy-cabs-customer.apk"
$tempUnsigned = Join-Path $root "apps\customer-app\dist_bundle\temp_unsigned.apk"
$tempAligned = Join-Path $root "apps\customer-app\dist_bundle\temp_aligned.apk"
$finalRootApk = Join-Path $root "kandy-cabs-customer.apk"
$finalCustomerApk = Join-Path $root "apps\customer-app\kandy-cabs-customer.apk"
$finalWebApk = Join-Path $root "apps\web\public\kandy-cabs-customer.apk"
$hbcFile = Join-Path $root "apps\customer-app\dist_bundle\index.android.bundle.hbc"

$zipalign = "C:\Users\Rakshith\AppData\Local\Android\Sdk\build-tools\34.0.0\zipalign.exe"
$apksigner = "C:\Users\Rakshith\AppData\Local\Android\Sdk\build-tools\34.0.0\apksigner.bat"
$keystore = Join-Path $root "apps\customer-app\android\app\debug.keystore"

Write-Output "1. Copying base APK..."
Copy-Item $baseApk $tempUnsigned -Force

Write-Output "2. Updating zip entries in APK..."
$zip = [System.IO.Compression.ZipFile]::Open($tempUnsigned, [System.IO.Compression.ZipArchiveMode]::Update)

# Patch AndroidManifest.xml binary versionCode to 25 and versionName to 1.1.0
$manifestEntry = $zip.GetEntry("AndroidManifest.xml")
if ($null -ne $manifestEntry) {
    $mStream = $manifestEntry.Open()
    $mMem = New-Object System.IO.MemoryStream
    $mStream.CopyTo($mMem)
    $mBytes = $mMem.ToArray()
    $mStream.Dispose()
    $manifestEntry.Delete()

    # Patch versionCode at offset 6008 to 25
    $vcBytes = [System.BitConverter]::GetBytes([uint32]25)
    [System.Array]::Copy($vcBytes, 0, $mBytes, 6008, 4)

    # Patch versionName at offset 1208 to "1.1.0"
    $vnBytes = [System.Text.Encoding]::Unicode.GetBytes("1.1.0")
    [System.Array]::Copy($vnBytes, 0, $mBytes, 1208, $vnBytes.Length)

    $newManifestPath = Join-Path $root "apps\customer-app\dist_bundle\AndroidManifest.xml"
    [System.IO.File]::WriteAllBytes($newManifestPath, $mBytes)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $newManifestPath, "AndroidManifest.xml")
    Write-Output "Patched AndroidManifest.xml with versionCode=25, versionName=1.1.0!"
}

$toDelete = @()
foreach ($entry in $zip.Entries) {
    if ($entry.FullName.StartsWith("META-INF/") -or $entry.FullName -eq "assets/index.android.bundle") {
        $toDelete += $entry
    }
}
foreach ($entry in $toDelete) {
    $entry.Delete()
}

# Insert compiled Hermes bytecode
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $hbcFile, "assets/index.android.bundle")

# Update login hero image (mapped to res/1C.jpg in compiled resources.arsc)
$loginHeroFile = Join-Path $root "apps\customer-app\assets\images\customer-login-hero.jpg"
if (Test-Path $loginHeroFile) {
    $heroEntry = $zip.GetEntry("res/1C.jpg")
    if ($null -ne $heroEntry) { $heroEntry.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $loginHeroFile, "res/1C.jpg")
    Write-Output "Updated native compiled login hero res/1C.jpg!"
}

# Update native app launcher icons (Adaptive Foregrounds, Legacy Square & Round across all densities)
$androidIconsDir = Join-Path $root "apps\customer-app\android_icons"
if (Test-Path $androidIconsDir) {
    $iconList = @(
        @{ file = "fg_mdpi.png"; target = "res/QZ.png" },
        @{ file = "fg_hdpi.png"; target = "res/zr.png" },
        @{ file = "fg_xhdpi.png"; target = "res/Em.png" },
        @{ file = "fg_xxhdpi.png"; target = "res/Lf.png" },
        @{ file = "fg_xxxhdpi.png"; target = "res/as.png" },
        @{ file = "square_mdpi.png"; target = "res/9w.png" },
        @{ file = "square_hdpi.png"; target = "res/yn.png" },
        @{ file = "square_xhdpi.png"; target = "res/FS.png" },
        @{ file = "square_xxhdpi.png"; target = "res/RJ.png" },
        @{ file = "square_xxxhdpi.png"; target = "res/o-.png" },
        @{ file = "round_mdpi.png"; target = "res/zR.png" },
        @{ file = "round_hdpi.png"; target = "res/8c.png" },
        @{ file = "round_xhdpi.png"; target = "res/wb.png" },
        @{ file = "round_xxhdpi.png"; target = "res/fO.png" },
        @{ file = "round_xxxhdpi.png"; target = "res/Gc.png" }
    )

    foreach ($item in $iconList) {
        $srcPath = Join-Path $androidIconsDir $item.file
        $targetEntry = $item.target
        if (Test-Path $srcPath) {
            $existing = $zip.GetEntry($targetEntry)
            if ($null -ne $existing) { $existing.Delete() }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $srcPath, $targetEntry)
            Write-Output "Updated launcher icon resource: $targetEntry"
        }
    }
    Write-Output "Updated all 15 native Android launcher icon densities in APK res/!"
}

# Also add/update all drawable assets exported by Metro
$distDir = Join-Path $root "apps\customer-app\dist_bundle"
Get-ChildItem -Path $distDir -Directory -Filter "drawable-*" | ForEach-Object {
    $dpiFolder = $_.Name
    Get-ChildItem -Path $_.FullName -File | ForEach-Object {
        $entryName = "res/$dpiFolder/" + $_.Name
        $existing = $zip.GetEntry($entryName)
        if ($null -ne $existing) {
            $existing.Delete()
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
    }
}

# Also add/update raw assets (fonts, etc.)
$rawDir = Join-Path $distDir "raw"
if (Test-Path $rawDir) {
    Get-ChildItem -Path $rawDir -File | ForEach-Object {
        $entryName = "res/raw/" + $_.Name.ToLower()
        $existing = $zip.GetEntry($entryName)
        if ($null -ne $existing) {
            $existing.Delete()
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
    }
}

# Explicitly embed custom Roboto TTF fonts in APK assets/fonts/ for 100% offline native font resolution
$fontsDir = Join-Path $root "apps\customer-app\assets\fonts"
if (Test-Path $fontsDir) {
    Get-ChildItem -Path $fontsDir -File -Filter "*.ttf" | ForEach-Object {
        $entryName = "assets/fonts/" + $_.Name
        $existing = $zip.GetEntry($entryName)
        if ($null -ne $existing) {
            $existing.Delete()
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
        Write-Output "Embedded font in APK: $entryName"
    }
}

# Also add any files under dist_bundle/assets
$assetsDir = Join-Path $distDir "assets"
if (Test-Path $assetsDir) {
    Get-ChildItem -Path $assetsDir -File -Recurse | ForEach-Object {
        $rel = $_.FullName.Substring($distDir.Length).TrimStart('\', '/') -replace '\\', '/'
        $existing = $zip.GetEntry($rel)
        if ($null -ne $existing) {
            $existing.Delete()
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel)
    }
}

$zip.Dispose()

Write-Output "3. Running zipalign..."
if (Test-Path $tempAligned) { Remove-Item $tempAligned -Force }
& $zipalign -p -f 4 $tempUnsigned $tempAligned

Write-Output "4. Signing APK with debug key..."
$tempSigned = Join-Path $root "apps\customer-app\dist_bundle\temp_signed.apk"
if (Test-Path $tempSigned) { Remove-Item $tempSigned -Force }
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out $tempSigned $tempAligned

Write-Output "5. Verifying APK signature..."
& $apksigner verify $tempSigned

Write-Output "6. Deploying updated APK to workspace root, customer-app, and web public..."
Copy-Item $tempSigned $finalRootApk -Force
Copy-Item $tempSigned (Join-Path $root "kandycabs-customer.apk") -Force
Copy-Item $tempSigned $finalCustomerApk -Force
Copy-Item $tempSigned $finalWebApk -Force
Copy-Item $tempSigned (Join-Path $root "apps\web\public\kandycabs-customer.apk") -Force

Write-Output "7. Cleaning up temporary build files..."
Remove-Item $tempUnsigned -Force -ErrorAction SilentlyContinue
Remove-Item $tempAligned -Force -ErrorAction SilentlyContinue
Remove-Item $tempSigned -Force -ErrorAction SilentlyContinue
Remove-Item "$tempSigned.idsig" -Force -ErrorAction SilentlyContinue

Write-Output "=== APK SUCCESSFULLY UPDATED ==="
Get-Item $finalRootApk, (Join-Path $root "kandycabs-customer.apk") | Select-Object Name, Length, LastWriteTime
