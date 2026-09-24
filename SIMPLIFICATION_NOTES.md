# Rest Assured UX simplification notes

Updated September 24, 2026.

## Goal

Reduce cognitive load without turning Rest Assured into a generic wellness tracker or removing the structural idea that makes the project distinct.

## Simplified

1. **Six primary destinations became four:** Home, Agreement, Coverage, Reflect.
2. **Aliases and local-data/security controls moved into Settings.** They remain available, but are not part of the daily mental model.
3. **The dashboard became a guided Home screen** with one recommended next action and the three-step journey: Agree → Cover → Reflect.
4. **“Covenant ceremony” is presented as “Team agreement”** in the main UI, while the underlying covenant concept and versioned adoption are preserved.
5. **“Rotation rota” is presented as “Coverage.”** The schedule still represents rotation over time and retains the same data model.
6. **A first coverage period can be created in one click** as “Next 7 days”; custom dates remain available.
7. **New coverage no longer asks the user to choose an internal state.** It starts as a proposal. Acceptance remains a separate explicit action.
8. **Handover fields are collapsed by default.** All four minimum fields still exist, but teams only open them when needed.
9. **Advanced security explanations are progressive-disclosure details** instead of front-page warnings. The security boundary itself has not been weakened.
10. **Terminology was made more conversational:** “Who is resting?”, “Who will cover?”, “Needs change”, and “Pause work.”

## Deliberately preserved

- The team, not the individual, remains the unit of adoption.
- Rest is supported by a team-approved agreement plus actual coverage.
- Coverage is never silently treated as accepted.
- A receiver cannot hold overlapping accepted coverage windows.
- Work can be paused when nobody has safe capacity instead of reverting to the person resting.
- Aliases remain the default; real names remain an explicit lower-protection choice.
- The four minimum handover concepts remain: current status, next bounded action, agreed limit, and essential authorized reference.
- The reflection remains one shared team answer, never individual mood/engagement tracking.
- No streaks, scores, badges, leaderboards, engagement analytics, chat, social credentials, or cloud sync were added.
- Encryption, backup, auto-lock, print revisioning, and the existing threat-model boundary remain.
- No unpublished curriculum text or fabricated Seven Shifts voice was added.

## Product rationale

The project’s essence is not the number of screens or the terminology “covenant” and “rota.” Its essence is the structural loop:

**The team agrees that rest is protected → responsibility is explicitly covered or paused → the team reflects on whether the agreement held.**

The simplified interface makes that loop easier to understand while preserving the mechanisms that distinguish Rest Assured from a reminder or individual wellness app.
