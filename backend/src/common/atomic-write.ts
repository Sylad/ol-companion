import * as fs from 'fs';
import * as path from 'path';

/**
 * Écrit un fichier JSON de manière atomique.
 *
 * Pattern : write to `<file>.tmp` puis `rename(<file>.tmp, <file>)`. Sur la
 * plupart des FS POSIX (ext4, xfs, btrfs incl. Synology), `rename` est atomique
 * → soit l'ancienne version est lisible, soit la nouvelle. Jamais un fichier
 * tronqué/corrompu si le process crash en plein milieu.
 *
 * Audit a identifié 12 writes non-atomiques sur ol-companion (standings,
 * season-matches, live-match notamment). Un SIGKILL pendant `writeFileSync`
 * corrompt le JSON et provoque un crash-loop au reboot.
 *
 * Usage :
 *   atomicWriteJsonSync(this.filepath, data);
 *   // au lieu de :
 *   fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
 */
export function atomicWriteJsonSync(filepath: string, data: unknown): void {
  const tmp = `${filepath}.tmp.${process.pid}.${Date.now()}`;
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filepath);
}

export async function atomicWriteJson(filepath: string, data: unknown): Promise<void> {
  const tmp = `${filepath}.tmp.${process.pid}.${Date.now()}`;
  const dir = path.dirname(filepath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmp, filepath);
}
