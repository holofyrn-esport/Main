
/**
 * HoloFyrn League Predictor
 * Framework-agnostic ES module. No external dependencies.
 *
 * Main ideas:
 *  - Seeds are only used to create an INITIAL rating when no manual rating is given.
 *  - Only REAL, already-played matches can update ratings.
 *  - Future matches never change team ratings mid-simulation.
 *  - Future series are modeled probabilistically, including possible series scorelines.
 *  - Exact enumeration is used while the scenario count stays manageable.
 *  - Monte Carlo is used automatically for larger remaining schedules.
 *  - Standings are recalculated after every simulated season using configurable tiebreakers.
 */

const DEFAULTS = {
  baseRating: 1500,
  seedGap: 60,
  eloScale: 400,
  eloK: 28,
  ratingSource: "manual-or-seed", // "manual-or-seed" | "seed"
  updateRatingsFromPlayedMatches: true,

  bestOf: 5,

  // exact enumeration can branch into multiple possible SERIES SCORES per fixture.
  maxExactScenarios: 500_000,
  monteCarloRuns: 250_000,
  randomSeed: 1337,

  // Available values:
  // "matchWins", "h2hWins", "h2hGameDiff", "gameDiff", "gamesWon", "seed"
  tiebreakers: [
    "matchWins",
    "h2hWins",
    "h2hGameDiff",
    "gameDiff",
    "gamesWon",
    "seed",
  ],

  targetMode: "exact", // "exact" | "top"
  targetPosition: 1,

  selectedTeamId: null,

  // Example:
  // forcedOutcomes: {
  //   "fx-1": { winnerId: "HF" },
  //   "fx-2": { winnerId: "A", winnerGames: 3, loserGames: 1 }
  // }
  forcedOutcomes: {},

  // Only used to classify "must win" in exact mode.
  probabilityEpsilon: 1e-12,
};

export function createLeaguePredictor(input, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const data = normalizeInput(input, cfg);

  if (!cfg.selectedTeamId) {
    cfg.selectedTeamId = data.teams[0]?.id ?? null;
  }
  if (!cfg.selectedTeamId || !data.teamById.has(cfg.selectedTeamId)) {
    throw new Error("selectedTeamId must reference a valid team.");
  }

  // Step 1: initial ratings from manual rating or seed.
  const initialRatings = createInitialRatings(data.teams, cfg);

  // Step 2: update ratings only from REAL played matches.
  const currentRatings = cfg.updateRatingsFromPlayedMatches
    ? updateRatingsFromHistory(
        initialRatings,
        data.playedMatches,
        cfg
      )
    : new Map(initialRatings);

  // Step 3: build probabilistic future outcome distributions.
  const future = data.remainingFixtures.map((fixture) => {
    const dist = buildFixtureOutcomeDistribution(
      fixture,
      currentRatings,
      cfg
    );
    return { fixture, outcomes: dist };
  });

  // Step 4: decide exact vs Monte Carlo.
  const estimatedScenarioCount = estimateScenarioCount(future, cfg);
  const mode =
    estimatedScenarioCount <= cfg.maxExactScenarios
      ? "exact"
      : "monte-carlo";

  const context = {
    data,
    cfg,
    ratings: currentRatings,
    future,
    estimatedScenarioCount,
  };

  const analysis =
    mode === "exact"
      ? runExactAnalysis(context)
      : runMonteCarloAnalysis(context);

  return {
    mode,
    selectedTeamId: cfg.selectedTeamId,
    target: {
      mode: cfg.targetMode,
      position: cfg.targetPosition,
    },
    estimatedScenarioCount,
    ratings: mapRatingsToObject(currentRatings, data.teamById),
    ...analysis,
  };
}

/* -------------------------------------------------------------------------- */
/*                                INPUT MODEL                                 */
/* -------------------------------------------------------------------------- */

