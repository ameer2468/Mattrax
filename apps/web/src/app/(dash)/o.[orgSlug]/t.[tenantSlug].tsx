import { type ParentProps, Show, Suspense, createMemo } from "solid-js";
import { type RouteDefinition, A, createAsync } from "@solidjs/router";
import { z } from "zod";

import { useZodParams } from "~/lib/useZodParams";
import { MErrorBoundary } from "~c/MattraxErrorBoundary";
import IconPhCaretUpDown from "~icons/ph/caret-up-down.jsx";
import { MultiSwitcher } from "../MultiSwitcher";
import { As } from "@kobalte/core";
import { Button } from "@mattrax/ui";
import { trpc } from "~/lib";
import { cache, createQueryCacher, useCachedQueryData } from "~/cache";

export function useTenantSlug() {
	const params = useZodParams({ tenantSlug: z.string() });
	return () => params.tenantSlug;
}

const NAV_ITEMS = [
	{ title: "Dashboard", href: "" },
	{ title: "Users", href: "users" },
	{ title: "Devices", href: "devices" },
	{ title: "Policies", href: "policies" },
	{ title: "Applications", href: "apps" },
	{ title: "Groups", href: "groups" },
	{ title: "Settings", href: "settings" },
];

export const route = {
	load: ({ params }) => {
		trpc.useContext().tenant.list.ensureData({ orgSlug: params.orgSlug! });
	},
	info: {
		NAV_ITEMS,
		BREADCRUMB: {
			hasNestedSegments: true,
			Component: (props: { href: string }) => {
				const params = useZodParams({
					orgSlug: z.string(),
					tenantSlug: z.string(),
				});

				const query = trpc.org.list.createQuery();
				const orgs = useCachedQueryData(query, cache.orgs.toArray());
				const org = () => orgs()?.find((o) => o.slug === params.orgSlug);

				return (
					<Show when={org()}>
						{(org) => {
							const query = trpc.tenant.list.createQuery(() => ({
								orgSlug: params.orgSlug,
							}));
							createQueryCacher(query, "tenants", (t) => ({ ...t }));
							const tenants = useCachedQueryData(
								query,
								cache.tenants.where("orgId").equals(org().id).toArray(),
							);

							const tenant = () =>
								tenants()?.find((t) => t.slug === params.tenantSlug);

							return (
								<div class="flex flex-row items-center py-1 gap-2">
									<A href={props.href}>{tenant()?.name}</A>
									<MultiSwitcher>
										<As component={Button} variant="ghost" size="iconSmall">
											<IconPhCaretUpDown class="h-5 w-5 -mx-1" />
										</As>
									</MultiSwitcher>
								</div>
							);
						}}
					</Show>
				);
			},
		},
	},
} satisfies RouteDefinition;

export default function Layout(props: ParentProps) {
	const params = useZodParams({ tenantSlug: z.string() });

	return (
		<>
			<MErrorBoundary>
				{/* we key here on purpose - tenants are the root-most unit of isolation */}
				<Show when={params.tenantSlug} keyed>
					<Suspense>{props.children}</Suspense>
				</Show>
			</MErrorBoundary>
		</>
	);
}
