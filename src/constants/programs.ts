export const PROGRAMS = [
  {
    id: 'individual',
    name: 'Individualtraining',
    description: 'Persönliches 1:1 Training mit individuellem Fokus.',
    duration: 60,
    capacity: 1,
    category: 'individual' as const,
    color: '#4A8FE8',
    emoji: '⚽',
  },
  {
    id: 'gruppe',
    name: 'Gruppentraining',
    description: 'Training in der Gruppe (max. 4 Teilnehmer).',
    duration: 60,
    capacity: 4,
    category: 'gruppe' as const,
    color: '#3DBFA0',
    emoji: '👥',
  },
  {
    id: 'athletik',
    name: 'Athletiktraining',
    description: 'Konditions- und Athletiktraining (max. 4 Teilnehmer).',
    duration: 60,
    capacity: 4,
    category: 'gruppe' as const,
    color: '#F5A84A',
    emoji: '🏃',
  },
  {
    id: 'torhueter_individual',
    name: 'Torwart Individual',
    description: 'Individuelles Torwarttraining.',
    duration: 60,
    capacity: 1,
    category: 'individual' as const,
    color: '#E87676',
    emoji: '🥅',
  },
  {
    id: 'torhueter_gruppe',
    name: 'Torwart Gruppe',
    description: 'Torwarttraining in der Gruppe (max. 4 Teilnehmer).',
    duration: 60,
    capacity: 4,
    category: 'gruppe' as const,
    color: '#9B59B6',
    emoji: '🧤',
  },
] as const;

export type ProgramId = typeof PROGRAMS[number]['id'];
export type ProgramCategory = 'individual' | 'gruppe';

export const PROGRAM_CATEGORY: Record<ProgramId, ProgramCategory> = {
  individual: 'individual',
  torhueter_individual: 'individual',
  gruppe: 'gruppe',
  athletik: 'gruppe',
  torhueter_gruppe: 'gruppe',
};

export const PROGRAM_CAPACITY: Record<ProgramId, number> = {
  individual: 1,
  torhueter_individual: 1,
  gruppe: 4,
  athletik: 4,
  torhueter_gruppe: 4,
};
