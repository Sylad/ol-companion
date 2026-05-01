import { useEffect } from 'react';
import { Gamepad2, Trophy, History, Construction } from 'lucide-react';

const ELECTRIC_BLUE_BRIGHT = '#3aa0ff';
const NOOBZ_GREEN = '#84cc16';
const NOOBZ_GREEN_GLOW = 'rgba(132, 204, 22, 0.55)';

export function FcNoobzPage() {
  useEffect(() => {
    document.body.classList.add('theme-fcnoobz');
    return () => document.body.classList.remove('theme-fcnoobz');
  }, []);

  return (
    <div className="space-y-8 -mx-5 -my-6 lg:-mx-8 lg:-my-10 px-5 lg:px-8 py-6 lg:py-10 min-h-[calc(100vh-2rem)]"
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(29, 78, 216, 0.18) 0%, transparent 65%), linear-gradient(180deg, #03040a 0%, #060814 60%, #03040a 100%)',
      }}
    >
      {/* HERO */}
      <header className="relative overflow-hidden rounded-md p-8 lg:p-12 text-center"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(29, 78, 216, 0.22) 0%, transparent 70%), #050714',
          border: `1px solid ${NOOBZ_GREEN}`,
          boxShadow: `0 0 24px ${NOOBZ_GREEN_GLOW}, inset 0 0 60px rgba(29, 78, 216, 0.15)`,
        }}
      >
        {/* Lightning streaks bg */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M 50 0 L 70 80 L 50 100 L 90 200" stroke={ELECTRIC_BLUE_BRIGHT} strokeWidth="0.6" fill="none" />
          <path d="M 350 0 L 320 60 L 340 100 L 310 200" stroke={ELECTRIC_BLUE_BRIGHT} strokeWidth="0.6" fill="none" />
          <path d="M 200 0 L 180 50 L 220 100 L 190 200" stroke={ELECTRIC_BLUE_BRIGHT} strokeWidth="0.4" fill="none" opacity="0.6" />
        </svg>

        <img
          src="/fcnoobz.png"
          alt="FC Noobz"
          className="relative mx-auto w-32 h-32 lg:w-40 lg:h-40 object-contain"
          style={{
            filter: `drop-shadow(0 0 28px ${NOOBZ_GREEN_GLOW}) drop-shadow(0 0 14px rgba(29, 78, 216, 0.5))`,
          }}
        />

        <h1
          className="relative mt-6 font-display text-display-md lg:text-display-lg font-extrabold uppercase tracking-tight"
          style={{
            color: ELECTRIC_BLUE_BRIGHT,
            WebkitTextStroke: '0.6px #000',
            textShadow: `0 0 18px ${NOOBZ_GREEN_GLOW}, 0 0 6px rgba(29, 78, 216, 0.7)`,
          }}
        >
          FC Noobz
        </h1>
        <p className="relative mt-3 text-sm uppercase tracking-[0.4em]" style={{ color: NOOBZ_GREEN }}>
          Since 1980
        </p>
      </header>

      {/* PRESENTATION */}
      <section
        className="rounded-md p-6 lg:p-8"
        style={{
          background: 'linear-gradient(180deg, rgba(5, 7, 20, 0.85), rgba(3, 4, 10, 0.9))',
          border: `1px solid rgba(132, 204, 22, 0.4)`,
        }}
      >
        <div className="eyebrow mb-2" style={{ color: NOOBZ_GREEN }}>Le club</div>
        <h2 className="font-display text-2xl font-bold mb-4" style={{ color: ELECTRIC_BLUE_BRIGHT }}>
          Le légendaire FC Noobz
        </h2>
        <p className="text-fg-muted leading-relaxed max-w-3xl">
          Club fictif né dans les sauvegardes Football Manager d'un fan de l'Olympique Lyonnais.
          Fondé en 1980, le FC Noobz est devenu au fil des éditions une véritable institution
          virtuelle, traversant les saisons, les ligues et les générations de joueurs créés.
        </p>
        <p className="text-fg-muted leading-relaxed max-w-3xl mt-4">
          Cette page lui est dédiée — un coin du site pour archiver l'histoire du club,
          ses promus, ses titres et ses légendes au fil des Football Manager.
        </p>
      </section>

      {/* FUTURES SECTIONS */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FeatureTile
          icon={Gamepad2}
          title="Lecteur de sauvegarde FM"
          desc="Importer et explorer les sauvegardes Football Manager pour suivre l'évolution du FC Noobz au fil des saisons."
          status="À l'étude"
        />
        <FeatureTile
          icon={History}
          title="Histoire du club"
          desc="Chronologie complète : promotions, titres, transferts marquants, joueurs légendaires."
          status="À venir"
        />
        <FeatureTile
          icon={Trophy}
          title="Palmarès virtuel"
          desc="Trophées, statistiques et records accumulés au fil des éditions FM."
          status="À venir"
        />
      </section>

      <p className="text-center text-xs" style={{ color: 'rgba(132, 204, 22, 0.5)' }}>
        Section indépendante du suivi OL — purement personnelle.
      </p>
    </div>
  );
}

interface FeatureTileProps {
  icon: typeof Gamepad2;
  title: string;
  desc: string;
  status: string;
}

function FeatureTile({ icon: Icon, title, desc, status }: FeatureTileProps) {
  return (
    <div
      className="rounded-md p-5 group transition-all hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(180deg, rgba(15, 17, 35, 0.85), rgba(5, 7, 20, 0.9))',
        border: `1px solid rgba(132, 204, 22, 0.35)`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center"
          style={{
            background: 'rgba(29, 78, 216, 0.2)',
            border: `1px solid ${NOOBZ_GREEN}`,
            color: ELECTRIC_BLUE_BRIGHT,
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <span
          className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm"
          style={{
            color: NOOBZ_GREEN,
            background: 'rgba(132, 204, 22, 0.1)',
            border: `1px solid ${NOOBZ_GREEN}`,
          }}
        >
          <Construction className="h-2.5 w-2.5" />
          {status}
        </span>
      </div>
      <h3 className="font-bold mb-1.5" style={{ color: ELECTRIC_BLUE_BRIGHT }}>
        {title}
      </h3>
      <p className="text-sm text-fg-muted leading-relaxed">{desc}</p>
    </div>
  );
}
