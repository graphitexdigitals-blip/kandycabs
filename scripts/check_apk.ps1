Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$zip = [System.IO.Compression.ZipFile]::OpenRead('d:\Rakshith\Graphitex Digitals\client websites\kandycabs\kandycabs website\kandycabs updated\kandy-cabs-customer.apk')

foreach ($dexName in @('classes.dex', 'classes2.dex', 'classes3.dex')) {
    $entry = $zip.GetEntry($dexName)
    if ($entry) {
        $stream = $entry.Open()
        $ms = New-Object System.IO.MemoryStream
        $stream.CopyTo($ms)
        $bytes = $ms.ToArray()
        $text = [System.Text.Encoding]::ASCII.GetString($bytes)
        $hasLG = $text.Contains("LinearGradient")
        $hasIP = $text.Contains("ImagePicker")
        $hasFS = $text.Contains("FileSystem")
        Write-Output "$dexName -> LinearGradient: $hasLG, ImagePicker: $hasIP, FileSystem: $hasFS"
        $stream.Dispose()
    }
}
$zip.Dispose()
