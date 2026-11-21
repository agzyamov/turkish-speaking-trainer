# Architecture documentation

This is the authoritative description of the Turkish speaking trainer's architecture. It follows the SEI *Views and Beyond* approach: a set of views, each showing the system from one angle, plus the information that applies across views.

It describes the **target** architecture. Every element carries a status:

- **Existing**: present in the code today.
- **Changing**: present, but being replaced or renamed. The row says what it becomes.
- **Planned**: not yet in the code. The row names the phase that adds it.

The conversion plan and its phases are in [roadmap.md](roadmap.md).

## Binding force

These documents are guardrails for anyone changing the code, human or agent.

1. Read the relevant views and [constraints.md](constraints.md) before changing code.
2. A change must fit the documented architecture.
3. If it does not fit, or the documents do not cover it, **stop and ask the human owner**. Do not pick an interpretation and continue.
4. Once the owner decides, record the decision as an ADR in [decisions/](decisions/) and update the affected views in the same change.

The full procedure, including what counts as "does not fit", is in [constraints.md](constraints.md#escalation).

## Documentation roadmap

| Document | What it answers |
|---|---|
| [system-overview.md](system-overview.md) | What the system is for, who uses it, what it talks to, and which qualities matter most |
| [constraints.md](constraints.md) | The numbered rules a change must not break, and the escalation procedure |
| **Module views** (how the code is structured) | |
| [views/module-decomposition.md](views/module-decomposition.md) | Which modules exist and what each is responsible for |
| [views/module-layered.md](views/module-layered.md) | Which layers exist and which direction dependencies may point |
| [views/module-uses.md](views/module-uses.md) | Which module depends on which for the main features |
| **Component-and-connector views** (how it behaves at runtime) | |
| [views/cc-runtime.md](views/cc-runtime.md) | The running processes and external services and how they communicate |
| [views/cc-voice-answer-flow.md](views/cc-voice-answer-flow.md) | The path of one spoken answer, including where spending is checked |
| **Allocation views** (how software maps to its environment) | |
| [views/deployment.md](views/deployment.md) | Where each component runs and what configuration it needs |
| [views/implementation.md](views/implementation.md) | Where each module lives in the repository and how it is built and tested |
| [views/work-assignment.md](views/work-assignment.md) | Who (which agent role or human) owns which part |
| **Beyond views** | |
| [interfaces/rest-api.md](interfaces/rest-api.md) | The HTTP contract between client and backend |
| [interfaces/provider-ports.md](interfaces/provider-ports.md) | The contracts the backend uses to reach AI providers |
| [interfaces/budget-guard.md](interfaces/budget-guard.md) | The contract of the spend cap |
| [view-mapping.md](view-mapping.md) | How elements in one view correspond to elements in another |
| [decisions/](decisions/) | Architecture decision records: what was decided and why |
| [test-audit.md](test-audit.md) | Which existing tests fit the architecture, which must change and in which phase, and what is not yet tested |
| [glossary.md](glossary.md) | Terms used across the documents |
| [../release-process.md](../release-process.md) | How a change is checked, versioned, released and rolled back |

## Who should read what

| Reader | Start with |
|---|---|
| Product owner | system-overview, constraints, decisions |
| Backend developer or agent | constraints, module-layered, module-decomposition, provider-ports, budget-guard |
| Frontend developer or agent | constraints, module-decomposition (frontend part), rest-api |
| Reviewer or QA | constraints, cc-voice-answer-flow, view-mapping |
| Operator (deploys, keys, budgets) | deployment, budget-guard |

## View template

Every view document has the same sections:

1. **Primary presentation**: a diagram or table showing the elements and relations.
2. **Element catalog**: each element, its responsibility and its status.
3. **Context**: how the view's subject relates to what is outside it.
4. **Variability guide**: what can be configured or swapped without changing the architecture.
5. **Rationale**: why it is designed this way, with links to ADRs.

## Keeping it current

- A change that alters an element, relation or interface updates the affected view in the same change.
- When a Planned element lands, its status becomes Existing.
- The older `docs/architecture.md`, `docs/decisions.md` and the spec docx describe the Serbian product and are kept as history. Where they disagree with this directory, this directory wins.
