---
name: qualifying-acquisition-safeguards
description: Qualifying optional guards that observe actor-local skill acquisition or refuse dependent mutations — the acquisition-specific evidence criteria for audit and enforcement claims. Triggers on acquisition guards, audit interference, cached allow decisions, shared actor state and refusal left active after interruption. Skill-management practices own acquisition meanings, installation, loading and retained-text recovery; project policy and host operations own activation, permissions and mechanisms. Not general runtime-control testing. Covers contained controls, reachable effects, evidence validity through mutation, concurrency, history-preserving recovery and independent restoration.
user-invocable: false
---

# Qualifying Acquisition Safeguards

Use this capability when designing, changing or assessing an optional safeguard
that relies on actor-local skill-acquisition evidence to observe acquisition or
refuse dependent mutations. Qualify the guard's bounded claim, not the actor's
acquisition, output conformity or readiness. These portable criteria define no
interception, containment, scheduling or activation mechanism, and grant no
permission or new project gate. General runtime controls remain outside scope.

Acquisition meanings have a separate owner. When interpreting required material,
coverage or currency, consult actor-local skill-acquisition practices where
present. An established acquisition contract can support the assessment without
assuming that owner is installed; missing meanings or required evidence leave
the affected scope unqualified. Looking up those meanings does not start another
qualification exercise or require reloading this caller for the same question.

Every claim needs its acquisition contract before choosing the applicable
qualification controls, so this prerequisite remains in the body.

**Guidelines:**

- MUST ground each qualification claim in established actor-local acquisition meanings and the relevant evidence; when either cannot be established, identify the affected unqualified scope rather than invent an acquisition owner, redefine coverage or infer success.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Qualification Controls and Claim Limits

See [safeguard-qualification.md](./references/safeguard-qualification.md) for:

- comparing routine audit against absent controls across reachable effects, including adverse histories and bounded acquisition telemetry
- qualifying refusal with contained negative and valid-edit controls under ordinary permissions, equivalent inputs/state and counterbalanced order
- keeping acquisition evidence valid through executed mutation and relevant transitions, including current-Full and recovered-Full valid work
- establishing actor-state isolation or relevant concurrent interleavings instead of transferring another actor's evidence
- checking usable recovery without erasing event history, and leaving unsupported or hidden scopes unqualified
- restoring temporary refusal through timely independent expiry or rollback, separately from settled target cleanup and target-class applicability
