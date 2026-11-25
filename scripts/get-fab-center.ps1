Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('C:\Users\Rakshith\.gemini\antigravity\brain\54357793-1034-48f8-9da5-8eea2ab067b5\.user_uploaded\fab_crop.png')
$bmp = New-Object System.Drawing.Bitmap($img)

$pts = @()
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -gt 220 -and $c.G -gt 70 -and $c.G -lt 140 -and $c.B -lt 30) {
            $pts += [PSCustomObject]@{ X = $x; Y = $y }
        }
    }
}

$minX = ($pts | Measure-Object -Property X -Minimum).Minimum
$maxX = ($pts | Measure-Object -Property X -Maximum).Maximum
$minY = ($pts | Measure-Object -Property Y -Minimum).Minimum
$maxY = ($pts | Measure-Object -Property Y -Maximum).Maximum

# Original crop was X: 780, Y: 1700
$absMinX = $minX + 780
$absMaxX = $maxX + 780
$absMinY = $minY + 1700
$absMaxY = $maxY + 1700
$absCenterX = [Math]::Round(($absMinX + $absMaxX) / 2)
$absCenterY = [Math]::Round(($absMinY + $absMaxY) / 2)

Write-Host "In crop: X=[$minX, $maxX], Y=[$minY, $maxY]"
Write-Host "Screen absolute: X=[$absMinX, $absMaxX], Y=[$absMinY, $absMaxY]"
Write-Host "Screen center to tap: ($absCenterX, $absCenterY)"

$bmp.Dispose()
$img.Dispose()
