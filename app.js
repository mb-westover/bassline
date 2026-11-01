const $ = (id) => document.getElementById(id),
  scale = [43, 45, 47, 48, 50, 52, 53, 55, 57];
let notes = [],
  index = 0,
  done = 0,
  ctx,
  stream,
  analyser,
  raf,
  running = false,
  hold = 0,
  last = 0,
  playing = false,
  playTimer = 0,
  roundFinished = false;
let harmonyVoices = [],
  harmonyTimers = [],
  referenceVoices = [];
let playback = { active: false, section: 0, t: 0 },
  playbackRAF = 0,
  referenceMix = null,
  referenceRun = 0,
  pausedBeat = null,
  referenceClock = null;
const noteName = (m) =>
  ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"][
    ((m % 12) + 12) % 12
  ] +
  (Math.floor(m / 12) - 1);
const freq = (m) => 440 * 2 ** ((m - 69) / 12);
const isHymn = () => $("mode").value === "hymn";
function songSection() {
  return HYMN.sections[Number($("section").value)];
}
function lyricText() {
  const ls = songSection().lyrics[Number($("verse").value)];
  return ls
    .map((l, i) => l.text + (l.hyphen ? "-" : i < ls.length - 1 ? " " : ""))
    .join("");
}
function draw() {
  if (isHymn()) {
    drawHymn();
    return;
  }
  $("staff").setAttribute("viewBox", "0 0 640 200");
  $("staff").style.height = "210px";
  $("staff").style.minWidth = "0";
  $("staff").style.cursor = "default";
  let out = "";
  for (let y = 60; y <= 108; y += 12)
    out += `<line x1="20" y1="${y}" x2="970" y2="${y}" stroke="#a6ad9f" stroke-width="1"/>`;
  out +=
    '<text x="26" y="103" font-size="64" fill="#203e36" font-family="serif">𝄢</text>';
  if (isHymn()) {
    [96, 78, 102].forEach(
      (y, j) =>
        (out += `<text x="${85 + j * 13}" y="${y + 4}" font-size="26" font-family="serif" fill="#203e36">♭</text>`),
    );
    out +=
      '<text x="130" y="80" font-size="23" font-family="serif">3</text><text x="130" y="103" font-size="23" font-family="serif">4</text>';
  }
  const page = Math.floor(Math.min(index, notes.length - 1) / 4) * 4;
  notes.slice(page, page + 4).forEach((n, j) => {
    let i = page + j;
    const meta = isHymn() ? songSection().tracks[3][i] : null,
      letter = ["C", "D", "E", "F", "G", "A", "B"].indexOf(
        meta ? meta.step : noteName(n)[0],
      ),
      diatonic = 7 * (meta ? meta.octave + 1 : Math.floor(n / 12)) + letter,
      y = 108 - (diatonic - 25) * 6,
      x = (isHymn() ? 185 : 120) + j * (isHymn() ? 108 : 110),
      color = i < index ? "#668b58" : i === index ? "#326653" : "#203e36",
      duration = meta ? meta.d : 1;
    if (i === index && !roundFinished)
      out += `<rect x="${x - 23}" y="28" width="46" height="126" rx="15" fill="#e9f0df"/>`;
    for (let ly = 120; ly <= y; ly += 12)
      out += `<line x1="${x - 16}" y1="${ly}" x2="${x + 16}" y2="${ly}" stroke="${color}"/>`;
    for (let ly = 48; ly >= y; ly -= 12)
      out += `<line x1="${x - 16}" y1="${ly}" x2="${x + 16}" y2="${ly}" stroke="${color}"/>`;
    out += `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" transform="rotate(-18 ${x} ${y})" fill="${duration >= 2 ? "#fffef9" : color}" stroke="${color}" stroke-width="2"/><line x1="${x + 8}" y1="${y}" x2="${x + 8}" y2="${y - 33}" stroke="${color}" stroke-width="2"/>`;
    if (duration < 1)
      out += `<path d="M ${x + 8} ${y - 33} q 20 10 6 25" fill="none" stroke="${color}" stroke-width="3"/>`;
    if (duration < 0.5)
      out += `<path d="M ${x + 8} ${y - 25} q 20 10 6 25" fill="none" stroke="${color}" stroke-width="3"/>`;
    if (meta)
      out += `<text x="${x}" y="155" text-anchor="middle" fill="#71776e" font-size="11">bar ${meta.measure}</text>`;
    if ($("names").checked)
      out += `<text x="${x}" y="180" text-anchor="middle" fill="${color}" font-size="15">${noteName(n)}</text>`;
  });
  $("staff").innerHTML = out;
  $("staff").setAttribute(
    "aria-label",
    "Bass clef notes: " +
      notes
        .slice(page, page + 4)
        .map(noteName)
        .join(", "),
  );
  $("progress").textContent = roundFinished
    ? "Section complete"
    : `Note ${index + 1} of ${notes.length}`;
  $("songWords").textContent = isHymn() ? lyricText() : "";
}
function escapeScore(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function scoreWindow() {
  const bass = songSection().tracks[3],
    page = Math.floor(Math.min(index, bass.length - 1) / 4) * 4,
    visible = bass.slice(page, page + 4),
    start = visible[0].t,
    end = visible.at(-1).t + visible.at(-1).d;
  return { page, start, end, bass, visible };
}
function scoreX(sec) {
  const ls = sec.lyrics[Number($("verse").value)],
    times = [
      ...new Set([
        0,
        12,
        ...sec.tracks.flatMap((tr) => tr.map((n) => n.t)),
        ...ls.map((l) => l.t),
      ]),
    ].sort((a, b) => a - b),
    positions = [0];
  const width = (t) => {
    const l = ls.find((l) => l.t === t);
    return l
      ? (l.text.replace(/^\d+\.\s*/, "").length + (l.hyphen ? 2 : 0)) * 8
      : 0;
  };
  for (let i = 1; i < times.length; i++)
    positions.push(
      positions.at(-1) +
        Math.max(
          24,
          (times[i] - times[i - 1]) * 50,
          (width(times[i]) + width(times[i - 1])) / 2 + 12,
        ),
    );
  const factor = 775 / positions.at(-1);
  return (t) => {
    let i = times.findIndex((x) => x >= t);
    if (i <= 0) return 170;
    if (i < 0) return 945;
    const ratio = (t - times[i - 1]) / (times[i] - times[i - 1]);
    return (
      170 +
      (positions[i - 1] + ratio * (positions[i] - positions[i - 1])) * factor
    );
  };
}
function drawHymnSystem(sec, sectionIndex) {
  const bass = sec.tracks[3],
    win = { start: 0, end: 12, bass },
    activeSystem =
      (playback.active ? playback.section : Number($("section").value)) ===
      sectionIndex,
    target = activeSystem
      ? playback.active
        ? bass.find((n) => n.t <= playback.t && n.t + n.d > playback.t) ||
          bass.at(-1)
        : bass[Math.min(index, bass.length - 1)]
      : { t: -1, d: 0 },
    xFor = scoreX(sec);

  const text = (x, y, value, size = 13, fill = "#71776e", extra = "") =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escapeScore(value)}</text>`;
  let out = "";
  out += text(20, 22, "SOPRANO ↑  ·  ALTO ↓", 11);
  out += text(20, 224, "TENOR ↑  ·  BASS ↓", 11);
  out += text(
    970,
    22,
    "Section " + (sectionIndex + 1) + " · E♭ major · 3/4",
    12,
    "#71776e",
    'text-anchor="end"',
  );
  const activeX = xFor(playback.active ? playback.t : target.t);
  if (activeSystem && (playback.active || !roundFinished))
    out += `<rect id="playhead-${sectionIndex}" x="${activeX - 16}" y="32" width="32" height="330" rx="10" fill="#edf2e5"/>`;
  for (const bottom of [112, 314]) {
    for (let y = bottom - 48; y <= bottom; y += 12)
      out += `<line x1="20" y1="${y}" x2="970" y2="${y}" stroke="#a6ad9f" stroke-width="1"/>`;
    out += text(
      26,
      bottom - 5,
      bottom === 112 ? "𝄞" : "𝄢",
      64,
      "#203e36",
      'font-family="serif"',
    );
    const ys =
      bottom === 112
        ? [bottom - 24, bottom - 42, bottom - 18]
        : [bottom - 12, bottom - 30, bottom - 6];
    ys.forEach(
      (y, j) =>
        (out += text(
          85 + j * 13,
          y + 4,
          "♭",
          26,
          "#203e36",
          'font-family="serif"',
        )),
    );
    out += text(134, bottom - 28, "3", 23, "#203e36", 'font-family="serif"');
    out += text(134, bottom - 5, "4", 23, "#203e36", 'font-family="serif"');
  }
  out +=
    '<path d="M 16 64 L 10 64 L 10 314 L 16 314" stroke="#203e36" fill="none"/>';
  const measures = new Map();
  sec.tracks[3].forEach((n) => {
    if (!measures.has(n.measure)) measures.set(n.measure, n.t);
  });
  for (const [bar, t] of measures) {
    if (t >= win.start && t < win.end) {
      const x = xFor(t);
      out += text(x, 45, "bar " + bar, 10, "#71776e", 'text-anchor="middle"');
      if (t > win.start) {
        let bx = x - 20;
        out += `<path d="M ${bx} 64 V 112 M ${bx} 266 V 314" stroke="#c1c6b9"/>`;
      }
    }
  }
  sec.tracks.forEach((track, v) => {
    const bottom = v < 2 ? 112 : 314,
      base = v < 2 ? 37 : 25,
      up = v === 0 || v === 2;
    track
      .filter((n) => n.t < win.end && n.t + n.d > win.start)
      .forEach((n) => {
        const x = xFor(Math.max(n.t, win.start)),
          letter = ["C", "D", "E", "F", "G", "A", "B"].indexOf(n.step),
          y = bottom - (7 * (n.octave + 1) + letter - base) * 6,
          active =
            activeSystem &&
            (playback.active || !roundFinished) &&
            n.t <= target.t &&
            n.t + n.d > target.t,
          color =
            v === 3
              ? active
                ? "#235d42"
                : n.t < target.t
                  ? "#6c8a60"
                  : "#203e36"
              : "#59645c",
          dur = n.d,
          stemX = up ? x + 8 : x - 8,
          tip = up ? y - 33 : y + 33;
        if (v === 3 && active)
          out += `<ellipse cx="${x}" cy="${y}" rx="15" ry="11" fill="#d7e7c7" stroke="#326653"/>`;
        for (let ly = bottom + 12; ly <= y; ly += 12)
          out += `<line x1="${x - 14}" y1="${ly}" x2="${x + 14}" y2="${ly}" stroke="${color}"/>`;
        for (let ly = bottom - 60; ly >= y; ly -= 12)
          out += `<line x1="${x - 14}" y1="${ly}" x2="${x + 14}" y2="${ly}" stroke="${color}"/>`;
        out += `<ellipse data-part="${v}" data-time="${n.t}" cx="${x}" cy="${y}" rx="8" ry="5.5" transform="rotate(-18 ${x} ${y})" fill="${dur >= 2 ? "#fffef9" : color}" stroke="${color}" stroke-width="1.7"/><line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${tip}" stroke="${color}" stroke-width="1.7"/>`;
        if (dur < 1) {
          let dir = up ? 1 : -1;
          out += `<path d="M ${stemX} ${tip} q ${dir * 19} ${dir * 10} ${dir * 6} ${dir * 24}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
          if (dur < 0.5)
            out += `<path d="M ${stemX} ${tip + dir * 8} q ${dir * 19} ${dir * 10} ${dir * 6} ${dir * 24}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
        }
        if (n.t < win.start)
          out += `<path d="M ${x - 15} ${y + 13} Q ${x - 6} ${y + 20} ${x + 3} ${y + 13}" fill="none" stroke="${color}"/>`;
        if ($("names").checked && v === 3)
          out += text(x, 368, noteName(n.m), 12, color, 'text-anchor="middle"');
      });
  });
  const lyrics = sec.lyrics[Number($("verse").value)].filter(
    (l) => l.t >= win.start && l.t < win.end,
  );
  lyrics.forEach((l) => {
    const active =
        activeSystem &&
        (playback.active || !roundFinished) &&
        l.t >= target.t &&
        l.t < target.t + target.d,
      label = l.text.replace(/^\d+\.\s*/, "") + (l.hyphen ? " -" : "");
    out += text(
      xFor(l.t),
      185,
      label,
      16,
      active ? "#235d42" : "#59645c",
      `text-anchor="middle" font-weight="${active ? 700 : 400}" data-lyric-time="${l.t}"`,
    );
  });
  return `<g transform="translate(0 ${sectionIndex * 390})" data-section="${sectionIndex}">${out}</g>`;
}
function drawHymn() {
  const out = HYMN.sections.map((sec, i) => drawHymnSystem(sec, i)).join("");
  $("staff").setAttribute("viewBox", "0 0 1000 1560");
  $("staff").style.height = "auto";
  $("staff").style.minWidth = "900px";
  $("staff").style.cursor = "pointer";
  $("staff").innerHTML = out;
  $("staff").setAttribute(
    "aria-label",
    "Complete four-part hymn score, all four sections. Soprano and alto share the treble clef; tenor and bass share the bass clef. Selected verse syllables align with every part. Green marks your current bass note.",
  );
  $("progress").textContent = playback.active
    ? `${playback.paused ? "Paused ·" : "Playing"} section ${playback.section + 1} of 4`
    : roundFinished
      ? "Section complete"
      : `Section ${Number($("section").value) + 1} · bass note ${index + 1} of ${notes.length}`;
  $("songWords").textContent =
    "Full hymn · verse " +
    (Number($("verse").value) + 1) +
    " · click a note or lyric to jump. Space pauses/resumes. Soprano/tenor stems up; alto/bass stems down.";
}

