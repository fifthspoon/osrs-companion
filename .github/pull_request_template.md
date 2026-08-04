## What this changes

<!-- One or two sentences. What is different after this merges. -->

## Why

<!-- What was wrong, or what this makes possible. Link an issue if there is one. -->

## What I actually verified

Be specific here, because "it builds" and "I watched it work" are different
claims and only one of them means the feature works. Delete what does not apply.

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] I drove the changed logic and checked the values (paste them below)
- [ ] I opened it in a browser and looked at it

<!-- Paste any values you asserted on. CONTRIBUTING.md has the recipes. -->

**Not verified:** <!-- Say plainly what you did not check. This is genuinely more useful than a confident guess, and it will not count against the PR. -->

## Checklist

- [ ] No map tiles, wiki text, game assets or other third party content is added,
      in any form, including binaries. See [ATTRIBUTION.md](../ATTRIBUTION.md).
- [ ] If this adds a new data source, `ATTRIBUTION.md` gains a section in this PR.
- [ ] If this changes a user-visible feature or a setup step, the README moves with it.
- [ ] If this changes an invariant or adds a hard-won gotcha, `CONTRIBUTING.md` moves with it.
- [ ] No em dashes. CI checks this.
- [ ] I did not undo one of the deliberate decisions in CONTRIBUTING.md. The
      common ones: no map calibration, no `will-change` on `.wmlayer`, no `rAF`
      for the map fit, label ranking is type first, `tsconfig` keeps `noEmit`.

## Anything you are unsure about

<!-- Optional, and welcome. Flagging a doubt is faster than having it found in review. -->
