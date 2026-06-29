# Generates the PWA icons (public/icon-192.png + icon-512.png).
# "WG13" bold, tight tracking, on a violet gradient squircle, with a diagonal
# slice cutting through the "13". Pure System.Drawing — no external deps.
# Run from anywhere:  pwsh web/scripts/generate-icons.ps1
#                     powershell -File web/scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing

# Output dir = ../public relative to this script.
$dir = Join-Path $PSScriptRoot "..\public"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

foreach ($s in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAlias"; $g.PixelOffsetMode = "HighQuality"
  $g.Clear([System.Drawing.Color]::Transparent)

  # gradient squircle background
  $rect = New-Object System.Drawing.Rectangle 0, 0, $s, $s
  $c1 = [System.Drawing.ColorTranslator]::FromHtml("#6C63FF")
  $c2 = [System.Drawing.ColorTranslator]::FromHtml("#8B7FFF")
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45.0
  $r = [int]($s * 0.24); $d = $r * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($s - $d, 0, $d, $d, 270, 90)
  $path.AddArc($s - $d, $s - $d, $d, $d, 0, 90); $path.AddArc(0, $s - $d, $d, $d, 90, 90)
  $path.CloseFigure(); $g.FillPath($brush, $path)

  # tight typographic layout of WG13
  $sf = [System.Drawing.StringFormat]::GenericTypographic.Clone()
  $sf.FormatFlags = $sf.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
  $chars = @("W", "G", "1", "3")
  $target = [single]($s * 0.86)   # text fills ~86% of width
  $kern = [single](-$s * 0.028)   # negative tracking -> chars closer together
  $fs = [single]($s * 0.34)
  for ($n = 0; $n -lt 60; $n++) {
    $f = New-Object System.Drawing.Font "Segoe UI", $fs, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $ws = $chars | ForEach-Object { $g.MeasureString($_, $f, 2147483647, $sf).Width }
    $tot = ($ws | Measure-Object -Sum).Sum + $kern * ($chars.Count - 1)
    if ([math]::Abs($tot - $target) -lt 0.5) { break }
    $fs = $fs * $target / $tot; $f.Dispose()
  }
  $f = New-Object System.Drawing.Font "Segoe UI", $fs, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $ws = $chars | ForEach-Object { $g.MeasureString($_, $f, 2147483647, $sf).Width }
  $tot = ($ws | Measure-Object -Sum).Sum + $kern * ($chars.Count - 1)
  $h = $g.MeasureString("WG13", $f, 2147483647, $sf).Height
  $x = ($s - $tot) / 2; $y = [single](($s - $h) / 2)
  $xs = @()
  foreach ($i in 0..3) {
    $xs += $x
    $g.DrawString($chars[$i], $f, [System.Drawing.Brushes]::White, [single]$x, $y, $sf)
    $x += $ws[$i] + $kern
  }
  $x13Start = [single]$xs[2]
  $x13End = [single]($xs[3] + $ws[3])

  # diagonal slice across the "13" only (clipped so it never touches the G)
  $w13 = $x13End - $x13Start
  $clipLeft = [single]($x13Start + $w13 * 0.08)
  $g.SetClip((New-Object System.Drawing.RectangleF $clipLeft, $y, ([single]($x13End - $clipLeft)), $h))
  $cx = ($x13Start + $x13End) / 2; $cy = [single]($y + $h * 0.555)
  $ang = -24.0 * [math]::PI / 180     # slice angle
  $dx = [math]::Cos($ang); $dy = [math]::Sin($ang)
  $nx = -[math]::Sin($ang); $ny = [math]::Cos($ang)
  $L = $w13 * 0.62; $t = [single]($s * 0.022)   # slice length / thickness
  $band = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pts = @(
    (New-Object System.Drawing.PointF ([single]($cx + $dx * $L + $nx * $t)), ([single]($cy + $dy * $L + $ny * $t))),
    (New-Object System.Drawing.PointF ([single]($cx + $dx * $L - $nx * $t)), ([single]($cy + $dy * $L - $ny * $t))),
    (New-Object System.Drawing.PointF ([single]($cx - $dx * $L - $nx * $t)), ([single]($cy - $dy * $L - $ny * $t))),
    (New-Object System.Drawing.PointF ([single]($cx - $dx * $L + $nx * $t)), ([single]($cy - $dy * $L + $ny * $t)))
  )
  $band.AddPolygon([System.Drawing.PointF[]]$pts)
  $g.FillPath($brush, $band)
  $g.ResetClip()

  $g.Dispose()
  $out = Join-Path $dir "icon-$s.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $out"
}
