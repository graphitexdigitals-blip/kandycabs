$ErrorActionPreference = "Stop"
$env:PATH = "C:\nvm4w\nodejs;$env:PATH"
$root = "D:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated"
Set-Location $root

Write-Output "== STEP 1: EXPORTING METRO BUNDLE =="
Set-Location "$root\apps\customer-app"
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.5:3000"
& "C:\nvm4w\nodejs\npx.cmd" expo export:embed --entry-file index.js --platform android --dev false --bundle-output dist_bundle\index.android.bundle --assets-dest dist_bundle

Write-Output "== STEP 2: COMPILING HERMES BYTECODE =="
Set-Location $root
$hermesc = "$root\node_modules\react-native\sdks\hermesc\win64-bin\hermesc.exe"
& $hermesc -emit-binary -out "$root\apps\customer-app\dist_bundle\index.android.bundle.hbc" "$root\apps\customer-app\dist_bundle\index.android.bundle"

Write-Output "== STEP 3: REPACKAGING, ZIPALIGNING & SIGNING APK =="
& powershell -ExecutionPolicy Bypass -File "$root\scripts\update-customer-apk.ps1"

Write-Output "== ALL STEPS COMPLETE! =="
