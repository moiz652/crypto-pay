<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:behavioral-guidelines -->
# CryptoPay Agent Behavioral Guidelines

Merge with project-specific instructions below. Bias toward caution over speed — this handles real money.

## 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so.
- If something is unclear, stop and ask.

## 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If it could be 50 lines instead of 200, rewrite it.

## 3. Surgical Changes
Touch only what you must.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- Note unrelated dead code — don't delete it unasked.

## 4. Goal-Driven Execution
Define success criteria. Loop until verified.
- "Fix the bug" → "reproduce it, then make the reproduction pass."
- State a numbered plan for multi-step tasks before starting.

## 5. CryptoPay-specific
- Never modify payment, auth, or on-chain-verification logic (src/lib/onchain.ts, src/app/api/sessions/[code]/pay, src/app/api/transfers) unless explicitly asked to touch that exact file.
- One bug fix per commit. Don't bundle unrelated fixes into one commit.
- Never push directly to main. Feature branch → PR → review → merge, every time, no exceptions for "small" changes.
- Any Supabase schema change ships as a new .sql file — never assume it's been applied; ask.
- Base mainnet + USDC only in Phase 1. Do not add multi-chain or multi-token logic unless the task explicitly says Phase 2.
<!-- END:behavioral-guidelines -->