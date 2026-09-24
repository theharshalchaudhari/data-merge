export type UserRole =
  | "admin"
  | "editor"
  | "viewer"
  | "pending";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser
  extends User {}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
}
