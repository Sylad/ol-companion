import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Nettoie le DOM entre deux tests (les requêtes Testing Library ne débordent pas).
afterEach(() => {
  cleanup();
});
