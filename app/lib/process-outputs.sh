#!/usr/bin/env zsh

cd ${0:h:h} || exit 1

node './dist/app/process-outputs.js' --grouping-config '/Volumes/Sync/OneDrive - Univerzita Pardubice/DP/model-1/grouping-config.json' --output-path '/Volumes/Sync/OneDrive - Univerzita Pardubice/DP/model-1/output'
node './dist/app/process-outputs.js' --grouping-config '/Volumes/Sync/OneDrive - Univerzita Pardubice/DP/model-1/grouping-config.json' --output-path '/Volumes/Sync/OneDrive - Univerzita Pardubice/DP/model-1/output2'

