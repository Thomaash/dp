#!/usr/bin/env zsh

cd '/Volumes/Sync/OneDrive - Univerzita Pardubice/DP/model-1/output' || exit 1

printf -- '%s\n' **/*.otsimcor | sed 's#.*/##g;s#\(.*\)\.\([0-9]*\)\.[^.]*#\t\2\t\1#g' | sort -n | uniq -c | tac

