import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!password) throw new Error("DEFAULT_ADMIN_PASSWORD must be set");
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@local";
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Organization", slug: "default" }
  });
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      organizationId: org.id,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      fullName: "Local Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: true
    }
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
