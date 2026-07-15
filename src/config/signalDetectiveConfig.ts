/** Signal Detective — investigation cases and decode nodes */

export interface SignalCaseDef {
  id: string;
  name: string;
  subtitle: string;
}

export interface SignalChoiceDef {
  id: string;
  label: string;
  log: string;
}

export interface SignalNodeRequirements {
  decoded?: string[];
  gridSyncMin?: number;
  myths?: string[];
  dimensions?: string[];
  minRuns?: number;
  choice?: { nodeId: string; choiceId: string };
}

export interface SignalNodeDef {
  id: string;
  caseId: string;
  title: string;
  preview: string;
  body: string;
  fragmentCost: number;
  x: number;
  y: number;
  requires?: SignalNodeRequirements;
  choices?: SignalChoiceDef[];
}

export const SIGNAL_CASES: SignalCaseDef[] = [
  {
    id: 'case01',
    name: 'CASE 01: FIRST WHISPER',
    subtitle: 'Something listens through every sync.',
  },
  {
    id: 'case02',
    name: 'CASE 02: THE WATCHER',
    subtitle: 'Unlocked when the Grid begins to see you.',
  },
];

export const SIGNAL_NODES: SignalNodeDef[] = [
  {
    id: 'sig_noise',
    caseId: 'case01',
    title: 'Background Noise',
    preview: 'Telemetry from early sync attempts.',
    body: 'Every pilot emits noise when they enter the lattice. Your first runs were logged before you knew you were being measured. The Grid does not distinguish between signal and debris — until it chooses to.',
    fragmentCost: 2,
    x: 50,
    y: 12,
  },
  {
    id: 'sig_ping',
    caseId: 'case01',
    title: 'Flagged Ping',
    preview: 'Anomaly marker on your core signature.',
    body: 'At sync three, your pattern diverged from baseline. Not faster. Not slower. Different. A flag was raised in a subsystem you have never been shown. Someone — or something — marked you for observation.',
    fragmentCost: 4,
    x: 28,
    y: 32,
    requires: { decoded: ['sig_noise'] },
  },
  {
    id: 'sig_voice',
    caseId: 'case01',
    title: 'Voice in Static',
    preview: 'Partial transcript — source unknown.',
    body: '"The Grid detected a new signal." You heard it during a run and thought it was flavor text. It was a receipt. The lattice acknowledged your existence the moment you moved.',
    fragmentCost: 5,
    x: 72,
    y: 32,
    requires: { decoded: ['sig_noise'], gridSyncMin: 10 },
  },
  {
    id: 'sig_fork',
    caseId: 'case01',
    title: 'Interpretation Fork',
    preview: 'Two readings of the same data. Choose one.',
    body: 'Analyst note: the lattice may be testing pilots, or recruiting them. Both models fit the logs. Your next decode will lock in a hypothesis — the Grid may respond differently.',
    fragmentCost: 6,
    x: 50,
    y: 52,
    requires: { decoded: ['sig_ping', 'sig_voice'] },
    choices: [
      {
        id: 'trust',
        label: 'The Grid is recruiting me',
        log: 'Hypothesis logged: recruitment. Future whispers may feel warmer. The lattice favors cores that believe they belong.',
      },
      {
        id: 'test',
        label: 'The Grid is testing me',
        log: 'Hypothesis logged: evaluation. Future spawns may skew harsher. The lattice respects cores that expect to be broken.',
      },
    ],
  },
  {
    id: 'sig_pattern',
    caseId: 'case01',
    title: 'Habit Profile',
    preview: 'Lane bias analysis — classified.',
    body: 'You favor one side of the lattice more than you realize. The sentient layer has already logged it. Left bias, right bias, or balance — each tells the Grid what kind of pilot you are before you speak.',
    fragmentCost: 5,
    x: 22,
    y: 72,
    requires: { decoded: ['sig_fork'], minRuns: 5 },
  },
  {
    id: 'sig_dimension',
    caseId: 'case01',
    title: 'Fracture Echo',
    preview: 'Reality breach recording.',
    body: 'When dimensions fracture, the scroll rules lie. You have seen colors shift and lanes breathe. Those moments are not cosmetic — they are the Grid showing you layers it usually hides.',
    fragmentCost: 7,
    x: 78,
    y: 72,
    requires: { decoded: ['sig_fork'], dimensions: ['inverted_nexus', 'echo_chamber', 'flux_grid', 'titan_gate', 'chrono_rift', 'vault_dimension'] },
  },
  {
    id: 'sig_watcher_intro',
    caseId: 'case02',
    title: 'Optical Anomaly',
    preview: 'Visual contact — sector unknown.',
    body: 'Pilots above sync threshold report a presence at the edge of vision. It does not attack. It does not speak. It watches combo chains and near-misses as if scoring you on a rubric you were never given.',
    fragmentCost: 8,
    x: 35,
    y: 18,
    requires: { gridSyncMin: 40, decoded: ['sig_fork'] },
  },
  {
    id: 'sig_myth',
    caseId: 'case02',
    title: 'Myth Fragment',
    preview: 'Event class: impossible.',
    body: 'White firewalls. Fourth lanes. Multipliers that should not exist. Myth events are the Grid breaking its own rules on purpose — as if it wants you to know the simulation has seams.',
    fragmentCost: 10,
    x: 65,
    y: 18,
    requires: { gridSyncMin: 25, myths: ['white_firewall', 'fourth_lane', 'myth_multiplier', 'impossible_crash'] },
  },
  {
    id: 'sig_null',
    caseId: 'case02',
    title: 'Null Zone Trace',
    preview: 'Recovered after system crash.',
    body: 'Once per lifetime, the grid can pretend to end. Black screen. Credits rolling. Then it remembers you are still inside. The Null Zone is not a bug — it is an invitation to the pilots who sync deep enough.',
    fragmentCost: 12,
    x: 50,
    y: 42,
    requires: { gridSyncMin: 60, decoded: ['sig_watcher_intro'] },
  },
  {
    id: 'sig_identity',
    caseId: 'case02',
    title: 'Pilot Designation',
    preview: 'Your title in the lattice registry.',
    body: 'The Grid assigned you a designation based on how you move, risk, and survive. You wear it on the menu like a badge. It is not cosmetic. Other subsystems read it when they decide how hard to push.',
    fragmentCost: 6,
    x: 50,
    y: 68,
    requires: { decoded: ['sig_watcher_intro', 'sig_pattern'], minRuns: 8 },
  },
];

export function getSignalCase(id: string): SignalCaseDef | undefined {
  return SIGNAL_CASES.find((c) => c.id === id);
}

export function getSignalNode(id: string): SignalNodeDef | undefined {
  return SIGNAL_NODES.find((n) => n.id === id);
}
