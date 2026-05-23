import redis from "./redis";

// how long (ms) we hold the lock while doing the DB transaction
const LOCK_TTL_MS = 5000;

// Lua script for atomic check-and-delete
// Returns 1 if we deleted the key, 0 if it wasn't ours (expired or stolen)
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Tries to acquire a distributed lock for `key`.
 * Returns a release function if we got it, null if someone else holds it.
 *
 * We use SET key token PX ttl NX — one round-trip, atomically sets only if
 * the key doesn't exist. The random token ensures only the original holder
 * can release the lock (prevents accidental release after TTL expiry and
 * re-acquisition by another caller).
 *
 * Release uses a Lua script so the get+del is atomic on the Redis side.
 */
export async function acquireLock(
  key: string
): Promise<(() => Promise<void>) | null> {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const result = await redis.set(key, token, "PX", LOCK_TTL_MS, "NX");

  if (result !== "OK") {
    // someone else already holds this lock
    return null;
  }

  const release = async () => {
    // atomic: only delete if we still own the key
    await redis.eval(RELEASE_SCRIPT, 1, key, token);
  };

  return release;
}
