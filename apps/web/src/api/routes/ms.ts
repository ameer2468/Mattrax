import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "vinxi/server";
import { z } from "zod";

import { db, domains, identityProviders } from "~/db";
import { env } from "~/env";
import { lucia } from "../auth";
import { msGraphClient } from "../microsoft";
import { syncEntraUsersWithDomains } from "../trpc/routers/tenant/identityProvider";
import type { HonoEnv } from "../types";
import { decryptJWT } from "../jwt";

const tokenEndpointResponse = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
});

const userResponse = z.object({
	userPrincipalName: z.string(),
});

const organizationResponse = z.object({
	value: z
		.array(
			z.object({
				id: z.string(),
			}),
		)
		.min(1)
		.max(1),
});

const OAUTH_STATE = z.object({
	tenantPk: z.number(),
});

export const msRouter = new Hono<HonoEnv>().get("/link", async (c) => {
	const error = c.req.query("error");
	if (error) return new Response(`Error from Microsoft: ${error}`); // TODO: Proper error UI as the user may land here

	const code = c.req.query("code");
	if (!code) return new Response("No code!"); // TODO: Proper error UI as the user may land here

	const rawState = c.req.query("state");
	if (!rawState) return new Response("No state!"); // TODO: Proper error UI as the user may land here
	const { tenantPk } = OAUTH_STATE.parse((await decryptJWT(rawState)).payload);

	const sessionId = getCookie(c.env.h3Event, lucia.sessionCookieName) ?? null;
	if (sessionId === null) return new Response("Unauthorised!"); // TODO: Proper error UI as the user may land here

	const { session } = await lucia.validateSession(sessionId);
	if (!session) return new Response("Unauthorised!"); // TODO: Proper error UI as the user may land here

	const body = new URLSearchParams({
		client_id: env.ENTRA_CLIENT_ID,
		client_secret: env.ENTRA_CLIENT_SECRET,
		scope: "offline_access https://graph.microsoft.com/.default",
		code: code,
		redirect_uri: `${env.PROD_URL}/api/ms/link`,
		grant_type: "authorization_code",
	});

	const tokenReq = await fetch(
		"https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		},
	);
	if (!tokenReq.ok) {
		// TODO: Proper error UI as the user may land here
		console.error(
			`Failed to get token from Microsoft '${
				tokenReq.status
			}': ${await tokenReq.text()}`,
		);
		return new Response("Failed to get token from Microsoft");
	}

	const tokenData = tokenEndpointResponse.safeParse(await tokenReq.json());
	if (!tokenData.success)
		return new Response("Failed to parse token response from Microsoft"); // TODO: Proper error UI as the user may land here

	const [userReq, tenantReq] = await Promise.allSettled([
		fetch("https://graph.microsoft.com/v1.0/me?$select=userPrincipalName", {
			headers: { Authorization: `Bearer ${tokenData.data.access_token}` },
		}),
		// > returns a 200 OK response code and a collection of one organization object in the response body.
		fetch("https://graph.microsoft.com/v1.0/organization?$select=id", {
			headers: { Authorization: `Bearer ${tokenData.data.access_token}` },
		}),
	]);
	if (userReq.status === "rejected") {
		console.error(`Failed to get user from Microsoft: ${userReq.reason}`);
		return new Response("Failed to get user from Microsoft");
	}
	if (tenantReq.status === "rejected") {
		console.error(
			`Failed to get tenant ID from Microsoft: ${tenantReq.reason}`,
		);
		return new Response("Failed to get tenant ID from Microsoft");
	}
	if (!userReq.value.ok)
		return new Response("Failed to get user from Microsoft"); // TODO: Proper error UI as the user may land here
	if (!tenantReq.value.ok)
		return new Response("Failed to get tenant ID from Microsoft"); // TODO: Proper error UI as the user may land here

	const userData = userResponse.safeParse(await userReq.value.json());
	if (!userData.success)
		return new Response("Failed to parse user response from Microsoft"); // TODO: Proper error UI as the user may land here

	const tenantData = organizationResponse.safeParse(
		await tenantReq.value.json(),
	);
	if (!tenantData.success)
		return new Response("Failed to parse tenant response from Microsoft"); // TODO: Proper error UI as the user may land here
	const tenant = tenantData.data.value[0]!; // We valid the length in the Zod schema

	const entraTenantId = tenant.id;

	// the actually important bit
	await db
		.insert(identityProviders)
		.values({
			variant: "entraId",
			remoteId: entraTenantId,
			linkerUpn: userData.data.userPrincipalName,
			linkerRefreshToken: tokenData.data.refresh_token,
			tenantPk,
		})
		// We don't care if it already exists so no need for that to cause an error.
		.onDuplicateKeyUpdate({
			// Drizzle requires at least one item or it will error.
			set: {
				variant: "entraId",
				remoteId: entraTenantId,
				tenantPk,
			},
		});

	let skipSubscription = false;
	try {
		const url = new URL(env.PROD_URL);
		if (url.hostname === "localhost") {
			skipSubscription = true;
		}
	} catch (_) {}

	if (!skipSubscription) {
		await msGraphClient(entraTenantId)
			.api("/subscriptions")
			.post({
				changeType: "created,updated,deleted",
				notificationUrl: `${env.PROD_URL}/api/webhook/microsoft-graph`,
				lifecycleNotificationUrl: `${env.PROD_URL}/api/webhook/microsoft-graph/lifecycle`,
				resource: "/users",
				expirationDateTime: new Date(
					new Date().getTime() + 1000 * 60 * 60 * 24 * 25, // 25 days
				).toISOString(),
				clientState: env.INTERNAL_SECRET,
			});
	} else {
		console.log("Skipping subscription creation as we are on localhost");
	}

	return c.html(`
  	<script>
      window.opener.postMessage(location.search)
   	</script>
  `);
});