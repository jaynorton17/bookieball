export type TableCutLineTone = 'title' | 'promotion' | 'playoff' | 'relegation';

export type TableCutLine = {
  afterRank: number;
  label: string;
  tone: TableCutLineTone;
};

function dedupeCutLines(lines: TableCutLine[], rowCount: number): TableCutLine[] {
  const seen = new Set<string>();
  return lines
    .filter((line) => line.afterRank >= 1 && line.afterRank < rowCount)
    .filter((line) => {
      const key = `${line.afterRank}-${line.label}-${line.tone}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.afterRank - right.afterRank);
}

export function buildTableCutLines(title: string, rowCount: number): TableCutLine[] {
  const normalizedTitle = title.trim().toLowerCase();

  if (/premier league/.test(normalizedTitle)) {
    return dedupeCutLines([
      { afterRank: 1, label: 'Title', tone: 'title' },
      { afterRank: Math.max(1, rowCount - 3), label: 'Relegation line', tone: 'relegation' },
    ], rowCount);
  }

  if (/ligue 1/.test(normalizedTitle)) {
    return dedupeCutLines([
      { afterRank: 2, label: 'Auto promotion', tone: 'promotion' },
      { afterRank: 6, label: 'Playoff line', tone: 'playoff' },
      { afterRank: Math.max(1, rowCount - 3), label: 'Relegation line', tone: 'relegation' },
    ], rowCount);
  }

  if (/bundesliga/.test(normalizedTitle)) {
    return dedupeCutLines([
      { afterRank: 2, label: 'Auto promotion', tone: 'promotion' },
      { afterRank: 6, label: 'Playoff line', tone: 'playoff' },
    ], rowCount);
  }

  if (
    /champions bookies/.test(normalizedTitle)
    || /premier bookies/.test(normalizedTitle)
    || /^division \d+$/.test(normalizedTitle)
  ) {
    return dedupeCutLines([
      { afterRank: 1, label: 'Title line', tone: 'title' },
      { afterRank: 2, label: 'Playoff line', tone: 'playoff' },
      { afterRank: Math.max(1, rowCount - 1), label: 'Relegation line', tone: 'relegation' },
    ], rowCount);
  }

  return dedupeCutLines([
    { afterRank: 1, label: 'Leader line', tone: 'title' },
  ], rowCount);
}