function say(a, b) {
  $("message").textContent = a;
  $("detail").textContent = b;
}
function fresh() {
  stop();
  stopReference(false);
  roundFinished = false;
  index = 0;
  hold = 0;
  $("meter").style.width = "0%";
  $("songSettings").hidden = !isHymn();
  $("range").disabled = isHymn();
  if (isHymn()) {
    notes = songSection().tracks[3].map((e) => e.m);
    $("exercise").textContent =
      "Come, Thou Fount · section " + (Number($("section").value) + 1);
    $("next").textContent = "Next section →";
    $("replay").textContent = referenceLabel();
    $("hint").textContent =
      "Full hymn shown below. Sing downward-stem bass notes on the lower staff. Choose a practice section in settings; all four sections remain visible.";
  } else {
    const pool =
      $("range").value === "low" ? scale.slice(0, 6) : scale.slice(3);
    let pos = Math.floor(Math.random() * pool.length);
    notes = [pool[pos]];
    let len = $("mode").value === "single" ? 1 : 4;
    for (let i = 1; i < len; i++) {
      let options = ($("mode").value === "leap" ? [-2, -1, 1, 2] : [-1, 1])
        .map((v) => pos + v)
        .filter((v) => v >= 0 && v < pool.length);
      pos = options[Math.floor(Math.random() * options.length)];
      notes.push(pool[pos]);
    }
    $("exercise").textContent =
      ($("mode").value === "single"
        ? "Single note"
        : $("mode").value === "leap"
          ? "Small leaps"
          : "Stepwise") + " · C major";
    $("next").textContent = "New phrase →";
    $("replay").textContent = "Hear phrase";
    $("hint").textContent =
      "Read from left to right. Hold each note for about half a second.";
  }
  say(
    "Your starting note is " + noteName(notes[0]) + ".",
    "Play the starting note, then start singing when you’re ready.",
  );
  draw();
}
async function audio() {
  ctx ??= new AudioContext();
  await ctx.resume();
}
function tone(m, t, d = 0.65, level = 0.16, upper = false) {
  let osc = ctx.createOscillator(),
    g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq(m);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  osc
    .connect(g)
    .connect(upper && referenceMix ? referenceMix : ctx.destination);
  osc.start(t);
  osc.stop(t + d + 0.03);
  referenceVoices.push(osc);
}
function updateReferenceMix() {
  if (referenceMix)
    referenceMix.gain.setTargetAtTime(
      $("harmony").checked ? Number($("harmonyVolume").value) / 100 : 0,
      ctx.currentTime,
      0.025,
    );
}
function stopReference(announce = true) {
  pausedBeat = null;
  referenceClock = null;
  playback.paused = false;
  referenceRun++;
  clearTimeout(playTimer);
  cancelAnimationFrame(playbackRAF);
  referenceVoices.forEach((o) => {
    try {
      o.stop();
    } catch {}
  });
  referenceVoices = [];
  referenceMix?.disconnect();
  referenceMix = null;
  playing = false;
  playback.active = false;
  $("playbackBar").hidden = true;
  $("replay").textContent = referenceLabel();
  $("startNote").disabled = running;
  if (isHymn()) draw();
  if (announce)
    say(
      "Playback stopped.",
      "Press Play or Space to hear from the selected section, or click a note to start there.",
    );
}
async function play(all, startBeat = 0) {
  if (running) return;
  if (playing) {
    stopReference();
    return;
  }
  startBeat = Math.max(0, Math.min(47.999, Number(startBeat) || 0));
  const token = ++referenceRun;
  playing = true;
  try {
    await audio();
    if (token !== referenceRun) return;
    const startTime = ctx.currentTime + 0.06;
    pausedBeat = null;
    referenceClock = { startTime, startBeat };
    let seconds = 0;
    $("replay").textContent = "■ Stop playback";
    $("startNote").disabled = true;
    if (isHymn() && all) {
      referenceMix = ctx.createGain();
      referenceMix.connect(ctx.destination);
      referenceMix.gain.value = $("harmony").checked
        ? Number($("harmonyVolume").value) / 100
        : 0;
      HYMN.sections.forEach((sec, si) =>
        sec.tracks.forEach((track, v) =>
          track.forEach((n) => {
            const onset = si * 12 + n.t,
              end = onset + n.d;
            if (end > startBeat) {
              const from = Math.max(onset, startBeat);
              tone(
                n.m,
                startTime + (from - startBeat) * 0.65,
                (end - from) * 0.65 * 0.96,
                v === 3 ? 0.16 : 0.12,
                v !== 3,
              );
            }
          }),
        ),
      );
      seconds = (48 - startBeat) * 0.65;
      playback = {
        active: true,
        section: Math.floor(startBeat / 12),
        t: startBeat % 12,
      };
      $("playbackBar").hidden = false;
      $("pausePlayback").textContent = "Ⅱ Pause";
      let lastNoteKey = "",
        lastSection = -1;
      function animate() {
        if (!playing || token !== referenceRun) return;
        const beat =
          startBeat + Math.max(0, (ctx.currentTime - startTime) / 0.65);
        if (beat >= 48) {
          stopReference(false);
          say(
            "Hymn playback complete.",
            "Press Start singing to practice your selected section.",
          );
          return;
        }
        playback.section = Math.min(3, Math.floor(beat / 12));
        playback.t = beat - playback.section * 12;
        const bass = HYMN.sections[playback.section].tracks[3],
          ni = bass.findIndex(
            (n) => n.t <= playback.t && n.t + n.d > playback.t,
          ),
          key = playback.section + ":" + ni;
        if (key !== lastNoteKey) {
          draw();
          lastNoteKey = key;
        }
        const head = $("playhead-" + playback.section);
        if (head)
          head.setAttribute(
            "x",
            scoreX(HYMN.sections[playback.section])(playback.t) - 16,
          );
        $("playbackStatus").textContent =
          "Playing section " + (playback.section + 1) + " of 4";
        if (lastSection !== playback.section) {
          $("staff")
            .querySelector('[data-section="' + playback.section + '"]')
            .scrollIntoView({ behavior: "smooth", block: "center" });
          lastSection = playback.section;
        }
        playbackRAF = requestAnimationFrame(animate);
      }
      playbackRAF = requestAnimationFrame(animate);
      say(
        startBeat > 0
          ? "Playing from your selected note."
          : "Playing the whole hymn.",
        "Click any note or lyric to jump. Space pauses and resumes; Stop ends playback.",
      );
    } else {
      let seq = all ? notes : [notes[0]];
      seq.forEach((n, i) => tone(n, startTime + i * 0.85));
      seconds = seq.length * 0.85;
    }
    playTimer = setTimeout(
      () => {
        if (token !== referenceRun) return;
        stopReference(false);
        if (all)
          say("Playback complete.", "Press Start singing when you’re ready.");
      },
      seconds * 1000 + 200,
    );
  } catch (e) {
    stopReference(false);
    say(
      "Audio could not start.",
      "Try again in a browser that supports Web Audio.",
    );
  }
}
function referenceLabel() {
  return isHymn()
    ? Number($("section").value) === 0
      ? "▶ Hear whole hymn"
      : "▶ Hear from section " + (Number($("section").value) + 1)
    : "Hear phrase";
}
function freezeReference(beat) {
  pausedBeat = beat;
  playback = {
    active: true,
    paused: true,
    section: Math.floor(beat / 12),
    t: beat % 12,
  };
  $("playbackBar").hidden = false;
  $("playbackStatus").textContent =
    "Paused · section " + (playback.section + 1) + " of 4";
  $("pausePlayback").textContent = "▶ Resume";
  $("replay").textContent = "▶ Resume playback";
  draw();
}
function pauseReference() {
  if (!playing || !playback.active || !referenceClock) return;
  const beat = Math.min(
    47.999,
    referenceClock.startBeat +
      Math.max(0, (ctx.currentTime - referenceClock.startTime) / 0.65),
  );
  stopReference(false);
  freezeReference(beat);
  say(
    "Playback paused.",
    "Press Space or Resume to continue from this position.",
  );
}
async function chooseSection(section) {
  const wasPlaying = playing && playback.active,
    wasPaused = pausedBeat !== null;
  $("section").value = String((section + 4) % 4);
  fresh();
  const selected = Number($("section").value);
  if (wasPlaying) {
    await play(true, selected * 12);
  } else if (wasPaused) {
    freezeReference(selected * 12);
    say(
      "Paused at section " + (selected + 1) + ".",
      "Press Space or Resume to continue from the start of this section.",
    );
  } else {
    say(
      "Section " + (selected + 1) + " selected.",
      "Your starting note is " +
        noteName(notes[0]) +
        ". Press Play or Space to hear from here, or Start singing to practice.",
    );
  }
  $("staff")
    .querySelector('[data-section="' + selected + '"]')
    .scrollIntoView({ behavior: "smooth", block: "center" });
}
function nextSection() {
  if (!isHymn()) {
    fresh();
    return;
  }
  const current = playback.active
    ? playback.section
    : Number($("section").value);
  return chooseSection((current + 1) % 4);
}
async function togglePause() {
  if (running || !isHymn()) return;
  if (pausedBeat !== null) {
    const beat = pausedBeat;
    await play(true, beat);
  } else if (playing) pauseReference();
  else await play(true, Number($("section").value) * 12);
}
function playbackKey(event) {
  if (
    (event.code !== "Space" && event.key !== " ") ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !isHymn() ||
    running
  )
    return;
  const target = event.target;
  if (target?.closest?.('input,textarea,select,[contenteditable="true"]'))
    return;
  event.preventDefault();
  if (!event.repeat) togglePause();
}
function nearestScoreBeat(section, x) {
  const sec = HYMN.sections[section],
    xFor = scoreX(sec),
    times = [...new Set(sec.tracks.flatMap((track) => track.map((n) => n.t)))];
  return (
    section * 12 +
    times.reduce(
      (best, t) =>
        Math.abs(xFor(t) - x) < Math.abs(xFor(best) - x) ? t : best,
      times[0],
    )
  );
}
async function seekScore(beat) {
  if (!isHymn()) return;
  if (running) {
    say(
      "Pause singing to listen.",
      "Press Pause, then click the note you want to hear.",
    );
    return;
  }
  stopReference(false);
  await play(true, beat);
}
function scoreClick(event) {
  if (!isHymn()) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      $("staff").getScreenCTM().inverse(),
    ),
    section = Math.floor(point.y / 390);
  if (section < 0 || section >= 4 || point.x < 155 || point.x > 980) return;
  const direct = event.target.closest("[data-time], [data-lyric-time]"),
    time = direct
      ? Number(
          direct.getAttribute("data-time") ??
            direct.getAttribute("data-lyric-time"),
        )
      : null,
    beat =
      time !== null ? section * 12 + time : nearestScoreBeat(section, point.x);
  seekScore(beat);
}
function harmonyNotes(m) {
  const major = [0, 2, 4, 5, 7, 9, 11],
    oct = Math.floor(m / 12),
    degree = major.indexOf(m % 12);
  return [9, 11].map(
    (steps) =>
      12 * (oct + Math.floor((degree + steps) / 7)) +
      major[(degree + steps) % 7],
  );
}
function harmonyLevel() {
  return (Number($("harmonyVolume").value) / 100) * 0.12;
}
function hushHarmony() {
  harmonyTimers.forEach(clearTimeout);
  harmonyTimers = [];
  if (ctx) {
    for (const voice of harmonyVoices) {
      const t = ctx.currentTime;
      voice.g.gain.cancelScheduledValues(t);
      voice.g.gain.setTargetAtTime(0, t, 0.02);
      voice.osc.stop(t + 0.12);
    }
  }
  harmonyVoices = [];
}
function soundHarmony(upper) {
  if (ctx) {
    for (const v of harmonyVoices) {
      v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      v.osc.stop(ctx.currentTime + 0.12);
    }
  }
  harmonyVoices = [];
  upper.forEach((m) => {
    const osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq(m);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(harmonyLevel(), ctx.currentTime + 0.08);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    harmonyVoices.push({ osc, g });
  });
  $("harmonyStatus").textContent =
    "Playing · " + upper.map(noteName).join(" + ");
}
function upperAt(t) {
  return songSection()
    .tracks.slice(0, 3)
    .flatMap((track) => {
      let n = track.find((n) => n.t <= t + 1e-6 && n.t + n.d > t + 1e-6);
      return n ? [n.m] : [];
    });
}
function syncHarmony() {
  hushHarmony();
  const enabled = $("harmony").checked;
  if (!enabled || !running || roundFinished) {
    $("harmonyStatus").textContent = enabled
      ? "On · starts when you sing"
      : "Off · bass practice on your own";
    return;
  }
  if (isHymn()) {
    const target = songSection().tracks[3][index];
    soundHarmony(upperAt(target.t));
    const changes = [
      ...new Set(
        songSection()
          .tracks.slice(0, 3)
          .flatMap((track) =>
            track
              .filter((n) => n.t > target.t && n.t < target.t + target.d)
              .map((n) => n.t),
          ),
      ),
    ];
    changes.forEach((t) =>
      harmonyTimers.push(
        setTimeout(
          () => {
            if (running && $("harmony").checked) soundHarmony(upperAt(t));
          },
          (t - target.t) * 650,
        ),
      ),
    );
  } else soundHarmony(harmonyNotes(notes[index]));
}
function detect(buf, sr) {
  let rms = 0;
  for (const a of buf) rms += a * a;
  if (Math.sqrt(rms / buf.length) < 0.012) return null;
  let best = 0,
    lag = 0;
  let lo = Math.floor(sr / 500),
    hi = Math.min(Math.floor(sr / 65), buf.length / 2);
  for (let k = lo; k <= hi; k++) {
    let c = 0,
      a = 0,
      b = 0;
    for (let j = 0; j < buf.length - hi; j++) {
      c += buf[j] * buf[j + k];
      a += buf[j] ** 2;
      b += buf[j + k] ** 2;
    }
    let v = c / Math.sqrt(a * b || 1);
    if (v > best) {
      best = v;
      lag = k;
    }
    if (v > 0.92 && v < best - 0.005 && lag) break;
  }
  if (best < 0.8 || !lag) return null;
  return sr / lag;
}
function stop() {
  running = false;
  syncHarmony();
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $("listen").textContent = "● Start singing";
  $("startNote").disabled = false;
  $("replay").disabled = false;
  $("pitch").textContent = "—";
  $("cents").textContent = "Microphone off";
  hold = 0;
}
async function start() {
  if (pausedBeat !== null) stopReference(false);
  if (running) {
    stop();
    say(
      "Practice paused.",
      "Press Start singing to continue with the highlighted note.",
    );
    return;
  }
  if (playing) {
    say(
      "Let the reference finish.",
      "Start singing after the reference tone ends.",
    );
    return;
  }
  if (roundFinished) {
    fresh();
  }
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error("unsupported");
    await audio();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: $("speakerMode").checked,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const echoEnabled = stream
      .getAudioTracks()[0]
      ?.getSettings?.().echoCancellation;
    $("echoStatus").textContent = $("speakerMode").checked
      ? echoEnabled === true
        ? "Microphone echo cancellation is on"
        : echoEnabled === false
          ? "Echo cancellation is unavailable; use very low harmony volume"
          : "Echo cancellation requested; browser does not report its status"
      : "Headphone mode · echo cancellation off";
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    ctx.createMediaStreamSource(stream).connect(analyser);
    running = true;
    syncHarmony();
    $("listen").textContent = "■ Pause";
    $("startNote").disabled = true;
    $("replay").disabled = true;
    say(
      "Listening for the highlighted note…",
      "Sing naturally and hold each note for about half a second.",
    );
    last = performance.now();
    const buf = new Float32Array(analyser.fftSize);
    function tick(now) {
      if (!running) return;
      let dt = Math.min(now - last, 100);
      last = now;
      analyser.getFloatTimeDomainData(buf);
      let f = detect(buf, ctx.sampleRate);
      if (f) {
        const midi = 69 + 12 * Math.log2(f / 440),
          nearest = Math.round(midi),
          delta = 100 * (midi - notes[index]);
        $("pitch").textContent = noteName(nearest);
        $("cents").textContent =
          (delta > 0 ? "+" : "") + Math.round(delta) + " cents from target";
        if (Math.abs(delta) < Number($("tolerance").value)) {
          hold += dt;
          say("On pitch — hold it…", "Keep your voice steady.");
        } else {
          hold = 0;
          say(
            delta > 0 ? "A little lower ↓" : "A little higher ↑",
            Math.abs(delta) > 150
              ? "Check the highlighted note. You can pause and replay the starting pitch."
              : "Move gently toward the target pitch.",
          );
        }
      } else {
        hold = 0;
        $("pitch").textContent = "—";
        $("cents").textContent = "Waiting for a clear tone";
      }
      $("meter").style.width = Math.min(100, (hold / 500) * 100) + "%";
      if (hold >= 500) {
        index++;
        hold = 0;
        if (index >= notes.length) {
          roundFinished = true;
          done++;
          try {
            localStorage.setItem("bassline-completed", done);
          } catch {}
          $("stats").textContent = done + " phrases completed";
          stop();
          say(
            isHymn()
              ? "Hymn section complete. Nicely sung!"
              : "Phrase complete. Nicely sung!",
            isHymn()
              ? "Choose Next section to continue the hymn, or Start singing to repeat this section."
              : "You matched every note. Choose New phrase for another round.",
          );
          draw();
          return;
        }
        syncHarmony();
        draw();
        say("Good. Now the next note.", "Follow the highlighted note.");
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  } catch (e) {
    stop();
    say(
      "Microphone is unavailable.",
      e.name === "NotAllowedError"
        ? "Allow microphone access in your browser settings, then try again."
        : "Try opening the game in a current browser over HTTPS. Reference notes still work.",
    );
  }
}
$("staff").onclick = scoreClick;
$("startNote").onclick = () => play(false);
$("replay").onclick = () =>
  pausedBeat !== null
    ? togglePause()
    : play(true, isHymn() ? Number($("section").value) * 12 : 0);
$("pausePlayback").onclick = togglePause;
document.addEventListener("keydown", playbackKey);
$("stopPlayback").onclick = () => stopReference();
$("listen").onclick = start;
$("next").onclick = nextSection;
$("nextPlayback").onclick = nextSection;
$("section").onchange = () => chooseSection(Number($("section").value));
$("verse").onchange = draw;
["mode", "range"].forEach((id) => ($(id).onchange = fresh));
$("names").onchange = draw;
$("harmony").onchange = () => {
  hold = 0;
  syncHarmony();
  updateReferenceMix();
};
$("speakerMode").onchange = () => {
  const wasRunning = running;
  if (wasRunning) stop();
  $("echoStatus").textContent = $("speakerMode").checked
    ? "Speaker mode · echo cancellation requested at microphone start"
    : "Headphone mode · echo cancellation off";
  if (wasRunning)
    say(
      "Microphone setting changed.",
      "Press Start singing to restart with the new audio setting.",
    );
};
$("harmonyVolume").oninput = () => {
  updateReferenceMix();
  for (const voice of harmonyVoices)
    voice.g.gain.setTargetAtTime(harmonyLevel(), ctx.currentTime, 0.03);
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) stopReference();
  if (document.hidden && running) {
    stop();
    say("Practice paused.", "Return and press Start singing to continue.");
  }
});
try {
  done = Number(localStorage.getItem("bassline-completed")) || 0;
} catch {}
$("stats").textContent = done + " phrases completed";
fresh();
