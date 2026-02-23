const DIVISION_LABEL_OVERRIDES: Record<string, string> = {
  'Average Bookies': 'Division 1',
  'Struggling Bookies': 'Division 2',
  'Awful Bookies': 'Division 3',
};

export function displayDivisionName(division: string | null | undefined): string {
  if (!division) {
    return '';
  }
  return DIVISION_LABEL_OVERRIDES[division] ?? division;
}
