import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mattrax/ui";
import {
	type RouteDefinition,
	action,
	cache,
	createAsync,
	useAction,
	useSubmission,
} from "@solidjs/router";
import { eq } from "drizzle-orm";
import { Match, Show, Suspense, Switch } from "solid-js/web";
import { z } from "zod";

import { checkAuth } from "~/api/auth";
import { createAPIKey } from "~/api/trpc/routers/apiKey";
import { useAuth } from "~/app/(dash)/utils";
import { cliAuthCodes, db } from "~/db";
import { useZodParams } from "~/lib/useZodParams";

const getCode = cache(async (code: string) => {
	"use server";

	const auth = await checkAuth();
	if (!auth) throw new Error("UNAUTHORIZED");

	return db.query.cliAuthCodes.findFirst({
		where: eq(cliAuthCodes.code, code),
		columns: {
			code: true,
			createdAt: true,
		},
	});
}, "getCode");

const authorizeCodeAction = action(async (code: string) => {
	"use server";

	const auth = await checkAuth();
	if (!auth) throw new Error("UNAUTHORIZED");

	const apiKey = await createAPIKey("Mattrax CLI", auth.account.id);

	await db
		.update(cliAuthCodes)
		.set({ sessionId: apiKey.id })
		.where(eq(cliAuthCodes.code, code));

	return true;
});

export const route = {
	load: ({ params }) => getCode(params.code!),
} satisfies RouteDefinition;

export default function Page() {
	const params = useZodParams({
		code: z.string(),
	});
	const auth = useAuth();

	const code = createAsync(() => getCode(params.code));

	const authorizeCode = useAction(authorizeCodeAction);
	const authorizeSubmission = useSubmission(authorizeCodeAction);

	return (
		<>
			<CardDescription>Sign in to the Mattrax CLI</CardDescription>

			<Suspense fallback="Loading...">
				<Show when={code()} fallback="Code not found">
					{(code) => (
						<Switch>
							<Match when={!authorizeSubmission.result}>
								<Button
									disabled={authorizeSubmission.pending}
									onClick={() => authorizeCode(code().code)}
								>
									Continue as
									<span class="ml-1 font-semibold">{auth.data?.email}</span>
								</Button>
								{/* <span>Or <Button variant="link">sign in as a different user</Button></span> */}
							</Match>
							<Match when={authorizeSubmission.error}>
								Error authorizing code
							</Match>
							<Match when={authorizeSubmission.result}>
								Code authorized, return to the CLI!
							</Match>
						</Switch>
					)}
				</Show>
			</Suspense>
		</>
	);
}
