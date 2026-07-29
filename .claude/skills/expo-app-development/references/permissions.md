# Permissions

Apply this reference when the app needs a capability the user must grant — camera, microphone, location, notifications, photo library, contacts, calendar — or when a permission-dependent feature behaves wrongly after a denial.

## The Three States

A permission check does not answer yes or no. It answers with a status and a separate flag saying whether asking again is still possible, which yields three distinct states, each needing a different branch:

| State                         | What the app should do                          |
| ----------------------------- | ----------------------------------------------- |
| Granted                       | proceed                                         |
| Not granted, can ask again    | explain why, then request                       |
| Not granted, cannot ask again | explain, and offer a route into system settings |

Collapsing the last two is the characteristic defect. Once the system will no longer show the prompt, calling request returns denied immediately — so a button wired straight to request appears to do nothing at all, repeatedly, with no explanation.

**Example:**

```tsx
const status = await getPermissionsAsync();

if (status.granted) return start();
if (status.canAskAgain) return requestPermissionsAsync();

return openSettings();
```

**Guidelines:**

- MUST branch on all three states, treating "cannot ask again" as distinct from "not granted".
- MUST NOT call request as the response to a press without first checking whether asking is still possible.
- MUST give the user a route into system settings when the prompt is no longer available.
- SHOULD re-check permission state when the app returns to the foreground, since it can be changed in settings while the app is backgrounded.

## Asking at the Moment of Need

Request a permission at the point the user has asked for the thing that needs it, not at launch and not on a preflight screen. A prompt with visible context is granted far more often, and a denial gathered at launch is a denial that costs a feature the user had not yet tried to use.

Where the reason is not self-evident from what the user just pressed, explain it in the app _before_ the system prompt appears — the system prompt is not a place where an explanation can be added.

**Guidelines:**

- MUST request a permission at the moment the feature needing it is invoked, not at launch.
- SHOULD explain the reason in the app before triggering the system prompt where the need is not obvious from the interaction.
- MUST keep the app usable when a permission is denied — degrade the feature, never break navigation or block unrelated surfaces.
- MUST NOT request a permission the app has no current feature for.

## Declaration and Request Must Agree

Every runtime request needs a matching declaration in the app config, with a usage description where the platform requires one. The two drift in both directions: a request with no declaration is denied outright by the platform, and a declaration left behind after its feature was removed draws store-review questions about a capability the app no longer uses.

Declarations come from two places — keys the app sets directly, and keys a library's config plugin writes on the app's behalf. Both are real, and a library can introduce a permission the app never asked for.

**Guidelines:**

- MUST declare every permission the app requests, including a usage description where the platform requires one.
- MUST remove a declaration when the feature that needed it is removed.
- MUST check what a dependency's config plugin declares, since a plugin can add permissions the app did not request.
- SHOULD keep a permission's declaration, its request site, and its usage description traceable to the same feature, so all three move together.
- SHOULD re-run prebuild and inspect the generated manifests after changing a permission, since the config is the input and the manifest is what the platform reads.
