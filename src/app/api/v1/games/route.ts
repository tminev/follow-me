import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";
import { areBlocked, areFriends } from "@/lib/social";
import { findRomanticGame } from "@/lib/romantic-games";
import { notifyUser } from "@/lib/notifications";

const createSchema = z.object({ participantId: z.string().min(1), gameCode: z.string().min(1) });

export async function GET() {
  try {
    const userId = await requireUserId();
    const games = await db.gameSession.findMany({
      where: { participants: { some: { userId } }, state: { in: ["INVITED", "ACTIVE", "COMPLETED"] } },
      orderBy: { createdAt: "desc" }, take: 30,
      include: { createdBy: { select: { handle: true, profile: { select: { displayName: true } } } }, participants: { include: { user: { select: { id: true, handle: true, profile: { select: { displayName: true, avatarUrl: true } } } } } } },
    });
    return ok({ games });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const createdById = await requireUserId();
    const { participantId, gameCode } = createSchema.parse(await request.json());
    const gameTemplate = findRomanticGame(gameCode);
    if (!gameTemplate) return fail("UNKNOWN_GAME", "Избраната игра не е налична.", 400);
    if (createdById === participantId) return fail("SELF_GAME", "Избери приятел, с когото да играеш.", 400);
    if (!await areFriends(createdById, participantId)) return fail("FRIENDS_ONLY", "Игрите са достъпни само между приятели.", 403);
    if (await areBlocked(createdById, participantId)) return fail("BLOCKED", "Не можеш да започнеш игра с този профил.", 403);
    const game = await db.gameSession.create({
      data: {
        gameCode: gameTemplate.code, createdById, expiresAt: new Date(Date.now() + 48 * 60 * 60_000),
        payload: { title: gameTemplate.title, questions: gameTemplate.questions },
        participants: { create: [{ userId: createdById, status: "JOINED", joinedAt: new Date() }, { userId: participantId }] },
      },
      include: { participants: true },
    });
    const sender = await db.user.findUnique({ where: { id: createdById }, select: { handle: true, profile: { select: { displayName: true } } } });
    const displayName = sender?.profile?.displayName ?? sender?.handle ?? "Приятел";
    void notifyUser({ userId: participantId, type: "GAME_INVITATION", title: "Покана за игра", body: `${displayName} те покани на „${gameTemplate.title}“.`, url: "/", payload: { gameId: game.id } }).catch((error) => console.error("Could not create game invitation notification", error));
    return ok({ game }, 201);
  } catch (error) { return apiError(error); }
}
