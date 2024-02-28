import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";
import { getCookie, appendResponseHeader, H3Event } from "vinxi/server";
import { User } from "lucia";
import { and, eq } from "drizzle-orm";

import { db, tenantAccounts, tenants } from "~/db";
import { lucia } from "../auth";
import { HonoEnv } from "../types";

export const createTRPCContext = async (opts: {
  env: HonoEnv["Bindings"];
  event: H3Event;
}) => {
  return {
    db,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

// Public (unauthenticated) procedure
export const publicProcedure = t.procedure;

// Authenticated procedure
export const authedProcedure = t.procedure.use(async (opts) => {
  const sessionId = getCookie(opts.ctx.event, lucia.sessionCookieName) ?? null;

  const data = await (async () => {
    if (sessionId === null) return;

    const { session, user: account } = await lucia.validateSession(sessionId);

    if (session && session.fresh) {
      appendResponseHeader(
        opts.ctx.event,
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      );
    }
    if (!session) {
      appendResponseHeader(
        opts.ctx.event,
        "Set-Cookie",
        lucia.createBlankSessionCookie().serialize()
      );
    }

    if (session && account) return { session, account };
  })();

  if (!data) throw new TRPCError({ code: "UNAUTHORIZED" });

  return opts.next({
    ctx: {
      ...opts.ctx,
      ...data,
    },
  });
});

export const isSuperAdmin = (account: User) =>
  // TODO: Make sure this check is only run if the email is verified
  account.email.endsWith("@otbeaumont.me") ||
  account.email.endsWith("@mattrax.app");

// Authenticated procedure requiring a superadmin (Mattrax employee)
export const superAdminProcedure = authedProcedure.use((opts) => {
  const { ctx } = opts;
  if (!isSuperAdmin(ctx.account)) throw new TRPCError({ code: "FORBIDDEN" });

  return opts.next({ ctx });
});

// Authenticated procedure w/ a tenant
export const tenantProcedure = authedProcedure
  .input(z.object({ tenantId: z.string() }))
  .use(async (opts) => {
    const { ctx, input } = opts;

    const query = (
      await db
        .select()
        .from(tenants)
        .where(
          and(
            eq(tenants.id, input.tenantId),
            eq(tenantAccounts.accountPk, ctx.account.pk)
          )
        )
        .innerJoin(tenantAccounts, eq(tenants.pk, tenantAccounts.tenantPk))
    )[0];

    if (query === undefined)
      throw new TRPCError({ code: "FORBIDDEN", message: "tenant" });

    return opts.next({ ctx: { ...ctx, tenant: query.tenant } });
  });