function normalizeInput(input, cfg) {
  if (!input || !Array.isArray(input.teams) || input.teams.length < 2) {
    throw new Error("input.teams must contain at least two teams.");
  }

  const teamIds = new Set();
  const teams = input.teams.map((team, index) => {
    if (!team.id) throw new Error(`Team at index ${index} is missing id.`);
    if (teamIds.has(team.id)) throw new Error(`Duplicate team id: ${team.id}`);
    teamIds.add(team.id);

    const seed = Number.isFinite(team.seed) ? Number(team.seed) : index + 1;

    return {
      id: String(team.id),
      name: String(team.name ?? team.id),
      seed,
      rating: Number.isFinite(team.rating) ? Number(team.rating) : null,
    };
  });

  const teamById = new Map(teams.map((t) => [t.id, t]));

  const playedMatches = (input.playedMatches ?? []).map((m, index) =>
    normalizePlayedMatch(m, index, teamById, cfg)
  );

  const remainingFixtures = (input.remainingFixtures ?? []).map((f, index) =>
    normalizeFixture(f, index, teamById, cfg)
  );

  return { teams, teamById, playedMatches, remainingFixtures };
}

function normalizePlayedMatch(m, index, teamById, cfg) {
  const id = String(m.id ?? `played-${index + 1}`);
  const teamAId = String(m.teamAId);
  const teamBId = String(m.teamBId);
  validateTeams(teamAId, teamBId, teamById, id);

  const winnerId = String(m.winnerId);
  if (winnerId !== teamAId && winnerId !== teamBId) {
    throw new Error(`Played match ${id}: winnerId must be one of the teams.`);
  }

  const bestOf = normalizeBestOf(m.bestOf ?? cfg.bestOf);
  const needed = Math.floor(bestOf / 2) + 1;

  let teamAGames = Number.isFinite(m.teamAGames) ? Number(m.teamAGames) : null;
  let teamBGames = Number.isFinite(m.teamBGames) ? Number(m.teamBGames) : null;

  // If score is omitted, create the minimum valid score.
  if (teamAGames === null || teamBGames === null) {
    if (winnerId === teamAId) {
      teamAGames = needed;
      teamBGames = Math.max(0, needed - 1);
    } else {
      teamBGames = needed;
      teamAGames = Math.max(0, needed - 1);
    }
  }

  return {
    id,
    teamAId,
    teamBId,
    winnerId,
    teamAGames,
    teamBGames,
    bestOf,
    order: Number.isFinite(m.order) ? Number(m.order) : index,
  };
}

function normalizeFixture(f, index, teamById, cfg) {
  const id = String(f.id ?? `fixture-${index + 1}`);
  const teamAId = String(f.teamAId);
  const teamBId = String(f.teamBId);
  validateTeams(teamAId, teamBId, teamById, id);

  return {
    id,
    teamAId,
    teamBId,
    bestOf: normalizeBestOf(f.bestOf ?? cfg.bestOf),
  };
}

function validateTeams(teamAId, teamBId, teamById, matchId) {
  if (teamAId === teamBId) {
    throw new Error(`Match ${matchId}: a team cannot play itself.`);
  }
  if (!teamById.has(teamAId) || !teamById.has(teamBId)) {
    throw new Error(`Match ${matchId}: unknown team id.`);
  }
}

