import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { renderToString } from "solid-js/web";

import { db, domains, identityProviders } from "~/db";
import { env } from "..";

export type EnrollmentProfileDescription = {
  data: string;
  createdAt: number;
};

export const enrollmentRouter = new Hono()
  .get("/login", async (c) => {
    // `appru` and `login_hint` are parameters set by Windows MDM client
    const appru = c.req.query("appru");
    // The access token from the `ms-device-enrollment:?` link.
    // This won't be set if the enrollment is started on the device but will be set if the user started in their browser through `/enroll`.
    const accesstoken = c.req.query("accesstoken");
    // `email` is set when coming from the form in `/enroll`, `login_hint` is set by the MDM browser.
    const email = c.req.query("email") ?? c.req.query("login_hint");
    if (!email) {
      // TODO: Pretty error page
      c.status(400);
      return c.text("Email is required");
    }

    // The user did the login flow in their browser, so we can skip doing it again in within the Windows Federated enrollment flow.
    if (appru && accesstoken) {
      // TODO: Reject expired access_tokens. Microsoft's MDM client seems to be caching them (as least that's the only explanation to what i'm seeing)

      return c.html(renderMdmCallback(appru, accesstoken));
    }

    const [, domain] = email.split("@");

    if (domain === undefined) return c.text("Invalid email address");

    const [domainRecord] = await db
      .select({
        identityProvider: identityProviders,
      })
      .from(domains)
      .where(and(eq(domains.domain, domain)))
      .innerJoin(
        identityProviders,
        eq(domains.identityProviderPk, identityProviders.pk)
      );

    if (domainRecord === undefined) return c.text("Domain not found");

    const params = new URLSearchParams({
      client_id: env.ENTRA_CLIENT_ID,
      scope: "https://graph.microsoft.com/.default",
      redirect_uri: `${env.PROD_URL}/api/enrollment/callback`,
      response_type: "code",
      response_mode: "query",
      login_hint: email,
      state: JSON.stringify({
        appru,
        tenantId: domainRecord.identityProvider.remoteId,
      }),
    });

    return c.redirect(
      `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?${params.toString()}`
    );
  })
  .get("/callback", async (c) => {
    const stateStr = c.req.query("state");
    if (!stateStr) return c.text("Missing OAuth state");

    const code = c.req.query("code");
    if (!code) return c.text("Missing OAuth code");

    const { appru, tenantId } = JSON.parse(stateStr);

    const { access_token } = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: env.ENTRA_CLIENT_ID,
          client_secret: env.ENTRA_CLIENT_SECRET,
          scope: "https://graph.microsoft.com/.default",
          redirect_uri: `${env.PROD_URL}/api/enrollment/callback`,
          grant_type: "authorization_code",
          code,
        }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    ).then(async (r) => {
      if (!r.ok)
        throw new Error(
          `Failed to get access token '${r.status}': ${await r.text()}`
        );
      return await r.json();
    });

    const { userPrincipalName } = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    ).then(async (r) => {
      if (!r.ok)
        throw new Error(`Failed to get user '${r.status}': ${await r.text()}`);
      return await r.json();
    });

    if (appru) {
      return c.html(renderMdmCallback(appru, access_token));
    } else {
      // TODO: Can we use cookies for this cause I don't trust non-tech people to not accidentally copy it out. - We would wanna render `/enroll` with Solid on the server for that.
      const searchParams = new URLSearchParams({
        token: access_token,
        email: userPrincipalName,
      });
      return c.redirect(`/enroll?${searchParams.toString()}`);
    }
  });

const renderMdmCallback = (appru: string, authToken: string) =>
  renderToString(() => (
    <>
      <h3>Mattrax Login</h3>
      <form id="loginForm" method="post" action={appru}>
        <p>
          <input type="hidden" name="wresult" value={authToken} />
        </p>
        <input type="submit" value="Login" />
      </form>
      <script>document.getElementById('loginForm').submit()</script>
    </>
  ));