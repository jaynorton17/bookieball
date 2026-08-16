export type CompetitionKey = 'league' | 'master' | 'trio' | 'tier' | 'bookieball_cup' | 'master_cup' | 'super_cup';
export type CompetitionKind = 'league' | 'group_league' | 'knockout' | 'showcase';

export type CompetitionDefinition = {
  key: CompetitionKey;
  label: string;
  shortLabel: string;
  kind: CompetitionKind;
  hasTable: boolean;
  hasFixtures: boolean;
  hasHistory: boolean;
  tone: 'blue' | 'gold' | 'green' | 'red';
  order: number;
};

export const COMPETITIONS: CompetitionDefinition[] = [
  { key: 'league', label: 'BookieBall League', shortLabel: 'League', kind: 'league', hasTable: true, hasFixtures: true, hasHistory: true, tone: 'blue', order: 1 },
  { key: 'master', label: 'Master League', shortLabel: 'Master', kind: 'league', hasTable: true, hasFixtures: true, hasHistory: true, tone: 'gold', order: 2 },
  { key: 'trio', label: 'Trio League', shortLabel: 'Trio', kind: 'group_league', hasTable: true, hasFixtures: true, hasHistory: true, tone: 'green', order: 3 },
  { key: 'tier', label: 'Tier League', shortLabel: 'Tier', kind: 'group_league', hasTable: true, hasFixtures: true, hasHistory: true, tone: 'green', order: 4 },
  { key: 'bookieball_cup', label: 'BookieBall Cup', shortLabel: 'BB Cup', kind: 'knockout', hasTable: false, hasFixtures: true, hasHistory: true, tone: 'gold', order: 5 },
  { key: 'master_cup', label: 'Master Cup', shortLabel: 'Master Cup', kind: 'knockout', hasTable: false, hasFixtures: true, hasHistory: true, tone: 'gold', order: 6 },
  { key: 'super_cup', label: 'Super Cup', shortLabel: 'Super Cup', kind: 'showcase', hasTable: false, hasFixtures: true, hasHistory: true, tone: 'red', order: 7 },
];

export const competitionByKey = new Map(COMPETITIONS.map((competition) => [competition.key, competition]));
