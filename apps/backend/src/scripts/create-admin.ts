import "dotenv/config";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";

async function main() {
  const name = process.env.ADMIN_NAME;
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !username || !email || !password) {
    console.error(
      [
        "Missing admin bootstrap configuration.",
        "",
        "Set these environment variables:",
        "ADMIN_NAME",
        "ADMIN_USERNAME",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
      ].join("\n"),
    );

    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Admin password must be at least 8 characters.");
    process.exit(1);
  }

  const existingAdmin = await db.query(
    `
    SELECT id, username, email
    FROM users
    WHERE role = 'admin'
    LIMIT 1
    `,
  );

  if (existingAdmin.rows.length > 0) {
    console.error(
      `An admin already exists: ${existingAdmin.rows[0].username}`,
    );

    process.exit(1);
  }

  const existingUser = await db.query(
    `
    SELECT id
    FROM users
    WHERE username = $1
       OR email = $2
    LIMIT 1
    `,
    [username, email],
  );

  const passwordHash = await bcrypt.hash(password, 12);

  if (existingUser.rows.length > 0) {
    const userId = existingUser.rows[0].id;

    await db.query(
      `
      UPDATE users
      SET
        name = $1,
        username = $2,
        email = $3,
        password_hash = $4,
        role = 'admin',
        updated_at = now()
      WHERE id = $5
      `,
      [
        name,
        username,
        email,
        passwordHash,
        userId,
      ],
    );

    console.log("Existing user promoted to admin.");
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);

    return;
  }

  await db.query(
    `
    INSERT INTO users (
      id,
      name,
      username,
      email,
      password_hash,
      role
    )
    VALUES ($1, $2, $3, $4, $5, 'admin')
    `,
    [
      randomUUID(),
      name,
      username,
      email,
      passwordHash,
    ],
  );

  console.log("Admin account created successfully.");
  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
}

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.end();
  });