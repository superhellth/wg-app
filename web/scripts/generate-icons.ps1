# Generates the PWA icons:
#   public/icon-192.png          "any"      — violet gradient squircle
#   public/icon-512.png          "any"      — violet gradient squircle
#   public/icon-maskable-512.png "maskable" — full-bleed square, content in the
#                                             80% safe zone (Android adaptive)
# "WG13" bold, tight tracking, with a diagonal slice through the "13".
# Pure System.Drawing — no external deps. Windows-only (needs Segoe UI).
# Run from anywhere:  pwsh web/scripts/generate-icons.ps1
#                     powershell -File web/scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "..\public"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

function Render-Icon {
  param(
    [int]$s,         # canvas size in px
    [bool]$Maskable, # full-bleed square (true) vs rounded squircle (false)
    [string]$out
  )

  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAlias"; $g.PixelOffsetMode = "HighQuality"
  $g.Clear([System.Drawing.Color]::Transparent)

  # gradient background — full square for maskable, rounded squircle otherwise
  $rect = New-Object System.Drawing.Rectangle 0, 0, $s, $s
  $c1 = [System.Drawing.ColorTranslator]::FromHtml("#6C63FF")
  $c2 = [System.Drawing.ColorTranslator]::FromHtml("#8B7FFF")
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45.0
  if ($Maskable) {
    $g.FillRectangle($brush, $rect)
  } else {
    $r = [int]($s * 0.24); $d = $r * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($s - $d, 0, $d, $d, 270, 90)
    $path.AddArc($s - $d, $s - $d, $d, $d, 0, 90); $path.AddArc(0, $s - $d, $d, $d, 90, 90)
    $path.CloseFigure(); $g.FillPath($brush, $path)
  }

  # tight typographic layout of WG13.
  # Maskable keeps text inside the ~80% safe zone (a circle mask can clip edges).
  $sf = [System.Drawing.StringFormat]::GenericTypographic.Clone()
  $sf.FormatFlags = $sf.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
  $chars = @("W", "G", "1", "3")
  $target = [single]($s * $(if ($Maskable) { 0.60 } else { 0.86 }))
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
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $out"
}

Render-Icon -s 192 -Maskable $false -out (Join-Path $dir "icon-192.png")
Render-Icon -s 512 -Maskable $false -out (Join-Path $dir "icon-512.png")
Render-Icon -s 512 -Maskable $true  -out (Join-Path $dir "icon-maskable-512.png")
