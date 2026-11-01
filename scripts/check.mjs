import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'hymn.js'), 'utf8');
new vm.Script(app);
new vm.Script(data);
for (const asset of ['styles.css', 'app.js', 'hymn.js']) {
  assert(html.includes(asset), `HTML must load ${asset}`);
  assert(fs.existsSync(path.join(root, asset)));
}
assert(fs.existsSync(path.join(root, 'scores/come-thou-fount.musicxml')));
const elements = new Map();
let audio;
let scheduled = 0;
let cancelled = 0;
let scrolls = 0;
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: id === 'mode' ? 'hymn' : id === 'section' ? '0' : id === 'verse' ? '1' : '15',
    checked: false,
    style: {},
    setAttribute(key, value) { this[key] = value; },
    querySelector() { return { scrollIntoView() { scrolls++; } }; },
  });
  return elements.get(id);
}
class AudioContextMock {
  currentTime = 0;
  destination = {};
  constructor() { audio = this; }
  async resume() {}
  createOscillator() {
    return {
      frequency: {}, connect() { return this; },
      start() { scheduled++; },
      stop(time) { if (time === undefined) cancelled++; },
      disconnect() {},
    };
  }
  createGain() {
    return {
      gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; },
        cancelScheduledValues() {}, },
      connect() { return this; }, disconnect() {},
    };
  }
}
const listeners = {};
const sandbox = {
  document: { getElementById: element, addEventListener(type, callback) { listeners[type] = callback; } },
  localStorage: { getItem() { return 0; } },
  cancelAnimationFrame() {}, requestAnimationFrame() { return 1; },
  setTimeout() { return 1; }, clearTimeout() {}, AudioContext: AudioContextMock,
  URLSearchParams,
};
vm.createContext(sandbox);
vm.runInContext(data + '\n' + app, sandbox);
const run = (source) => vm.runInContext(source, sandbox);
assert.equal(run('HYMN.sections.length'), 4);
assert.equal(run('HYMN.sections.flatMap(s => s.tracks.flat()).length'), 244);
assert.equal((element('staff').innerHTML.match(/data-section=/g) || []).length, 4);
assert.equal((element('staff').innerHTML.match(/data-lyric-time=/g) || []).length, 60);
assert(element('staff').innerHTML.includes('Eb -'));

await run('play(true)');
assert.equal(scheduled, 244);
audio.currentTime = 4.222;
run('pauseReference()');
const pauseBeat = run('pausedBeat');
assert(Math.abs(pauseBeat - (4.222 - 0.06) / 0.65) < 1e-9);
assert.equal(cancelled, 244);
audio.currentTime = 20;
await run('togglePause()');
assert.equal(run('referenceClock.startBeat'), pauseBeat);
assert.equal(run('pausedBeat'), null);
await run('seekScore(25.5)');
assert.equal(run('playback.section'), 2);
assert.equal(run('referenceClock.startBeat'), 25.5);
await run('seekScore(1)');
assert.equal(run('playback.section'), 0);
run('stopReference(false)');
await element('next').onclick();
assert.equal(element('section').value, '1');
assert.equal(element('replay').textContent, '▶ Hear from section 2');
await element('replay').onclick();
assert.equal(run('referenceClock.startBeat'), 12);
await element('nextPlayback').onclick();
assert.equal(run('referenceClock.startBeat'), 24);
run('pauseReference()');
await element('next').onclick();
assert.equal(run('pausedBeat'), 36);
assert.equal(run('playing'), false);
await run('togglePause()');
await element('next').onclick();
assert.equal(element('section').value, '0');
assert.equal(run('referenceClock.startBeat'), 0);
assert(scrolls >= 4);
run('stopReference(false)');
assert.equal(cancelled, scheduled);
let prevented = false;
listeners.keydown({ code: 'Space', target: { closest() { return true; } },
  preventDefault() { prevented = true; } });
assert.equal(prevented, false, 'Space should retain normal behavior in form inputs');
element('mode').value = 'step';
element('mode').onchange();
assert.equal(run('notes.length'), 4);
assert.equal(element('staff').viewBox, '0 0 640 200');

// Second hymn: different length, section count, meter, key and tempo.
element('mode').value = 'hymn';
element('mode').onchange();
element('song').value = '1';
element('song').onchange();
assert.equal(run('HYMN.id'), 'all-creatures');
assert.equal(run('HYMN.sections.length'), 8);
assert.equal(run('HYMN.total_beats'), 96);
assert.equal((element('staff').innerHTML.match(/data-section=/g) || []).length, 8);
assert.equal(element('staff').viewBox, '0 0 1000 3120');
assert(element('staff').innerHTML.includes('♯'), 'D major key signature');
assert(element('staff').innerHTML.includes('Section 1 · D major · 3/2'));
assert.equal(run('noteName(66)'), 'F♯4');
const songStart = audio.currentTime;
await run('play(true)');
audio.currentTime = songStart + 9;
run('pauseReference()');
assert(Math.abs(run('pausedBeat') - (9 - 0.06) / 0.45) < 1e-9, 'tempo comes from the hymn');
await run('seekScore(61)');
assert.equal(run('playback.section'), 5);
assert.equal(run('playback.t'), 1);
run('stopReference(false)');
assert.equal(run('sectionAtBeat(95.9)'), 7);
await run('chooseSection(7)');
assert.equal(element('section').value, '7');
await element('next').onclick();
assert.equal(element('section').value, '0');
// Refrain words printed under one verse appear under every verse.
for (let verse = 0; verse < 5; verse++)
  assert(run(`HYMN.sections[5].lyrics[${verse}].some((l) => l.text === 'praise')`));
element('song').value = '0';
element('song').onchange();
assert.equal(run('HYMN.id'), 'come-thou-fount');
assert.equal(element('verse').value, '1');
assert.equal(run('noteName(63)'), 'E♭4');
console.log('Passed: assets, full score and lyrics, playback, seeking, exact pause/resume, section navigation, cleanup, exercise fallback, and switching hymns.');
