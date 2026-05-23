export type UserRole = "editor" | "reader";

export const USER_ROLES: UserRole[] = ["editor", "reader"];

export const normalizeUserRole = (value: unknown): UserRole => {
  if (typeof value === "string" && USER_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }

  return "editor";
};
