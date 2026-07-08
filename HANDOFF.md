# CryptoPay — Handoff
__________________________________
> ⚠️ CRITICAL: Do not remove or alter this instruction block. Fill in every section below before ending a session. Every "Done" item must cite the command/output it's based on, or be tagged [unverified].
__________________________________
# Instructions

**Last updated:** [date] · **Updated by:** [Claude/Codex/Cursor/Kimi/you]

## Current state
[One paragraph: what's deployed, what's on main, what's in flight]

## Done since last handoff
- [bullet list]

## In progress / blocked
- [bullet list, with what's blocking it]

## Known issues
- [bullet list]

## Next steps, in order
1.
2.
3.

## Decisions made and why
- [decision] — [reason] — [date]

__________________________________

### Trigger rules (non-negotiable)
- Update immediately after any merge to main
- Update immediately after any squash
- Update before closing any session over ~30 minutes
__________________________________

**Last updated:** 2026-07-10 · **Updated by:** Claude (web)

## Current state
`main` is at `b8e5f56`. Duplicate insufficient-balance error on the Send screen is fixed and merged. Ponytail audit ran (report-only, no changes applied). Local git identity corrected. Fable 5 access confirmed working via Claude Code + Amazon Bedrock.

## Done since last handoff
- Ran Ponytail audit in a Codex worktree (report-only) — 16 findings: 4 orphaned components (SendUsdc.tsx, RequestLink.tsx, UsernameForm.tsx, TransactionConfirmModal.tsx), 2 dead exports/deps, CSP wildcard flags, 5 unused create-next assets, stale README section. None applied yet — pending separate verification + branch.
- Verified via `git show 20e4635 --stat` + targeted greps that rate limiting, feature-flag kill switch, and all RLS policies survived the ac9efdb revert intact — confirmed by diffing actual file contents, not assumed.
- Found and fixed real CSP drift independent of the revert: middleware.ts widened `auth.privy.io` → `*.privy.io` and added unused WalletConnect entries across ordinary incremental commits — flagged, not yet fixed (still open).
- Fixed duplicate insufficient-balance error display on Send screen — root cause: single catch block wrote to both toast and a persistent inline `<p>`, with no reset on cancel/edit. PR #2, commit 0536acb → squash-merged as b8e5f56. Verified on Vercel preview after fixing a Privy allowed-origins gap on that preview hostname.
- Corrected local git identity: `user.email` was `moizkhn12@gmail.com` (unrecognized/stale), now `moiz.k6524@gmail.com`; `user.name` now "Moiz Khan". Only affects future commits, not history.
- Confirmed Fable 5 accessible via Claude Code CLI + Amazon Bedrock (`claude` v2.1.202, high effort) — $120 in credits currently available.

## In progress / blocked
- [Blocked] CSP wildcard cleanup in middleware.ts — diagnosed, not fixed. Scope: `*.privy.io` → explicit subdomains, drop unused WalletConnect entries pending confirmation they're genuinely unused.
- [Blocked] Ponytail's 4 orphaned-component deletions — grep-confirmed zero importers for all 4, not yet deleted/committed.
- [In progress] One-time first-send acknowledgment screen (irreversibility warning) — fully scoped, Prompt 2 ready, not started. Requires new migration (profiles.acknowledged_irreversibility_at), new route, new component.
- [Not started] Full app redesign under Fable 5 — mentioned but explicitly not scoped yet; flagged as scope creep if bundled into "Phase 2" alongside Li.Fi/multi-chain work.

## Known issues
- Vercel preview deployments require manual Privy allowed-origins entry per random preview hostname unless a wildcard pattern is confirmed available on the Privy plan — not yet checked.
- GitHub squash-merge default was corrected in repo settings; confirm still in effect for future PRs.

## Next steps, in order
1. Run Prompt 2 (first-send acknowledgment screen) — new Cursor session, new branch off current main
2. CSP wildcard cleanup — separate branch, separate PR
3. Apply confirmed-safe Ponytail deletions (4 components) — separate branch, separate PR
4. Scope the Fable 5 / redesign work properly before starting it — separate planning session, do not fold into Phase 2's existing Li.Fi scope
5. Full commit-history squash from b2e9726 forward (deferred multiple times, still pending)

## Decisions made and why
- 2026-07-10 — Prompt 2 runs in a fresh session, not appended to Prompt 1's session, because Prompt 1's session already contains one self-corrected scope decision and one manual environment fix; starting clean avoids compounding drift on a task with more open decisions.
- 2026-07-10 — App redesign work explicitly not classified as "Phase 2" — Phase 2 already has a defined scope (Li.Fi, USDT, contacts, fees, QR, WalletConnect) from the original TRD; a visual redesign is a separate initiative regardless of which model executes it.