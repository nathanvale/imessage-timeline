---
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
description:
  Project manager for iMessage pipeline task state - update status, complete
  ACs, track progress
argument-hint: '[action] [task-id] [optional: AC-id or notes]'
---

# Project Manager: iMessage Pipeline Task Tracker

Systematic task state management for the iMessage pipeline implementation. Acts
as a project manager to update task status, complete acceptance criteria, track
progress, and generate status reports.

## Task

Manage the task state in `docs/imessage-pipeline-task-state.json` with
systematic updates, validation, and reporting capabilities.

## Supported Actions

### 1. `status` - Show current project status

```bash
/pm status
```

Shows:

- Overall progress (% tasks complete)
- Current in-progress tasks
- Next available tasks (dependencies satisfied)
- Blocked tasks (waiting on dependencies)
- Risk breakdown (HIGH/MEDIUM/LOW)

### 2. `start [task-id]` - Start a task

```bash
/pm start SCHEMA--T01
```

- **FIRST: Load all documentation into context** (if not already present)
  - `docs/imessage-pipeline-tech-spec.md` - Full specification
  - `docs/imessage-pipeline-refactor-report.md` - Architecture and design
    decisions
  - `docs/imessage-pipeline-tasks.md` - Task checklist and details
  - `docs/imessage-pipeline-task-state.json` - Current state
  - Any related guides/ADRs mentioned in the task
- Validates dependencies are complete
- Updates status to "in_progress"
- Sets started_at timestamp
- Shows acceptance criteria to complete
- Provides context-specific guidance based on task type

### 3. `complete-ac [task-id] [ac-id]` - Complete an acceptance criterion

```bash
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC01
```

- Moves AC from acs_remaining to acs_completed
- Updates task notes with completion details
- Shows remaining ACs

### 4. `finish [task-id] [notes]` - Complete a task

```bash
/pm finish SCHEMA--T01 "Completed schema with full Zod validation"
```

- Validates all ACs are completed
- Updates status to "completed"
- Sets completed_at timestamp
- Updates notes with final summary
- Shows newly unlocked tasks

### 5. `report` - Generate progress report

```bash
/pm report
```

Generates markdown report with:

- Epic-level progress
- Milestone tracking
- Burndown estimate
- Risk summary
- Recent completions

### 6. `next` - Show next recommended task

```bash
/pm next
```

Shows the next highest-priority task based on:

- Dependencies satisfied
- Epic ordering (E1 → E2 → E3 → E4 → E5 → E6)
- Risk level (complete LOW first to build momentum)

### 7. `validate` - Validate task state consistency

```bash
/pm validate
```

Checks:

- All dependencies exist
- No circular dependencies
- Started tasks have started_at timestamp
- Completed tasks have all ACs in acs_completed
- JSON structure is valid

### 8. `add-note [task-id] [note]` - Add notes to a task

```bash
/pm add-note SCHEMA--T01 "Found issue with HEIC handling, adding workaround"
```

### 9. `list [filter]` - List tasks with filters

```bash
/pm list HIGH           # Show only HIGH risk tasks
/pm list E2             # Show only E2 (Normalize-Link) tasks
/pm list in_progress    # Show in-progress tasks
/pm list pending        # Show pending tasks
/pm list MEDIUM,HIGH    # Show MEDIUM and HIGH risk tasks
```

## Process

### ⚠️ CRITICAL: Documentation Loading Protocol

**BEFORE any action (especially `start`), you MUST load ALL documentation into
context:**

1. **Check Context** - Verify if these files are already loaded:
   - `docs/imessage-pipeline-tech-spec.md`
   - `docs/imessage-pipeline-refactor-report.md`
   - `docs/imessage-pipeline-tasks.md`
   - `docs/imessage-pipeline-task-state.json`

2. **Load Missing Docs** - Use Read tool to load any missing files

3. **Extract Key Information**:
   - Full acceptance criteria with detailed requirements
   - Architecture patterns and design decisions
   - Risk mitigations and TDD requirements
   - Dependencies and task relationships
   - Epic structure and milestones

4. **Task-Specific Context** (load as needed):
   - Schema tasks → Zod patterns, type definitions
   - Normalize tasks → CSV/DB schemas, conversion logic
   - Enrich tasks → AI provider APIs, retry patterns
   - Render tasks → Obsidian markdown syntax, formatting rules

