$ErrorActionPreference = "Stop"
$outDir = "C:\Users\Rakshith\.gemini\antigravity\brain\54357793-1034-48f8-9da5-8eea2ab067b5\.user_uploaded"

Write-Host "1. Starting MainActivity..."
& adb -s emulator-5554 shell am start -n com.kandycabs.customer/.MainActivity
Start-Sleep -Seconds 4

& adb -s emulator-5554 shell screencap -p /sdcard/step1_home.png
& adb -s emulator-5554 pull /sdcard/step1_home.png (Join-Path $outDir "step1_home.png")

Write-Host "2. Tapping Pickup Location row..."
# Pickup row on home screen is around y=550
& adb -s emulator-5554 shell input tap 400 550
Start-Sleep -Seconds 2

& adb -s emulator-5554 shell screencap -p /sdcard/step2_modal.png
& adb -s emulator-5554 pull /sdcard/step2_modal.png (Join-Path $outDir "step2_modal.png")

Write-Host "Done step 1 and 2."
