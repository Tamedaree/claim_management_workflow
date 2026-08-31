import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@eic.com";
  const password = "Admin@12345";
  const hashed = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashed,
      role: "admin",
      is_active: true,
      work_location_type: "Head_Office",
      department: "Claim_Division",
      position_title: "System Administrator",
    },
    create: {
      email,
      password: hashed,
      role: "admin",
      is_active: true,
      work_location_type: "Head_Office",
      department: "Claim_Division",
      work_location: "Head Office",
      position_title: "System Administrator",
      phone: "0900000000",
    },
  });

  console.log("✅ Admin created successfully");
  console.log("Email   :", email);
  console.log("Password:", password);
  console.log("Role   :", admin.role);
  console.log("ID     :", admin.id);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
