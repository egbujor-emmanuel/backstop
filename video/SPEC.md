# BACKSTOP walkthrough — spec

GOAL: anyone, crypto-native or not, finishes knowing what BACKSTOP is and the five steps to use it, and has
seen each step happen in the real app with real Mezo testnet transactions.

OUTPUT: HyperFrames, 1920 × 1080, 30 fps. Narrated (Kokoro am_michael, local), burned-in captions.

TIME: about 112 s (each scene = 0.5 s lead + its voice line + 0.7 s tail; end card holds 2.5 s after its
line). Under 2:00, the AKINDO rule; judges capped Materials above about 2:15.

LOOK: the product itself is the world. Real footage of the live app fills the whole frame (recorded at a
1920 × 1080 viewport with the page zoomed 1.5×, so UI text is readable).
- Ground: the app's own ink #0b0d0c. Ink text #ecebe4. One accent, amber #f5a524, only on: the step
  number, the hook number, the end-card word "covered."
- Material: the app's diagonal hazard stripe (amber/transparent, 10 px bands at −45°), used as an 8 px bar
  on the step label and as the end-card wipe. No glow, no gradients.
- Display: Instrument Serif 400 (self-hosted woff2). Hook number 220 px, end-card line 120 px, tracking −1%.
- Body: Inter 500 34 px captions, line-height 1.25, on an ink panel at 86% opacity with 18 px radius,
  inside title-safe (bottom edge 108 px above the frame). Step label: JetBrains Mono 22 px uppercase,
  tracking 0.16 em.

OBJECTS: the BACKSTOP app pages (Replay, Home, wallet menu, Get cover, Underwrite, Claims, Proof), the
hazard stripe, the BACKSTOP wordmark (end card only).

MOTION: footage cuts hard on the scene boundary (the voice is the clock). Step label: x −40 → 0 and
opacity 0 → 1 over 12 frames, power3.out, 0.15 s into the scene; it holds still while read. Captions:
opacity 0 → 1 over 4 frames, no movement. Hook number: scale 1.12 → 1 and opacity 0 → 1 over 10 frames,
power4.out. End card: stripe scaleX 0 → 1 over 18 frames from the left, wordmark y 30 → 0 over 14 frames,
line 6 frames later.

SHOTS:
1. Replay (s1): the 37 drained positions scroll by; "$472,476" lands over them; voice: the October 5 loss.
2. Home (s2): the headline and pool numbers; voice: what BACKSTOP is.
3. Connect (s3): the wallet menu opens (Installed / Not installed), the browser wallet connects; label STEP 1.
4. Buy (s4): pick the Tigris product, type 10 MUSD and 30 days, the live price appears, buy confirms, the
   policy shows in "Your policies"; label STEP 2.
5. Underwrite (s5): type 20, approve and deposit confirm, the position updates; label STEP 3.
6. Claim (s6): the claim form: policy, amount, evidence link, bond; label STEP 4.
7. Court (s7): decided claims: rejected, approved and paid, the veBTC claim; label STEP 5.
8. Proof (s8): Sourcify-verified contracts and the transaction list.
9. End card (s9): stripe wipe, BACKSTOP, "When Mezo has a bad day, you're covered.", the live URL.

BANNED: a dark void with small things floating (the footage fills the frame); glow, particles, gradients,
glass; three cards in a row; the logo docked in a corner; captions that move while read; text repeating
the narration word for word on top of captions; synthetic tones.

QA: frames at the middle of every scene: footage fills the frame, the label and caption sit inside
title-safe and never cover the element the voice is talking about; the hook number at s1 + 1.5 s; the end
card at its last second.
