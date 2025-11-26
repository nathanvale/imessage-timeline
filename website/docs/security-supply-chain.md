## Security & Supply Chain Overview

This document outlines current and planned software supply chain security
measures for the project. It complements `docs/automated-release-workflow.md` by
focusing on integrity, vulnerability management, dependency risk, runtime
hardening, and future provenance/signing enhancements.

### Current Controls (Implemented)

1. NPM Provenance
   - Enabled via `publishConfig.provenance` (or `npm publish --provenance`) in
     the release workflow.
   - Provides a Sigstore-backed attestation linking source, workflow, and build
     environment. Verifiable with `npm audit signatures`.
2. Conventional Commits + Changesets
   - Enforced commit hygiene supports clean changelog + automated versioning;
     reduces ambiguous histories for audit.
3. SBOM Generation (CycloneDX JSON)
   - Release workflow generates `sbom.cdx.json` using `anchore/sbom-action@v0`
     (Syft under the hood).
   - Artifact uploaded for each publish run; consumers can ingest CycloneDX for
     license & component risk analysis.
4. Dependency Review (Pull Requests)
   - `dependency-review.yml` gates PRs introducing dependencies with
     vulnerabilities ≥ moderate severity or problematic licenses, posting a
     summary comment on failure.
5. OSV Scheduled & Push Scans
   - `security.yml` runs OSV-Scanner weekly and on main updates, surfacing newly
     disclosed vulnerabilities (Code Scanning alerts UI if elevated).
6. Harden-Runner (Egress / Process Audit)
   - Added to all workflows as first step with `egress-policy: audit` to
     baseline outbound calls and detect anomalies (supply chain compromise early
     warning).
7. Release Channel Isolation
   - Dedicated channel workflow (`channel-release.yml`) enables prerelease tags
     (`next`, `beta`, `rc`, `canary`) without blocking stable `main` releases;
     see `docs/release-channels.md`.

### File & Workflow Reference

| Control              | Location                                  | Purpose                                           |
| -------------------- | ----------------------------------------- | ------------------------------------------------- |
| Provenance publish   | `.github/workflows/release.yml`           | Trusted build + attestation for published package |
| SBOM (CycloneDX)     | `.github/workflows/release.yml`           | Component inventory & license/vuln correlation    |
| Dependency review    | `.github/workflows/dependency-review.yml` | Blocks risky new deps in PRs                      |
| OSV scanning         | `.github/workflows/security.yml`          | Scheduled & push vuln detection                   |
| Harden-Runner        | All workflows (first step)                | Runtime/network anomaly detection                 |
| Channel releases     | `.github/workflows/channel-release.yml`   | Manual prerelease tagging & publish               |
| Channel strategy doc | `docs/release-channels.md`                | Promotion, rollback, dist-tag policy              |

### Verification Procedures

1. SBOM Retrieval
   - After a release workflow run: navigate to the workflow run → Artifacts →
     download `sbom.cdx.json`.
   - Validate structure with any CycloneDX tool or online validator.
2. Provenance Attestation
   - Consumer side: `npm audit signatures` in a project depending on this
     package shows verified attestations count.
3. Dependency Review Enforcement
   - Open a PR adding a vulnerable dependency (e.g., an outdated version with
     known CVE); action should fail with a summary comment.
4. OSV Scan Alerts
   - Inspect Security → Code scanning → OSV results after scheduled job (if
     vulnerabilities exist).
5. Harden-Runner Baseline
   - First run establishes baseline outbound domains. Subsequent unexpected
     domains will appear in Harden-Runner logs (visible in job output / future
     dashboard tooling if integrated).

### Tuning & Configuration

| Aspect                              | How to Adjust                                          | Recommendation                                                         |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Severity gating (dependency review) | `fail-on-severity` key                                 | Start at `moderate`; raise to `high` once backlog is clear             |
| License policy                      | Add `allow-licenses` list or external config file      | Introduce SPDX allowlist after initial SBOM license audit              |
| OSV frequency                       | Modify cron in `security.yml`                          | Weekly is a balance; increase for higher sensitivity                   |
| Harden-Runner enforcement           | Switch `egress-policy: audit` → `block` with allowlist | Transition after baseline stabilizes (7–14 days)                       |
| SBOM format(s)                      | Add `spdx-json` or multi-step generation               | Keep CycloneDX JSON as primary; add SPDX if downstream tooling demands |

### Guided Remediation Workflow

1. OSV scheduled scan flags new vulnerability.
2. Check SBOM component version & license impact.
3. Use `pnpm why <package>` to map dependency graph.
4. Determine minimal upgrade path; prefer patch/minor upgrades with lowest
   depth.
5. Create changeset marking `fix:` with summary of remediation.
6. Ensure dependency-review passes; merge → publish with updated provenance &
   SBOM.

### Threat & Tamper Scenarios Addressed

| Scenario                                | Mitigation                                           |
| --------------------------------------- | ---------------------------------------------------- |
| Compromised dependency (new CVE)        | OSV scheduled scan + SBOM inventory for impact scope |
| Malicious new dependency in PR          | Dependency Review gating                             |
| Exfiltration during build               | Harden-Runner egress monitoring / future blocking    |
| Build tampering / untrusted environment | NPM provenance attestation (OIDC + Sigstore)         |
| Hidden component/licensing risk         | CycloneDX SBOM license & component enumeration       |

### Future Enhancements (Planned / Optional)

