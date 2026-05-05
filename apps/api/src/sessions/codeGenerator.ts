import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSessionCode(length = 8): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }

  return code;
}