### Standard Operation Flow

1. **Read Task State**
   - Load `docs/imessage-pipeline-task-state.json`
   - Parse and validate JSON structure
   - Build dependency graph
   - Cache task relationships

2. **Validate Action**
   - Verify task exists in state file
   - Check dependencies are satisfied (all must be "completed")
   - Validate AC IDs if provided
   - Ensure action is valid for current task status
   - For HIGH risk tasks: Confirm TDD approach understood

3. **Execute Action**
   - Update task state as requested
   - Regenerate manifest_hash (SHA-256 of tasks object)
   - Update last_updated timestamp (ISO 8601 UTC)
   - Write atomically (temp file + rename for crash safety)

4. **Update Markdown Checklist**
   - Sync changes to `docs/imessage-pipeline-tasks.md`
   - Update checkboxes and status indicators
   - Preserve formatting and structure

5. **Display Result**
   - Show what changed with clear visual indicators
   - Display next steps and specific guidance
   - Highlight newly unlocked tasks
   - Show progress metrics (% complete, days remaining)
   - For task start: Provide detailed context and implementation guidance

## Validation Rules

### Starting a Task

- Status must be "pending"
- All dependencies must be "completed"
- No other task in same epic can be "in_progress" (sequential by default)

### Completing an AC

- Task must be "in_progress"
- AC must exist in acs_remaining
- AC ID must match expected format

### Finishing a Task

- Task must be "in_progress"
- All ACs must be in acs_completed (acs_remaining must be empty)
- Notes must be provided

## Output Format

### Status Report

```
📊 iMessage Pipeline Implementation Status

Overall Progress: 3/30 tasks complete (10%)
Estimated Days Remaining: 73 of 79

🟢 Completed (3):
  ✓ SCHEMA--T01 (completed 2025-10-15)
  ✓ SCHEMA--T02 (completed 2025-10-15)
  ✓ SCHEMA--T03 (completed 2025-10-16)

🔄 In Progress (1):
  → NORMALIZE--T01 (started 2025-10-17, 2/5 ACs complete)

⏭️  Next Available (2):
  • NORMALIZE--T02 (depends on SCHEMA--T01 ✓)
  • CI--T01 (depends on SCHEMA--T01 ✓)

🚫 Blocked (24):
  • NORMALIZE--T03 (waiting on NORMALIZE--T01, NORMALIZE--T02)
  • NORMALIZE--T04 (waiting on NORMALIZE--T01, NORMALIZE--T02)
  [...]

⚠️  Risk Breakdown:
  HIGH: 0/10 complete (0%)
  MEDIUM: 1/5 complete (20%)
  LOW: 2/15 complete (13%)
```

### Task Start Confirmation

```
✅ Started SCHEMA--T01: Create unified Message schema with Zod validation

Risk Level: MEDIUM (TDD not required, but recommended)
Estimated: 3 days

📋 Acceptance Criteria (6):
  [ ] SCHEMA-T01-AC01: Message interface with messageKind discriminated union
  [ ] SCHEMA-T01-AC02: Zod schema with superRefine for cross-field invariants
  [ ] SCHEMA-T01-AC03: Media payload validation
  [ ] SCHEMA-T01-AC04: Tapback payload validation
  [ ] SCHEMA-T01-AC05: ISO 8601 date validation
  [ ] SCHEMA-T01-AC06: Absolute path validation

💡 Next Steps:
  1. Create src/schema/message.ts
  2. Implement Message interface with discriminated union
  3. Add Zod validators with superRefine
  4. Run /pm complete-ac SCHEMA--T01 [AC-ID] as you finish each criterion
```

### AC Completion Confirmation

```
✅ Completed SCHEMA-T01-AC01 for SCHEMA--T01

Progress: 1/6 ACs complete (17%)

Remaining:
  [ ] SCHEMA-T01-AC02: Zod schema with superRefine for cross-field invariants
  [ ] SCHEMA-T01-AC03: Media payload validation
  [ ] SCHEMA-T01-AC04: Tapback payload validation
  [ ] SCHEMA-T01-AC05: ISO 8601 date validation
  [ ] SCHEMA-T01-AC06: Absolute path validation
```

### Task Completion Confirmation

