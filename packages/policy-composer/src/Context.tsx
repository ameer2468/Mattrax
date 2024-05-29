import { type ParentProps, Show, createContext, useContext } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

export type PolicyPlatform = "windows" | "apple";

export type PolicyComposerState = {
	platform: PolicyPlatform;
	windows?: Record<
		string,
		{ enabled: boolean; data: Record<string, any>; open: boolean }
	>;
	apple?: Record<
		string,
		{ enabled: boolean; data: Array<Record<string, any>>; open: boolean }
	>;
};

export type PolicyComposerController = {
	state: PolicyComposerState;
	setState: SetStoreFunction<PolicyComposerState>;
};

const ControllerContext = createContext<PolicyComposerController>(null!);

export function ControllerProvider(
	props: ParentProps<{ controller: PolicyComposerController }>,
) {
	return (
		<Show when={props.controller} keyed>
			{(controller) => (
				<ControllerContext.Provider value={controller}>
					{props.children}
				</ControllerContext.Provider>
			)}
		</Show>
	);
}

export function useController() {
	const ctx = useContext(ControllerContext);

	if (!ctx) {
		throw new Error(
			"useController must be used within a PolicyComposerProvider",
		);
	}

	return ctx;
}
