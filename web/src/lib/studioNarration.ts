export type StudioNarrationMode = 'desk' | 'brief' | 'hype';
export type StudioReporterMode = 'solo' | 'duo' | 'trio';
export type StudioReporterSpeaker = 'anchor' | 'analyst' | 'coCommentator';
export type StudioVoiceCharacterProfile = 'analytical' | 'emotional' | 'contrarian';
export type StudioReporterLine = {
  speaker: StudioReporterSpeaker;
  text: string;
};

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const MAX_WORDS_PER_SENTENCE = 20;
const STORY_SECTION_ORDER = ['intro', 'league', 'cup', 'verdict', 'next'] as const;
type StorySectionKey = (typeof STORY_SECTION_ORDER)[number];
type StorySection = {
  key: StorySectionKey;
  text: string;
};
const STORY_SECTION_LABEL: Record<StorySectionKey, string> = {
  intro: 'Intro',
  league: 'League',
  cup: 'Cup',
  verdict: 'Verdict',
  next: 'Next',
};
const NUMBER_WORDS: Record<number, string> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
};

function pickBySeed(seed: string, variants: string[]): string {
  if (variants.length === 0) {
    return '';
  }
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) % 2147483647;
  }
  return variants[Math.abs(hash) % variants.length] ?? variants[0];
}

function sanitizeSpacing(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeStorySectionLabel(label: string): StorySectionKey | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'intro') {
    return 'intro';
  }
  if (normalized === 'league') {
    return 'league';
  }
  if (normalized === 'cup') {
    return 'cup';
  }
  if (normalized === 'verdict') {
    return 'verdict';
  }
  if (normalized === 'next') {
    return 'next';
  }
  return null;
}

function storySectionWordCap(mode: StudioNarrationMode): number {
  if (mode === 'brief') {
    return 14;
  }
  if (mode === 'hype') {
    return 30;
  }
  return 26;
}

function storySectionRegex(): RegExp {
  return /\b(Intro|League|Cup|Verdict|Next):\s*([\s\S]*?)(?=\b(?:Intro|League|Cup|Verdict|Next):|$)/gi;
}

function extractStorySections(value: string): StorySection[] {
  const sectionsByKey = new Map<StorySectionKey, StorySection>();
  const regex = storySectionRegex();
  let match = regex.exec(value);
  while (match) {
    const key = normalizeStorySectionLabel(match[1] ?? '');
    const text = sanitizeSpacing(match[2] ?? '');
    if (key && text.length > 0) {
      sectionsByKey.set(key, { key, text });
    }
    match = regex.exec(value);
  }
  return STORY_SECTION_ORDER
    .map((key) => sectionsByKey.get(key) ?? null)
    .filter((section): section is StorySection => section !== null);
}

function formatStorySection(section: StorySection, mode: StudioNarrationMode): string {
  const normalizedText = normalizeSentenceTone(normalizeSpeechText(section.text));
  const trimmed = trimSentenceWords(normalizedText, storySectionWordCap(mode));
  const completed = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return `${STORY_SECTION_LABEL[section.key]}: ${completed}`;
}

function buildStoryArcNarration(rawText: string, mode: StudioNarrationMode): string | null {
  const sections = extractStorySections(rawText);
  if (sections.length === 0) {
    return null;
  }
  const sentences = sections.map((section) => formatStorySection(section, mode));
  return sentences.join(' ');
}

function numberToSpeech(value: number): string {
  return NUMBER_WORDS[value] ?? String(value);
}

function normalizeSpeechText(value: string): string {
  const base = sanitizeSpacing(value);
  if (!base) {
    return '';
  }
  return base
    .replace(/&/g, ' and ')
    .replace(/\bGW(\d+)\b/gi, (_full, gw: string) => `game week ${numberToSpeech(Number(gw))}`)
    .replace(/\bS(\d+)\b/g, (_full, season: string) => `season ${numberToSpeech(Number(season))}`)
    .replace(/\bvs?\.?\b/gi, 'versus')
    .replace(/\bpts\b/gi, 'points')
    .replace(/\bml\b/gi, 'master league')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  sentences.forEach((sentence) => {
    const key = narrationMemoryKey(sentence);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(sentence);
  });
  return unique;
}

