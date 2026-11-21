import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Focus (WCAG 2.4.3) : le bouton disparaît pendant le nouvel appel. Le focus passe alors sur <main>, puis
// revient sur « Réessayer » si l'erreur revient dans la minute ; sans retour d'erreur, la marque s'éteint.
let retryEn = 0;
const FENETRE_MS = 60_000;
// L260/t2 (revue M1) : dans le fournisseur, un bloc qui cesse d'être le premier en panne perd son bouton. S'il avait le
// focus (posé après « Réessayer »), le nouveau premier le reprend, sinon il retombait sur <body> quand le bloc le plus
// haut retombait en panne après les autres. Fenêtre courte : le relais ne vaut que pour le bouton qui remplace l'autre.
let relaisEn = 0;
const RELAIS_MS = 1_000;

/**
 * L260 — une panne de l'API sans cause (tous les appels d'une page en 5xx ou sans réseau) affichait un « Réessayer »
 * par bloc : 5 sur l'accueil, 2 sur le classement et l'actu. Les messages d'une page s'inscrivent ici ; dès que deux
 * blocs ou plus sont en panne, seul le premier dans l'ordre du document garde « Réessayer », qui relance tous les
 * appels, et dit ce qui a échoué ailleurs. Hors de ce fournisseur (tests d'un bloc seul), chaque message garde le sien.
 */
interface Panne {
  id: string;
  message: string;
  quoi: string;
  relancer: { current: () => void };
  element: { current: HTMLElement | null };
}

interface Registre {
  pannes: Panne[];
  inscrire: (panne: Panne) => () => void;
}

const PannesContext = createContext<Registre | null>(null);

/**
 * L260/t1 (WCAG 4.1.3) : dans le fournisseur, les messages visibles n'ont pas de rôle ; UNE région assertive, présente
 * dès le départ (une région ajoutée avec son texte n'est pas toujours lue), annonce le message du bloc qui porte
 * « Réessayer » et le récapitulatif des autres pannes. Les blocs d'une panne arrivent à quelques millisecondes
 * d'écart : le texte n'est posé qu'une fois la liste stable depuis ANNONCE_MS, d'où une seule annonce, la complète.
 * Quand plus rien n'est en panne, la région se vide aussitôt : une panne revenue après « Réessayer » est réannoncée.
 *
 * L260/t2 (revue m1, m2) : la région est vidée EFFACE_MS après l'annonce (comme le LiveAnnouncer de react-aria),
 * sinon le parcours au clavier ou en lecture continue relisait le message une seconde fois ; vider une région ne
 * s'annonce pas. Une panne qui s'ajoute plus de ANNONCE_MS après une annonce n'annonce que ce qui est nouveau
 * (« Impossible aussi de charger … »), sans relire le message déjà dit ; tant que le bloc en tête ne change pas.
 */
const ANNONCE_MS = 250;
const EFFACE_MS = 7_000;

export function PannesProvider({ children }: { children: React.ReactNode }) {
  const [pannes, setPannes] = useState<Panne[]>([]);
  const [annonce, setAnnonce] = useState('');
  const dejaDit = useRef<{ tete: string; quoi: Set<string> } | null>(null);
  const inscrire = useCallback((panne: Panne) => {
    setPannes((l) => [...l.filter((p) => p.id !== panne.id), panne]);
    return () => setPannes((l) => l.filter((p) => p.id !== panne.id));
  }, []);
  const valeur = useMemo(() => ({ pannes, inscrire }), [pannes, inscrire]);
  const ordre = dansLOrdre(pannes);
  const tete = ordre[0]?.message ?? '';
  const autres = ordre.length > 0 ? autresPannes(ordre) : [];
  const texte = texteAnnonce(pannes);

  useEffect(() => {
    if (!texte) {
      dejaDit.current = null;
      setAnnonce('');
      return;
    }
    const poser = setTimeout(() => {
      const dit = dejaDit.current;
      if (dit && dit.tete === tete) {
        const nouvelles = autres.filter((q) => !dit.quoi.has(q));
        if (nouvelles.length === 0) return;
        for (const q of nouvelles) dit.quoi.add(q);
        setAnnonce(recapitulatif(nouvelles));
      } else {
        dejaDit.current = { tete, quoi: new Set(autres) };
        setAnnonce(texte);
      }
    }, ANNONCE_MS);
    const effacer = setTimeout(() => setAnnonce(''), ANNONCE_MS + EFFACE_MS);
    return () => {
      clearTimeout(poser);
      clearTimeout(effacer);
    };
    // `tete` et `autres` se déduisent de `texte` : le texte seul déclenche.
  }, [texte]);

  return (
    <PannesContext.Provider value={valeur}>
      <div aria-live="assertive" aria-atomic="true" data-testid="annonce-pannes" className="sr-only">
        {annonce}
      </div>
      {children}
    </PannesContext.Provider>
  );
}

