"""Builds the BACKSTOP walkthrough composition from the real footage, voice and captions.

  python build.py

Reads narration.json, assets/voice/sN.wav and assets/raw/{walkthrough.mp4,marks.json}. Cuts one clip per
scene from the recording and retimes it to that scene's length (waits on transactions run faster; a short
segment holds its last frame instead of playing in slow motion). Writes assets/clips/sN.mp4 and index.html
from template.hf. Scene length = LEAD + voice + TAIL, so the voice is the clock.
"""
import html
import json
import pathlib
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
LEAD, TAIL, END_HOLD = 0.5, 0.7, 2.5
MAX_SPEED = 3.2
STEP_LABELS = {"s3": "Step 1 · Connect", "s4": "Step 2 · Buy cover", "s5": "Step 3 · Underwrite",
               "s6": "Step 4 · File a claim", "s7": "Step 5 · veMEZO holders decide", "s8": "Check it yourself"}


def duration(path: pathlib.Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def chunk(words: list[str], size: int = 8) -> list[list[str]]:
    groups = [words[i:i + size] for i in range(0, len(words), size)]
    if len(groups) > 1 and len(groups[-1]) <= 2:
        groups[-2].extend(groups.pop())
    return groups


def cut_clip(src: pathlib.Path, start: float, end: float, target: float, out: pathlib.Path) -> float:
    """Cuts [start, end) and fits it to `target` seconds. Returns the speed used."""
    seg = max(0.1, end - start)
    speed = min(MAX_SPEED, max(1.0, seg / target))
    used = seg / speed
    vf = f"setpts=PTS/{speed:.4f}"
    if used < target:  # hold the last frame instead of slowing down
        vf += f",tpad=stop_mode=clone:stop_duration={target - used + 0.1:.3f}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{seg:.3f}", "-i", str(src),
                    "-vf", vf + ",fps=30,format=yuv420p", "-t", f"{target:.3f}", "-an",
                    "-c:v", "libx264", "-crf", "17", "-preset", "medium", str(out)], check=True)
    return speed


