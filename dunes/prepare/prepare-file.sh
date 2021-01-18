#!/usr/bin/env zsh

cd ${0:h} || exit 1

sizeExponent=$1
wav=$2
dir=$3
labels=$4

size=$(( 2 ** $sizeExponent ))

label=${${wav:t}//.*/}

pcm=$dir/${wav:t:r}.s16le.pcm
pcmJSON=$dir/${wav:t:r}.json

ffmpeg -stream_loop -1 -i $wav -ar 4000 -ac 1 -f s16le -fs $(( $size + 256 )) $pcm || exit 1

# The size from ffmpeg may be a bit more (but never less) than $size, truncate any excess.
truncate -s $size $pcm || exit 1

node ../dist/bin/pcm-to-pcm-tensor-data.js $pcm $pcmJSON $label $labels || exit 1

rm $pcm || exit 1

