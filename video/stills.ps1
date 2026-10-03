# Reconstruye la escena y renderiza cuadros de revision a prioridad BelowNormal.
# Uso: .\stills.ps1 -Out D:\renders\mildred-fractal\stillsN -Secs "6,14,30" [-Pct 33] [-NoBuild]
param([string]$Out, [string]$Secs, [int]$Pct = 33, [switch]$NoBuild)
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$blender = "D:\tools\blender\blender-5.2.2-windows-x64\blender.exe"
if (-not $NoBuild) {
  & $blender -b --factory-startup -P "$here\build_scene.py" 2>&1 | Select-String -Pattern "Error|Traceback|line \d+|SAVED" | Select-Object -First 20
}
New-Item -ItemType Directory -Force $Out | Out-Null
$p = Start-Process -PassThru -NoNewWindow -FilePath $blender -ArgumentList '-b', "`"$here\fractal_agreement.blend`"", '-P', "`"$here\render_stills.py`"", '--', $Out, "$Pct", $Secs -RedirectStandardOutput "$Out\log.txt" -RedirectStandardError "$Out\err.txt"
Start-Sleep 1
try { $p.PriorityClass = 'BelowNormal' } catch {}
$p.WaitForExit()
Get-Content "$Out\err.txt" -Tail 5
python -c @"
import glob
from PIL import Image
fs=sorted(glob.glob(r'$Out\t*.jpg'))
ims=[Image.open(f).resize((426,240)) for f in fs]
cols=3
for part in range(0,len(ims),12):
  sub=ims[part:part+12]; rows=(len(sub)+cols-1)//cols
  m=Image.new('RGB',(426*cols,240*rows))
  for i,im in enumerate(sub): m.paste(im,((i%cols)*426,(i//cols)*240))
  m.save(r'$Out\sheet%d.jpg'%(part//12))
print(len(fs),'stills')
"@
