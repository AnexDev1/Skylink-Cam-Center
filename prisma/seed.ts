import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { hashPassword } from "../src/lib/password"

const demoEmail = "admin@skylink.local"
const demoPassword = "skylink-demo"

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

  const passwordHash = await hashPassword(demoPassword)

  const organization = await prisma.organization.upsert({
    where: { id: "org_skylink_demo" },
    update: { name: "Skylink Demo" },
    create: {
      id: "org_skylink_demo",
      name: "Skylink Demo",
    },
  })

  await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      name: "Skylink Admin",
      passwordHash,
      role: "ADMIN",
      organizationId: organization.id,
    },
    create: {
      name: "Skylink Admin",
      email: demoEmail,
      passwordHash,
      role: "ADMIN",
      organizationId: organization.id,
    },
  })

  await prisma.site.upsert({
    where: { id: "site_skylink_hq" },
    update: {
      name: "Headquarters",
      address: "1 Skylink Way",
      organizationId: organization.id,
    },
    create: {
      id: "site_skylink_hq",
      name: "Headquarters",
      address: "1 Skylink Way",
      organizationId: organization.id,
    },
  })

  await prisma.$disconnect()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
