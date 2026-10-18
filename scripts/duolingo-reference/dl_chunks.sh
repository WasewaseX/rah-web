#!/bin/bash
cd /home/z/my-project/scripts/duolingo-reference
SIZE=397456000
CHUNK=8000000
START=$(stat -c %s traces.part 2>/dev/null || echo 0)
if [ "$START" -gt 0 ]; then echo "resuming from $START" >> dl.log; fi
while [ "$START" -lt "$SIZE" ]; do
  END=$((START + CHUNK - 1))
  if [ "$END" -ge "$SIZE" ]; then END=$((SIZE - 1)); fi
  WANT=$((END - START + 1))
  GOT=0
  TRY=0
  while [ "$GOT" -ne "$WANT" ] && [ "$TRY" -lt 6 ]; do
    TRY=$((TRY + 1))
    curl -sL --max-time 240 -r "$START"-"$END" "https://dataverse.harvard.edu/api/access/datafile/3091087" -o chunk.bin
    GOT=$(stat -c %s chunk.bin 2>/dev/null || echo 0)
    if [ "$GOT" -ne "$WANT" ]; then sleep 3; fi
  done
  if [ "$GOT" -ne "$WANT" ]; then echo "FAILED at $START" >> dl.log; exit 1; fi
  cat chunk.bin >> traces.part
  START=$((END + 1))
done
rm -f chunk.bin
mv traces.part traces.csv.gz
echo CHUNKED-DONE >> dl.log
