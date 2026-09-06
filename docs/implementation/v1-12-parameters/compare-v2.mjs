// Owned design replay. This is not product code, external evidence, or a test oracle.
const row = (id, fields = {}) => ({ id, partition: "measured", language: "Rust", ageDays: 100, intervalHours: 24,
  stars: 100, forks: 20, starsDelta: 5, forksDelta: 0, reportAgesDays: [], topicPriority: 0, excludedTopic: false, ...fields });
const signals = [row("star-spike", { starsDelta: 100 }), row("balanced", { starsDelta: 2, forksDelta: 2 }), row("star-mid", { starsDelta: 10, forksDelta: 1 }), row("low", { starsDelta: 1 })];
const scenarios = [
  { id: "two-signals", rows: signals, before: [["balanced", "star-spike"], ["star-mid", "balanced"]] },
  { id: "changed-size", rows: [...signals, ...Array.from({ length: 12 }, (_, i) => row(`zero-${i}`, { starsDelta: 0 }))], before: [["balanced", "star-spike"], ["star-mid", "balanced"]] },
  { id: "small-cohort-tie", rows: [signals[0], signals[1]], note: "Reduced population may introduce a tie; no invariant ordering guarantee is claimed." },
  { id: "exact-ties", rows: [row("c"), row("b"), row("a")], selected: ["a", "b", "c"] },
  { id: "stock-shift", rows: signals.map((entry) => ({ ...entry, stars: entry.stars + 1000000, forks: entry.forks + 1000000 })), sameOrderAs: "two-signals" },
  { id: "uneven-languages", rows: [...Array.from({ length: 4 }, (_, i) => row(`Rust-${i + 1}`, { starsDelta: 4 - i })), ...Array.from({ length: 12 }, (_, i) => row(`Python-${i + 1}`, { language: "Python", starsDelta: (12 - i) * 100 }))], includes: ["Rust-1", "Python-1"] },
  { id: "uneven-ages", rows: [...Array.from({ length: 4 }, (_, i) => row(`young-${i + 1}`, { ageDays: 14, starsDelta: 4 - i })), ...Array.from({ length: 12 }, (_, i) => row(`mature-${i + 1}`, { ageDays: 500, starsDelta: (12 - i) * 100 }))], includes: ["young-1", "mature-1"] },
  { id: "unknown-language", rows: [row("unknown", { language: null }), row("known-1"), row("known-2"), row("known-3")], includes: ["unknown"], note: "Age fallback is explicitly less precise, not a language quota." },
  { id: "signed-deltas", rows: [row("positive"), row("zero", { starsDelta: 0, stars: 10000000 }), row("negative", { starsDelta: -10, forksDelta: -1, stars: 9999999 })], selected: ["positive"] },
  { id: "cold-floor", rows: [row("measured"), row("bare-stock", { partition: "cold-start", stars: 5, forks: 0 }), row("corroborated", { partition: "cold-start", stars: 4, forks: 2 }), row("star-attention", { partition: "cold-start", stars: 10, forks: 0 }), row("zero", { partition: "cold-start", stars: 0, forks: 0 })], includes: ["measured", "corroborated", "star-attention"], excludes: ["bare-stock", "zero"], before: [["measured", "corroborated"], ["measured", "star-attention"]] },
  { id: "topic-tie", rows: [row("a"), row("b", { topicPriority: 100 }), row("excluded", { topicPriority: 100, excludedTopic: true })], selected: ["b", "a"] },
  { id: "frequent-coverage", rows: [row("one", { reportAgesDays: [40] }), row("four", { reportAgesDays: [40, 50, 60, 70] }), row("new")], before: [["new", "one"], ["one", "four"]], note: "Both penalty candidates satisfy the directional expectation; choose smaller intervention if other evidence ties." },
  { id: "actual-quota", rows: [...Array.from({ length: 3 }, (_, i) => row(`new-${i}`, { starsDelta: 1 })), ...Array.from({ length: 7 }, (_, i) => row(`old-${i}`, { starsDelta: 100, reportAgesDays: [22] })), row("weak", { starsDelta: 0 })], selectedCount: 6, excludes: ["weak"] },
  { id: "zero-novel", rows: [row("old", { reportAgesDays: [22] })], selected: [] },
  { id: "unequal-intervals", rows: [row("a-25h", { starsDelta: 24, intervalHours: 25 }), row("b-23h", { starsDelta: 24, intervalHours: 23 })], before: [["b-23h", "a-25h"]], note: "Equal observed net change over less time has the higher average measured rate; raw deltas remain 24 for both." },
  ...[7 - 1 / 86400000, 7, 7 + 1 / 86400000, 30 - 1 / 86400000, 30, 30 + 1 / 86400000, 37, 90 - 1 / 86400000, 90, 90 + 1 / 86400000].map((age) => ({ id: `history-age-${age}`, rows: [row("returning", { reportAgesDays: [age] }), row("new")], note: "Inspect exact endpoint recovery, novelty, and frequency values; no rounded-day comparison." })),
];
const baseline = { id: "balanced-small-intervention", starsWeight: .6, topicGain: .15, frequencyPenalty: .25, coldStars: 10, coldForks: 2, normalizeInterval: true, minimumCohort: 4 };
const configurations = [baseline, { ...baseline, id: "star-heavy", starsWeight: .75 }, { ...baseline, id: "equal-weights", starsWeight: .5 },
  { ...baseline, id: "larger-topic-gain", topicGain: .3 }, { ...baseline, id: "stronger-frequency", frequencyPenalty: .5 },
  { ...baseline, id: "lower-cold-floor", coldStars: 5, coldForks: 1 }, { ...baseline, id: "raw-window-total", normalizeInterval: false }];