function normalizeSentenceTone(sentence: string): string {
  if (!sentence) {
    return sentence;
  }
  return sentence
    .replace(/\b(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\b/g, 'the score is settled')
    .replace(/\b\d+(?:\.\d+)?\s*pts?\b/gi, 'key points')
    .replace(/\b\d+(?:\.\d+)?\s*spins?\b/gi, 'important spins');
}

function trimSentenceWords(sentence: string, maxWords = MAX_WORDS_PER_SENTENCE): string {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return sentence;
  }
  return `${words.slice(0, maxWords).join(' ')}.`;
}

function sentencePriority(sentence: string): number {
  let score = 0;
  if (/winner|won|advanced|draw|result|full.?time|just in/i.test(sentence)) {
    score += 7;
  }
  if (/coming up|next|pending|in play|kick.?off|fixture/i.test(sentence)) {
    score += 6;
  }
  if (/season start|season now|last season|what happens next|next up/i.test(sentence)) {
    score += 6;
  }
  if (/spotlight|table|leader|pressure|promotion|relegation|title|race/i.test(sentence)) {
    score += 5;
  }
  if (/why|impact|matters|swing|momentum|storyline/i.test(sentence)) {
    score += 4;
  }
  if (/\d/.test(sentence)) {
    score -= 1;
  }
  const words = sentence.split(/\s+/).filter(Boolean).length;
  if (words >= 7 && words <= 18) {
    score += 2;
  }
  return score;
}

function narrationSentenceBudget(mode: StudioNarrationMode): number {
  if (mode === 'brief') {
    return 3;
  }
  if (mode === 'hype') {
    return 6;
  }
  return 5;
}

