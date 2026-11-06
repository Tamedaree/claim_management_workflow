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
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must be configured.",
    );
  }

  if (password.length < 12) {
    throw new Error(
      "Initial administrator password must be at least 12 characters.",
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: "admin",
      is_active: true,
      must_change_password: true,
      work_location_type: "Head_Office",
      department: "Claim_Division",
      work_location: "Head Office",
      position_title: "System Administrator",
    },
    create: {
      email,
      password: hashed,
      role: "admin",
      is_active: true,
      must_change_password: true,
      work_location_type: "Head_Office",
      department: "Claim_Division",
      work_location: "Head Office",
      position_title: "System Administrator",
      phone: "0900000000",
    },
  });

  console.log("Administrator account is ready.");
  console.log("Email:", admin.email);
  console.log("Role:", admin.role);
  console.log("Must change password:", admin.must_change_password);
}

main()
  .catch((error) => {
    console.error("Administrator setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
