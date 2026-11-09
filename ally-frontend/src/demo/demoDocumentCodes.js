const CODE_LIFETIME = 5 * 60_000;
const ACCESS_LIFETIME = 15 * 60_000;
const MAX_ATTEMPTS = 5;

export function createDemoDocumentCodes(getSessionId) {
  const challenges = new Map();
  const grants = new Map();
  let sessionId;

  const resetForNewSession = () => {
    const current = getSessionId();
    if (current === sessionId) return;
    challenges.clear();
    grants.clear();
    sessionId = current;
  };

  const verify = (scope, code) => {
    resetForNewSession();
    const challenge = challenges.get(scope);
    if (!challenge || challenge.expiresAt <= Date.now()) {
      challenges.delete(scope);
      throw Object.assign(new Error('The practice code expired. Request a new code.'), { status: 410 });
    }
    if (challenge.code === code) {
      challenges.delete(scope);
      return;
    }
    challenge.attempts--;
    if (challenge.attempts === 0) {
      challenges.delete(scope);
      throw Object.assign(new Error('Too many incorrect attempts. Request a new practice code.'), { status: 410 });
    }
    throw new Error(`Incorrect code. Attempts remaining: ${challenge.attempts}`);
  };

  const workspaceAccess = caseId => {
    resetForNewSession();
    const expiresAt = grants.get(String(caseId)) || 0;
    return { unlocked: expiresAt > Date.now(), expiresAt };
  };

  return {
    issue(scope) {
      resetForNewSession();
      const now = Date.now();
      for (const [key, challenge] of challenges) {
        if (challenge.expiresAt <= now) challenges.delete(key);
      }
      const [random] = crypto.getRandomValues(new Uint32Array(1));
      const code = String(random % 1_000_000).padStart(6, '0');
      challenges.set(scope, { code, expiresAt: now + CODE_LIFETIME, attempts: MAX_ATTEMPTS });
      return { code };
    },
    verify,
    workspaceAccess,
    unlockWorkspace(caseId, code) {
      verify(`workspace:${caseId}`, code);
      grants.set(String(caseId), Date.now() + ACCESS_LIFETIME);
      return workspaceAccess(caseId);
    },
    requireWorkspaceAccess(caseId) {
      if (!workspaceAccess(caseId).unlocked) throw new Error('Unlock the document workspace with a practice code first.');
    },
  };
}
