$appPath = Split-Path $MyInvocation.MyCommand.Path -Parent
Set-Location $appPath

Start-Transcript -Path "C:\Users\st46664\OneDrive - Univerzita Pardubice\DP\model-1\last-run-powershell.log"

npm install
node --trace-warnings -r source-map-support/register ./index.js --config "C:\Users\st46664\OneDrive - Univerzita Pardubice\DP\model-1\app-config.json"

