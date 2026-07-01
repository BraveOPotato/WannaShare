// Stable-id + human name generation.

const ADJECTIVES = [
  'cheery', 'colorful', 'wild', 'brave', 'clever', 'gentle', 'happy', 'lucky',
  'mighty', 'nimble', 'quiet', 'rapid', 'shiny', 'snappy', 'sunny', 'swift',
  'witty', 'zippy', 'cosmic', 'breezy', 'jolly', 'plucky', 'spry', 'bold',
];

const ANIMALS = [
  'bird', 'pigeon', 'wolf', 'otter', 'fox', 'lynx', 'panda', 'koala', 'heron',
  'falcon', 'badger', 'gecko', 'moose', 'raven', 'seal', 'stork', 'tiger',
  'walrus', 'yak', 'zebra', 'hare', 'newt', 'orca', 'quail',
];

function pick<T>(arr: readonly T[]): T {
  // arr is always non-empty here; assert for noUncheckedIndexedAccess.
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** e.g. "cheery-bird-2342" — matches the on-screen naming style. */
export function generateDisplayName(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${n}`;
}

/** A stable, opaque device id (uuid v4 where available). */
export function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Short unique id for chat items / file transfers. */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}