```
🎉 Completed SCHEMA--T01: Create unified Message schema with Zod validation

Duration: 2.5 days (started 2025-10-17, completed 2025-10-19)
All 6 acceptance criteria satisfied ✓

📈 Progress Update:
  Epic E1: 1/3 complete (33%)
  Overall: 1/30 complete (3%)

🔓 Newly Unlocked Tasks:
  → SCHEMA--T02: Build validator CLI script
  → SCHEMA--T03: Create fixtures and schema tests
  → CI--T01: Configure Vitest with proper settings
  → NORMALIZE--T01: Implement CSV to schema mapping
  → NORMALIZE--T02: Implement DB row splitting with part GUIDs

💡 Recommended Next: SCHEMA--T02 (LOW risk, quick win, 1 day)
```

## Error Handling

### Dependency Not Met

```
❌ Cannot start NORMALIZE--T03

Dependencies not satisfied:
  ✗ NORMALIZE--T01 (status: pending)
  ✗ NORMALIZE--T02 (status: pending)

Complete these tasks first:
  /pm start NORMALIZE--T01
```

### AC Not Found

```
❌ AC not found: SCHEMA-T01-AC99

Valid ACs for SCHEMA--T01:
  - SCHEMA-T01-AC01
  - SCHEMA-T01-AC02
  - SCHEMA-T01-AC03
  - SCHEMA-T01-AC04
  - SCHEMA-T01-AC05
  - SCHEMA-T01-AC06
```

### Task Not Ready to Finish

```
❌ Cannot finish SCHEMA--T01

Incomplete acceptance criteria (3 remaining):
  [ ] SCHEMA-T01-AC04: Tapback payload validation
  [ ] SCHEMA-T01-AC05: ISO 8601 date validation
  [ ] SCHEMA-T01-AC06: Absolute path validation

Complete all ACs before finishing task.
```

## Implementation Notes

The command should:

1. **Load all documentation FIRST** - Before any task start, verify all docs are
   in context
2. **Always validate** before making changes
3. **Write atomically** (temp file + rename for crash safety)
4. **Keep JSON and MD in sync** (update both files)
5. **Calculate dependencies** dynamically from depends_on fields
6. **Generate timestamps** in ISO 8601 with Z suffix
7. **Compute manifest hash** after changes (SHA-256 of tasks object)
8. **Handle concurrent updates** gracefully (detect file changes before write)

### Documentation Loading Requirements

**The agent MUST:**

- Check if documentation is in context before starting ANY task
- Use Read tool to load missing documentation files
- Never assume documentation context is present
- Load task-specific guides/ADRs referenced in task notes
- Extract and understand acceptance criteria before implementation
- Verify TDD requirements for HIGH risk tasks

## Example Workflow Session

```bash
# Start your day - see status
/pm status

# Pick next task
/pm next

# Start recommended task
/pm start SCHEMA--T01

# Work on implementation...
# Complete ACs as you go
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC01
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC02

# Add notes during work
/pm add-note SCHEMA--T01 "Using Zod discriminated union pattern from docs"

# Complete remaining ACs...
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC03
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC04
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC05
/pm complete-ac SCHEMA--T01 SCHEMA-T01-AC06

# Finish task with summary
/pm finish SCHEMA--T01 "Completed full Message schema with Zod validation. All cross-field invariants implemented using superRefine. Tests passing."

# See what's unlocked
/pm status

# Generate end-of-day report
/pm report
```

## Integration with Git

After significant updates (task completion, milestone reached):

```bash
# Commit your progress
git add docs/imessage-pipeline-task-state.json
git add docs/imessage-pipeline-tasks.md
git commit -m "Complete SCHEMA--T01: Unified Message schema with Zod"
git push
```

## Tips for Best Results

1. **Complete ACs incrementally** - Don't wait until end
2. **Add notes frequently** - Capture decisions and gotchas
3. **Use /pm next** - Trust the dependency-based recommendations
4. **Run /pm validate** - Catch inconsistencies early
5. **Generate reports** - Track progress, share with stakeholders
6. **Commit often** - Keep Git history aligned with task progress

---

**Task State File**: `docs/imessage-pipeline-task-state.json` **Checklist
File**: `docs/imessage-pipeline-tasks.md` **Spec Source**:
`docs/imessage-pipeline-tech-spec.md`