function evaluate(rows, config) {
  const age = (row) => row.ageDays < 30 ? "0-29d" : row.ageDays < 365 ? "30-364d" : "365d+";
  const signal = (r, key) => r.partition === "cold-start" ? r[key] / Math.max(1, r.ageDays) : Math.max(0, r[`${key}Delta`]) * (config.normalizeInterval ? 24 / r.intervalHours : 1);
  const pct = (value, values) => value <= 0 ? 0 : (values.filter((x) => x < value).length + .5 * values.filter((x) => x === value).length) / values.length;
  const scored = rows.map((r) => {
    let peers = rows.filter((p) => p.partition === r.partition && p.language === r.language && age(p) === age(r));
    let fallback = "language-age";
    if (peers.length < config.minimumCohort) { peers = rows.filter((p) => p.partition === r.partition && age(p) === age(r)); fallback = "age"; }
    if (peers.length < config.minimumCohort) { peers = rows.filter((p) => p.partition === r.partition); fallback = "partition"; }
    const elapsed = Math.min(Infinity, ...r.reportAgesDays);
    const recovery = Math.max(0, Math.min(1, (elapsed - 7) / 30));
    const count90 = r.reportAgesDays.filter((d) => d < 90).length;
    const frequency = 1 / (1 + config.frequencyPenalty * count90);
    const attention = r.partition === "measured" ? r.starsDelta > 0 || r.forksDelta > 0 : r.stars >= config.coldStars || r.forks >= config.coldForks;
    const base = config.starsWeight * pct(signal(r, "stars"), peers.map((p) => signal(p, "stars"))) + (1 - config.starsWeight) * pct(signal(r, "forks"), peers.map((p) => signal(p, "forks")));
    const score = !attention || r.excludedTopic ? 0 : base * (1 + config.topicGain * r.topicPriority / 100) * recovery * frequency;
    return { id: r.id, partition: r.partition, score, base, recovery, count90, frequency, novel: elapsed >= 30, fallback, cohortMembers: peers.map((p) => p.id), attention };
  }).sort((a, b) => Number(a.partition === "cold-start") - Number(b.partition === "cold-start") || b.score - a.score || (a.id < b.id ? -1 : 1));
  const eligible = scored.filter((r) => r.score > 0), novel = eligible.filter((r) => r.novel);
  const count = Math.min(7, eligible.length, novel.length * 2);
  const selected = new Set(novel.slice(0, Math.ceil(count / 2)).map((r) => r.id));
  for (const r of eligible) if (selected.size < count) selected.add(r.id);
  return { order: scored.map((r) => r.id), selected: scored.filter((r) => selected.has(r.id)).map((r) => r.id), scores: scored,
    novelFraction: count ? scored.filter((r) => selected.has(r.id) && r.novel).length / count : null,
    repeatFraction: count ? scored.filter((r) => selected.has(r.id) && !r.novel).length / count : null };
}
const trials = configurations.map((config) => {
  const results = scenarios.map((scenario) => {
    const result = evaluate(scenario.rows, config);
    const differences = [];
    for (const [a, b] of scenario.before ?? []) if (result.order.indexOf(a) >= result.order.indexOf(b)) differences.push(`${a} does not precede ${b}`);
    for (const id of scenario.includes ?? []) if (!result.selected.includes(id)) differences.push(`${id} not selected`);
    for (const id of scenario.excludes ?? []) if (result.selected.includes(id)) differences.push(`${id} selected`);
    if (scenario.selected && JSON.stringify(result.selected) !== JSON.stringify(scenario.selected)) differences.push("selected order differs");
    if (scenario.selectedCount !== undefined && result.selected.length !== scenario.selectedCount) differences.push("actual count differs");
    return { scenarioId: scenario.id, ...result, differences };
  });
  for (const scenario of scenarios.filter((s) => s.sameOrderAs)) {
    const result = results.find((r) => r.scenarioId === scenario.id), base = results.find((r) => r.scenarioId === scenario.sameOrderAs);
    if (JSON.stringify(result.order) !== JSON.stringify(base.order)) result.differences.push("stock-only change altered ranking");
  }
  return { configuration: config, preferenceDifferences: results.reduce((n, r) => n + r.differences.length, 0), results };
});
console.log(JSON.stringify({ evidence: "Owned simulation, not real satisfaction or production qualification", priorExpectationsSha256: "41ad8312dce52fe0ed5aa24771f97db29062d9d7ad6232dd10c8c18ff88db872", scenarios, trials }, null, 2));
