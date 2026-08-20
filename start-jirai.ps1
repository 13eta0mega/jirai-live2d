$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
node (Join-Path $projectRoot 'tools\serve.mjs')

