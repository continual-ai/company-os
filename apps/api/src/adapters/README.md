# Adapters

Private provider adapters live here and are bound in the API composition root. A provider adapter
implements a narrow capability port owned by the consuming module or `@continual/runtime`.

Use provider-first names such as `ResendEmailDeliveryAdapter`. Do not wrap a provider merely
because it is external; preserve the native SDK until the application needs a smaller stable
contract with a meaningful local implementation.