function normalizeBestOf(bestOf) {
  const value = Number(bestOf);
  if (!Number.isInteger(value) || value < 1 || value % 2 === 0) {
    throw new Error(`bestOf must be a positive odd integer. Received: ${bestOf}`);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*                             RATING / WIN MODEL                              */
/* -------------------------------------------------------------------------- */

function createInitialRatings(teams, cfg) {
  const count = teams.length;
  const ratings = new Map();

  for (const team of teams) {
    let rating;

    if (
      cfg.ratingSource === "manual-or-seed" &&
      Number.isFinite(team.rating)
    ) {
      rating = team.rating;
    } else {
      // Seed #1 strongest.
      rating = cfg.baseRating + (count - team.seed) * cfg.seedGap;
    }

    ratings.set(team.id, rating);
  }

  return ratings;
}

function updateRatingsFromHistory(initialRatings, playedMatches, cfg) {
  const ratings = new Map(initialRatings);
  const ordered = [...playedMatches].sort((a, b) => a.order - b.order);

  for (const match of ordered) {
    const ra = ratings.get(match.teamAId);
    const rb = ratings.get(match.teamBId);

    const expectedA = eloProbability(ra, rb, cfg.eloScale);
    const scoreA = match.winnerId === match.teamAId ? 1 : 0;

    const marginMultiplier = seriesMarginMultiplier(
      match.teamAGames,
      match.teamBGames
    );

    const delta = cfg.eloK * marginMultiplier * (scoreA - expectedA);

    ratings.set(match.teamAId, ra + delta);
    ratings.set(match.teamBId, rb - delta);
  }

  return ratings;
}

function seriesMarginMultiplier(aGames, bGames) {
  const margin = Math.abs(aGames - bGames);
  // Mild adjustment only; avoids overreacting to one sweep.
  return 1 + Math.min(margin, 4) * 0.08;
}

export function eloProbability(ratingA, ratingB, eloScale = 400) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / eloScale));
}

/**
 * Converts per-game win probability into exact BO-series score probabilities.
 *
 * Example BO5:
 * A 3-0, A 3-1, A 3-2, B 3-0, B 3-1, B 3-2
 */
function seriesScoreDistribution(teamAId, teamBId, pGameA, bestOf) {
  const needed = Math.floor(bestOf / 2) + 1;
  const outcomes = [];

  // A wins needed:j, j=0...(needed-1)
  for (let j = 0; j < needed; j++) {
    const prob =
      combination(needed + j - 1, j) *
      Math.pow(pGameA, needed) *
      Math.pow(1 - pGameA, j);

    outcomes.push({
      winnerId: teamAId,
      loserId: teamBId,
      teamAGames: needed,
      teamBGames: j,
      probability: prob,
    });
  }

  // B wins j:needed from A perspective.
  const pGameB = 1 - pGameA;
  for (let j = 0; j < needed; j++) {
    const prob =
      combination(needed + j - 1, j) *
      Math.pow(pGameB, needed) *
      Math.pow(1 - pGameB, j);

    outcomes.push({
      winnerId: teamBId,
      loserId: teamAId,
      teamAGames: j,
      teamBGames: needed,
      probability: prob,
    });
  }

  // Floating-point normalization.
  const total = outcomes.reduce((s, o) => s + o.probability, 0);
  for (const o of outcomes) o.probability /= total;

  return outcomes;
}

