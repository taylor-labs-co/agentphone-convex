const DEFAULT_INITIAL_BACKOFF_MS = 1000;
const DEFAULT_MAX_BACKOFF_MS = 30 * 60 * 1000;

export function nextWebhookRetryDelayMs(
  attempt: number,
  options: {
    initialBackoffMs?: number;
    maxBackoffMs?: number;
  } = {},
) {
  const initialBackoffMs = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const exponent = Math.max(0, attempt - 1);
  return Math.min(initialBackoffMs * 2 ** exponent, maxBackoffMs);
}

export function shouldRetryWebhookDispatch(args: {
  attempt: number;
  maxAttempts: number;
}) {
  return args.attempt < args.maxAttempts;
}
