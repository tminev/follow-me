import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";
import { rewardCompletedGame } from "@/lib/progression";
import { answersFrom } from "@/lib/three-questions";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("JOIN") }),
  z.object({ action: z.literal("DECLINE") }),
  z.object({ action: z.literal("ANSWER"), index: z.number().int().min(0).max(2), answer: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("COMPLETE") }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const input = schema.parse(await request.json());
    const game = await db.gameSession.findUnique({ where: { id }, include: { participants: true } });
    const participant = game?.participants.find((item) => item.userId === userId);
    if (!game || !participant) return fail("GAME_NOT_FOUND", "Тази игра не е налична.", 404);
    if (game.expiresAt <= new Date() && game.state !== "COMPLETED") return fail("GAME_EXPIRED", "Времето за тази игра изтече.", 409);
    if (game.state === "COMPLETED" || game.state === "DECLINED") return fail("GAME_FINISHED", "Тази игра вече е приключила.", 409);

    if (input.action === "JOIN") {
      if (participant.status !== "INVITED") return fail("GAME_ALREADY_JOINED", "Вече участваш в тази игра.", 409);
      await db.gameParticipant.update({ where: { gameId_userId: { gameId: id, userId } }, data: { status: "JOINED", joinedAt: new Date() } });
      await db.gameSession.update({ where: { id }, data: { state: "ACTIVE" } });
    }
    if (input.action === "DECLINE") {
      await db.gameParticipant.update({ where: { gameId_userId: { gameId: id, userId } }, data: { status: "DECLINED", completedAt: new Date() } });
      await db.gameSession.update({ where: { id }, data: { state: "DECLINED" } });
    }
    if (input.action === "ANSWER") {
      if (game.state !== "ACTIVE") return fail("GAME_NOT_ACTIVE", "Приеми поканата, преди да отговориш.", 409);
      const answers = answersFrom(participant.answers); answers[input.index] = input.answer;
      await db.gameParticipant.update({ where: { gameId_userId: { gameId: id, userId } }, data: { answers } });
    }
    if (input.action === "COMPLETE") {
      const allAnswered = game.participants.every((item) => item.status === "JOINED" && answersFrom(item.answers).filter(Boolean).length === 3);
      if (!allAnswered) return fail("GAME_INCOMPLETE", "И двамата трябва да отговорите на трите въпроса.", 409);
      const completed = await db.gameSession.updateMany({ where: { id, state: "ACTIVE", completedAt: null }, data: { state: "COMPLETED", completedAt: new Date() } });
      if (completed.count) {
        await Promise.all(game.participants.map((item) => rewardCompletedGame(item.userId, id)));
        await db.gameParticipant.updateMany({ where: { gameId: id }, data: { status: "COMPLETED", completedAt: new Date() } });
      }
    }
    const updated = await db.gameSession.findUnique({ where: { id }, include: { participants: true } });
    return ok({ game: updated });
  } catch (error) { return apiError(error); }
}
