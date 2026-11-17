export function formatFirestoreErrorMessage(err: unknown, actionPrefix: string): string {
  console.error(`[Salonéo] ${actionPrefix}:`, err);

  let rawMessage = '';
  if (err instanceof Error) {
    rawMessage = err.message;
  } else if (typeof err === 'string') {
    rawMessage = err;
  }

  let parsedError = rawMessage;
  let pathInfo = '';
  if (rawMessage.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage) as {
        error?: string;
        path?: string | null;
        operationType?: string;
      };
      if (parsed.error) parsedError = parsed.error;
      if (parsed.path) pathInfo = parsed.path;
    } catch {
      // Keep rawMessage
    }
  }

  const lower = parsedError.toLowerCase();

  if (lower.includes('quota exceeded')) {
    return `${actionPrefix} : le quota journalier gratuit de la base de données est dépassé. Réessayez demain.`;
  }

  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return pathInfo
      ? `${actionPrefix} : accès refusé par les règles de sécurité (${pathInfo}). Vérifiez que vous êtes bien connecté avec le compte du salon.`
      : `${actionPrefix} : accès refusé par les règles de sécurité. Vérifiez que vous êtes bien connecté avec le compte du salon.`;
  }

  if (lower.includes('unavailable') || lower.includes('offline') || lower.includes('network')) {
    return `${actionPrefix} : connexion réseau ou base de données inaccessible. Vérifiez votre connexion Internet.`;
  }

  if (lower.includes('not-found') || lower.includes('no document to update')) {
    return `${actionPrefix} : élément introuvable dans la base de données.`;
  }

  if (lower.includes('invalid-argument')) {
    return `${actionPrefix} : certaines valeurs saisies ne sont pas dans le format attendu.`;
  }

  if (parsedError) {
    return `${actionPrefix} : ${parsedError}`;
  }

  return `${actionPrefix} : une erreur inattendue s'est produite.`;
}
