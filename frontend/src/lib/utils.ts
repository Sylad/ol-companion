import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { NOMS_TAILLES } from '@/theme/typographie';

// L258 : les tailles du thème (`text-petite`…) sont des tailles, pas des couleurs : sans cela, `cn('text-petite', 'text-fg')`
// retirait la taille.
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: NOMS_TAILLES }] } } });

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
