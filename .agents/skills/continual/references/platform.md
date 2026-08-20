# Continual platform context

This reference frames ownership questions for a platform that may build, run, or govern a
customer-owned Company OS. It does not describe guaranteed product capability.

## Working hypothesis

Continual may provide shared operational capabilities around a Company OS while the customer keeps
its business source and data. The useful boundary could include some combination of identity,
agents, connections, infrastructure, delivery, controls, and audit, but that scope is unsettled and
must be earned capability by capability.

The standalone repository must remain coherent without hosted Continual. A hosted service may be
the best implementation for a requirement without becoming part of the semantic business model.

## Ownership questions

For each proposed platform responsibility, decide:

- Is this business truth, company policy, control-plane state, or derived observability?
- Must the customer be able to inspect, export, repair, or operate it independently?
- Does the platform need business-data access, or only a narrow governed capability?
- Which credentials and lifecycle events does the platform own?
- What happens to committed company work when the platform is unavailable?
- Can the dependency be removed or replaced without reconstructing the business model?

Avoid fixed customer/platform ownership tables until real operations establish the split.

## Tentative vocabulary

Terms such as workspace, project, connection, conversation, work queue, environment, and deployment
may be useful control-plane concepts. Their exact hierarchy and semantics are not settled here.

In particular, a platform Project is a possible operational context around source and running
artifacts; it should not be assumed to define the company's API or to equal a company business
object with the same name.

## Guardrails

- Do not copy business rules into a platform console, gateway, queue, or agent implementation.
- Do not make silent upstream changes to customer source or running behavior.
- Keep platform state distinguishable from authoritative company records.
- Preserve attribution between source revision, deployed artifact, actor, and invocation when the
  capability requires it.
- Treat portability and local operation as decision criteria, not absolute requirements that force
  unused fallback implementations.

## Accuracy

Before implementing against hosted Continual, inspect current platform code or authoritative live
contracts. Verify authentication, authorization assumptions, availability, payloads, limits,
deployment behavior, data access, and failure recovery. Label anything else as a proposal.
