// Programmfarben werden als Header-Hintergrund in BuchenScreen genutzt
// statt externer Bilder von picsum.photos (externe Abhängigkeit vermeiden)
export const PROGRAMS = [
  {
    id: 'muscle',
    name: 'EMS-Intensiv Muskelaufbau',
    description: 'Intensives EMS-Training für maximalen Muskelaufbau und Kraftzuwachs.',
    duration: 20,
    color: '#4A8FE8',
    emoji: '💪',
  },
  {
    id: 'lymph',
    name: 'Lymphdrainage',
    description: 'EMS pro Einheit 20€ statt 25€ für EMS Kunden. Sanfte Stimulation für ein gesundes Lymphsystem.',
    duration: 25,
    color: '#3DBFA0',
    emoji: '🌿',
    price: '20€',
    originalPrice: '25€',
  },
  {
    id: 'relax',
    name: 'Relax',
    description: 'Du fühlst dich schlapp oder warst gerade erst krank? Dann ist dieses Programm genau das Richtige für dich.',
    duration: 20,
    color: '#F5A84A',
    emoji: '😌',
  },
  {
    id: 'metabolism',
    name: 'Stoffwechsel',
    description: 'Aktiviere deinen Stoffwechsel und tu was für dein Herz-Kreislauf-System.',
    duration: 20,
    color: '#E87676',
    emoji: '🔥',
  },
] as const;

export type ProgramId = typeof PROGRAMS[number]['id'];
export type Program = typeof PROGRAMS[number];
