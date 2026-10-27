export type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  isMine?: boolean;
};

export type ChatAck = { ok: true } | { ok: false; error: string };

export interface ChatClientEvents {
  "chat:join": (data: { conversationId: string }, acknowledge?: (result: ChatAck) => void) => void;
  "chat:leave": (data: { conversationId: string }) => void;
  "chat:send": (
    data: { conversationId: string; body: string },
    acknowledge?: (result: ChatAck) => void,
  ) => void;
}

export interface ChatServerEvents {
  "map:refresh": () => void;
  "chat:message": (data: { conversationId: string; message: ChatMessage }) => void;
  "notification:friend-request": (data: {
    requestId: string;
    sender: { handle: string; displayName: string };
    createdAt: string;
  }) => void;
  "notification:friend-request-updated": (data: {
    requestId: string;
    status: "ACCEPTED" | "DECLINED";
    recipient: { handle: string; displayName: string };
    createdAt: string;
  }) => void;
  "notification:message": (data: {
    conversationId: string;
    message: ChatMessage;
    sender: { handle: string; displayName: string };
  }) => void;
  "notification:new": (data: { id: string; type: string; title: string; body: string; url: string | null; createdAt: string }) => void;
}

export interface ChatSocketData {
  userId: string;
}
