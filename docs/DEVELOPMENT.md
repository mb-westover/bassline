# Development guide

## Architecture

This prototype is buildless: `index.html` loads `styles.css`, then `hymn.js`, then `app.js`. UI state, Web Audio synthesis, audio scheduling, microphone processing, and SVG drawing live in `app.js`. Function names are retained from the working app so the implementation can be followed easily.

### Score data

`HYMN.sections` contains four 12-quarter-note sections. Each has `tracks` in **soprano, alto, tenor, bass** order and two lyric arrays. Notes carry start time `t`, duration `d` (quarter-note units), MIDI pitch `m`, written step/alter/octave, and source measure number. Lyrics carry `t`, `text`, and a hyphenation flag.

This is a prototype-specific data model, not a substitute for MusicXML. The bundled conversion reconstructs upper/lower lines from two choral staves using sounding pitch order. That is not a reliable strategy for arbitrary scores with voice crossings, rests, ties, multiple simultaneous parts, or differing lyric rhythms.

### Display

`drawHymn`, `drawHymnSystem`, and `scoreX` draw the complete hymn, map musical time to horizontal score positions, and place lyric syllables on the same timeline. Soprano/tenor stems point up; alto/bass stems point down. The custom renderer does not implement all engraving rules, ties, beams, accidentals, or complex MusicXML layout features.

### Playback and navigation

`play` schedules notes against `AudioContext.currentTime`. `referenceClock` maps audio time to the musical beat. `pauseReference` saves the exact beat, cancels scheduled oscillators, and freezes the score; resuming schedules the remaining portions of held notes and all subsequent events. `referenceRun` invalidates callbacks from superseded playback runs.

`seekScore` cancels the current run and schedules from the clicked beat. `scoreClick` maps SVG coordinates or explicit note/lyric metadata to time. `chooseSection` and `nextSection` synchronize the selected practice section, score position, and transport while preserving playing/paused state.

`requestAnimationFrame` moves the playhead, updates bass-note highlighting, and scrolls when the active score system changes. UI updates should remain tied to the audio clock rather than accumulating timer delays.

### Singing feedback

Microphone capture is enabled only after a user action. `detect` estimates monophonic pitch using normalized time-domain autocorrelation. A target must remain within the selected tolerance for approximately 500 milliseconds to advance. This grades neither rhythm nor vocal tone quality.

Speaker mode requests `echoCancellation` through `getUserMedia`, and reports the track's setting if available. This does not guarantee successful removal of local synthesized accompaniment. Headphones avoid much of this interference. No custom adaptive echo canceller, ICA, or source-separation model is implemented.

### State and storage

The app stores only its completed-phrase count in `localStorage` under `bassline-completed`. There is no account system or server-side persistence. The `scores/catalog.json` file is informational and is not read by the app yet.

## Suggested next phase: general MusicXML support

1. Add a file picker for uncompressed MusicXML, followed by compressed `.mxl` support.
2. Use an established engraving engine, such as OpenSheetMusicDisplay or Verovio, for score rendering rather than expanding the custom SVG implementation.
3. Parse written voice identity, parts, clefs, durations, rests, ties, tuplets, pickup measures, lyrics, tempo changes, and repeat/navigation instructions into an explicit playback model. Preserve voice identity rather than separating voices by pitch order.
4. Map renderer note identifiers and lyric anchors to that playback model, so the cursor, seeking, and pitch grading use the same musical timeline.
5. Offer a score selector and a target-part selector, with per-part mute/volume and optional transposition. Keep lyric-to-note relationships from the source file.
6. Retain the working transport behavior and add fixture-based checks for import edge cases and real browser checks for playback, seeking, and microphone access.

MusicXML references:
- https://www.w3.org/2021/06/musicxml40/
- https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/lyric/
- https://github.com/opensheetmusicdisplay/opensheetmusicdisplay

No general MusicXML import or rendering library has been added to this export. It is the portable, working prototype plus its source score and development materials.
