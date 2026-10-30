/** A committed server operation must be finalized even if device I/O fails. */
export async function clearCommittedAccountState(
  clearNative: () => Promise<void>,
  clearCache: () => Promise<void>
) {
  let localCleanupFailed = false;
  try {
    await clearNative();
  } catch {
    localCleanupFailed = true;
  } finally {
    await clearCache();
  }
  return { localCleanupFailed };
}
export async function completeAccountLogout(
  clearNative: () => Promise<void>,
  revokeSession: () => Promise<void>,
  clearCache: () => Promise<void>
) {
  let localCleanupFailed = false;
  try {
    await clearNative();
  } catch {
    localCleanupFailed = true;
  }
  try {
    await revokeSession();
  } finally {
    await clearCache();
  }
  return { localCleanupFailed };
}
/** Fail before issuing new credentials when local account isolation cannot complete. */
export async function prepareAccountChange(clearNative: () => Promise<void>) {
  try {
    await clearNative();
  } catch {
    throw new Error("LOCAL_REMINDER_CLEANUP_FAILED");
  }
}
