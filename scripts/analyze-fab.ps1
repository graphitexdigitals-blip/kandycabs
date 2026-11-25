Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('C:\Users\Rakshith\.gemini\antigravity\brain\54357793-1034-48f8-9da5-8eea2ab067b5\.user_uploaded\fab_crop.png')
$bmp = New-Object System.Drawing.Bitmap($img)

Write-Host "Analyzing fab_crop.png (300x400, original X: 780-1080, Y: 1700-2100)..."
$orangePixels = 0
$whitePixels = 0
$darkNavy = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -gt 220 -and $c.G -gt 70 -and $c.G -lt 140 -and $c.B -lt 30) { $orangePixels++ }
        if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) { $whitePixels++ }
        if ($c.R -lt 20 -and $c.G -lt 35 -and $c.B -gt 20 -and $c.B -lt 70) { $darkNavy++ }
    }
}

Write-Host "Orange: $orangePixels, White: $whitePixels, DarkNavy: $darkNavy"
$bmp.Dispose()
$img.Dispose()
