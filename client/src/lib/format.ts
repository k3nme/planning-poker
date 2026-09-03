export const clsx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '?';

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** Room code in the URL: /r/ABC123 (with ?room= as a fallback). */
export function readRoomFromLocation(): string {
  const path = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{1,6})/);
  if (path) return path[1].toUpperCase();
  const query = new URLSearchParams(window.location.search).get('room');
  return query ? query.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '';
}

export const roomUrl = (code: string) => `${window.location.origin}/r/${code}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Turns a failed API call into something that points at the real problem.
 *
 * A dead network and a host that answers 404 are very different faults, and
 * "is the server running?" sends people hunting in the wrong place when the
 * app has been deployed somewhere that never had an API to begin with.
 */
export function describeApiFailure(status?: number): string {
  if (status === undefined) {
    return 'Could not reach the server — check your connection.';
  }
  if (status === 404) {
    return 'The server has no API at /api. If this is a deployment, it needs a host that runs Node, not serverless.';
  }
  if (status >= 500) {
    return `The server hit an error (HTTP ${status}). Try again in a moment.`;
  }
  return `The server refused the request (HTTP ${status}).`;
}

/** A JSON endpoint that answers with HTML is a router serving the SPA shell. */
export const looksLikeJson = (response: Response) =>
  (response.headers.get('content-type') ?? '').includes('json');
