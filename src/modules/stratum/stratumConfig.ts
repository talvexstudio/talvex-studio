export type StratumMode = 'demo' | 'app';

/**
 * STRATUM_MODE
 * demo 60 seeded data, persona switching, demo entry flow
 * app  60 real auth, persistence (future)
 */
export const STRATUM_MODE: StratumMode = 'demo';

export const IS_DEMO = STRATUM_MODE === 'demo';
