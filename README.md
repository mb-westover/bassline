# Bassline

A browser-based app for learning to sing a part in four-part hymns: follow the score, hear the other voices, and get live feedback on your pitch from the microphone.

**Use it:** <https://mb-westover.github.io/bassline/>. Link straight to a hymn with `?song=all-creatures`.

## Run locally

No build step or dependency installation is needed. With Python 3 installed, run this command **from this folder**:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000** in a current browser. Allow microphone access when you choose **Start singing**. Use localhost rather than opening `index.html` directly; microphone access requires a secure context (localhost is allowed). A hosted copy should use HTTPS.

The app runs entirely in the browser, with no account, API key, database or backend. Its optional web fonts come from Google Fonts; system-font fallbacks are provided.

## Current features

- Complete SATB scores for **Come, Thou Fount of Every Blessing** (NETTLETON, E-flat major) and **All Creatures of Our God and King** (LASST UNS ERFREUEN, D major), chosen from a menu.
- Two staves: soprano and alto in treble clef; tenor and bass in bass clef. Lyric syllables align with the shared note timeline. Every verse in the source score is available.
- Full-hymn playback, a moving playhead, and scrolling between score systems.
- Click a note, lyric, or position in the score to jump there and continue playback.
- Spacebar pauses and resumes at the saved musical position. Floating Pause/Resume and Stop controls are also available.
- Next section and the section selector move the selected practice section and playback position together. Playing stays playing; paused stays paused. When stopped, Play/Space begins at the selected section and continues to the end.
- Toggle the upper parts and adjust their volume during playback or self-paced singing practice.
- Microphone pitch feedback with configurable tolerance, generated single-note/stepwise/leap exercises, and a browser-local count of completed phrases.
- Speaker mode requests browser echo cancellation. Microphone audio is analyzed locally and is not uploaded.

This is pitch practice at your own pace, not rhythm grading. Each hymn has one fixed playback tempo, set in `scores/catalog.json`. Audio uses synthesized tones, not recorded voices. Speaker-mode effectiveness depends on the browser, device, and room.

## Project files

```text
index.html                      Page structure and controls
styles.css                      Visual styles
app.js                          Score drawing, transport, audio, pitch feedback
hymn.js                         Generated data for the playable hymns
scores/
  *.musicxml                    Original source scores, with parts and lyrics
  catalog.json                  Each score's sections, tempo, source and rights
scripts/
  convert_scores.py             Rebuilds hymn.js from the catalog
  check.mjs                     Dependency-free application checks
  README.md                     Converter notes
docs/
  DEVELOPMENT.md                Architecture, limitations, and next steps
NOTICE.md                       Score sources and provenance
package.json                    Optional check command; no dependencies
```

## Adding a hymn

1. Put the MusicXML file in `scores/`. It must be a two-staff, four-part score: soprano and alto on the treble staff, tenor and bass on the bass staff. Compressed `.mxl` files need unzipping first.
2. Add an entry to `scores/catalog.json` with its title, source, rights, tempo, and where each section starts (in quarter notes), and set `playable_in_app` to `true`. About 12 quarter notes per section keeps the lyrics readable.
3. Run `python3 scripts/convert_scores.py`, record the source in `NOTICE.md`, and run the checks below.

The converter separates the parts on each staff by pitch, so check a new score by ear: voices that cross will swap. Other layouts, such as open-score files with one staff per voice or solo pieces, aren't supported yet. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Checks

With Node.js 18 or later installed:

```sh
node scripts/check.mjs
# or: npm run check
```

No `npm install` is required. The checks use a simulated browser/audio environment to verify score data and transport behavior; they do not replace trying the microphone on real hardware.

## License

The code is licensed under [CC BY-NC 4.0](LICENSE.txt): free to use, share and adapt with attribution, but not for commercial purposes. The scores in `scores/` are not covered by that license; `NOTICE.md` records each one's source and status.