function buildFixtureOutcomeDistribution(fixture, ratings, cfg) {
  const forced = cfg.forcedOutcomes?.[fixture.id];
  const needed = Math.floor(fixture.bestOf / 2) + 1;

  if (forced) {
    const winnerId = String(forced.winnerId);
    if (winnerId !== fixture.teamAId && winnerId !== fixture.teamBId) {
      throw new Error(`Forced winner for ${fixture.id} is not in the fixture.`);
    }

    let teamAGames;
    let teamBGames;

    if (
      Number.isFinite(forced.winnerGames) &&
      Number.isFinite(forced.loserGames)
    ) {
      if (winnerId === fixture.teamAId) {
        teamAGames = Number(forced.winnerGames);
        teamBGames = Number(forced.loserGames);
      } else {
        teamAGames = Number(forced.loserGames);
        teamBGames = Number(forced.winnerGames);
      }
    } else {
      // If only the winner is forced, preserve score uncertainty among that winner's
      // possible scorelines and renormalize those branches to 100%.
      const ra = ratings.get(fixture.teamAId);
      const rb = ratings.get(fixture.teamBId);
      const pSeriesA = eloProbability(ra, rb, cfg.eloScale);
      const pGameA = invertSeriesWinProbability(pSeriesA, fixture.bestOf);
      const all = seriesScoreDistribution(
        fixture.teamAId,
        fixture.teamBId,
        pGameA,
        fixture.bestOf
      );
      const filtered = all.filter((o) => o.winnerId === winnerId);
      const subtotal = filtered.reduce((s, o) => s + o.probability, 0);
      return filtered.map((o) => ({
        ...o,
        probability: o.probability / subtotal,
      }));
    }

    return [
      {
        winnerId,
        loserId:
          winnerId === fixture.teamAId ? fixture.teamBId : fixture.teamAId,
        teamAGames,
        teamBGames,
        probability: 1,
      },
    ];
  }

  const ra = ratings.get(fixture.teamAId);
  const rb = ratings.get(fixture.teamBId);

  // Elo is interpreted as SERIES-win probability. For a BO-series we then
  // infer the per-game probability that produces that same overall series
  // chance. This avoids accidentally "double amplifying" favourites.
  const pSeriesA = eloProbability(ra, rb, cfg.eloScale);
  const pGameA = invertSeriesWinProbability(pSeriesA, fixture.bestOf);

  return seriesScoreDistribution(
    fixture.teamAId,
    fixture.teamBId,
    pGameA,
    fixture.bestOf
  );
}

function seriesWinProbabilityFromGameP(pGame, bestOf) {
  const needed = Math.floor(bestOf / 2) + 1;
  let total = 0;
  for (let j = 0; j < needed; j++) {
    total +=
      combination(needed + j - 1, j) *
      Math.pow(pGame, needed) *
      Math.pow(1 - pGame, j);
  }
  return total;
}

function invertSeriesWinProbability(targetSeriesP, bestOf) {
  if (targetSeriesP <= 0) return 0;
  if (targetSeriesP >= 1) return 1;

  let lo = 0;
  let hi = 1;

  // Binary search is plenty precise for probability display and simulation.
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pSeries = seriesWinProbabilityFromGameP(mid, bestOf);
    if (pSeries < targetSeriesP) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*                                  STANDINGS                                  */
/* -------------------------------------------------------------------------- */

function baseStats(teams) {
  return new Map(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id,
        matchWins: 0,
        matchLosses: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDiff: 0,
      },
    ])
  );
}

function applyMatchToStats(stats, match) {
  const a = stats.get(match.teamAId);
  const b = stats.get(match.teamBId);

  if (match.winnerId === match.teamAId) {
    a.matchWins++;
    b.matchLosses++;
  } else {
    b.matchWins++;
    a.matchLosses++;
  }

  a.gamesWon += match.teamAGames;
  a.gamesLost += match.teamBGames;
  b.gamesWon += match.teamBGames;
  b.gamesLost += match.teamAGames;

  a.gameDiff = a.gamesWon - a.gamesLost;
  b.gameDiff = b.gamesWon - b.gamesLost;
}

