/** Shopify rejected the stored token, which happens after an uninstall and reinstall. */
export class AdminAuthError extends Error {
  constructor() {
    super("Stale session cleared");
    this.name = "AdminAuthError";
  }
}

/**
 * Calls the Admin API. On a 401 it deletes the stale session, and the caller answers 401 with
 * the retry header. App Bridge then retries, and token exchange creates a new session
 * (S1 in specs/10-spikes.md).
 */
export function createAdminClient({ createGraphqlClient, deleteSession }) {
  return {
    async request(session, query, variables) {
      try {
        const response = await createGraphqlClient(session).request(query, { variables });
        return response.data;
      } catch (error) {
        if (error.response?.code === 401) {
          await deleteSession(session.id);
          throw new AdminAuthError();
        }
        throw error;
      }
    },
  };
}