def main() -> None:
    narration = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
    marks = json.loads((HERE / "assets/raw/marks.json").read_text(encoding="utf-8"))["marks"]
    mark_t = {m["id"]: m["t"] for m in marks}
    order = [m["id"] for m in marks]
    raw = HERE / "assets/raw/walkthrough.mp4"
    (HERE / "assets/clips").mkdir(parents=True, exist_ok=True)

    t = 0.0
    videos, audios, labels, captions, tweens = [], [], [], [], []
    report = []
    z = 1
    for scene in narration["scenes"]:
        sid = scene["id"]
        voice = HERE / f"assets/voice/{sid}.wav"
        vdur = duration(voice)
        is_end = sid == "s9"
        dur = round(LEAD + vdur + (END_HOLD if is_end else TAIL), 3)

        if not is_end:
            nxt = order[order.index(sid) + 1]
            speed = cut_clip(raw, mark_t[sid], mark_t[nxt], dur, HERE / f"assets/clips/{sid}.mp4")
            report.append(f"{sid}: {dur:.2f}s from {mark_t[nxt] - mark_t[sid]:.1f}s of footage at {speed:.2f}x")
            videos.append(
                f'<video id="v-{sid}" class="clip footage" data-start="{t:.3f}" data-duration="{dur:.3f}" '
                f'data-track-index="1" muted playsinline src="assets/clips/{sid}.mp4"></video>')
        audios.append(
            f'<audio id="voice-{sid}" class="clip" data-start="{t + LEAD:.3f}" data-duration="{vdur:.3f}" '
            f'data-track-index="2" data-volume="1" src="assets/voice/{sid}.wav"></audio>')

        if sid in STEP_LABELS:
            label = STEP_LABELS[sid]
            num, _, rest = label.partition(" · ")
            inner = (f'<span class="label-num">{html.escape(num)}</span><span class="label-sep">·</span>'
                     f'<span>{html.escape(rest)}</span>') if rest else f'<span>{html.escape(label)}</span>'
            labels.append(
                f'<div id="label-{sid}" class="clip label-host" data-start="{t:.3f}" data-duration="{dur:.3f}" data-track-index="3">'
                f'<div id="label-{sid}-in" class="label"><i class="label-stripe"></i>{inner}</div></div>')
            tweens.append(f'tl.fromTo("#label-{sid}-in", {{x: -40, opacity: 0}}, {{x: 0, opacity: 1, duration: 0.4, ease: "power3.out"}}, {t + 0.15:.3f});')

        if not is_end:
            words = scene["caption"].split()
            groups = chunk(words)
            c0 = t + LEAD
            per_word = vdur / len(words)
            for gi, g in enumerate(groups):
                gdur = per_word * len(g)
                cid = f"cap-{sid}-{gi}"
                captions.append(
                    f'<div id="{cid}" class="clip cap-host" data-start="{c0:.3f}" data-duration="{gdur:.3f}" data-track-index="4">'
                    f'<p id="{cid}-in" class="cap">{html.escape(" ".join(g))}</p></div>')
                tweens.append(f'tl.fromTo("#{cid}-in", {{opacity: 0}}, {{opacity: 1, duration: 0.13, ease: "none"}}, {c0:.3f});')
                c0 += gdur
        if sid == "s1":
            tweens.append(f'tl.fromTo("#hook-num", {{scale: 1.12, opacity: 0}}, {{scale: 1, opacity: 1, duration: 0.33, ease: "power4.out"}}, {t + 1.2:.3f});')
            hook = (f'<div id="hook" class="clip hook-host" data-start="{t:.3f}" data-duration="{dur:.3f}" data-track-index="5">'
                    f'<p id="hook-num" class="hook-num">$472,476</p></div>')
        if is_end:
            end = (f'<div id="endcard" class="clip end-host" data-start="{t:.3f}" data-duration="{dur:.3f}" data-track-index="6">'
                   '<div id="end-stripe" class="end-stripe"></div>'
                   '<p id="end-mark" class="end-mark">BACKSTOP</p>'
                   '<p id="end-line" class="end-line">When Mezo has a bad day, you\'re <em>covered.</em></p>'
                   '<p id="end-url" class="end-url">backstop-pearl.vercel.app · live on Mezo testnet</p></div>')
            tweens += [
                f'tl.fromTo("#end-stripe", {{scaleX: 0}}, {{scaleX: 1, duration: 0.6, ease: "power3.inOut"}}, {t + 0.05:.3f});',
                f'tl.fromTo("#end-mark", {{y: 30, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.47, ease: "power3.out"}}, {t + 0.35:.3f});',
                f'tl.fromTo("#end-line", {{y: 30, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.47, ease: "power3.out"}}, {t + 0.55:.3f});',
                f'tl.fromTo("#end-url", {{opacity: 0}}, {{opacity: 1, duration: 0.3, ease: "none"}}, {t + 1.0:.3f});',
            ]
        t = round(t + dur, 3)
        z += 1

    template = (HERE / "template.hf").read_text(encoding="utf-8")
    out = (template.replace("{{TOTAL}}", f"{t:.3f}")
           .replace("{{VIDEOS}}", "\n      ".join(videos))
           .replace("{{AUDIOS}}", "\n      ".join(audios))
           .replace("{{LABELS}}", "\n      ".join(labels))
           .replace("{{CAPTIONS}}", "\n        ".join(captions))
           .replace("{{HOOK}}", hook)
           .replace("{{END}}", end)
           .replace("{{TWEENS}}", "\n      ".join(tweens)))
    (HERE / "index.html").write_text(out, encoding="utf-8", newline="\n")
    print("\n".join(report))
    print(f"total {t:.2f}s")


if __name__ == "__main__":
    main()
