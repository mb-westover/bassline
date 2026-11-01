# Included scripts

`convert_nettleton.py` rebuilds `hymn.js` from the included MusicXML using only Python's standard library. Run it from any working directory:

```sh
python3 scripts/convert_nettleton.py
```

Optional arguments:

```sh
python3 scripts/convert_nettleton.py scores/come-thou-fount.musicxml --output /tmp/hymn.js
```

The converter expects the bundled two-staff, 48-beat score and derives four pitch-ordered lines. It deliberately retains the prototype's assumptions and first two lyric verses. Do not treat it as a general MusicXML parser.

`check.mjs` uses Node's standard library only. It checks data, script parsing, and key transport interactions in a simulated DOM/Web Audio environment. Real browser/microphone verification is still needed after substantive changes.
