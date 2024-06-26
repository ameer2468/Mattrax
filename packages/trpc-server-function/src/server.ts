import { AsyncLocalStorage } from "node:async_hooks";
import { getEvent } from "vinxi/http";

export const TRPC_LOCAL_STORAGE = new AsyncLocalStorage<() => void>();

export function flushResponse() {
	const flush = TRPC_LOCAL_STORAGE.getStore();
	if (!flush)
		throw new Error("Cannot call flushResponse outside of a trpc handler");

	flush();
}

export function waitUntil(promise: Promise<void> | (() => Promise<void>)) {
	const waitUntil = getEvent().context?.waitUntil;
	const p = typeof promise === "function" ? promise() : promise;
	if (waitUntil) {
		waitUntil(p);
	} else {
		// If we don't catch it will panic the node devserver.
		p.catch((err) => console.error("Failed waitUntil:", err));
	}
}
