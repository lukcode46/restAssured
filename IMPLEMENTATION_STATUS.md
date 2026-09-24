# Rest Assured implementation status

Updated: September 24, 2026.

## What is now true

A working local-first V1 prototype exists in this folder. The user-facing flow is now simplified to **Agree → Cover → Reflect**, with aliases and privacy controls moved into Settings. It still implements the full narrow hackathon mechanism: versioned team covenant, rotation coverage with explicit acceptance and minimal handover, one team-level reflection, print output, local encryption, encrypted backup, inactivity lock, and fictional pitch data.

The prototype can run without any backend, account, cloud model, analytics service, or third-party JavaScript dependency.

## Claims that can be made in the pitch now

- “We built a working local prototype that helps a team agree on protected rest, assign accepted coverage, and reflect on whether the plan held.”
- “Core use does not require an internet connection after the static app shell is available.”
- “The prototype stores its team vault as encrypted ciphertext in this browser and unlocks it with a local passphrase.”
- “Aliases are the default, and the demo uses only fictional Cedar/Birch/Ash data.”
- “Coverage is visibly proposed until acceptance; the app blocks overlapping accepted coverage for the same receiver.”
- “The printable rota includes period and revision.”
- “The prototype records one optional shared team pulse, not individual mood or engagement data.”
- “There is no cloud sync, chat, SMS, ad/analytics SDK, or runtime AI call in this build.”

## Claims that should still not be made

- Do not call the prototype secure for surveilled activists or claim it has no attack surface.
- Do not claim peer-to-peer synchronization, on-device AI inference, secure cloud AI processing, or multi-device revocation/recovery.
- Do not claim a completed external security review, usability study, field pilot, partner commitment, curriculum license, or validated market demand.
- Do not call small-team pulse data anonymous.
- Do not claim the app prevents burnout or guarantees recovery.
- Do not claim Evan’s unfinished manuscript or unwritten Shifts 6–7 are included.

## Next work before a real pilot

1. Nontechnical facilitator usability test for covenant + first rota.
2. Security/threat-model review with a reviewer familiar with the actual user population.
3. Target-device validation of browser persistence, storage clearing, backup behavior, passphrase performance, and memory exposure.
4. Pilot protocol with three trained team leaders plus a security reviewer, if those participants are actually recruited.
5. Measure at the team level: whether the rota held, time to first mutually acknowledged protected rest window, qualitative essentiality language, and whether coverage created new burden.
6. Decide whether multi-device use is necessary. Only then design pairing/authentication/encryption/revocation/recovery and explicit conflict resolution.
7. Establish written curriculum licensing terms before shipping any approved Evan content.
