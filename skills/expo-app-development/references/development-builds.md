# Development Builds

Apply this reference when setting up a local development loop, deciding whether a change needs a new native build, adding a developer-only affordance, or running a development build on a simulator or emulator to verify a change.

## Which Changes Need a Native Build

The most common time sink in Expo development is reloading after a change that required a rebuild, and concluding the change did not work. The line is whether the change affects **native** content — a distinction [Expo's development-builds documentation](https://docs.expo.dev/develop/development-builds/introduction/) explains but does not reduce to a lookup:

| Change                                                         | Needs          |
| -------------------------------------------------------------- | -------------- |
| JavaScript, TypeScript, styles, assets already bundled         | reload         |
| Adding or removing a package with native code                  | native build   |
| Adding, removing, or reconfiguring a config plugin             | native build   |
| Changing app config native keys — permissions, icons, identity | native build   |
| Changing a public environment variable                         | rebuild bundle |

**Guidelines:**

- MUST rebuild natively after changing a config plugin, a native dependency, or a native app-config key, rather than reloading.
- MUST rebuild after changing a public environment variable, since its value is inlined into the bundle at build time.
- SHOULD clear the bundler cache when a change to resolution — extensions, aliases, transformers — appears not to take effect.
- SHOULD suspect a missing native build first when a newly configured native capability is absent at runtime.

## Development Build over the General-Purpose Client

A development build is the app's own binary, containing its own native dependencies, with the developer tooling included. The general-purpose client app can only run projects whose native dependencies it happens to contain, so any app with a native dependency outside that set cannot run in it — and an app that starts inside it usually outgrows it.

Standardize on a development build. The cost is one native build per platform per native change; the benefit is that development runs the same native code as production.

**Guidelines:**

- MUST use a development build for any app with a native dependency outside the general-purpose client's set.
- SHOULD standardize on a development build from the start rather than migrating once the client stops working.
- SHOULD keep a development build's configuration in a named build profile, so every developer builds the same thing.

## The Developer Menu

The developer menu is extensible, and it is the right home for the destructive-but-useful affordances a team needs while building: seeding data, erasing local state, resetting a migration, toggling a feature. Putting these behind the developer menu keeps them out of the app's own UI and out of production builds entirely.

Register them from the entry module so they exist regardless of which screen is open, and handle their failures — a registration callback that throws takes down the menu action with no feedback.

**Guidelines:**

- MUST register custom developer-menu items from the entry module rather than from a screen.
- MUST keep destructive developer affordances in the developer menu rather than in the app's own UI, so they cannot ship.
- MUST catch and report a failure inside a menu callback; an uncaught rejection there is silent.
- SHOULD name each item for what it does to the device's data, since these are used quickly and are not undoable.

## Launcher Behavior

Where the development client provides a launcher, it can be configured to open the most recent project rather than presenting a picker on every launch. On a machine that works on one app, this removes a step from every single run.

**Guidelines:**

- SHOULD configure the launcher to open the most recently used project when the machine works on one app at a time.
- MAY leave the picker enabled where several development builds are used side by side.

## Running on a Simulator or Emulator for Verification

This section covers getting a development build running and reachable on an iOS Simulator or an Android emulator. Whether such a run settles a device check belongs to the project's development-verification practices, where present. What a running app reports through the development server's MCP capabilities is in [expo-mcp.md](./expo-mcp.md).

Command syntax for `simctl`, `adb` and `expo start` (Expo CLI 57.0.27) was checked on **2026-10-30**. Behaviour marked _observed_ was seen on **SDK 57 on 2026-10-29** and was not reproduced when this was written; recheck it against the installed SDK before relying on it.

### Choose the Build Route

A development build reaches a simulator or emulator by a local native run, by a development-client build profile built locally, or by reusing an installed build. A hosted build service uploads the project and spends billed quota and secrets, so dispatching one is a separate effect that needs its own authorization. A profile that embeds the JavaScript bundle at build time does not load from the development server, so an uncommitted change never appears in it.

**Guidelines:**

- SHOULD reuse an installed build when nothing in the table above calls for a native build.
- MUST NOT treat a hosted build as the default route; it is a billed or secret-bearing dispatch that needs its own authorization, as the development-verification practices state where present.
- MUST NOT verify an uncommitted change in a profile that embeds the bundle.

### Select the Device and Port

Through a package script, device and port flags go after `--`: `npm run ios -- --device <id> --port <port>`. Without the `--`, npm keeps the flags and the build runs on the default device and port.

Check what listens on a port before starting a server: `lsof -nP -iTCP:<port> -sTCP:LISTEN` names the process, and `curl -s http://localhost:<port>/status` answers `packager-status:running` when a development server is there. Neither says which checkout's code it serves, and a server another checkout holds serves that checkout's code. _Observed:_ when the chosen port was already serving, a non-interactive run built and installed but started no server of its own, and still opened the app on that port. Start your own on a free port, `npx expo start --dev-client --port <port>`; one server serves both platforms.

**Guidelines:**

- MUST pass device and port flags after `--` when running through a package script.
- MUST check what holds a port before starting a server on it, and use a free port rather than one whose server's checkout is unknown.

### Open the App and Deep Links

A development client opens at a server through its own scheme, and an app deep link opens the same way:

```bash
xcrun simctl openurl <device> "<url>"
adb -s <serial> shell am start -a android.intent.action.VIEW -d "<url>"
```

For the client, `<url>` has the form `<scheme>://expo-development-client/?url=<encoded server URL>`, the server URL percent-encoded, such as `http%3A%2F%2Flocalhost%3A<port>`. _Observed:_ the first time a URL of each scheme opens on an iOS Simulator, the system asks whether to open the app, and `openurl` waits until someone taps Open.

On Android, `adb` sends to a device other than the one meant when another is attached unless told otherwise. Connect with `adb -s <serial> reverse tcp:<port> tcp:<port>` and `localhost` rather than the host's network address. _Observed:_ the app's connection to the host's network address dropped, and the app then stopped reaching the server until reopened.

**Guidelines:**

- MUST name the device on every `adb` command with `-s <serial>`.
- SHOULD connect an Android emulator through `adb reverse` and `localhost`.
- SHOULD look for the first-open prompt before treating a waiting `openurl` as failed.

### Change Appearance and Connectivity, Then Restore Them

The device appearance changes with `xcrun simctl ui <device> appearance dark` and `adb -s <serial> shell cmd uimode night yes`; it reaches the app only while the app follows the device setting. Connectivity on Android goes off with `adb -s <serial> shell svc wifi disable` and `svc data disable`. _Observed:_ the iOS Simulator shares the host's network and has no toggle of its own, so an offline state cannot be set there.

**Guidelines:**

- SHOULD return appearance to what it was found as (`appearance light`, `cmd uimode night no`) and re-enable Wi-Fi and data with `svc wifi enable` and `svc data enable` afterwards, so the next check does not start from a state it did not choose.
- MUST say when connectivity cannot be restored rather than leave the emulator offline silently.
- SHOULD name the platform an offline observation came from.

### Read Logs

JavaScript console output and native logs are different instruments. _Observed:_ the console appears in the development server's output and its inspector, and does not appear in `logcat`. To read it as events, list targets at `http://localhost:<port>/json/list` (one entry per connected app, told apart by `deviceName`), connect a WebSocket to an entry's `webSocketDebuggerUrl`, and send `{"id":1,"method":"Runtime.enable"}`. _Observed:_ the server refuses any `Origin` other than `http://127.0.0.1:<port>`, and `Runtime.enable` replays the history since the app started. Watch `Runtime.consoleAPICalled` and `Runtime.exceptionThrown`.

A native crash appears in `adb -s <serial> logcat -d --pid=<pid>`, with the pid from `adb -s <serial> shell pidof <application id>`.

**Guidelines:**

- SHOULD read JavaScript errors from the inspector and native crashes from `logcat`, rather than looking for either in the other.

### Match the Emulator's ABI

On an Apple-silicon host, create the emulator from an arm64 system image; an x86_64 image is the wrong ABI there. A build that carries no native library for the image's ABI fails to install.

**Guidelines:**

- SHOULD pick the system image whose ABI the host runs and the build includes.

### Serve the Web Build for Verification

`npx expo start --web --port <port>` serves the web build on a chosen port, and the port check above applies to it. `expo start --help` says `--port` does not apply to web; with Expo CLI 57.0.27 on **2026-10-30** the command answered HTTP 200 on the chosen port. This section covers only that serving step and gives no rules for web output.
