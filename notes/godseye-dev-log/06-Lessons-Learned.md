---
tags: [godseye, lessons, quality, testing]
created: 2026-09-27
---

# Lessons Learned — Guessing vs. Verifying

Related: [[00-Overview]] · [[04-Severe-Weather-Alerts-Layer]] · [[05-Air-Quality-Layer]] · [[03-Adding-a-Data-Layer-Pattern]]

The throughline lesson across this whole session, in one sentence: **a full green test suite proves your code does what you told it to do — it says nothing about whether what you told it to do matches reality.**

## What actually happened

1. **NWS Alerts layer** was built by copying the validation *policy* of an existing layer (earthquakes: reject the whole feed if any one record looks malformed) onto a new, much more heterogeneous data source (a nationwide aggregate from dozens of independent government offices), with field-length limits picked from a guess rather than a real sample.
2. It passed everything — 4,905 tests, boundary checks, a full build, even a headless-browser smoke test with zero console errors.
3. It failed the moment it touched **real production data**, because the guessed 800-character cap on one field was too tight for a real multi-county warning, and the reject-the-whole-feed policy meant that one alert anywhere in the list blanked the entire layer.
4. **Air Quality layer**, built right after, deliberately did the opposite: when the upstream documentation was unreachable and web search only gave partial/truncated field summaries, the response was to **stop and ask the user for a real downloaded file** rather than proceed on a best guess. The parser was built and tested against that real file's actual bytes.
5. The real-sample approach caught a live bug (`Number('') === 0`, silently turning "not measured" into "AQI 0") **before** it shipped — the equivalent-severity mistake to the NWS one, caught by verification instead of by a user report.

## The general principle

When a task description says "read the docs and build it," what actually protects against a data-shape bug is not the volume of tests you write against your own assumptions — it's **whether at least one of those assumptions was checked against ground truth**. A test suite built entirely from imagined fixtures will happily stay green while encoding the same wrong belief the code does.

Concretely, this means: when documentation is unavailable, incomplete, or came from a secondary/AI-summarized source rather than the primary spec — and the code's correctness genuinely depends on getting an exact shape right (field order, enum values, escaping rules) — the responsible move is to **get one real sample and test against it**, not to ship the best available guess with a comprehensive-looking test suite built on top of that same guess.

## A secondary lesson: reject-all vs. skip-one is a real design decision, not a default

Copying a validation *policy* (not just a schema) from a template layer without re-deriving whether it fits the new data source's actual failure modes is its own category of mistake, separate from the field-length guess. USGS earthquakes is one authoritative source publishing a small, internally-consistent feed — "any malformed record probably means something is systemically wrong, so distrust the whole batch" is a reasonable policy there. NWS alerts is dozens of independently-operated offices aggregated into one feed — "one office's product has an unusual field length" says nothing about the other 99 alerts in the same response, so rejecting all of them on one outlier is actively the wrong policy, independent of what the length cap is set to. This is documented in more technical detail in [[03-Adding-a-Data-Layer-Pattern]], Step 2.

## What made the fix cheap

Because each layer was committed in isolation (see [[00-Overview]]'s commit list), the NWS bug fix was a small, independent, easily-reviewed commit (`a43a958`) rather than a rewrite tangled with unrelated changes — and `git revert`/`git reset` to the prior commit were always real, low-cost options if the fix itself had gone wrong. This is why the isolated-commit discipline in [[03-Adding-a-Data-Layer-Pattern]] is called out as load-bearing, not just tidy git hygiene.
