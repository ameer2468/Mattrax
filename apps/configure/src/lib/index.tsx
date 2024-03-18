import { type ClassValue, clsx } from "clsx";
import { type Accessor, createEffect, createSignal } from "solid-js";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// TODO: Surly this can be done in a better way.
export function untrackScopeFromSuspense<T>(scope: () => T): Accessor<T> {
	const [signal, setSignal] = createSignal<T>(scope());
	createEffect(() => setSignal(scope() as any));
	return signal;
}

export function SuspenseError(props: { name: string }) {
	// Hitting the certain higher-level suspense boundaries means we don't have a UI to show which is a bad UI so we log the warning.
	console.warn(`${props.name}Suspense triggered!`);
	return <></>;
}