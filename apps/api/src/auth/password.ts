import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, keyLength)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, key] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const expected = Buffer.from(key, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
