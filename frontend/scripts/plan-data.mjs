#!/usr/bin/env node
// L23 — données PUBLIQUES de la page « Plan de travail », tirées du plan raf
// (docs/plan/raf.yaml). Repris de finance-tracker L48 (même règles, même format),
// plus une vérification de fuite sur le bundle construit.
//
//   node scripts/plan-data.mjs [--in ../docs/plan/raf.yaml] [--news ../docs/nouveautes]
//        [--out public/plan-data/plan.json] [--check]
//   node scripts/plan-data.mjs --leaks dist      (après vite build, appelé par npm run build)
//
// --check n'écrit rien et sort en code 1 si le JSON versionné n'est plus à jour.
// --leaks sort en code 1 si un texte privé du plan (note, verdict UX, raison
// d'abandon, titre brut) se trouve dans un fichier du dossier construit.
//
// L'application est publique. Règles dures :
//   1. seuls les lots `visible: true` (changements pour l'utilisateur) sortent ;
//   2. seuls id, titre PUBLIC, état, dates de début / fin et sous-tâches
//      (titre public éventuel, état) sortent — jamais le titre brut du plan,
//      les notes, estimations, shas, verdicts UX… Titre public = champ
//      `public:` du lot, sinon titre de sa Nouveauté, sinon lot masqué ;
//      les lots de processus (revues UX) exigent un `public:` ;
//   3. filet de sécurité : un lot dont le titre évoque la sécurité (liste
//      noire ci-dessous) n'est pas publié du tout ; une sous-tâche dans ce cas
//      est retirée de son lot (et du décompte n/m).
// Le JSON ne porte aucune date de génération : il ne dépend que du plan, ce
// qui permet au test de vérifier qu'il est à jour. Le build Docker (contexte
// frontend/) n'a pas docs/ : le JSON est versionné, comme nouveautes-data/.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** États raf publiés ; tout autre état (dropped, inconnu) est écarté. */
export const PUBLISHED_STATUSES = ['doing', 'todo', 'done'];

// Comparaison sans casse ni accents (« Sécurité » = « securite »).
const DENY = [
  /securit/, /faille/, /spoof/, /injection/, /\btoken/, /\bjeton/, /secret/,
  /mot de passe/, /password/, /\bpin\b/, /\bcve\b/, /vulnerab/, /\bxss\b/,
  /\bcsrf\b/, /x-forwarded/, /forgeable/, /\bauth/, /bypass/,
];

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Vrai si le titre évoque un sujet de sécurité : le lot n'est alors jamais publié. */
export function isDenied(title) {
  const t = fold(String(title));
  return DENY.some((re) => re.test(t));
}

function day(v) {
  if (v == null || v === '') return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return undefined;
  return s.slice(0, 10);
}

/** Lots de processus (revues UX…) : jamais publiés sans `public:` explicite. */
const PROCESS = [/^revue\b/, /^audit\b/, /^campagne\b/];
export const isProcessLot = (lot) => PROCESS.some((re) => re.test(fold(String(lot?.title ?? '')).trim()));

export const PUBLIC_TITLE_MAX = 80;

/**
 * Titre montré au visiteur : ≤ 80 caractères, sans chemin, nom de technique ni
 * identifiant de lot. Non conforme → erreur (on corrige le plan, on ne publie pas).
 */
export function checkPublicTitle(title, where) {
  const t = String(title ?? '').trim();
  const why =
    !t ? 'vide'
      : t.length > PUBLIC_TITLE_MAX ? `${t.length} caractères (> ${PUBLIC_TITLE_MAX})`
        : /\//.test(t) ? 'contient « / »'
          : /\.ya?ml\b/i.test(t) ? 'cite un fichier'
            : /localstorage/i.test(t) ? 'nom de technique'
              : /\bL\d+\b/.test(t) ? 'cite un identifiant de lot'
                : isDenied(t) ? 'liste noire sécurité'
                  : null;
  if (why) throw new Error(`titre public de ${where} non conforme (${why}) : « ${t} »`);
  return t;
}

/**
 * Plan raf (objet YAML) → données publiques. Pur, sans E/S.
 * Titre d'un lot : `public:`, sinon titre de sa Nouveauté (`newsTitles`), sinon
 * le lot est masqué — jamais le titre brut du plan. Sous-tâche : `public:` ou
 * rien (elle ne compte alors que dans l'avancement n/m).
 */
export function buildPlan(raf, { newsTitles = new Map() } = {}) {
  if (!raf || !Array.isArray(raf.lots)) throw new Error('plan raf invalide : pas de liste « lots »');
  const lots = [];
  for (const lot of raf.lots) {
    if (lot?.visible !== true) continue;
    if (!PUBLISHED_STATUSES.includes(lot.status)) continue;
    if (isDenied(lot.title)) continue;
    const id = String(lot.id);
    let title = lot.public;
    if (title == null && !isProcessLot(lot)) title = newsTitles.get(id);
    if (title == null) continue;
    const out = { id, title: checkPublicTitle(title, id), status: lot.status };
    const started = day(lot.started);
    const finished = lot.status === 'done' ? day(lot.finished) : undefined;
    if (started) out.started = started;
    if (finished) out.finished = finished;
    const tasks = (Array.isArray(lot.tasks) ? lot.tasks : []).filter((t) => t && !isDenied(t.title ?? ''));
    if (tasks.length > 0) {
      out.tasks = tasks.map((t) =>
        t.public != null
          ? { title: checkPublicTitle(t.public, `${id}/${t.id}`), status: String(t.status) }
          : { status: String(t.status) },
      );
    }
    lots.push(out);
  }
  return { version: 1, project: String(raf.project ?? ''), lots };
}

