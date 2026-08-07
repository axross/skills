// Ambient declarations for the framework surface this project imports.
//
// The app is not built or served here — `npm run typecheck` and `npm test` are
// the whole of what runs — so the framework itself is not a dependency. These
// declarations cover only the handful of imports the route modules actually
// use, which is what lets `tsc --noEmit` check those modules instead of
// drowning in unresolved-module errors and checking nothing.
//
// Keep this narrow. It is a stand-in for reading the real types, so anything
// declared here that the framework does not actually provide is a bug this
// file would hide rather than catch.

declare module "next" {
	export interface Metadata {
		/**
		 * A bare title, or the default/template pair a layout uses so child
		 * pages inherit a suffix.
		 */
		title?: string | { default: string; template?: string };
		description?: string;
	}
}

declare module "next/headers" {
	/** A read-only view of the request's headers. Async since v15. */
	export function headers(): Promise<{ get(name: string): string | null }>;
}

declare module "next/navigation" {
	/** Renders the nearest not-found boundary. Never returns. */
	export function notFound(): never;
}
