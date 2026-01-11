const extractHostname = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (trimmed.includes('://')) {
        try {
            return new URL(trimmed).hostname.toLowerCase();
        } catch {
            return null;
        }
    }

    const withoutPath = trimmed.split('/')[0] ?? '';
    const host = withoutPath.split(':')[0];
    return host ? host.toLowerCase() : null;
};

export const isRedirectUriAllowed = (redirectUri: string): boolean => {
    let url: URL;
    try {
        url = new URL(redirectUri);
    } catch {
        return false;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return false;
    }

    const allowlistRaw = process.env.REDIRECT_URI_ALLOWLIST || '';
    const allowlist = allowlistRaw
        .split(',')
        .map((entry) => extractHostname(entry))
        .filter((entry): entry is string => Boolean(entry));

    if (allowlist.length === 0) {
        return true;
    }

    const hostname = url.hostname.toLowerCase();
    return allowlist.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
};
