import { Hono } from "hono";

import { json } from "../../../src/worker/common";
import { requestServicesMiddleware, type AppBindings } from "../../../src/worker/routes/hono";
import { registerGitRoutes } from "../../../src/worker/routes/git";
import { handleRepoTaskQueue } from "../../../src/worker/tasks/queue";

const app = new Hono<AppBindings>({ strict: false });

app.use("*", requestServicesMiddleware);
registerGitRoutes(app);

app.notFound(() => new Response("Not found\n", { status: 404 }));
app.onError((error) =>
  json({ error: error.message || "Internal Server Error" }, 500, {
    "Content-Type": "application/json; charset=utf-8",
  })
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return await app.fetch(request, env, ctx);
  },
  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleRepoTaskQueue(batch, env, ctx);
  },
};

export { RepoDurableObject } from "../../../src/worker/do/repo/repoDO";
