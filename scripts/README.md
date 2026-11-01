# Included scripts

`convert_scores.py` rebuilds `hymn.js` from every score marked `playable_in_app` in `scores/catalog.json`, using only Python's standard library. Run it from any working directory:

```sh
python3 scripts/convert_scores.py
```

It expects two-staff, four-part scores and reads the upper and lower line of each staff by pitch. Do not treat it as a general MusicXML parser.

`check.mjs` uses Node's standard library only. It checks data, script parsing, key transport interactions and switching between hymns in a simulated DOM/Web Audio environment. Real browser/microphone verification is still needed after substantive changes.
