# Record access and sharing

Status: proposed design, following the September 6 record-workspace review. This document does
not describe implemented sharing controls or change current permissions.

## Problem observed

Creating a deal asks for an "Authorization scope" alongside Owner and Companies. These are
three different facts, but the form presents all of them as business relationships.

Current code confirms that Deal declares `parent: AuthorizationScope`, Company implements that
interface, and DealCompanies independently represents company participation. Authorization grants
apply at the target or any ancestor. A deal's parent therefore affects visibility and permitted
operations; it is not an interchangeable label for its associated company. Deal itself does not
currently implement AuthorizationScope, so the current role-assignment surface cannot express
arbitrary direct sharing of a deal. The required interface-parent picker also does not offer the
application root as an ordinary record option.

Relevant implementation: the Deal and Company models, DealCompanies, ObjectFormFields,
Authorization.require, Authorization.visibleWithin, and the role-assignment service.

## Recommended product contract

A company or deal is a business record. People manage its access through **Share** in the record
header. Routine creation asks for business facts; access defaults come from application policy.
The form should not require users to select an authorization-inheritance parent.

The Share dialog shows:

- People, groups, and service accounts with direct access, with the roles this object supports.
- Inherited access, its source, and where that source can be managed.
- Add people or groups and change/remove direct grants, when the caller may manage access.
- Copy link, explicitly preserving the existing access rules. Copying a link never publishes a record.

Use recognizable role names such as Viewer and Editor, backed by exact operations. Custom actions
need deliberate role mappings; Editor must not implicitly authorize every action on an object.
Managing access is a separate permission from editing business fields. Display a restricted state
only when the effective policy actually restricts access. Removing a direct grant cannot remove
access independently inherited from another source, and the UI must explain that case.

A CRM company's membership is not the set of users allowed into Company OS. A deal's Owner means
business responsibility, not ownership of permissions. Connecting records, assigning an owner,
or creating a note about a record does not implicitly share another record.

## Model and implementation boundary

Share is a foundation capability applicable across object models. The application declares defaults,
available roles, and deliberate inheritance rules in source. The UI derives available sharing
controls from those capabilities, rather than branching on company, deal, or note.

Ordinary CRM records should default to application-level access policy. They should not require
another CRM record as their authorization parent. Preserve true ownership relationships where
they have domain meaning, such as a line item belonging to its deal. If a model deliberately uses
that ownership for permission inheritance, the Share dialog names and explains the inherited source.
Keep business associations separate from ownership and access inheritance.

Use the existing governed authorization system as the authority. A shared access-query contract
must return authorized direct grants, inherited grants and their sources, available roles, and
whether the caller can manage them. Sharing mutations must enforce grant-management authority,
prevent privilege escalation, and emit durable events. The same decisions must govern list reads,
record reads, related previews, APIs, agents, and live updates. Do not implement a client-only ACL
or a second independent sharing store.

Do not expose anonymous-link access or an option to suppress inherited grants before the policy
engine supports those semantics. Sharing a note must also not silently expose its linked subjects;
those subjects remain independently authorized.

## Migration requirements

Changing Deal to an application-owned record and removing Company as an authorization parent is a
permission migration, not a cosmetic form fix. Before changing persisted parents:

1. Inventory affected descendants, scoped assignments, role operation sets, and effective access.
2. Translate intentional company-inherited access into the new explicit policy. Preserve existing
   access unless a separate, explicit policy decision changes it. Include descendants and custom actions.
3. Check that the new role targets and permission catalog can represent the old grants; do not copy
   a role to a different target type without validating its meaning.
4. Migrate ownership/projections/grants consistently and verify authorization before and after.
5. Remove the routine authorization-parent field only when its replacement default works for UI,
   API, and agent creation. Keep actual business-parent inputs, such as a line item's Deal.

The acceptance slice is a deal linked to two companies: create without a scope picker; explicitly
share the deal with a user; verify authorized list/detail/relationship access; revoke that grant;
and verify that linking or unlinking either company has no permission side effect. Also test a
user with inherited access, a user unable to share, and a caller unable to read linked records.
