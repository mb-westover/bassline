#!/usr/bin/env python3
"""Rebuild hymn.js from the scores listed in scores/catalog.json.

Handles two-staff, four-part hymn scores: soprano and alto on the treble staff,
tenor and bass on the bass staff. The upper and lower line of each staff are
read by sounding pitch, so a score whose voices cross, or that isn't laid out
this way, needs checking by ear. Standard library only.

    python3 scripts/convert_scores.py
"""
import json
import pathlib
import xml.etree.ElementTree as E

ROOT = pathlib.Path(__file__).resolve().parents[1]
STEPS = dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11)
ACCIDENTALS = {"sharp": "♯", "flat": "♭", "natural": "♮"}


def read_part(part, is_lyric_part, lyrics, bars):
    """Return a part's note events, in quarter notes from the start of the score."""
    events, base, div = [], 0, 256
    for measure in part.findall("measure"):
        number = measure.get("number")
        if is_lyric_part:
            bars.append(dict(t=base, measure=int(number)))
        pos = last = end = 0
        for child in measure:
            if child.tag == "attributes":
                div = int(child.findtext("divisions", str(div)))
            elif child.tag == "backup":
                pos -= int(child.findtext("duration")) / div
            elif child.tag == "forward":
                pos += int(child.findtext("duration")) / div
            elif child.tag == "note":
                d = int(child.findtext("duration", "0")) / div
                if child.find("chord") is not None:
                    t = last
                else:
                    t = pos
                    last = t
                    pos += d
                end = max(end, t + d)
                pitch = child.find("pitch")
                if pitch is not None:
                    step = pitch.findtext("step")
                    alter = int(pitch.findtext("alter", "0"))
                    octave = int(pitch.findtext("octave"))
                    event = dict(
                        t=base + t, d=d, m=12 * (octave + 1) + STEPS[step] + alter,
                        step=step, alter=alter, octave=octave, measure=int(number),
                    )
                    sign = ACCIDENTALS.get(child.findtext("accidental"))
                    if sign:
                        event["acc"] = sign
                    ties = {tie.get("type") for tie in child.findall("tie")}
                    event["tie_start"] = "start" in ties
                    event["tie_stop"] = "stop" in ties
                    events.append(event)
                if is_lyric_part:
                    for lyric in child.findall("lyric"):
                        lyrics.setdefault(lyric.get("number"), []).append(dict(
                            t=base + t, text=lyric.findtext("text", ""),
                            hyphen=lyric.findtext("syllabic", "single") in ("begin", "middle"),
                        ))
        base += end
    return merge_ties(events), base


def merge_ties(events):
    """Join tied notes into one held note, so playback doesn't re-strike them."""
    merged = []
    for event in sorted(events, key=lambda e: (e["t"], e["m"])):
        previous = next(
            (e for e in reversed(merged)
             if e["m"] == event["m"] and e["tie_start"] and abs(e["t"] + e["d"] - event["t"]) < 1e-6),
            None,
        )
        if event["tie_stop"] and previous:
            previous["d"] += event["d"]
            previous["tie_start"] = event["tie_start"]
        else:
            merged.append(event)
    for event in merged:
        del event["tie_start"], event["tie_stop"]
    return merged


def line(events, lower):
    """Read a staff's lower or upper sounding line. Keep an event's identity
    across changes in the other voice, so held notes remain held."""
    times = sorted({e["t"] for e in events} | {e["t"] + e["d"] for e in events})
    out, identity = [], None
    for a, b in zip(times, times[1:]):
        active = [e for e in events if e["t"] <= a < e["t"] + e["d"]]
        if not active:
            continue
        chosen = (min if lower else max)(active, key=lambda e: e["m"])
        ident = (chosen["t"], chosen["m"])
        if ident == identity and abs(out[-1]["t"] + out[-1]["d"] - a) < 1e-6:
            out[-1]["d"] += b - a
        else:
            out.append(dict(chosen, t=a, d=b - a))
            identity = ident
    return out


def verse_label(number, syllables):
    words, word = [], ""
    for syllable in syllables:
        word += syllable["text"]
        if not syllable["hyphen"]:
            words.append(word)
            word = ""
        if len(words) == 5:
            break
    return f"Verse {number} · " + " ".join(words).lstrip("0123456789. ").rstrip(",;:.!")


def convert(entry):
    root = E.parse(ROOT / "scores" / entry["file"]).getroot()
    lyrics, bars, parts, total = {}, [], {}, 0
    for part in root.findall("part"):
        parts[part.get("id")], total = read_part(part, part.get("id") == "P1", lyrics, bars)
    tracks = [line(parts["P1"], False), line(parts["P1"], True), line(parts["P2"], False), line(parts["P2"], True)]

    # Lyrics numbered "...verse0" are shared by every verse (e.g. a refrain). So
    # are any stretches the catalog lists under shared_lyrics: some scores print
    # a refrain's words once, under a single verse's number.
    shared = [l for key, ls in lyrics.items() if key.endswith("verse0") for l in ls]
    for extra in entry.get("shared_lyrics", []):
        shared += [l for l in lyrics[extra["number"]] if extra["start"] <= l["t"] < extra["end"]]
    verses = [
        sorted(ls + [l for l in shared if not any(l is x for x in ls)], key=lambda l: l["t"])
        for key, ls in lyrics.items() if not key.endswith("verse0")
    ]

    starts = entry["section_starts"]
    assert starts[0] == 0 and all(0 < b - a for a, b in zip(starts, starts[1:] + [total])), starts
    sections = []
    for i, a in enumerate(starts):
        b = starts[i + 1] if i + 1 < len(starts) else total

        def cut(track):
            return [
                dict(e, t=max(a, e["t"]) - a, d=min(b, e["t"] + e["d"]) - max(a, e["t"]))
                for e in track if e["t"] < b and e["t"] + e["d"] > a
            ]

        sections.append(dict(
            title=entry["section_titles"][i], start=a, beats=b - a,
            bars=[dict(bar, t=bar["t"] - a) for bar in bars if a <= bar["t"] < b],
            tracks=[cut(t) for t in tracks],
            lyrics=[[dict(l, t=l["t"] - a) for l in ls if a <= l["t"] < b] for ls in verses],
        ))
    attributes = root.find("part/measure/attributes")
    beats, beat_type = attributes.findtext("time/beats"), attributes.findtext("time/beat-type")
    print(entry["id"], "· beats", total, "· SATB notes", [len(t) for t in tracks], "· verses", len(verses),
          "· bass range", min(e["m"] for e in tracks[3]), max(e["m"] for e in tracks[3]))
    return dict(
        id=entry["id"], title=entry["title"], short_title=entry["short_title"], tune=entry["tune"],
        key=entry["key_label"], fifths=int(attributes.findtext("key/fifths")),
        meter=f"{beats}/{beat_type}", meter_top=beats, meter_bottom=beat_type,
        seconds_per_quarter=entry["seconds_per_quarter"], source=entry["source"],
        total_beats=total, default_verse=entry.get("default_verse", 0),
        verses=[verse_label(i + 1, v) for i, v in enumerate(verses)], sections=sections,
    )


def main():
    catalog = json.loads((ROOT / "scores/catalog.json").read_text())
    hymns = [convert(e) for e in catalog["scores"] if e.get("playable_in_app")]
    (ROOT / "hymn.js").write_text(
        "const HYMNS=" + json.dumps(hymns, separators=(",", ":"), ensure_ascii=False)
        + ";\nlet HYMN=HYMNS[0];\n"
    )


if __name__ == "__main__":
    main()
