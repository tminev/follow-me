import type { Server } from "socket.io";
import type { ChatClientEvents, ChatServerEvents, ChatSocketData } from "@/lib/chat-socket";

type AppSocketServer = Server<ChatClientEvents, ChatServerEvents, Record<string, never>, ChatSocketData>;
type SocketGlobal = typeof globalThis & { followMeSocket?: AppSocketServer };

const socketGlobal = globalThis as SocketGlobal;

export function setAppSocket(server: AppSocketServer) {
  socketGlobal.followMeSocket = server;
}

export function getAppSocket() {
  return socketGlobal.followMeSocket;
}
