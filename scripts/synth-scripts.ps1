# Renders the synthetic benchmark: five answer scripts for the sample test, each written to earn a
# known mark against the rubric, in handwriting-style fonts on ruled paper with a slight tilt and
# JPEG noise. These are NOT real student handwriting; the README says so.
# Also renders a marked script with a deliberate totalling slip, and a typed answer key.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\synth-scripts.ps1   (writes to .cache\synth)
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "..\.cache\synth"
New-Item -ItemType Directory -Force $out | Out-Null

function New-Page([string]$file, [string]$fontName, [float]$size, [object[]]$lines, [float]$tilt, [hashtable]$margin = @{}, [string]$total = "") {
  $w = 1240; $h = 1754
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAlias"
  $g.Clear([System.Drawing.Color]::FromArgb(250, 250, 246))
  $rule = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 160, 185, 215)), 2
  for ($y = 150; $y -lt $h - 60; $y += 62) { $g.DrawLine($rule, 0, $y, $w, $y) }
  $red = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, 215, 38, 61)), 3
  $g.DrawLine($red, 130, 0, 130, $h)
  $g.TranslateTransform(620, 877); $g.RotateTransform($tilt); $g.TranslateTransform(-620, -877)
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 27, 42, 107))
  $font = New-Object System.Drawing.Font $fontName, $size
  $y = 92
  foreach ($l in $lines) {
    $text = [string]$l
    $strike = $text.StartsWith("~")
    if ($strike) { $text = $text.Substring(1) }
    $g.DrawString($text, $font, $ink, 150, $y)
    if ($strike) {
      $sz = $g.MeasureString($text, $font)
      $p = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 27, 42, 107)), 4
      $g.DrawLine($p, 150, $y + $sz.Height / 2, 150 + $sz.Width, $y + $sz.Height / 2 - 6)
    }
    $y += 62
  }
  # Teacher's margin marks (red pen), for the totalling check page.
  if ($margin.Count -gt 0) {
    $pen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 200, 20, 40))
    $mf = New-Object System.Drawing.Font "Segoe Print", 26
    foreach ($k in $margin.Keys) { $g.DrawString($margin[$k], $mf, $pen, 40, [int]$k) }
    if ($total) {
      $tf = New-Object System.Drawing.Font "Segoe Print", 34
      $g.DrawString("Total: $total / 10", $tf, $pen, 820, 30)
      $g.DrawEllipse((New-Object System.Drawing.Pen $pen, 3), 800, 20, 330, 80)
    }
  }
  $g.ResetTransform()
  # Photo-like noise: random specks.
  $rnd = New-Object System.Random 7
  for ($i = 0; $i -lt 2500; $i++) {
    $c = $rnd.Next(150, 235)
    $bmp.SetPixel($rnd.Next(0, $w), $rnd.Next(0, $h), [System.Drawing.Color]::FromArgb($c, $c, $c))
  }
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $g.Dispose(); $bmp.Dispose()
}

# SYN-01 neat, everything right: 2, 2, 4, 2 = 10
New-Page "SYN-01.jpg" "Segoe Print" 24 @(
  "Roll no: SYN-01",
  "Q1. At constant temperature, the current through a conductor",
  "is directly proportional to the voltage across it. V = IR,",
  "where V is voltage (volt), I current (ampere), R resistance (ohm).",
  "Q2. RMS value is the steady DC current that produces the same",
  "heat in a resistor in the same time as the AC. Irms = Imax/root2",
  "= 0.707 Imax.",
  "Q3. Series: same current, voltages add, one path, one break stops all.",
  "Parallel: same voltage, currents add, branches work independently.",
  "Series R = R1 + R2 ; parallel 1/R = 1/R1 + 1/R2.",
  "Eg: decorative lights in series, house wiring in parallel.",
  "Q4. 1/R = 1/4 + 1/6 = 5/12, so R = 12/5 = 2.4 ohm."
) -0.6

