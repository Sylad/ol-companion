import { useWikiImage } from '@/hooks/use-wiki-image';

const BACKDROPS = [
  { query: 'Groupama Stadium', position: 'top-right', opacity: 0.22, blur: 0.8 },
  { query: 'Juninho Pernambucano', position: 'mid-left', opacity: 0.18, blur: 0.3 },
  { query: 'Karim Benzema', position: 'bottom-right', opacity: 0.16, blur: 0.3 },
] as const;

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  'top-right': {
    top: '6%',
    right: '-8%',
    width: '55%',
    height: '50%',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  },
  'mid-left': {
    top: '32%',
    left: '-10%',
    width: '38%',
    height: '45%',
    backgroundPosition: 'top center',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
  },
  'bottom-right': {
    bottom: '4%',
    right: '-6%',
    width: '32%',
    height: '45%',
    backgroundPosition: 'bottom center',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
  },
};

export function PageBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {BACKDROPS.map((b) => (
        <BackdropImage key={b.query} {...b} />
      ))}
    </div>
  );
}

interface BackdropImageProps {
  query: string;
  position: keyof typeof POSITION_STYLES;
  opacity: number;
  blur: number;
}

function BackdropImage({ query, position, opacity, blur }: BackdropImageProps) {
  const { data } = useWikiImage(query);
  if (!data?.imageUrl) return null;

  return (
    <div
      className="absolute"
      style={{
        ...POSITION_STYLES[position],
        backgroundImage: `url(${data.imageUrl})`,
        opacity,
        filter: `blur(${blur}px) saturate(0.85) contrast(1.05)`,
        mixBlendMode: 'screen',
        maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
      }}
    />
  );
}