1. SLSA Build Level 3+ Provenance
   - Evaluate `slsa-github-generator` Node builder. Current npm provenance
     covers source/build linkage; SLSA adds stronger isolation guarantees &
     standardized provenance schema.
   - Action: create experimental branch integrating Node builder reusable
     workflow, compare provenance metadata richness.
2. Artifact Signing (Cosign)
   - For distributed binaries or container images (if project expands). Keyless
     signing for release tarballs or OCI images; verification instructions for
     downstream integrators.
3. VEX (Vulnerability Exploitability Exchange)
   - Augment SBOM with exploitability data to reduce noise; leverage CycloneDX
     VEX extension when prioritizing remediation.
4. Harden-Runner Domain Allowlist Enforcement
   - Shift from audit to block mode with curated domain list (GitHub API,
     registry.npmjs.org, etc.).
5. Scorecard / Additional Policy Gates
   - Integrate OpenSSF Scorecard action for repository hygiene metrics; treat
     low scores as informational until baseline established.

### Harden-Runner Block Mode Timeline & Plan

We will migrate from `egress-policy: audit` to selective `block` mode in phased
steps to reduce risk of false positives.

| Phase                       | Criteria                                                                 | Action                                                         | Target Date (tentative) |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------- |
| Baseline Collection         | ≥ 8 successful runs per workflow with stable outbound domains            | Continue audit, gather insights links                          | Week 0–2                |
| Pilot (Single Workflow)     | Baseline stable & no unexpected domains for release workflow last 5 runs | Create `release-block.yml` variant using block allowlist       | Week 3                  |
| Expansion (High-Value Jobs) | Pilot passes 3 consecutive block runs                                    | Convert `release.yml` + `security.yml` to block mode           | Week 4                  |
| Full Adoption               | No blocking incidents for 2 weeks post expansion                         | Convert remaining workflows (commitlint, pr-title, bun-canary) | Week 6                  |

Initial allowlist (to refine via Insights):

```
github.com
api.github.com
objects.githubusercontent.com
registry.npmjs.org
nodejs.org
dl.dist.nodejs.org
raw.githubusercontent.com
githubusercontent.com
osv.dev
googleapis.com
stepsecurity.io
actions.githubusercontent.com
ghcr.io
```

Pilot workflow snippet (example):

```yaml
   - name: Harden Runner (block mode pilot)
      uses: step-security/harden-runner@c6295a65d1254861815972266d5933fd6e532bdf
      with:
         egress-policy: block
         allowed-endpoints: |
            github.com
            api.github.com
            objects.githubusercontent.com
            registry.npmjs.org
            nodejs.org
            raw.githubusercontent.com
            osv.dev
            stepsecurity.io
            actions.githubusercontent.com
```

Rollback plan: If a legitimate endpoint causes a block, add it to the allowlist
and re-run; keep audit mode on other workflows until updated list stabilizes.

Monitoring KPI: “Unexpected outbound domains per run” should trend to 0 before
expansion; any spike pauses migration.

### Operational Playbooks

Incident: Critical vulnerability disclosed affecting a direct or transitive
dependency. Steps:

1. Confirm exposure via SBOM search.
2. Run on-demand OSV scan (`workflow_dispatch`).
3. Assess fix availability; if patch exists, upgrade + changeset with `fix:`.
4. If no fix, consider temporary deny policy (dependency-review `deny-packages`)
   and document workaround.
5. Publish new version with provenance + updated SBOM.

Incident: Harden-Runner flags unexpected outbound domain. Steps:

1. Inspect job logs for process invoking connection.
2. Validate if tool update introduced new telemetry; if legitimate, record
   domain; else investigate commit diff for malicious script additions.
3. If suspicious, revert commit, open security advisory, rotate any exposed
   secrets.

### Developer Quick Reference

| Task                               | Command / Action                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Manual vulnerability scan          | Trigger `Security Scans` workflow (`workflow_dispatch`)                          |
| Verify provenance locally          | `npm audit signatures` after installing package                                  |
| SBOM diff between releases         | Download two `sbom.cdx.json` artifacts; use CycloneDX diff tool                  |
| Adjust severity gate               | Edit `fail-on-severity` in `dependency-review.yml` and commit                    |
| Transition to allowlist block mode | Change Harden-Runner config to `egress-policy: block` and define allowed domains |

### Maintenance Cadence

| Control                       | Review Interval                                    |
| ----------------------------- | -------------------------------------------------- |
| Severity threshold            | Quarterly                                          |
| Harden-Runner baseline        | Weekly during audit phase; monthly thereafter      |
| SBOM completeness             | Each release (auto) + quarterly manual validation  |
| OSV scan schedule             | Adjust based on vuln velocity; reassess quarterly  |
| Future features (SLSA/cosign) | Re-evaluate after significant distribution changes |

### Assumptions

1. Distribution currently limited to npm package (no containers). Cosign
   adoption deferred.
2. License policy: permissive baseline; stricter gates will follow initial
   inventory review.
3. Harden-Runner remains in audit mode until baseline stabilizes (minimum 5
   successful runs).

### Open Questions (For Future Iteration)

| Topic                    | Decision Needed                                      |
| ------------------------ | ---------------------------------------------------- |
| License allowlist scope  | Define high-level vs exhaustive list                 |
| SLSA adoption priority   | Determine ROI vs existing npm provenance sufficiency |
| Blocking policy timeline | Date for enabling egress block mode                  |

### Change Log (Security Controls)

| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| YYYY-MM-DD | Initial creation: SBOM + Dependency Review + OSV + Harden-Runner integration |

---

For enhancements or concerns, open an issue with label `security`.