# SYN-02 messy, partial: 1, 1, 2, 2 = 6
New-Page "SYN-02.jpg" "Freestyle Script" 34 @(
  "Roll no: SYN-02",
  "Q1. Current is proportional to voltage. V = IR",
  "Q2. Irms = Imax / root 2",
  "Q3. In series the current is same and in parallel the voltage",
  "is same. Example series - torch cells, parallel - fans at home.",
  "Q4. R = (4 x 6)/(4 + 6) = 24/10 = 2.4 ohm"
) 1.2

# SYN-03 skips Q3, Q4 wrong: 2, 1, 0, 0 = 3
New-Page "SYN-03.jpg" "Kristen ITC" 22 @(
  "Roll no: SYN-03",
  "Q1. At constant temperature current I is directly proportional to",
  "potential difference V. V = I R, R is resistance in ohms.",
  "Q2. It is the DC current which gives the same heating effect",
  "as the AC in the same resistor and time.",
  "Q4. In parallel R = 4 + 6 = 10 ohm"
) -1.5

# SYN-04 Q4 forgot to invert: 2, 2, 3, 1 = 8
New-Page "SYN-04.jpg" "Bradley Hand ITC" 26 @(
  "Roll no: SYN-04",
  "Q1. At constant temperature, I is directly proportional to V.",
  "V = IR with V in volts, I in amperes and R in ohms.",
  "Q2. The equivalent DC that produces the same heat in the same",
  "resistor in the same time. Irms = Imax / root 2.",
  "Q3. Series: one path, same current, voltages add, if one bulb",
  "fails all go off. Parallel: same voltage, currents add,",
  "each branch independent. Example: serial lights (series),",
  "household wiring (parallel).",
  "Q4. 1/R = 1/4 + 1/6 = 5/12 = 0.42 so R = 0.42 ohm"
) 0.8

# SYN-05 crossing-out, then correct: 2, 2, 2, 2 = 8
New-Page "SYN-05.jpg" "Ink Free" 26 @(
  "Roll no: SYN-05",
  "Q1. At constant temperature current is directly proportional",
  "to voltage. V = IR (V volt, I ampere, R ohm).",
  "~Q2. RMS is the average value of AC",
  "Q2. RMS = DC current giving same heat in a resistor in the same",
  "time as the AC. Irms = 0.707 Imax.",
  "Q3. Series R = R1 + R2, parallel 1/R = 1/R1 + 1/R2.",
  "Example: Christmas lights are series, home sockets are parallel.",
  "~Q4. R = 10 ohm",
  "Q4. 1/R = 1/4 + 1/6 = 5/12, R = 2.4 ohm"
) -0.9

# A script already marked by hand, with a totalling slip: 2 + 1.5 + 3 + 2 = 8.5, written as 9.
New-Page "MARKED-01.jpg" "Bradley Hand ITC" 26 @(
  "Roll no: MARKED-01",
  "Q1. At constant temperature I is proportional to V. V = IR.",
  "",
  "Q2. Same heat as DC in same time. Irms = Imax/root 2",
  "",
  "Q3. Series: same current, one path. Parallel: same voltage,",
  "currents add. Eg: serial lights, house wiring.",
  "",
  "Q4. 1/R = 1/4 + 1/6 so R = 2.4 ohm"
) 0.5 @{ "92" = "2"; "278" = "1.5"; "402" = "3"; "588" = "2" } "9"

# A typed answer key.
New-Page "KEY-01.jpg" "Arial" 21 @(
  "Basic Electrical Engineering - Internal Test 1 - Scheme of valuation",
  "Q1. State Ohm's law. [2 marks]",
  "  Proportionality at constant temperature (1). V = IR with units (1).",
  "Q2. Define RMS value of AC. [2 marks]",
  "  Heating-effect definition (1). Irms = Imax/root 2 (1).",
  "Q3. Series vs parallel with examples. [4 marks]",
  "  Series properties (1). Parallel properties (1). Equivalent",
  "  resistance formulas (1). One example each (1).",
  "Q4. 4 ohm and 6 ohm in parallel. [2 marks]",
  "  Method (1). 2.4 ohm with unit (1)."
) 0
Write-Output "Rendered to $out"
