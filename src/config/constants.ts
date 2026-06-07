/** Maximum social points a single channel post can earn (anti-farming cap). */
export const CHANNEL_POST_POINTS_CAP = 50;

/** Standard points per like / recast before weighting. */
export const POINTS_PER_LIKE = 1;
export const POINTS_PER_RECAST = 2;

/** Exponential base applied to premium (high-reputation) interactions. */
export const PREMIUM_INTERACTION_EXPONENT = 1.35;

/** Epoch cycle durations in milliseconds. */
export const SUBMISSION_PHASE_MS = 12 * 60 * 60 * 1000;
export const VOTING_PHASE_MS = 24 * 60 * 60 * 1000;

/** Guaranteed share of voting-feed slots reserved for ROOKIE-tier submissions. */
export const ROOKIE_VISIBILITY_QUOTA = 0.2;

/** Visibility boost applied when a submission has physical proof (NFC / gesture). */
export const PHYSICAL_PROOF_VISIBILITY_BOOST = 100;

/** Votes cast while totalVotes < this threshold qualify as "early" for trendsetter rewards. */
export const TRENDSETTER_EARLY_VOTE_THRESHOLD = 10;

/** Minimum elite-curator votes required on a submission to trigger trendsetter settlement. */
export const TRENDSETTER_ELITE_VOTE_THRESHOLD = 3;

/** Multiplier applied to reputation/social rewards for qualifying trendsetters. */
export const TRENDSETTER_MULTIPLIER = 2.5;

/** Base reputation reward for casting a vote during the voting phase. */
export const BASE_VOTE_REPUTATION_REWARD = 10;
export const BASE_VOTE_SOCIAL_POINTS_REWARD = 5;

/**
 * Asymptotic clique-farming dampener: reward scales as base / (1 + factor * totalVotes).
 * Higher consensus posts yield diminishing returns for the voter.
 */
export const CLIQUE_FARMING_DAMPENING_FACTOR = 0.15;

/** High-consensus threshold where clique farming penalty becomes severe. */
export const HIGH_CONSENSUS_VOTE_THRESHOLD = 25;