/**
 * Entrées Nouveautés (`docs/nouveautes/*.md`, front-matter cadence) → titre de
 * l'entrée la plus récente de chaque lot. Dossier absent = carte vide.
 */
export function readNewsTitles(dir) {
  const m = new Map();
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return m; }
  const entries = [];
  for (const f of files) {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(dir, f), 'utf8'));
    if (!fm) continue;
    const meta = parse(fm[1]) ?? {};
    if (!meta.title || !Array.isArray(meta.lots)) continue;
    entries.push({ key: `${day(meta.date) ?? ''} ${f}`, title: String(meta.title), lots: meta.lots.map(String) });
  }
  entries.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  for (const e of entries) for (const id of e.lots) if (!m.has(id)) m.set(id, e.title);
  return m;
}


/** Longueur minimale d'un texte privé recherché (en deçà, coïncidences possibles). */
const MIN_PRIVATE = 12;

/**
 * Textes du plan qui ne doivent JAMAIS sortir : notes (lots et sous-tâches),
 * verdicts UX, raisons d'abandon, titres bruts — sauf s'ils sont identiques à un
 * titre effectivement publié dans `plan`.
 */
export function privateTexts(raf, plan) {
  const published = new Set((plan?.lots ?? []).flatMap((l) => [l.title, ...(l.tasks ?? []).map((t) => t.title)]).filter(Boolean));
  const out = new Set();
  const add = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s.length >= MIN_PRIVATE && !published.has(s)) out.add(s);
  };
  const walk = (item) => {
    add(item?.title);
    add(item?.reason);
    add(item?.ux?.verdict);
    for (const n of Array.isArray(item?.notes) ? item.notes : []) add(n?.text ?? n);
    for (const t of Array.isArray(item?.tasks) ? item.tasks : []) walk(t);
  };
  for (const lot of raf?.lots ?? []) walk(lot);
  return [...out];
}

/** Formes sous lesquelles un texte peut apparaître dans un fichier construit. */
function forms(s) {
  const json = JSON.stringify(s).slice(1, -1);
  const ascii = json.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return [...new Set([s, json, ascii])];
}

/** Textes privés du plan présents dans `text`. */
export function findLeaks(raf, text, plan) {
  return privateTexts(raf, plan).filter((s) => forms(s).some((f) => text.includes(f)));
}

/** Parcourt un dossier construit ; retourne { file, text } pour chaque fuite. */
export function scanDir(raf, plan, dir) {
  const walk = (d) =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const out = [];
  for (const file of walk(dir).sort()) {
    const text = readFileSync(file).toString('utf8');
    for (const t of findLeaks(raf, text, plan)) out.push({ file: relative(dir, file), text: t });
  }
  return out;
}

export const renderPlan = (plan) => JSON.stringify(plan, null, 2) + '\n';

export const readPlan = (path) => parse(readFileSync(path, 'utf8'));

function main(argv) {
  const arg = (name, def) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
  };
  const input = arg('--in', '../docs/plan/raf.yaml');
  const output = arg('--out', 'public/plan-data/plan.json');
  const newsDir = arg('--news', '../docs/nouveautes');
  if (argv.includes('--leaks')) {
    const dir = arg('--leaks', 'dist');
    if (!existsSync(input)) {
      // Build Docker (contexte frontend/) : pas de plan brut à comparer ; le test
      // Vitest et le build local font la vérification.
      console.log(`plan-data : ${input} absent, vérification des fuites sautée.`);
      return;
    }
    const leaks = scanDir(readPlan(input), JSON.parse(readFileSync(output, 'utf8')), dir);
    if (leaks.length > 0) {
      for (const l of leaks) console.error(`FUITE du plan dans ${dir}/${l.file} : « ${l.text.slice(0, 80)} »`);
      process.exit(1);
    }
    console.log(`plan-data : aucun texte privé du plan dans ${dir}/.`);
    return;
  }
  const json = renderPlan(buildPlan(readPlan(input), { newsTitles: readNewsTitles(newsDir) }));
  if (argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(output, 'utf8'); } catch { /* absent = pas à jour */ }
    if (current !== json) {
      console.error(`${output} n'est pas à jour avec ${input} : lancer « npm run plan ».`);
      process.exit(1);
    }
    console.log(`${output} à jour.`);
    return;
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, json);
  const n = JSON.parse(json).lots.length;
  console.log(`${output} : ${n} lot(s) publié(s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
