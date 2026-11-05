import { buildHint, serializeHint } from "../../shared/hint.js";
import { AdminAuthError } from "./adminClient.js";

const INSTALLATION_QUERY = `{ currentAppInstallation { id } }`;
const SET_METAFIELD = `mutation($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) { userErrors { field message } }
}`;

/** Writes the Liquid hint, rebuilt from MongoDB each time, with writes queued per shop. */
export function createHintSync({ admin, timers, shopState }) {
  const queues = new Map();

  async function write(session) {
    const hint = buildHint(await timers.listAll(session.shop), Date.now());
    const { currentAppInstallation } = await admin.request(session, INSTALLATION_QUERY);
    const data = await admin.request(session, SET_METAFIELD, {
      metafields: [
        {
          ownerId: currentAppInstallation.id,
          namespace: "countdown",
          key: "timer_hint",
          type: "json",
          value: serializeHint(hint),
        },
      ],
    });
    const errors = data.metafieldsSet.userErrors;
    if (errors.length) throw new Error(`metafieldsSet: ${JSON.stringify(errors)}`);
  }

  function enqueue(session) {
    const previous = queues.get(session.shop) ?? Promise.resolve();
    const run = previous.catch(() => {}).then(() => write(session));
    const settled = run.finally(() => {
      if (queues.get(session.shop) === settled) queues.delete(session.shop);
    });
    queues.set(session.shop, settled);
    return settled;
  }

  return {
    /**
     * Returns "ok" or "failed", and never fails a save. With rethrowAuth, a stale session is
     * passed up so the caller can answer 401, which is only safe for requests that can be
     * retried without side effects.
     */
    async sync(session, { rethrowAuth = false } = {}) {
      try {
        await enqueue(session);
        await shopState.recordHintSync(session.shop, true);
        return "ok";
      } catch (error) {
        console.error(`Hint sync failed for ${session.shop}: ${error.message}`);
        await shopState.recordHintSync(session.shop, false);
        if (rethrowAuth && error instanceof AdminAuthError) throw error;
        return "failed";
      }
    },
  };
}
