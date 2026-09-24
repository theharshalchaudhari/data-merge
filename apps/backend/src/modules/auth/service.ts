import crypto from "node:crypto";

import bcrypt from "bcrypt";

import {
  db
} from "../../db/client.js";

import {
  env
} from "../../config/env.js";

export type AuthRole =
  | "admin"
  | "editor"
  | "viewer"
  | "pending";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: AuthRole;
}

function hashToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createUser(
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
  }
) {
  const passwordHash =
    await bcrypt.hash(
      input.password,
      12
    );

  const result =
    await db.query(
      `
      INSERT INTO users
      (
        name,
        username,
        email,
        password_hash
      )
      VALUES
      ($1, $2, $3, $4)
      RETURNING
        id,
        name,
        username,
        email,
        role,
        created_at,
        updated_at
      `,
      [
        input.name,
        input.username,
        input.email,
        passwordHash
      ]
    );

  return result.rows[0];
}

export async function authenticate(
  username: string,
  password: string
): Promise<AuthUser | null> {
  const result =
    await db.query(
      `
      SELECT
        id,
        name,
        username,
        email,
        password_hash,
        role
      FROM users
      WHERE username = $1
      `,
      [username]
    );

  const user =
    result.rows[0];

  if (!user) {
    return null;
  }

  const valid =
    await bcrypt.compare(
      password,
      user.password_hash
    );

  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role
  };
}

export async function createSession(
  userId: string
): Promise<string> {
  const token =
    crypto.randomBytes(48)
      .toString("hex");

  await db.query(
    `
    INSERT INTO sessions
    (
      user_id,
      token_hash,
      expires_at
    )
    VALUES
    (
      $1,
      $2,
      NOW() + INTERVAL '8 hours'
    )
    `,
    [
      userId,
      hashToken(token)
    ]
  );

  return token;
}

export async function getSessionUser(
  token: string
): Promise<AuthUser | null> {
  const result =
    await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.role
      FROM sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
      `,
      [hashToken(token)]
    );

  return (
    result.rows[0] ??
    null
  );
}

export async function deleteSession(
  token: string
): Promise<void> {
  await db.query(
    `
    DELETE FROM sessions
    WHERE token_hash = $1
    `,
    [hashToken(token)]
  );
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure:
    env.NODE_ENV ===
    "production",
  path: "/",
  maxAge: 60 * 60 * 8
};
