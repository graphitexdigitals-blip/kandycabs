Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
$baseApk = Join-Path $root "dist_apk\kandy-cabs-driver.apk"
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
$finalAdminApk = Join-Path $root "apps\admin\public\kandy-cabs-driver.apk"
$finalDistApk = Join-Path $root "dist_apk\kandy-cabs-driver.apk"
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
            if ($entryName -eq "resources.arsc") {
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $filePath, $entryName, [System.IO.Compression.CompressionLevel]::NoCompression)
                Write-Output "Injected uncompressed (stored): $entryName"
            } else {
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $filePath, $entryName)
                Write-Output "Injected patched asset: $entryName"
            }
        }
    }
}

# Inject high-res official Kandy Cabs logos into wide drawables
# res/6p.png = logo.png (grey/black text for light background)
# res/7n.png = logo-white.png (pure white text for dark header bar)
$logoPath = Join-Path $root "apps\driver-app\assets\images\logo.png"
$whiteLogoPath = Join-Path $root "apps\driver-app\assets\images\logo-white.png"

if (Test-Path $logoPath) {
    $existing = $zip.GetEntry("res/6p.png")
    if ($null -ne $existing) { $existing.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $logoPath, "res/6p.png")
    Write-Output "Injected full-res logo: res/6p.png"

    $existingMdpi = $zip.GetEntry("res/drawable-mdpi/assets_images_logo.png")
    if ($null -ne $existingMdpi) { $existingMdpi.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $logoPath, "res/drawable-mdpi/assets_images_logo.png")
    Write-Output "Injected full-res logo: res/drawable-mdpi/assets_images_logo.png"
}

if (Test-Path $whiteLogoPath) {
    $existing = $zip.GetEntry("res/7n.png")
    if ($null -ne $existing) { $existing.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $whiteLogoPath, "res/7n.png")
    Write-Output "Injected full-res white logo: res/7n.png"

    $existingMdpiWhite = $zip.GetEntry("res/drawable-mdpi/assets_images_logowhite.png")
    if ($null -ne $existingMdpiWhite) { $existingMdpiWhite.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $whiteLogoPath, "res/drawable-mdpi/assets_images_logowhite.png")
    Write-Output "Injected full-res white logo: res/drawable-mdpi/assets_images_logowhite.png"
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
Copy-Item $tempSigned $finalAdminApk -Force
Copy-Item $tempSigned $finalDistApk -Force

Write-Output "7. Cleaning up temporary files..."
Remove-Item $tempUnsigned -Force -ErrorAction SilentlyContinue
Remove-Item $tempAligned -Force -ErrorAction SilentlyContinue
Remove-Item $tempSigned -Force -ErrorAction SilentlyContinue
Remove-Item "$tempSigned.idsig" -Force -ErrorAction SilentlyContinue

Write-Output "=== DRIVER APK SUCCESSFULLY UPDATED ==="
Get-Item $finalRootApk, $finalWebApk | Select-Object Name, Length, LastWriteTime

