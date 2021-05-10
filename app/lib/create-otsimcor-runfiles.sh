#!/usr/bin/env zsh

cd '/Volumes/Sync/OneDrive - Univerzita Pardubice/DP/model-1' || exit 1

trash otsimcor.run.*.ps1(N)
trash otsimcor.runfile.*.txt(N)

root='C:\Users\st46664\OneDrive - Univerzita Pardubice\DP\model-1\'
for f in output/*/*.otsimcor; do
  otsimcorRunfile="otsimcor.runfile.${f:t:r}.txt"
  otsimcorPowerShell="otsimcor.run.${f:t:r}.ps1"

  < runfile.txt | grep -v '^Train Diagram Document#' > $otsimcorRunfile
  for otsimcor in output/*/${f:t}; do
    printf -- 'Train Diagram Document#%s#\r\n' $root${otsimcor//\//\\} >> $otsimcorRunfile
  done

  printf -- '&"C:\Program Files (x86)\OpenTrack V1.9\OpenTrack.app\OpenTrack.exe" -runfile="%s"\r\n' $root$otsimcorRunfile > $otsimcorPowerShell
done

