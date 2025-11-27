---
allowed-tools: Task
description:
  Validate specs against templates and ensure required sections are present
argument-hint: [new <spec-type> | <path-to-existing-spec>]
---

# Spec Librarian

Uses the spec-librarian agent to validate specification documents against
templates and ensure all required sections are present.

## Task

Launch the spec-librarian agent to:

- Validate specs against appropriate templates
- Check for missing sections (especially TDD Applicability)
- Provide insertion points for missing content
- Ensure documentation standards are met

## Process

1. **Parse Arguments**
   - Determine if creating new spec or validating existing
   - Identify spec type and path

2. **Launch Spec-Librarian Agent**
   - Use Task tool with subagent_type: "spec-librarian"
   - Pass the validation request as prompt

3. **Agent will:**
   - Load appropriate template based on spec type
   - Compare against existing spec structure
   - Identify missing or incomplete sections
   - Provide specific insertion points with template snippets

## Implementation

```javascript
// Parse the arguments
const args = $ARGUMENTS

// Construct the prompt for the spec-librarian agent
let prompt = ''
if (args.startsWith('new ')) {
  const specType = args.substring(4)
  prompt = `Create a new ${specType} specification from the appropriate template and ensure all required sections are included, especially the TDD Applicability section.`
} else {
  prompt = `Validate the specification at ${args} against the appropriate template. Check for missing sections, particularly the TDD Applicability section, and provide specific insertion points with template snippets for any missing content.`
}

// Launch the spec-librarian agent
Task({
  subagent_type: 'spec-librarian',
  description: 'Validate spec structure',
  prompt: prompt,
})
```

## Example Usage

```bash
# Create a new tech spec from template
/spec-librarian new tech-spec

# Validate an existing spec
/spec-librarian docs/specs/voice-capture-spec.md

# Check a PRD
/spec-librarian docs/prd/feature-prd.md
```

## Expected Output

The spec-librarian agent will provide:

- Validation report showing spec compliance
- List of missing sections with exact line numbers
- Template snippets ready for insertion
- Recommendations for incomplete sections
- Special attention to TDD Applicability section

Example output:

```
"Your spec is missing a TDD Applicability section. Insert at line 25:

## 4) TDD Applicability Decision
- Risk class: (High/Med/Low)
- Decision: Required / Optional / Skip for spike
- Unit: …
- Integration: …
- Contract: …
- YAGNI deferrals: …
- Trigger to revisit: …"
```
