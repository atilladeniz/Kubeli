# AI Usage Policy: Smart Coding over Vibe Coding

We welcome the use of AI tools (GitHub Copilot, ChatGPT, Claude, Cursor, etc.) in this project to boost productivity. We believe in **Smart Coding**: AI is the tool, the human is the craftsman.

However, we do not tolerate **Vibe Coding** (flying blind). If you use AI to generate code that you don't understand or haven't reviewed, your contribution is not welcome here.

---

## Our Rules

### 1. You are the Pilot, not the Passenger

**Rule:** You are 100% responsible for every line of code you submit. "The AI generated it that way" is not a valid excuse for bugs, security vulnerabilities, or poor architecture.

**Expectation:** If we ask you in code review *why* a function is implemented a certain way, you must be able to explain it. If you can't explain the code, don't submit it.

### 2. Smart Coding: Verification & Refactoring

**Rule:** AI-generated code must never be adopted 1:1 via copy & paste without critically questioning it.

**Avoid "AI Slop":** AI tends to bloat code ("if-loop soup"), introduce unnecessary dependencies, or use outdated patterns.

**Your Job:** It's up to you to clean up the output, refactor it, and adapt it to our project standards:

- Use our existing UI components from `src/components/ui/` (shadcn/ui + Radix UI based)
- Use Zustand stores from `src/lib/stores/` for state management
- Use Tauri commands via `src/lib/tauri/commands.ts` for backend communication
- Follow our Tailwind CSS patterns with `clsx` and `class-variance-authority`
- Use TanStack Query for async data fetching where appropriate

### 3. Transparency

**Rule:** We ask that for major changes (features, refactorings), you indicate whether and which AI tools were used to assist.

**Why:** This helps us in review to identify potential AI "hallucinations" more quickly. There's no shame in using AI - there is shame in hiding it and delivering poor results.

### 4. No "Drive-by" Pull Requests

**Rule:** Don't blindly apply AI-generated "optimizations" across the entire codebase without an accepted issue for it.

**Consequence:** PRs that are obviously pure AI spam (e.g., meaningless documentation comments or mass unchecked refactorings) will be closed without comment.

### 5. Human Communication

**Rule:** Commit messages, PR descriptions, and discussions must be written by a human or at least heavily edited.

**Expectation:** We don't want to read 5-page AI-generated essays about what your code does. We want to hear briefly and concisely from *you*:

- What was the problem?
- How did you solve it?
- Why did you choose this approach?

Example: *"Removed local state syncing to reduce re-renders"*

---

## What We Immediately Reject

We will close PRs and potentially block contributors that exhibit the following characteristics of **AI Slop**:

- Code that uses variables or functions that don't exist in the project (hallucinations)
- Logic that is unnecessarily complex or redundant because the project context was ignored
- PRs that obviously weren't tested (e.g., syntax errors or build failures)
- Mass "improvements" without discernible value
- Using `useState` where a Zustand store already exists
- Creating new UI primitives instead of using our existing shadcn/ui components
- Inventing Tauri commands that don't exist in `src-tauri/src/commands/`

---

## To the Humans Behind the Code

This project is maintained by humans. Every bad, unreviewed AI PR costs us valuable time for reviews and debugging.

**Vibe Coding:** "It feels like it works, but I haven't really checked" - Disrespectful to maintainers

**Smart Coding:** "I used AI to write the boilerplate, then adapted the architecture and made sure the tests run stable" - Highly welcome

Prove to us that you control the AI, and we look forward to your contribution.

---

## TL;DR

```text
AI as tool        ✓
AI as autopilot   ✗

Understand code   ✓
Copy code         ✗

Refactoring       ✓
Copy & Paste      ✗
```
