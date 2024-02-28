// Side-side exports (we don't want these shipped to the client)

import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext, appRouter } from "./trpc";
import { HonoEnv } from "./types";
import { webhookRouter } from "./routes/webhook";
import { enrollmentRouter } from "./routes/enrollment";
import { msRouter } from "./routes/ms";

export const app = new Hono<HonoEnv>()
  .basePath("/api")
  .get("/", (c) => c.json({ message: "Mattrax Forge!" }))
  .all("/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: () =>
        createTRPCContext({
          env: c.env,
          event: c.env.h3Event,
        }),
    })
  )
  .route("/enrollment", enrollmentRouter)
  .route("/webhook", webhookRouter)
  .route("/ms", msRouter)
  .all("*", (c) => {
    c.status(404);
    if (c.req.raw.headers.get("Accept")?.includes("application/json")) {
      return c.json({ error: "Not Found" });
    }
    return c.text("404: Not Found");
  });