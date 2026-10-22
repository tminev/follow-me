import { PrismaClient, AgeVerificationStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_SEED !== "true") {
    throw new Error("DEV seed is disabled. Set ENABLE_DEV_SEED=true outside production.");
  }
  for (const [slug, title] of [["cars", "Автомобили"], ["travel", "Пътуване"], ["music", "Музика"], ["sports", "Спорт"]]) {
    await prisma.interest.upsert({ where: { slug }, update: { title }, create: { slug, title } });
  }
  const passwordHash = await hash("Demo1234!", 12);
  const users = [
    { handle: "alex_demo", email: "alex@followme.local", displayName: "Алекс", dob: "1992-04-12", verified: true },
    { handle: "mira_demo", email: "mira@followme.local", displayName: "Мира", dob: "1995-09-03", verified: true },
    { handle: "teen_demo", email: "teen@followme.local", displayName: "Тийн профил", dob: "2012-01-01", verified: false },
  ];
  for (const item of users) {
    await prisma.user.upsert({
      where: { email: item.email },
      update: {},
      create: {
        handle: item.handle, email: item.email, passwordHash,
        declaredAdult: item.verified, dateOfBirth: new Date(item.dob),
        ageVerificationStatus: item.verified ? AgeVerificationStatus.VERIFIED : AgeVerificationStatus.UNVERIFIED,
        profile: { create: { displayName: item.displayName, city: "София" } },
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
