/**
 * fetchJson — fetch with retry + exponential backoff.
 * Retries on network errors, 429 (rate limit), 403 (iTunes rate limit) and 5xx.
 */
const isRetryable = (status: number): boolean =>
  status === 429 || status === 403 || status >= 500;

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface FetchJsonOptions {
  tries?: number;
  label?: string;
}

export async function fetchJson<T = unknown>(
  url: string,
  { tries = 4, label = "fetch" }: FetchJsonOptions = {},
): Promise<T> {
  let delay = 800;

  for (let attempt = 1; attempt <= tries; attempt++) {
    let response: Response | undefined;

    try {
      response = await fetch(url, { headers: { accept: "application/json" } });
    } catch (error) {
      if (attempt === tries) {
        throw new Error(`${label}: network error (${(error as Error).message})`);
      }
    }

    if (response) {
      if (response.ok) {
        return (await response.json()) as T;
      }

      if (!isRetryable(response.status)) {
        throw new Error(`${label}: HTTP ${response.status} for ${url}`);
      }

      if (attempt === tries) {
        throw new Error(`${label}: HTTP ${response.status} after ${tries} attempts`);
      }
    }

    await sleep(delay);
    delay *= 2;
  }

  throw new Error(`${label}: exhausted retries`);
}
