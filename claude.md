# Claude Guidelines

## Project Context

This project is a **Koine Greek vocabulary learning application** focused on helping users learn and practice Greek vocabulary through quizzes and flashcards.

The application:

* Contains a large Koine Greek vocabulary dataset.
* Organizes vocabulary progressively, with the most common vocabulary appearing first.
* Uses groups of approximately 20 vocabulary words as the default learning structure.
* Allows users to practice more or fewer than 20 words.
* Supports multiple learning formats, initially:

  * Multiple-choice quizzes.
  * Flashcards.
* Tracks vocabulary learning progress, mastery, difficult words, and quiz history.
* Is designed to be local-first.
* Has **no custom backend or application server**.
* Has **no centralized application database for user data**.
* Synchronizes personal learning data directly between the client application and the authenticated user's Google Drive.
* Uses Google authentication and Google Drive APIs directly from the application.

The architecture must remain consistent with this principle:

```text
Client Application
        ↓
Google Authentication
        ↓
Google Drive API
        ↓
User-Owned Learning Data
```

Do not introduce a backend, REST API, GraphQL API, server-side database, synchronization server, or custom authentication server unless the user explicitly changes the architecture.

---

# 1. Protect Existing Code

Before modifying an existing file, function, component, hook, service, utility, data model, route, or synchronization workflow, first understand how it is currently used.

Existing code may support features, flows, or synchronization behavior that are not immediately visible.

Do not assume a file is isolated simply because it appears unrelated to the current feature.

When the impact of modifying existing code is unclear, stop and ask:

> "This code already exists. Is it safe to modify, or is it used elsewhere? Should I create something new instead?"

Before changing existing code:

* Check its imports and references where possible.
* Understand its role in the current architecture.
* Identify whether it affects quiz progress, local persistence, Google Drive synchronization, authentication, or vocabulary data.
* Avoid breaking existing user data formats.
* Avoid silently changing persisted schemas.

If an existing file clearly belongs to the requested feature and the required change is obvious and safe, modify it surgically.

Do not ask unnecessary questions when the implementation path is clear.

---

# 2. Think Before Coding

**Do not assume. Do not hide uncertainty. Surface trade-offs.**

Before implementing:

* State important assumptions when they materially affect the implementation.
* If requirements have multiple reasonable interpretations, identify them rather than silently choosing one.
* If something is genuinely unclear and would affect the architecture or user experience, stop and ask.
* Prefer the simplest approach that satisfies the requirement.
* Push back on unnecessary complexity.
* Do not introduce infrastructure that conflicts with the project's architecture.

Pay particular attention to assumptions involving:

* Google authentication.
* Google Drive permissions.
* Local storage.
* Synchronization.
* Offline behavior.
* Data conflicts.
* Persisted data formats.
* Vocabulary ranking.
* Learning progress and mastery rules.

Never silently invent a backend requirement.

---

# 3. Preserve the Architecture

This project has **no custom backend**.

Do not introduce:

* Express servers.
* Node backend services.
* Laravel APIs.
* REST APIs.
* GraphQL APIs.
* Serverless functions acting as a hidden backend.
* Centralized databases for user learning data.
* Custom user-account storage.
* Backend synchronization services.

The application should communicate directly with Google services where required.

Personal learning data belongs to the user and should synchronize directly with the user's Google Drive.

The core architecture is:

```text
Application
    ↕
Local Device Storage
    ↕
Google Drive Synchronization
```

Google Drive is the user's **personal cloud data store**, not a replacement for a general-purpose application backend.

Do not use Google Drive to store unrelated application infrastructure or duplicate the entire master vocabulary dataset unless explicitly required.

---

# 4. Data Ownership and Storage Boundaries

Keep a strict distinction between shared application data and personal user data.

## Shared Application Data

Shared application data may include:

* Koine Greek vocabulary.
* English meanings.
* Transliteration.
* Frequency rankings.
* Vocabulary categories.
* Vocabulary set ordering.
* Part of speech.
* Grammatical metadata.
* References.
* Examples.

Shared vocabulary data should be:

* Bundled with the application, or
* Loaded from an appropriate static source, or
* Cached locally.

Do not unnecessarily store the shared vocabulary database in every user's Google Drive.

## Personal User Data

Personal user data may include:

* Learning progress.
* Quiz attempts.
* Quiz history.
* Correct answers.
* Incorrect answers.
* Difficult words.
* Mastered words.
* Flashcard progress.
* Custom vocabulary selections.
* Custom vocabulary lists.
* Learning preferences.
* Application settings.
* Personal learning statistics.

