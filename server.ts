import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Server } from "socket.io";
import { z } from "zod";
import next from "next";
import { db } from "./src/lib/db";
import { userIdFromAccessToken } from "./src/lib/auth-token";
import { areBlocked } from "./src/lib/social";
import { setAppSocket } from "./src/lib/app-socket";
import { sendPushToUser } from "./src/lib/web-push";
import type { ChatAck, ChatClientEvents, ChatServerEvents, ChatSocketData } from "./src/lib/chat-socket";

const isProduction = process.argv.includes("--production");
const useHttps = process.argv.includes("--https");
const dev = !isProduction;
// LocalTunnel forwards requests through IPv4. Listening on all local interfaces
// keeps both the computer and a phone opened through the HTTPS tunnel reachable.
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function accessTokenFromCookie(cookieHeader: string | undefined) {
  const cookie = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith("fm_access="));
  return cookie ? cookie.slice("fm_access=".length) : null;
}

function acknowledge(ack: ((result: ChatAck) => void) | undefined, result: ChatAck) {
  if (typeof ack === "function") ack(result);
}

async function start() {
  await app.prepare();
  const httpServer = useHttps
    ? await createHttpsServerForDev()
    : createHttpServer((request, response) => handle(request, response));
  if (useHttps) httpServer.on("request", (request, response) => handle(request, response));

  const io = new Server<ChatClientEvents, ChatServerEvents, Record<string, never>, ChatSocketData>(httpServer);
  setAppSocket(io);
  io.use(async (socket, nextSocket) => {
    const token = accessTokenFromCookie(socket.handshake.headers.cookie);
    const userId = token ? await userIdFromAccessToken(token) : null;
    if (!userId) {
      nextSocket(new Error("UNAUTHORIZED"));
      return;
    }
    socket.data.userId = userId;
    nextSocket();
  });

  io.on("connection", (socket) => {
    void socket.join(`user:${socket.data.userId}`);

    socket.on("chat:join", async (data, ack) => {
      try {
        const parsed = z.object({ conversationId: z.string().min(1) }).safeParse(data);
        if (!parsed.success) {
          acknowledge(ack, { ok: false, error: "VALIDATION_ERROR" });
          return;
        }
        const { conversationId } = parsed.data;
        const member = await db.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId: socket.data.userId } },
        });
        if (!member) {
          acknowledge(ack, { ok: false, error: "FORBIDDEN" });
          return;
        }
        await socket.join(`conversation:${conversationId}`);
        acknowledge(ack, { ok: true });
      } catch (error) {
        console.error("Socket conversation join failed", error);
        acknowledge(ack, { ok: false, error: "INTERNAL_ERROR" });
      }
    });

    socket.on("chat:leave", (data) => {
      const parsed = z.object({ conversationId: z.string().min(1) }).safeParse(data);
      if (parsed.success) void socket.leave(`conversation:${parsed.data.conversationId}`);
    });

    socket.on("chat:send", async (data, ack) => {
      try {
        const parsed = z.object({
          conversationId: z.string().min(1),
          body: z.string().trim().min(1).max(2000),
        }).safeParse(data);
        if (!parsed.success) {
          acknowledge(ack, { ok: false, error: "VALIDATION_ERROR" });
          return;
        }
        const { conversationId, body } = parsed.data;

        const members = await db.conversationMember.findMany({
          where: { conversationId },
          select: { userId: true },
        });
        if (!members.some((member) => member.userId === socket.data.userId)) {
          acknowledge(ack, { ok: false, error: "FORBIDDEN" });
          return;
        }
        const other = members.find((member) => member.userId !== socket.data.userId);
        if (!other || await areBlocked(socket.data.userId, other.userId)) {
          acknowledge(ack, { ok: false, error: "BLOCKED" });
          return;
        }
        const sender = await db.user.findUnique({
          where: { id: socket.data.userId },
          select: { handle: true, profile: { select: { displayName: true } } },
        });
        if (!sender) {
          acknowledge(ack, { ok: false, error: "UNAUTHORIZED" });
          return;
        }

        const message = await db.message.create({
          data: { conversationId, senderId: socket.data.userId, body },
          select: { id: true, body: true, senderId: true, createdAt: true },
        });
        io.to(`conversation:${conversationId}`).emit("chat:message", {
          conversationId,
          message: { ...message, createdAt: message.createdAt.toISOString() },
        });
        const displayName = sender.profile?.displayName ?? sender.handle;
        const chatMessage = { ...message, createdAt: message.createdAt.toISOString() };
        io.to(`user:${other.userId}`).emit("notification:message", {
          conversationId,
          message: chatMessage,
          sender: { handle: sender.handle, displayName },
        });
        void sendPushToUser(other.userId, {
          title: `Ново съобщение от ${displayName}`,
          body: "Отвори Follow Me, за да прочетеш съобщението.",
          url: "/",
        }).catch((error: unknown) => console.error("Could not send message push notification", error));
        acknowledge(ack, { ok: true });
      } catch (error) {
        console.error("Socket message send failed", error);
        acknowledge(ack, { ok: false, error: "INTERNAL_ERROR" });
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.info(`> Server listening at ${useHttps ? "https" : "http"}://${hostname}:${port}`);
  });
}

async function createHttpsServerForDev() {
  const require = createRequire(__filename);
  const { createSelfSignedCertificate } = require("next/dist/lib/mkcert") as {
    createSelfSignedCertificate: (host: string) => Promise<{ key: string; cert: string }>;
  };
  const certificate = await createSelfSignedCertificate(hostname);
  return createHttpsServer({
    key: readFileSync(certificate.key),
    cert: readFileSync(certificate.cert),
  });
}

start().catch((error: unknown) => {
  console.error("Failed to start application server", error);
  process.exitCode = 1;
});
