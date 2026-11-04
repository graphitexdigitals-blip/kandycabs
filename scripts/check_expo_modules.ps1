Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$zip = [System.IO.Compression.ZipFile]::OpenRead('d:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated\kandy-cabs-customer.apk')

$modules = @('lineargradient', 'imagepicker', 'filesystem', 'imagemanipulator', 'screens', 'securestore', 'location')

foreach ($dexName in @('classes.dex', 'classes2.dex', 'classes3.dex')) {
    $entry = $zip.GetEntry($dexName)
    if ($entry) {
        $stream = $entry.Open()
        $ms = New-Object System.IO.MemoryStream
        $stream.CopyTo($ms)
        $bytes = $ms.ToArray()
        $text = [System.Text.Encoding]::ASCII.GetString($bytes).ToLower()
        Write-Output "=== $dexName ==="
        foreach ($mod in $modules) {
            if ($text.Contains($mod)) {
                Write-Output "  Found: $mod"
            }
        }
        $stream.Dispose()
    }
}
$zip.Dispose()
