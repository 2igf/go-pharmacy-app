import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { betaAllowed, invitationCodeFor, normalizeEmail } from "../server/auth";
const email = normalizeEmail(
  z.string().email().parse(process.env.INVITE_EMAIL)
);
if (!betaAllowed(email))
  throw new Error("Add the email to BETA_ALLOWED_EMAILS first");
await mkdir(".local", { recursive: true });
await writeFile(
  ".local/invitation.json",
  JSON.stringify({ email, inviteCode: invitationCodeFor(email) }),
  { mode: 0o600 }
);
console.log(
  "Invitation saved to gitignored .local/invitation.json. Deliver privately; do not commit or publish it."
);
