$adb = "adb -s emulator-5554"
& adb -s emulator-5554 shell am force-stop com.kandycabs.customer
Start-Sleep -Milliseconds 500
& adb -s emulator-5554 shell monkey -p com.kandycabs.customer -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 3

# Tap Pickup Location on home screen (approx x=400, y=550)
& adb -s emulator-5554 shell input tap 400 550
Start-Sleep -Seconds 2

# Take screencap of open location modal
& adb -s emulator-5554 shell screencap -p /sdcard/modal_open.png
& adb -s emulator-5554 pull /sdcard/modal_open.png "C:\Users\Rakshith\.gemini\antigravity\brain\54357793-1034-48f8-9da5-8eea2ab067b5\.user_uploaded\modal_open.png"
Write-Host "Modal open captured"