function calculateStandings(teams, allMatches, tiebreakers) {
  const stats = baseStats(teams);

  for (const match of allMatches) {
    applyMatchToStats(stats, match);
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  let rows = teams.map((team) => ({
    ...stats.get(team.id),
    name: team.name,
    seed: team.seed,
  }));

  // First criterion is usually match wins. We explicitly group on it so that
  // H2H can be calculated only among teams that are actually tied.
  rows.sort((a, b) => b.matchWins - a.matchWins);

  const winGroups = groupBy(rows, (r) => r.matchWins);
  const finalRows = [];

  for (const group of winGroups) {
    if (group.length === 1) {
      finalRows.push(group[0]);
      continue;
    }

    const tiedIds = new Set(group.map((g) => g.teamId));
    const h2h = calculateMiniTable(tiedIds, allMatches);

    group.sort((a, b) => {
      for (const criterion of tiebreakers) {
        let av, bv, direction;

        switch (criterion) {
          case "matchWins":
            continue; // already equal inside this group
          case "h2hWins":
            av = h2h.get(a.teamId)?.wins ?? 0;
            bv = h2h.get(b.teamId)?.wins ?? 0;
            direction = "desc";
            break;
          case "h2hGameDiff":
            av = h2h.get(a.teamId)?.gameDiff ?? 0;
            bv = h2h.get(b.teamId)?.gameDiff ?? 0;
            direction = "desc";
            break;
          case "gameDiff":
            av = a.gameDiff;
            bv = b.gameDiff;
            direction = "desc";
            break;
          case "gamesWon":
            av = a.gamesWon;
            bv = b.gamesWon;
            direction = "desc";
            break;
          case "seed":
            av = a.seed;
            bv = b.seed;
            direction = "asc"; // lower seed = stronger
            break;
          default:
            continue;
        }

        if (av !== bv) {
          return direction === "desc" ? bv - av : av - bv;
        }
      }

      // Stable deterministic fallback.
      return a.name.localeCompare(b.name);
    });

    finalRows.push(...group);
  }

  return finalRows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}

function calculateMiniTable(tiedIds, allMatches) {
  const map = new Map(
    [...tiedIds].map((id) => [id, { wins: 0, losses: 0, gameDiff: 0 }])
  );

  for (const match of allMatches) {
    if (!tiedIds.has(match.teamAId) || !tiedIds.has(match.teamBId)) continue;

    const a = map.get(match.teamAId);
    const b = map.get(match.teamBId);

    if (match.winnerId === match.teamAId) {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }

    a.gameDiff += match.teamAGames - match.teamBGames;
    b.gameDiff += match.teamBGames - match.teamAGames;
  }

  return map;
}

function groupBy(items, keyFn) {
  const groups = [];
  let current = [];
  let currentKey;

  for (const item of items) {
    const key = keyFn(item);
    if (current.length === 0 || key === currentKey) {
      current.push(item);
      currentKey = key;
    } else {
      groups.push(current);
      current = [item];
      currentKey = key;
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function qualifies(position, cfg) {
  return cfg.targetMode === "top"
    ? position <= cfg.targetPosition
    : position === cfg.targetPosition;
}

/* -------------------------------------------------------------------------- */
/*                             EXACT ENUMERATION                               */
/* -------------------------------------------------------------------------- */

function estimateScenarioCount(future, cfg) {
  let count = 1;
  for (const f of future) {
    count *= f.outcomes.length;
    if (count > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  }
  return count;
}

function runExactAnalysis(context) {
  const { data, cfg, future } = context;
  const selectedId = cfg.selectedTeamId;

  const finishWeight = new Map(
    data.teams.map((_, i) => [i + 1, 0])
  );

  const fixtureAgg = initFixtureAggregates(future, selectedId);
  let targetProbability = 0;
  let totalProbability = 0;
  let successfulPathCount = 0;
  let bestPath = null;
  let bestPathProbability = -1;

  const chosen = new Array(future.length);

  function dfs(index, probability, simulatedMatches) {
    if (index === future.length) {
      const allMatches = [...data.playedMatches, ...simulatedMatches];
      const standings = calculateStandings(
        data.teams,
        allMatches,
        cfg.tiebreakers
      );
      const row = standings.find((r) => r.teamId === selectedId);
      const position = row.position;
      const hit = qualifies(position, cfg);

      totalProbability += probability;
      finishWeight.set(position, finishWeight.get(position) + probability);

      if (hit) {
        targetProbability += probability;
        successfulPathCount++;
        if (probability > bestPathProbability) {
          bestPathProbability = probability;
          bestPath = chosen.map((x) => ({ ...x }));
        }
      }

      updateFixtureAggregates(
        fixtureAgg,
        future,
        chosen,
        probability,
        hit,
        selectedId
      );
      return;
    }

    const { fixture, outcomes } = future[index];

    for (const outcome of outcomes) {
      const simulated = {
        id: fixture.id,
        teamAId: fixture.teamAId,
        teamBId: fixture.teamBId,
        winnerId: outcome.winnerId,
        teamAGames: outcome.teamAGames,
        teamBGames: outcome.teamBGames,
        bestOf: fixture.bestOf,
      };

      chosen[index] = {
        fixtureId: fixture.id,
        teamAId: fixture.teamAId,
        teamBId: fixture.teamBId,
        winnerId: outcome.winnerId,
        teamAGames: outcome.teamAGames,
        teamBGames: outcome.teamBGames,
        probability: outcome.probability,
      };

      dfs(
        index + 1,
        probability * outcome.probability,
        [...simulatedMatches, simulated]
      );
    }
  }

  dfs(0, 1, []);

  return finalizeAnalysis({
    context,
    mode: "exact",
    finishWeight,
    totalProbability,
    targetProbability,
    fixtureAgg,
    bestPath,
    bestPathProbability,
    successfulPathCount,
    simulationRuns: null,
  });
}

/* -------------------------------------------------------------------------- */
/*                              MONTE CARLO                                    */
/* -------------------------------------------------------------------------- */

function runMonteCarloAnalysis(context) {
  const { data, cfg, future } = context;
  const selectedId = cfg.selectedTeamId;
  const rng = mulberry32(cfg.randomSeed);

  const finishCount = new Map(
    data.teams.map((_, i) => [i + 1, 0])
  );
  const fixtureAgg = initFixtureAggregates(future, selectedId);

  let targetCount = 0;
  let bestPath = null;
  let bestPathProbability = -1;
  let successfulPathCount = 0;

  for (let run = 0; run < cfg.monteCarloRuns; run++) {
    const simulatedMatches = [];
    const chosen = [];
    let pathProbability = 1;

    for (const { fixture, outcomes } of future) {
      const outcome = sampleOutcome(outcomes, rng);
      pathProbability *= outcome.probability;

      simulatedMatches.push({
        id: fixture.id,
        teamAId: fixture.teamAId,
        teamBId: fixture.teamBId,
        winnerId: outcome.winnerId,
        teamAGames: outcome.teamAGames,
        teamBGames: outcome.teamBGames,
        bestOf: fixture.bestOf,
      });

      chosen.push({
        fixtureId: fixture.id,
        teamAId: fixture.teamAId,
        teamBId: fixture.teamBId,
        winnerId: outcome.winnerId,
        teamAGames: outcome.teamAGames,
        teamBGames: outcome.teamBGames,
        probability: outcome.probability,
      });
    }

    const allMatches = [...data.playedMatches, ...simulatedMatches];
    const standings = calculateStandings(
      data.teams,
      allMatches,
      cfg.tiebreakers
    );

    const row = standings.find((r) => r.teamId === selectedId);
    const position = row.position;
    const hit = qualifies(position, cfg);

    finishCount.set(position, finishCount.get(position) + 1);

    if (hit) {
      targetCount++;
      successfulPathCount++;
      if (pathProbability > bestPathProbability) {
        bestPathProbability = pathProbability;
        bestPath = chosen.map((x) => ({ ...x }));
      }
    }

    updateFixtureAggregates(
      fixtureAgg,
      future,
      chosen,
      1,
      hit,
      selectedId
    );
  }

  const finishWeight = new Map(
    [...finishCount].map(([pos, count]) => [
      pos,
      count / cfg.monteCarloRuns,
    ])
  );

  return finalizeAnalysis({
    context,
    mode: "monte-carlo",
    finishWeight,
    totalProbability: 1,
    targetProbability: targetCount / cfg.monteCarloRuns,
    fixtureAgg,
    bestPath,
    bestPathProbability,
    successfulPathCount,
    simulationRuns: cfg.monteCarloRuns,
  });
}

function sampleOutcome(outcomes, rng) {
  const r = rng();
  let acc = 0;
  for (const outcome of outcomes) {
    acc += outcome.probability;
    if (r <= acc) return outcome;
  }
  return outcomes[outcomes.length - 1];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*                         CONDITIONAL / IMPACT STATS                           */
/* -------------------------------------------------------------------------- */

function initFixtureAggregates(future, selectedId) {
  const map = new Map();

  for (const { fixture } of future) {
    map.set(fixture.id, {
      fixtureId: fixture.id,
      teamAId: fixture.teamAId,
      teamBId: fixture.teamBId,

      // total branch/run mass where A/B wins
      aWinMass: 0,
      bWinMass: 0,

      // target-success mass within those branches
      aWinTargetMass: 0,
      bWinTargetMass: 0,

      // selected team lens
      involvesSelected:
        fixture.teamAId === selectedId || fixture.teamBId === selectedId,
    });
  }

  return map;
}

function updateFixtureAggregates(
  fixtureAgg,
  future,
  chosen,
  scenarioMass,
  hitTarget,
  selectedId
) {
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    const agg = fixtureAgg.get(c.fixtureId);

    if (c.winnerId === c.teamAId) {
      agg.aWinMass += scenarioMass;
      if (hitTarget) agg.aWinTargetMass += scenarioMass;
    } else {
      agg.bWinMass += scenarioMass;
      if (hitTarget) agg.bWinTargetMass += scenarioMass;
    }
  }
}

function conditionalProbability(hitMass, branchMass) {
  if (branchMass <= 0) return null;
  return hitMass / branchMass;
}

function finalizeAnalysis({
  context,
  mode,
  finishWeight,
  totalProbability,
  targetProbability,
  fixtureAgg,
  bestPath,
  bestPathProbability,
  successfulPathCount,
  simulationRuns,
}) {
  const { data, cfg, future } = context;
  const selectedId = cfg.selectedTeamId;

  const finishDistribution = [...finishWeight]
    .sort((a, b) => a[0] - b[0])
    .map(([position, mass]) => ({
      position,
      probability: normalizeProbability(mass / totalProbability),
    }));

  const fixtureImpacts = [];

  for (const { fixture } of future) {
    const agg = fixtureAgg.get(fixture.id);
    const pTargetIfAWin = conditionalProbability(
      agg.aWinTargetMass,
      agg.aWinMass
    );
    const pTargetIfBWin = conditionalProbability(
      agg.bWinTargetMass,
      agg.bWinMass
    );

    const row = {
      fixtureId: fixture.id,
      teamAId: fixture.teamAId,
      teamAName: data.teamById.get(fixture.teamAId).name,
      teamBId: fixture.teamBId,
      teamBName: data.teamById.get(fixture.teamBId).name,
      pTargetIfAWin: pTargetIfAWin === null ? null : normalizeProbability(pTargetIfAWin),
      pTargetIfBWin: pTargetIfBWin === null ? null : normalizeProbability(pTargetIfBWin),
      absoluteImpact:
        pTargetIfAWin === null || pTargetIfBWin === null
          ? null
          : normalizeProbability(Math.abs(pTargetIfAWin - pTargetIfBWin)),
      involvesSelected: agg.involvesSelected,
    };

    if (agg.involvesSelected) {
      const selectedIsA = fixture.teamAId === selectedId;
      const pIfWin = selectedIsA ? pTargetIfAWin : pTargetIfBWin;
      const pIfLoss = selectedIsA ? pTargetIfBWin : pTargetIfAWin;

      row.selectedTeam = {
        pIfWin: pIfWin === null ? null : normalizeProbability(pIfWin),
        pIfLoss: pIfLoss === null ? null : normalizeProbability(pIfLoss),
        classification: classifySelectedFixtureImpact(
          pIfWin,
          pIfLoss,
          mode,
          cfg
        ),
      };
    } else {
      row.preferredWinner =
        pTargetIfAWin === null || pTargetIfBWin === null
          ? null
          : pTargetIfAWin > pTargetIfBWin
            ? fixture.teamAId
            : pTargetIfBWin > pTargetIfAWin
              ? fixture.teamBId
              : null;
    }

    fixtureImpacts.push(row);
  }

  const currentStandings = calculateStandings(
    data.teams,
    data.playedMatches,
    cfg.tiebreakers
  );

  const normalizedTargetProbability =
    normalizeProbability(targetProbability / totalProbability);

  return {
    currentStandings,
    targetProbability: normalizedTargetProbability,
    confidence95:
      mode === "monte-carlo"
        ? wilsonInterval(
            Math.round(normalizedTargetProbability * simulationRuns),
            simulationRuns
          )
        : null,
    finishDistribution,
    fixtureImpacts: fixtureImpacts.sort((a, b) =>
      (b.absoluteImpact ?? -1) - (a.absoluteImpact ?? -1)
    ),
    mustWinFixtures: fixtureImpacts
      .filter(
        (x) =>
          x.involvesSelected &&
          x.selectedTeam?.classification === "must-win"
      )
      .map((x) => x.fixtureId),
    bestPath: bestPath
      ? {
          type:
            mode === "exact"
              ? "most-likely-successful-path"
              : "most-likely-successful-path-seen-in-simulation",
          probability: normalizeProbability(bestPathProbability),
          matches: bestPath.map((m) => ({
            ...m,
            teamAName: data.teamById.get(m.teamAId).name,
            teamBName: data.teamById.get(m.teamBId).name,
            winnerName: data.teamById.get(m.winnerId).name,
          })),
        }
      : null,
    successfulPathCount,
    simulationRuns,
    notes:
      mode === "exact"
        ? [
            "Exact weighted enumeration: every modeled remaining series-score path was evaluated.",
            "Future upsets do not change ratings mid-simulation.",
          ]
        : [
            `Monte Carlo estimate based on ${simulationRuns.toLocaleString()} simulated seasons.`,
            "A 0% conditional result in Monte Carlo is not a mathematical proof unless separately exact-checked.",
          ],
  };
}

function classifySelectedFixtureImpact(pIfWin, pIfLoss, mode, cfg) {
  if (pIfWin === null || pIfLoss === null) return "unknown";

  if (
    mode === "exact" &&
    pIfLoss <= cfg.probabilityEpsilon &&
    pIfWin > cfg.probabilityEpsilon
  ) {
    return "must-win";
  }

  const impact = pIfWin - pIfLoss;
  if (impact >= 0.35) return "very-high-impact";
  if (impact >= 0.15) return "high-impact";
  if (impact >= 0.05) return "medium-impact";
  if (impact > 0) return "low-impact";
  if (impact < 0) return "counterintuitive-impact";
  return "neutral";
}

function wilsonInterval(successes, trials, z = 1.96) {
  if (!Number.isFinite(trials) || trials <= 0) return null;
  const phat = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const centre = (phat + z2 / (2 * trials)) / denom;
  const margin =
    (z / denom) *
    Math.sqrt(
      (phat * (1 - phat)) / trials + z2 / (4 * trials * trials)
    );

  return {
    low: normalizeProbability(centre - margin),
    high: normalizeProbability(centre + margin),
  };
}

function normalizeProbability(p) {
  if (!Number.isFinite(p)) return null;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                     */
/* -------------------------------------------------------------------------- */

function mapRatingsToObject(ratings, teamById) {
  return [...ratings.entries()].map(([teamId, rating]) => ({
    teamId,
    teamName: teamById.get(teamId).name,
    rating: Math.round(rating * 10) / 10,
  }));
}

export function probabilityToPercent(probability, decimals = 1) {
  if (probability === null || probability === undefined) return "—";
  return `${(probability * 100).toFixed(decimals)}%`;
}