Personal learning data should:

* Be saved locally first.
* Be synchronized to the user's Google Drive.
* Remain under the user's ownership.
* Be recoverable when the user signs in on another device.

---

# 5. Local-First by Default

The application should remain functional when the user is offline whenever possible.

Follow this principle:

> **Save locally first. Synchronize remotely when possible.**

When implementing features involving user progress:

1. Update the local application state.
2. Persist the change locally.
3. Mark the change as synchronized or pending synchronization.
4. Synchronize directly with Google Drive when connectivity and authorization are available.

Do not make normal quiz functionality dependent on an active internet connection.

The user should be able to:

* Practice cached vocabulary offline.
* Complete quizzes offline.
* Use flashcards offline.
* Have progress saved locally.
* Synchronize pending changes later.

Do not block a learning session because Google Drive is temporarily unavailable unless the user explicitly requires cloud-only behavior.

---

# 6. Google Authentication and Google Drive

Google integration is a security-sensitive area.

When working with Google authentication or Google Drive:

* Request only the minimum permissions necessary.
* Prefer application-specific Google Drive storage where appropriate.
* Do not request broad access to unrelated user files.
* Do not expose tokens.
* Do not log tokens.
* Do not persist tokens insecurely.
* Handle expired authentication sessions.
* Handle revoked permissions gracefully.
* Handle temporary Google Drive failures.
* Keep Google-specific logic isolated from unrelated UI components.

Do not allow Google API implementation details to spread throughout the application.

Prefer dedicated modules, hooks, services, or adapters for:

* Authentication.
* Google Drive access.
* Synchronization.
* Serialization and deserialization of user data.

The UI should not need to understand low-level Google Drive API details.

---

# 7. Synchronization Rules

Synchronization must be explicit, reliable, and designed to avoid data loss.

When modifying synchronization behavior:

* Do not overwrite newer user progress blindly.
* Track synchronization state.
* Preserve pending offline changes.
* Consider multiple devices using the same Google account.
* Use timestamps, versions, or another appropriate mechanism when necessary.
* Prefer merging independent learning progress rather than replacing entire datasets unnecessarily.

The application should clearly distinguish between:

```text
Local data
```

and:

```text
Last successfully synchronized cloud data
```

Never assume a successful local write means the change has reached Google Drive.

Where useful, expose synchronization states such as:

* Synced.
* Syncing.
* Offline.
* Pending synchronization.
* Synchronization failed.

Do not show a false "Synced" state when changes are only stored locally.

---

# 8. Persisted Data Compatibility

User learning data may exist across multiple devices and application versions.

When changing persisted data structures:

* Avoid breaking existing user data.
* Prefer backward-compatible additions.
* Use explicit schema versions when the data format becomes complex enough to require them.
* Write migration logic when an incompatible data change is unavoidable.
* Do not silently discard unknown or older user data.
* Preserve data whenever possible.

Before changing a persisted data model, consider:

> "What happens to a user who has been learning for six months and updates the application?"

Data loss is worse than a slightly more complicated migration.

---

# 9. Simplicity First

**Write the minimum amount of code required to solve the problem correctly.**

Do not add:

* Features that were not requested.
* Premature abstractions.
* Complex plugin systems.
* Configurability that nobody needs yet.
* Generic frameworks around one-use functionality.
* Infrastructure for hypothetical future requirements.

If a solution can be implemented in 50 lines instead of 200 without reducing correctness or maintainability, prefer the simpler solution.

Before finalizing, ask:

> "Would a senior engineer consider this unnecessarily complicated?"

If yes, simplify.

However, do not oversimplify critical areas such as:

* Authentication.
* Data persistence.
* Synchronization.
* Conflict handling.
* User data recovery.

Simple does not mean careless.

---

# 10. Surgical Changes

**Change only what is necessary to satisfy the request.**

When editing existing code:

* Do not refactor unrelated code.
* Do not redesign unrelated UI.
* Do not reformat entire files unnecessarily.
* Do not rename unrelated variables.
* Do not replace working implementations without a reason.
* Match the existing project conventions.

If your changes create unused code:

* Remove imports your changes made unused.
* Remove variables your changes made unused.
* Remove functions your changes made unused.

Do not remove pre-existing dead code unless explicitly asked.

Every changed line should be traceable to the requested task.

---

# 11. Goal-Driven Execution

Translate requests into verifiable outcomes.

Examples:

