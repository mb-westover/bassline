# Bassline

A browser-based bass sight-singing and four-part hymn rehearsal app. This is a standalone snapshot of the application developed in this conversation, including the corrected section-navigation behavior.

## Run locally

No build step or dependency installation is needed. With Python 3 installed, run this command **from this folder**:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000** in a current browser. Allow microphone access when you choose **Start singing**. Use localhost rather than opening `index.html` directly; microphone access requires a secure context (localhost is allowed). A hosted copy should use HTTPS.

The app runs entirely in the browser. The exported app does not require ChatGPT sign-in, an API key, a database, or a backend. Its optional web fonts come from Google Fonts; system-font fallbacks are provided.

## Current features

- Complete SATB score for **Come, Thou Fount of Every Blessing**, tune NETTLETON, E-flat major.
- Two staves: soprano and alto in treble clef; tenor and bass in bass clef. Lyric syllables align with the shared note timeline. Two verses are available, including the Ebenezer verse.
- Full-hymn playback, a moving playhead, and scrolling between score systems.
- Click a note, lyric, or position in the score to jump there and continue playback.
- Spacebar pauses and resumes at the saved musical position. Floating Pause/Resume and Stop controls are also available.
- Next section and the section selector move the selected practice section and playback position together. Playing stays playing; paused stays paused. When stopped, Play/Space begins at the selected section and continues to the end.
- Toggle the upper parts and adjust their volume during playback or self-paced singing practice.
- Microphone pitch feedback with configurable tolerance, generated single-note/stepwise/leap exercises, and a browser-local count of completed phrases.
- Speaker mode requests browser echo cancellation. Microphone audio is analyzed locally and is not uploaded.

This is pitch practice at your own pace, not rhythm grading. Playback is currently fixed at 0.65 seconds per quarter note. Audio uses synthesized tones, not recorded voices. Speaker-mode effectiveness depends on the browser, device, and room.

## Project files

```text
index.html                      Page structure and controls
styles.css                      Visual styles
app.js                          Score drawing, transport, audio, pitch feedback
hymn.js                         Preconverted data for the bundled hymn
scores/
  come-thou-fount.musicxml       Original source score, with parts and lyrics
  catalog.json                  Score metadata; not yet an app-loading mechanism
scripts/
  convert_nettleton.py           Score-specific converter that rebuilds hymn.js
  check.mjs                     Dependency-free application checks
  README.md                     Converter notes
docs/
  DEVELOPMENT.md                Architecture, limitations, and next steps
NOTICE.md                       Score source and provenance
package.json                    Optional check command; no dependencies
```

## Adding music

Put MusicXML files (`.musicxml` or `.xml`, or compressed `.mxl`) in `scores/`, using descriptive names. Record their titles, parts, source URLs, and usage rights in `scores/catalog.json`.

**Adding a file to that folder does not yet make it playable.** The current application loads only `hymn.js` and contains score-specific assumptions. A general MusicXML importer, compressed-file support, score selector, and standard notation renderer remain to be implemented. The existing Python converter is specific to this NETTLETON score; it is not a general import tool.

To rebuild the bundled data from its included source score:

```sh
python3 scripts/convert_nettleton.py
```

For the next development phase, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Checks

With Node.js 18 or later installed:

```sh
node scripts/check.mjs
# or: npm run check
```

No `npm install` is required. The checks use a simulated browser/audio environment to verify score data and transport behavior; they do not replace trying the microphone on real hardware.

## Put it in GitHub

Unzip this project and copy its contents into your chosen repository (or a subfolder such as `apps/bassline`). Commit and push through your normal Git workflow. The export contains no hosting identity, Git history, deployment credentials, or account configuration.

You can also host these static files with any HTTPS static host. No service-specific configuration is required by the app. Choose your preferred project license before distributing the application; the bundled score's source attribution is in `NOTICE.md`.