function prioritizeSentences(sentences: string[], mode: StudioNarrationMode): string[] {
  if (sentences.length <= 1) {
    return sentences;
  }
  const lead = sentences[0] ?? '';
  const trailing = sentences
    .slice(1)
    .map((sentence, index) => ({
      sentence,
      index,
      score: sentencePriority(sentence),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.sentence);
  const ordered = [lead, ...trailing];
  const bounded = ordered
    .map((sentence) => trimSentenceWords(sentence))
    .filter((sentence) => sentence.length > 0);
  return bounded.slice(0, narrationSentenceBudget(mode));
}

export function splitSentences(value: string): string[] {
  return normalizeSpeechText(value)
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function buildNarrationText(rawText: string, mode: StudioNarrationMode): string {
  const storyArcNarration = buildStoryArcNarration(rawText, mode);
  if (storyArcNarration) {
    if (mode === 'hype') {
      return `We are live at the studio desk. ${storyArcNarration}`;
    }
    return storyArcNarration;
  }
  const sanitized = normalizeSpeechText(rawText);
  if (!sanitized) {
    return '';
  }
  const dedupedSentences = dedupeSentences(splitSentences(sanitized))
    .map(normalizeSentenceTone)
    .filter((sentence) => sentence.length > 0);
  const selectedSentences = prioritizeSentences(dedupedSentences, mode);
  const normalized = selectedSentences.join(' ');
  if (!normalized) {
    return '';
  }

  if (mode === 'hype') {
    return `We are live at the studio desk. ${normalized}`;
  }
  return normalized;
}

function analystLine(seed: string, sentence: string): string {
  return pickBySeed(seed, [
    `Analysis angle: ${sentence}`,
    `The key read is this: ${sentence}`,
    `From the analyst desk: ${sentence}`,
  ]);
}

function coCommentatorLine(seed: string, sentence: string): string {
  return pickBySeed(seed, [
    `Co-commentator view: ${sentence}`,
    `That puts pressure on the next decision: ${sentence}`,
    `From pitchside: ${sentence}`,
  ]);
}

function anchorLeadLine(seed: string, sentence: string): string {
  return pickBySeed(seed, [
    `Live at the main desk: ${sentence}`,
    `Top line from the studio: ${sentence}`,
    `Headline now: ${sentence}`,
  ]);
}

function anchorFollowLine(seed: string, sentence: string): string {
  return pickBySeed(seed, [
    `${sentence}`,
    `Next angle: ${sentence}`,
    `As it stands: ${sentence}`,
  ]);
}

function anchorCloseLine(seed: string): string {
  return pickBySeed(seed, [
    'That is the latest from the studio desk.',
    'That is your update, and we will keep rotating the board.',
    'That is the latest read before we move to the next story.',
  ]);
}

function applyCharacterProfile(
  seed: string,
  speaker: StudioReporterSpeaker,
  text: string,
  profile?: StudioVoiceCharacterProfile,
): string {
  if (!profile) {
    return text;
  }
  if (profile === 'analytical') {
    return pickBySeed(`${seed}-${speaker}-analytical`, [
      text,
      `Data read: ${text}`,
      `Evidence says this: ${text}`,
    ]);
  }
  if (profile === 'emotional') {
    return pickBySeed(`${seed}-${speaker}-emotional`, [
      text,
      `What a swing in this story: ${text}`,
      `This one has real drama: ${text}`,
    ]);
  }
  return pickBySeed(`${seed}-${speaker}-contrarian`, [
    text,
    `Counterpoint: ${text}`,
    `Alternative angle here: ${text}`,
  ]);
}

function isStoryArcSentence(sentence: string): boolean {
  return /^(Intro|League|Cup|Verdict|Next):/i.test(sentence.trim());
}

export function extractStoryArcLabels(rawText: string): string[] {
  return extractStorySections(rawText).map((section) => STORY_SECTION_LABEL[section.key]);
}

export function buildReporterScript(
  rawText: string,
  narrationMode: StudioNarrationMode,
  reporterMode: StudioReporterMode,
  options?: {
    speakerProfiles?: Partial<Record<StudioReporterSpeaker, StudioVoiceCharacterProfile>>;
  },
): StudioReporterLine[] {
  const baseNarration = buildNarrationText(rawText, narrationMode);
  const sentences = splitSentences(baseNarration);
  if (sentences.length === 0) {
    return [];
  }
  const withProfile = (speaker: StudioReporterSpeaker, text: string, seed: string): string =>
    applyCharacterProfile(seed, speaker, text, options?.speakerProfiles?.[speaker]);
  const storyArcMode = sentences.some((sentence) => isStoryArcSentence(sentence));
  if (reporterMode === 'solo') {
    if (storyArcMode) {
      const lines: StudioReporterLine[] = sentences.map((sentence, index) => ({
        speaker: 'anchor',
        text: withProfile(
          'anchor',
          index === 0
            ? anchorLeadLine(`${sentence}-story-lead`, sentence)
            : anchorFollowLine(`${sentence}-story-follow`, sentence),
          `${sentence}-story-solo`,
        ),
      }));
      lines.push({
        speaker: 'anchor',
        text: withProfile('anchor', anchorCloseLine(`${baseNarration}-solo-story-close`), `${baseNarration}-solo-story-close`),
      });
      return lines;
    }
    const maxSentences = narrationMode === 'brief' ? 1 : narrationMode === 'hype' ? 3 : 2;
    const combined = sentences.slice(0, maxSentences).join(' ').trim();
    const withClose = narrationMode === 'brief'
      ? combined
      : `${combined} ${anchorCloseLine(`${baseNarration}-solo-close`)}`.trim();
    return [{
      speaker: 'anchor',
      text: withProfile('anchor', anchorLeadLine(`${baseNarration}-solo-lead`, withClose || baseNarration), `${baseNarration}-solo-lead`),
    }];
  }

  const storySpeakers: StudioReporterSpeaker[] = reporterMode === 'trio'
    ? ['anchor', 'analyst', 'coCommentator']
    : ['anchor', 'analyst'];

  if (storyArcMode) {
    const lines: StudioReporterLine[] = sentences.map((sentence, index) => {
      const speaker: StudioReporterSpeaker = storySpeakers[index % storySpeakers.length] ?? 'anchor';
      if (speaker === 'anchor') {
        return {
          speaker,
          text: withProfile(
            speaker,
            index === 0
              ? anchorLeadLine(`${sentence}-story-anchor-lead`, sentence)
              : anchorFollowLine(`${sentence}-story-anchor-follow`, sentence),
            `${sentence}-story-anchor`,
          ),
        };
      }
      if (speaker === 'coCommentator') {
        return {
          speaker,
          text: withProfile(speaker, coCommentatorLine(`${sentence}-story-co-commentator`, sentence), `${sentence}-story-co-commentator`),
        };
      }
      return {
        speaker,
        text: withProfile(speaker, analystLine(`${sentence}-story-analyst`, sentence), `${sentence}-story-analyst`),
      };
    });
    lines.push({
      speaker: 'anchor',
      text: withProfile('anchor', anchorCloseLine(`${baseNarration}-${reporterMode}-story-close`), `${baseNarration}-${reporterMode}-story-close`),
    });
    return lines;
  }

  const lines: StudioReporterLine[] = [];
  lines.push({
    speaker: 'anchor',
    text: withProfile('anchor', anchorLeadLine(`${sentences[0]}-lead`, sentences[0] ?? baseNarration), `${sentences[0]}-lead`),
  });
  if (sentences[1]) {
    lines.push({
      speaker: 'analyst',
      text: withProfile('analyst', analystLine(`${sentences[1]}-analysis`, sentences[1]), `${sentences[1]}-analysis`),
    });
  }
  if (reporterMode === 'trio' && sentences[2]) {
    lines.push({
      speaker: 'coCommentator',
      text: withProfile('coCommentator', coCommentatorLine(`${sentences[2]}-co-commentary`, sentences[2]), `${sentences[2]}-co-commentary`),
    });
  }
  const nextAnchorIndex = reporterMode === 'trio' ? 3 : 2;
  if (sentences[nextAnchorIndex]) {
    lines.push({
      speaker: 'anchor',
      text: withProfile('anchor', anchorFollowLine(`${sentences[nextAnchorIndex]}-follow`, sentences[nextAnchorIndex]), `${sentences[nextAnchorIndex]}-follow`),
    });
  }
  const extraAnalystIndex = reporterMode === 'trio' ? 4 : 3;
  if (narrationMode === 'hype' && sentences[extraAnalystIndex]) {
    lines.push({
      speaker: 'analyst',
      text: withProfile('analyst', analystLine(`${sentences[extraAnalystIndex]}-extra`, sentences[extraAnalystIndex]), `${sentences[extraAnalystIndex]}-extra`),
    });
  }

  if (lines.length <= 2) {
    lines.push({
      speaker: reporterMode === 'trio' ? 'coCommentator' : 'analyst',
      text: withProfile(
        reporterMode === 'trio' ? 'coCommentator' : 'analyst',
        reporterMode === 'trio'
          ? pickBySeed(`${lines[0].text}-fallback-trio`, [
            'Co-commentary note: this story will swing again before full-time.',
            'Co-commentary note: keep watching this lane for the next update.',
            'Co-commentary note: there is still pressure on both sides.',
          ])
          : pickBySeed(`${lines[0].text}-fallback`, [
            'Analysis note: that storyline will shape the next update.',
            'Analysis note: there is still room for late swings.',
            'Analysis note: this desk will keep tracking every shift.',
          ]),
        `${lines[0].text}-fallback`,
      ),
    });
  }
  lines.push({
    speaker: 'anchor',
    text: withProfile('anchor', anchorCloseLine(`${baseNarration}-${reporterMode}-close`), `${baseNarration}-${reporterMode}-close`),
  });
  const cap = narrationMode === 'brief' ? 2 : narrationMode === 'hype' ? (reporterMode === 'trio' ? 5 : 4) : (reporterMode === 'trio' ? 4 : 3);
  return lines.slice(0, cap);
}

export function narrationMemoryKey(text: string): string {
  return sanitizeSpacing(normalizeSpeechText(text).toLowerCase().replace(/[^a-z0-9\s]/g, ''))
    .replace(/\b(game week|season)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