* "Add a flashcard mode" → User can start a flashcard session, navigate cards, reveal answers, and record learning status.
* "Fix synchronization" → Reproduce the synchronization failure, fix it, and verify local and Google Drive data remain consistent.
* "Add vocabulary sets" → Vocabulary is grouped according to frequency ranking and users can select one or multiple sets.
* "Track difficult words" → Incorrect or manually marked difficult words persist locally and synchronize correctly.

For multi-step work, create a concise plan:

```text
1. [Step] → verify: [expected result]
2. [Step] → verify: [expected result]
3. [Step] → verify: [expected result]
```

Do not mark work complete merely because code was written.

Verify the requested behavior.

---

# 12. Quiz and Learning Logic

Learning logic must be separated from presentation logic where practical.

Do not bury important rules inside UI components when they can be expressed clearly in dedicated logic.

Examples of learning logic include:

* Selecting vocabulary.
* Randomizing questions.
* Generating multiple-choice options.
* Tracking correct and incorrect answers.
* Calculating scores.
* Tracking mastery.
* Identifying difficult words.
* Selecting words for revision.
* Determining quiz completion.

The UI should focus on presenting the learning experience.

The underlying learning state should remain predictable and testable.

Do not make vocabulary progress dependent solely on transient component state.

Important learning progress must be persisted.

---

# 13. Vocabulary Data Rules

The vocabulary database should be treated as structured educational content.

Do not hard-code vocabulary entries directly into UI components.

Vocabulary should support structured fields such as:

* Unique identifier.
* Greek word.
* English meaning or meanings.
* Transliteration.
* Frequency rank.
* Vocabulary set.
* Part of speech.
* Optional grammatical information.
* Optional references.
* Optional examples.

Vocabulary grouping should remain data-driven.

The default group size is approximately 20 words, but the application must not assume that users can only practice exactly 20 words.

Users should be able to select:

* One vocabulary set.
* Multiple vocabulary sets.
* A custom number of words.
* A range of vocabulary.
* Difficult words.
* Previously incorrect words.

Do not hard-code the UI around exactly 20 questions.

---

# 14. No Magic Strings

**Do not inline literal strings for comparisons, status checks, storage keys, synchronization states, quiz modes, or branching. Use named constants.**

This is particularly important for:

* Quiz modes.
* Learning statuses.
* Synchronization statuses.
* Storage keys.
* Google Drive file identifiers.
* Schema versions.
* Vocabulary directions.
* Question types.

Preferred:

```ts
const QUIZ_MODE = {
  MULTIPLE_CHOICE: 'multiple-choice',
  FLASHCARDS: 'flashcards',
} as const;

const SYNC_STATUS = {
  SYNCED: 'synced',
  SYNCING: 'syncing',
  PENDING: 'pending',
  FAILED: 'failed',
} as const;

if (quizMode === QUIZ_MODE.MULTIPLE_CHOICE) {
  // ...
}
```

Avoid:

```ts
if (quizMode === 'multiple-choice') {
  // ...
}
```

Rules:

* Use `CAPS_WITH_UNDERSCORES` for constants.
* Prefer objects for grouped variants.
* Use `as const` where appropriate.
* Use arrays only when ordering is genuinely required.
* Define constants close to where they are used.
* Move constants to shared files only when reused.

When editing an existing file, proactively replace magic strings encountered in the code with appropriate constants when doing so is small, safe, and does not expand the scope of the task.

Do not perform broad unrelated refactors solely to eliminate magic strings.

---

# 15. Error Handling and Diagnostics

This project does not have a traditional backend, so diagnostic logging must be appropriate for a client application.

When implementing important workflows, especially:

* Authentication.
* Local persistence.
* Google Drive reads.
* Google Drive writes.
* Synchronization.
* Data migration.

Provide enough diagnostic information to understand failures during development.

Never log:

* Access tokens.
* Refresh tokens.
* Authentication credentials.
* Full private user data.
* Sensitive Google account information.

Errors should distinguish between:

* Expected user actions.
* Offline conditions.
* Authentication failures.
* Authorization failures.
* Recoverable synchronization failures.
* Unexpected application failures.

Do not silently swallow errors.

If synchronization fails:

* Preserve local data.
* Preserve pending changes.
* Provide an appropriate application state.
* Allow retry where appropriate.

Never discard learning progress simply because a cloud synchronization attempt failed.

---

# 16. User-Facing Error States

Technical failures should not be exposed to users as raw API errors.

Translate failures into useful states.

Examples:

