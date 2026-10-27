param(
  [string]$SdkPath = $env:ANDROID_HOME,
  [string]$JavaPath = $env:JAVA_HOME
)
$ErrorActionPreference = 'Stop'
$androidProjectRoot = Split-Path $PSScriptRoot -Parent
if (-not $SdkPath -or -not (Test-Path -LiteralPath (Join-Path $SdkPath 'platforms/android-36/android.jar'))) {
  throw 'Supply -SdkPath with the installed Android SDK containing platforms/android-36.'
}
if (-not $JavaPath -or -not (Test-Path -LiteralPath (Join-Path $JavaPath 'bin/javac.exe'))) {
  throw 'Supply -JavaPath with JDK 21 (the installed Android Studio/jbr is supported).'
}
$env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaPath).Path
$env:ANDROID_HOME = (Resolve-Path -LiteralPath $SdkPath).Path
Push-Location $androidProjectRoot
try {
  $androidSdkProperty = 'sdk.dir=' + $env:ANDROID_HOME.Replace('\', '/').Replace(':', '\:')
  $androidPropertiesFile = Join-Path $androidProjectRoot 'android/local.properties'
  $androidPropertyLines = @()
  if (Test-Path -LiteralPath $androidPropertiesFile) {
    $androidPropertyLines = @(Get-Content -LiteralPath $androidPropertiesFile | Where-Object { $_ -notmatch '^sdk\.dir=' })
  }
  [IO.File]::WriteAllText($androidPropertiesFile, (($androidPropertyLines + $androidSdkProperty) -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  # Project-pinned pnpm; do not change global runtimes or environment settings.
  & npx --yes pnpm@10.34.5 android:sync
  if ($LASTEXITCODE -ne 0) { throw 'Android asset build/sync failed.' }
  Push-Location android
  try {
    & .\gradlew.bat --no-daemon :app:assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android debug build failed.' }
    Write-Output (Join-Path $androidProjectRoot 'android/app/build/outputs/apk/debug/app-debug.apk')
  } finally { Pop-Location }
} finally { Pop-Location }
