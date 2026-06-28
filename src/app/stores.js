import { writable } from 'svelte/store';

// Хранит оптимистичные обновления оценок
// Формат: { [releaseId]: { vote: number, releaseData: object, timestamp: number } }
export const optimisticVotes = writable({});
