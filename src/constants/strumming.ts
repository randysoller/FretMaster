/**
 * Strumming patterns for each music style.
 * Each pattern defines a sequence of strum actions per beat subdivision,
 * synced to the metronome for real-time visual guidance.
 */

/** Individual strum action type */
export type StrumType = 'D' | 'U' | 'Ad' | 'Au' | 'rest' | 'mute';

export interface StrummingPattern {
  id: string;
  name: string;
  description: string;
  /** Subdivisions per beat (2 = 8ths, 3 = triplets, 4 = 16ths) */
  subdivisions: number;
  /** Number of beats in the pattern (loops after this) */
  beats: number;
  /** Pattern actions — length must equal beats × subdivisions */
  pattern: StrumType[];
}

/** Labels for display */
export const STRUM_LABELS: Record<StrumType, string> = {
  D: '↓',
  U: '↑',
  Ad: '↓',
  Au: '↑',
  rest: '·',
  mute: '✕',
};

/** All strumming patterns indexed by style id */
export const STYLE_STRUMMING: Record<string, StrummingPattern[]> = {
  blues: [
    {
      id: 'blues-shuffle',
      name: 'Blues Shuffle',
      description: 'Triplet feel — skip the middle triplet for that swing groove',
      subdivisions: 3,
      beats: 4,
      pattern: ['Ad', 'rest', 'U', 'D', 'rest', 'U', 'D', 'rest', 'U', 'D', 'rest', 'U'],
    },
    {
      id: 'blues-straight',
      name: 'Slow Blues',
      description: 'Straight 8th notes with accented downbeats',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'U', 'D', 'U', 'Ad', 'U', 'D', 'U'],
    },
  ],
  jazz: [
    {
      id: 'jazz-comping',
      name: 'Jazz Comping',
      description: 'Swing feel — accent on beats 2 and 4',
      subdivisions: 2,
      beats: 4,
      pattern: ['D', 'rest', 'Ad', 'rest', 'D', 'rest', 'Ad', 'rest'],
    },
    {
      id: 'jazz-charleston',
      name: 'Charleston Rhythm',
      description: 'Syncopated swing — hit 1 and the "and" of 2',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'rest', 'rest', 'U', 'rest', 'rest', 'Ad', 'U'],
    },
  ],
  pop: [
    {
      id: 'pop-8ths',
      name: 'Pop Eighth Notes',
      description: 'Standard down-up strumming on every 8th note',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'U', 'D', 'U', 'D', 'U', 'D', 'U'],
    },
    {
      id: 'pop-island',
      name: 'Island Pop',
      description: 'Skip the upbeat of 1 and downbeat of 3 for a bouncy feel',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'rest', 'D', 'Au', 'rest', 'U', 'D', 'U'],
    },
  ],
  rock: [
    {
      id: 'rock-power',
      name: 'Power Strumming',
      description: 'All downstrokes — aggressive and driving',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'rest', 'D', 'rest', 'Ad', 'rest', 'D', 'rest'],
    },
    {
      id: 'rock-8ths',
      name: 'Rock Eighth Notes',
      description: 'Steady down-up with accented downbeats',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'U', 'D', 'U', 'Ad', 'U', 'D', 'U'],
    },
  ],
  country: [
    {
      id: 'country-boom-chicka',
      name: 'Boom-Chicka',
      description: 'Alternating bass note (down) and chord strum (up-down-up)',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'rest', 'mute', 'U',
        'D', 'rest', 'mute', 'U',
        'Ad', 'rest', 'mute', 'U',
        'D', 'rest', 'mute', 'U',
      ],
    },
    {
      id: 'country-train',
      name: 'Country Train Beat',
      description: 'Driving 16th note pattern with muted ghost strums',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'mute', 'D', 'U',
        'D', 'mute', 'D', 'U',
        'Ad', 'mute', 'D', 'U',
        'D', 'mute', 'D', 'U',
      ],
    },
  ],
  reggae: [
    {
      id: 'reggae-skank',
      name: 'Reggae Skank',
      description: 'Offbeat strumming — strum only on the "and" of each beat',
      subdivisions: 2,
      beats: 4,
      pattern: ['rest', 'Ad', 'rest', 'D', 'rest', 'Ad', 'rest', 'D'],
    },
    {
      id: 'reggae-one-drop',
      name: 'One Drop',
      description: 'Skip beat 1, accent beat 3 — classic roots feel',
      subdivisions: 2,
      beats: 4,
      pattern: ['rest', 'U', 'rest', 'D', 'rest', 'Au', 'rest', 'D'],
    },
  ],
  hiphop: [
    {
      id: 'hiphop-muted',
      name: 'Muted Groove',
      description: '16th note pattern with heavy ghost mutes',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'mute', 'rest', 'U',
        'mute', 'D', 'mute', 'U',
        'Ad', 'mute', 'rest', 'U',
        'mute', 'D', 'mute', 'U',
      ],
    },
    {
      id: 'hiphop-lofi',
      name: 'Lo-fi Strum',
      description: 'Laid-back 8th note feel with soft ghost strums',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'rest', 'D', 'U', 'rest', 'U', 'D', 'rest'],
    },
  ],
  rnb: [
    {
      id: 'rnb-smooth-16ths',
      name: 'Smooth 16ths',
      description: '16th note strumming with subtle accents for silky feel',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'U', 'D', 'U',
        'D', 'Au', 'D', 'U',
        'D', 'U', 'Ad', 'U',
        'D', 'U', 'D', 'Au',
      ],
    },
    {
      id: 'rnb-ballad',
      name: 'R&B Ballad',
      description: 'Slow, expressive strumming with rests for breathing room',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'rest', 'D', 'U', 'rest', 'Au', 'D', 'rest'],
    },
  ],
  latin: [
    {
      id: 'latin-bossa',
      name: 'Bossa Nova',
      description: 'Syncopated Brazilian rhythm — down on 1, up on the "and" of 2',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'rest', 'rest', 'U',
        'rest', 'rest', 'D', 'rest',
        'rest', 'U', 'rest', 'rest',
        'Ad', 'rest', 'D', 'rest',
      ],
    },
    {
      id: 'latin-son',
      name: 'Son Clave Strum',
      description: 'Follows the 3-2 clave pattern with accented hits',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'rest', 'rest', 'D',
        'rest', 'rest', 'Ad', 'rest',
        'rest', 'rest', 'D', 'rest',
        'Ad', 'rest', 'D', 'rest',
      ],
    },
  ],
  funk: [
    {
      id: 'funk-16ths',
      name: 'Funk 16th Notes',
      description: 'Tight 16th note groove with muted ghost strums',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'mute', 'D', 'Au',
        'mute', 'D', 'mute', 'U',
        'D', 'mute', 'Ad', 'U',
        'mute', 'D', 'mute', 'Au',
      ],
    },
    {
      id: 'funk-scratch',
      name: 'Funk Scratch',
      description: 'Heavy muting with pops of strum — percussive and rhythmic',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'mute', 'mute', 'U',
        'mute', 'mute', 'D', 'mute',
        'mute', 'Au', 'mute', 'mute',
        'D', 'mute', 'mute', 'U',
      ],
    },
  ],
  neosoul: [
    {
      id: 'neosoul-groove',
      name: 'Neo Soul Groove',
      description: 'Relaxed 16th notes with tasteful ghost notes',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'rest', 'D', 'U',
        'rest', 'U', 'D', 'rest',
        'D', 'Au', 'rest', 'U',
        'D', 'rest', 'D', 'Au',
      ],
    },
    {
      id: 'neosoul-slow',
      name: 'Neo Soul Ballad',
      description: 'Soft, expressive 8th note feel with dynamic accents',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'U', 'rest', 'Au', 'D', 'rest', 'Ad', 'U'],
    },
  ],
  bluegrass: [
    {
      id: 'bluegrass-boom-chuck',
      name: 'Boom-Chuck',
      description: 'Classic bluegrass alternating bass-strum pattern',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'rest', 'rest', 'D', 'Ad', 'rest', 'rest', 'D'],
    },
    {
      id: 'bluegrass-flatpick',
      name: 'Flatpick Drive',
      description: 'Driving all-downstroke flatpicking rhythm',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'D', 'Ad', 'D', 'Ad', 'D', 'Ad', 'D'],
    },
  ],
  folk: [
    {
      id: 'folk-basic',
      name: 'Folk Strum',
      description: 'Classic down-up folk strumming with skipped upbeats',
      subdivisions: 2,
      beats: 4,
      pattern: ['Ad', 'U', 'rest', 'U', 'Ad', 'U', 'rest', 'U'],
    },
    {
      id: 'folk-fingerstyle',
      name: 'Fingerstyle Folk',
      description: 'Flowing pattern alternating bass and treble — Travis picking feel',
      subdivisions: 4,
      beats: 4,
      pattern: [
        'Ad', 'rest', 'U', 'rest',
        'D', 'rest', 'U', 'rest',
        'Ad', 'rest', 'U', 'rest',
        'D', 'rest', 'U', 'rest',
      ],
    },
  ],
};

/** Get strumming patterns for a style, returns empty array if none */
export function getStyleStrumming(styleId: string): StrummingPattern[] {
  return STYLE_STRUMMING[styleId] ?? [];
}