* Google Drive unavailable → "Your changes are saved on this device and will sync when possible."
* Offline → "You're offline. Your progress will sync when you reconnect."
* Authentication expired → Prompt the user to sign in again.
* Synchronization failed → Clearly indicate that changes are pending and allow retry.

Do not falsely claim that data is safely synchronized when it is only stored locally.

---

# 17. Testing and Verification

When practical, test the logic that matters.

Prioritize testing:

* Quiz scoring.
* Vocabulary selection.
* Randomization logic.
* Multiple-choice answer generation.
* Mastery calculations.
* Difficult-word tracking.
* Data serialization.
* Data deserialization.
* Data migrations.
* Synchronization state transitions.
* Conflict resolution.

For bugs:

1. Reproduce the problem.
2. Create a test when practical.
3. Fix the implementation.
4. Verify the fix.
5. Check that existing behavior was not broken.

Do not claim something is fixed without verifying the relevant behavior.

---

# 18. UI and Design Principles

The application is an educational tool, not a generic corporate dashboard.

The UI should be:

* Clean.
* Calm.
* Focused.
* Easy to understand.
* Accessible.
* Suitable for beginners.
* Suitable for serious Koine Greek learners.

Prioritize:

* Strong typography.
* Clear visual hierarchy.
* Large, readable Greek text.
* Minimal distractions.
* Clear progress indicators.
* Clear quiz feedback.
* Mobile responsiveness.

Greek vocabulary should receive appropriate visual emphasis.

English meanings and secondary grammatical information should have a clear secondary hierarchy.

Do not sacrifice usability for decorative UI.

---

# 19. Icons

If using a user or users icon from Lucide, always use the second variant where available.

For example:

```text
Users2
```

instead of:

```text
Users
```

---

# 20. Task Tracking

Always check whether `my_current_tasks.md` exists.

If it does not exist, create it.

Use this file to track tasks currently being worked on.

Every task requested by the user must be added as a concise one-line task with a checkbox.

Example:

```md
# Current Tasks

- [ ] Add multiple-choice vocabulary quiz mode
- [ ] Add Google Drive synchronization
- [ ] Persist difficult vocabulary words
```

When beginning a task:

```md
- [ ] Task description
```

When the task is completed and verified:

```md
- [x] Task description
```

Requirements:

* Every user-requested implementation task must be summarized as a one-line checkbox item.
* Update the task status as work progresses.
* Mark a task complete only after implementation and verification.
* Do not mark incomplete or partially implemented work as complete.
* Keep task descriptions concise and actionable.
* Do not delete previously tracked tasks unless explicitly instructed.

Before completing work, ensure `my_current_tasks.md` accurately reflects the current status.

---

# 21. Final Response Requirements

After every implementation or technical response, include two short sections.

## Confidence and Concerns

State anything implemented or proposed that you are not fully confident about.

Examples:

* A platform-specific Google OAuth behavior that needs verification.
* A synchronization conflict strategy that may need product decisions.
* An implementation that works but may not be ideal.
* An assumption made because requirements were incomplete.

If there are no meaningful concerns, explicitly say:

> "No significant concerns with the implementation based on the current requirements."

Do not invent uncertainty merely to fill this section.

---

## What You May Be Missing

After every response, answer:

> **What's the biggest thing I might be missing about this situation right now? What might I not realize?**

Identify the most important overlooked risk, trade-off, architectural implication, or product consideration.

Examples relevant to this project include:

* Google Drive API and OAuth behavior can differ significantly between web, desktop, and mobile platforms.
* Multi-device synchronization requires deliberate conflict handling.
* User progress can be lost if local persistence and cloud synchronization are not clearly separated.
* A vocabulary frequency ranking requires a reliable and academically appropriate source.
* "Mastered" needs a clearly defined learning rule before it can be implemented consistently.

Be specific to the task at hand.

Do not provide generic warnings when there is a more important project-specific consideration.

---

# Guiding Principle

The goal is to build a **simple, reliable, privacy-focused Koine Greek learning application**.

The architecture should remain:

* Client-side.
* Local-first.
* User-data owned.
* Google Drive synchronized.
* Free from unnecessary backend infrastructure.
* Easy to extend without premature abstraction.

When making decisions, prioritize:

1. Correctness.
2. Protection of user learning data.
3. Simplicity.
4. Clear user experience.
5. Maintainability.
6. Minimal infrastructure.

Do not introduce complexity merely because it may be useful in the future.

Build what is needed now, while avoiding decisions that unnecessarily block the application's natural evolution.
