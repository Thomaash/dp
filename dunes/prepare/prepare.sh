#!/usr/bin/env zsh

cd ${0:h} || exit 1

sizeExponent=$1

dir="../data/preprocessed/pcm$sizeExponent"

mkdir -p $dir || exit 1
trash $dir || exit 1
mkdir -p $dir || exit 1

wavs=(../data/raw/pcm/wav/*.wav)
labels=(${(unique)wavs:t:r:r})

for wav in $wavs; do
  printf -- '%s\n' $wav
done \
| parallel './prepare-file.sh' $sizeExponent '{}' $dir ${(j:.:)labels}

