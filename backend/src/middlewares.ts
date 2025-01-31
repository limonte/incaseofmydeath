import { Octokit } from "@octokit/core";
import { createMiddleware } from "express-zod-api";
import { z } from "zod";
import { app } from "./app";
import { Users } from "./db";
import { createProcessManager } from "./pm";

export const installationProviderMiddleware = createMiddleware({
  security: { type: "input", name: "iToken" },
  input: z.object({
    iToken: z.string().min(1),
  }),
  middleware: async ({ input: { iToken } }) => ({
    installation: new Octokit({ auth: iToken }),
  }),
});

const userIdSchema = z
  .number()
  .int()
  .positive()
  .or(
    z
      .string()
      .regex(/\d+/)
      .transform((v) => parseInt(v, 10))
  );

export const publicUserProviderMiddleware = createMiddleware({
  input: z.object({
    userId: userIdSchema,
  }),
  middleware: async ({ input: { userId } }) => {
    const user = await Users.findOne({ id: userId }).exec();
    if (!user) {
      return { user: null, account: null };
    }
    const {
      data: { account },
    } = await app.request("GET /app/installations/{installation_id}", {
      installation_id: user.installationId,
    });
    if (!account) {
      throw new Error("No account in response");
    }
    if (userId !== account.id) {
      throw new Error("Invalid userId");
    }
    return { user, account };
  },
});

export const authorizedUserProviderMiddleware = createMiddleware({
  security: { type: "input", name: "uToken" },
  input: z.object({
    uToken: z.string().min(1),
    userId: userIdSchema,
  }),
  middleware: async ({ input: { uToken, userId } }) => {
    const user = await Users.findOne({ id: userId }).exec();
    if (!user) {
      throw new Error("User not found");
    }
    const kit = new Octokit({ auth: uToken });
    const { data: account } = await kit.request("GET /user");
    if (account.id !== userId) {
      throw new Error("Invalid userId");
    }
    return { user, account };
  },
});

export const processManagerProviderMiddleware = createMiddleware({
  input: z.object({}),
  middleware: async () => ({
    processManager: await createProcessManager(),
  }),
});