/** « Impossible de charger le classement. » → « le classement » ; un autre texte est repris tel quel. */
function objet(message: string): string {
  const m = /^Impossible de charger (.+?)\.?$/.exec(message.trim());
  return m ? m[1] : message.trim().replace(/\.$/, '');
}

/** « a », « a et b », « a, b et c ». */
function enumeration(elements: string[]): string {
  return elements.length < 2 ? elements.join('') : `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`;
}

/** Pannes dans l'ordre du document. */
function dansLOrdre(pannes: Panne[]): Panne[] {
  return [...pannes].sort((a, b) => {
    const ea = a.element.current;
    const eb = b.element.current;
    if (!ea || !eb) return 0;
    return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/** Ce que les autres blocs n'ont pas pu charger, sans répéter celui du premier. */
function autresPannes(ordre: Panne[]): string[] {
  return [...new Set(ordre.slice(1).map((p) => p.quoi))].filter((q) => q !== ordre[0].quoi);
}

function recapitulatif(autres: string[]): string {
  return `Impossible aussi de charger ${enumeration(autres)}. « Réessayer » relance tout.`;
}

/** Texte de la région annoncée : message du premier bloc en panne, puis le récapitulatif s'il y en a d'autres. */
function texteAnnonce(pannes: Panne[]): string {
  if (pannes.length === 0) return '';
  const ordre = dansLOrdre(pannes);
  const autres = autresPannes(ordre);
  return autres.length > 0 ? `${ordre[0].message} ${recapitulatif(autres)}` : ordre[0].message;
}

interface RetryMessageProps {
  message: string;
  onRetry: () => void;
  messageTestId: string;
  buttonTestId: string;
  className?: string;
}

/** Message d'erreur d'un bloc + « Réessayer » (L85) ; un seul « Réessayer » par page en cas de panne générale (L260). */
export function RetryMessage({ message, onRetry, messageTestId, buttonTestId, className }: RetryMessageProps) {
  const boutonRef = useRef<HTMLButtonElement | null>(null);
  const racineRef = useRef<HTMLDivElement>(null);
  const relancer = useRef(onRetry);
  relancer.current = onRetry;
  const id = useId();
  const registre = useContext(PannesContext);
  const inscrire = registre?.inscrire;
  const quoi = objet(message);

  useLayoutEffect(() => {
    if (!inscrire) return;
    return inscrire({ id, message, quoi, relancer, element: racineRef });
  }, [inscrire, id, message, quoi]);

  const pannes = registre ? dansLOrdre(registre.pannes) : [];
  const groupe = pannes.length > 1 && pannes.some((p) => p.id === id);
  const chef = !groupe || pannes[0].id === id;
  const autres = groupe && chef ? autresPannes(pannes) : [];

  // Ref rappelée avec null juste avant le retrait du bouton : on sait encore s'il avait le focus. Seul un bouton retiré
  // parce qu'un autre bloc passe en tête passe le relais (`chef` déjà faux) ; un bloc démonté (chargé) ne le passe pas.
  const chefRef = useRef(chef);
  chefRef.current = chef;
  const refBouton = useCallback((bouton: HTMLButtonElement | null) => {
    if (!bouton && !chefRef.current && boutonRef.current && document.activeElement === boutonRef.current) {
      relaisEn = Date.now();
    }
    boutonRef.current = bouton;
  }, []);

  useEffect(() => {
    const relais = relaisEn !== 0 && Date.now() - relaisEn < RELAIS_MS;
    if (!relais) relaisEn = 0;
    if (!relais && (!retryEn || Date.now() - retryEn >= FENETRE_MS)) {
      retryEn = 0;
      return;
    }
    // Dans le fournisseur, le rôle (chef ou non) n'est connu qu'une fois les blocs inscrits : le focus attend l'image suivante.
    const poser = () => {
      if ((retryEn || relaisEn) && boutonRef.current) {
        boutonRef.current.focus();
        retryEn = 0;
        relaisEn = 0;
      }
    };
    if (!registre) {
      poser();
      return;
    }
    const image = requestAnimationFrame(poser);
    return () => cancelAnimationFrame(image);
  }, [chef, registre]);

  return (
    <div ref={racineRef} className={className ?? 'flex flex-col items-center gap-3 text-center'}>
      <p data-testid={messageTestId} role={registre ? undefined : 'alert'} className="text-sm text-ol-red-bright">
        {message}
      </p>
      {autres.length > 0 && (
        <p data-testid="pannes-groupees" className="text-sm text-fg-muted">
          {recapitulatif(autres)}
        </p>
      )}
      {chef && (
        <button
          ref={refBouton}
          type="button"
          data-testid={buttonTestId}
          onClick={(e) => {
            const main = e.currentTarget.closest('main');
            if (main) {
              main.tabIndex = -1;
              main.focus({ preventScroll: true });
            }
            retryEn = Date.now();
            if (groupe) for (const p of pannes) p.relancer.current();
            else onRetry();
          }}
          className="min-h-[44px] rounded-md border border-ol-blue-bright bg-ol-blue-bright/10 px-5 text-sm font-semibold text-fg-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
