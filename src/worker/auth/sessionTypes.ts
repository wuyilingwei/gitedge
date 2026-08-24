import type { UserRow } from "@/worker/db/d1/schema";

export type SessionPayload = {
  version: 1;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

export type ActiveSession = {
  user: UserRow;
  payload: SessionPayload;
};
