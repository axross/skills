# Data and Storage

Apply this reference when deciding where data lives on the device, opening a database, applying migrations, storing a credential, or caching a downloaded file.

## Choosing a Mechanism

Pick from what the data _is_, not from what is already imported. The four mechanisms are not interchangeable, and the usual mistake — putting everything in general-purpose key-value storage because it is the easiest to reach — turns into a migration once the data has structure or the values turn out to be sensitive.

| The data is                             | It belongs in                                 |
| --------------------------------------- | --------------------------------------------- |
| A credential, token, or key             | the platform keychain                         |
| Structured, queried, or related         | the on-device database                        |
| A large binary — media, model, download | the file system                               |
| A small scalar preference               | general-purpose key-value storage             |
| Server state                            | the server-state layer, not persisted by hand |

**Guidelines:**

- MUST choose a storage mechanism from the nature of the data rather than from what the module already imports.
- MUST NOT keep structured or related data as serialized blobs in key-value storage; that is a database with no queries and no migrations.
- MUST NOT store a large binary in the database or in key-value storage; store the file and keep its path.
- SHOULD record why a non-obvious choice was made, since these decisions are expensive to revisit once data exists on devices.

## Credentials

Session tokens, refresh tokens, API keys held on behalf of a user, and anything else that authenticates belong in the platform keychain — hardware-backed where available, and outside the app's own storage. General-purpose key-value storage is not encrypted and is readable on a compromised device.

Treat a stored credential as untrusted on read. It was written by a previous version of the app, may be corrupt, and may no longer parse. Validate it, and on failure clear it and fall back to signed out rather than throwing at launch.

**Example:**

```ts
export async function readSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw === null) return null;

  try {
    return sessionSchema.parse(JSON.parse(raw));
  } catch (error) {
    reportError(error, { extra: { scope: "auth/session-storage.read" } });
    await clearSession();
    return null;
  }
}
```

**Guidelines:**

- MUST store credentials in the platform keychain, never in general-purpose key-value storage or the database.
- MUST validate a credential on read, and clear a corrupt entry rather than letting it fail the launch.
- MUST clear every stored credential on sign-out, including any derived copy held elsewhere.
- SHOULD confine keychain access to one module per credential, so its key and its lifecycle have one owner.
- MUST NOT put a credential's value into a log line, an error's context, or a breadcrumb — a software instrumentation capability owns the general rule; this is the storage-layer site where it is most often broken.

## The On-Device Database

Structured data belongs in the app's SQL database. Schema changes are applied as **generated migrations** committed to the repository, not by mutating the schema and hoping — a shipped app has devices at every previous schema version, and the migration set is the only thing that can carry them forward.

Migrations run at startup, before any screen queries the database, which makes migration completion a launch-readiness prerequisite rather than something to discover mid-render.

**Guidelines:**

- MUST generate migrations from the schema and commit them, rather than applying schema changes ad hoc.
- MUST apply pending migrations at startup, and include their completion in the launch readiness gate.
- MUST NOT edit a migration that has shipped; add a new one, since devices have already applied the old one.
- SHOULD open the database once and share the handle, rather than opening it per query.
- SHOULD report a migration failure to the error tracker with the schema version, because it presents to the user as a launch failure with no other signal.

## Files

Large binaries live on the file system, with the app keeping the path. Two distinctions matter: a **cache** location the system may reclaim under pressure, versus a **document** location that persists; and the fact that a path stored today may not resolve after an app update, so paths are reconstructed from a stable identifier rather than persisted verbatim.

**Guidelines:**

- MUST store a reclaimable download in the cache location and durable user data in the document location.
- MUST handle a missing file on read; a cached file can disappear between writing and reading it.
- SHOULD reconstruct a file path from a stable identifier rather than persisting an absolute path across launches.
- SHOULD clean up files whose owning records are deleted, since the file system is not covered by the database's deletes.

## Where This Skill Stops

Data fetched from a server is **server state**: it has an owner elsewhere, it goes stale, and it is managed by the app's server-state layer — its caching, invalidation, retries, and offline behavior. This skill covers the Expo-layer concerns beneath it: that a request is cancelled when a screen goes away, and that the app behaves when the network is absent.

How queries and mutations are organized, how cache keys are shaped, and when a cache is invalidated are that layer's own concerns, not this skill's — a TanStack Query development capability owns them where the project uses that library, including the mechanism for the cancellation rule below and the sanctioned way to persist that layer's own cache.

**Guidelines:**

- MUST NOT hand-persist server state into device storage as a cache; that is the server-state layer's responsibility.
- MUST cancel an in-flight request when the screen that issued it goes away.
- SHOULD define what each screen does with no network — cached content, an empty state, or an error — rather than leaving it to a spinner that never resolves.
