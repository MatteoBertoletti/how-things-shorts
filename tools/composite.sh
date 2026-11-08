#!/bin/bash
# Join the plate segments, lay the overlay PNGs on top, add the mix. usage: tools/composite.sh render audio/mix.wav out_master.mp4
set -e
R=$1; MIX=$2; OUT=$3
(for f in $R/seg_*.mp4; do echo "file '$(basename $f)'"; done) > $R/list.txt
ffmpeg -v error -y -f concat -safe 0 -i $R/list.txt -c copy $R/plate.mp4
ffmpeg -v error -y -i $R/plate.mp4 -framerate 30 -i $R/over/%05d.png -i $MIX \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 2:a \
  -c:v libx264 -crf 16 -preset veryfast -r 30 -c:a aac -b:a 256k -shortest -movflags +faststart ${OUT%.mp4}.tmp.mp4
mv ${OUT%.mp4}.tmp.mp4 $OUT
