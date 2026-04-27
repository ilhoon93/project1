import type { InvitationContent } from '@/types/invitation';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  main: InvitationContent['main'];
}

export function MainSlide({ groomName, brideName, weddingDate, main }: Props) {
  return (
    <section className="relative flex h-full flex-col items-center justify-between px-6 py-16">
      {main.heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={main.heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#F4E5D6] via-[#FAF7F2] to-[#E8D5C0]" />
      )}
      {main.heroImage && <div className="absolute inset-0 bg-black/30" />}

      <div className="relative z-10 mt-8 flex flex-col items-center gap-2 text-center">
        <p className={`text-sm tracking-[0.3em] ${main.heroImage ? 'text-white/90' : 'text-[#8B7355]'}`}>
          OUR WEDDING
        </p>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <h1 className={`flex flex-col items-center gap-2 text-3xl font-light ${main.heroImage ? 'text-white' : 'text-[#3D2E1F]'}`}>
          <span>{groomName}</span>
          <span className={`text-base ${main.heroImage ? 'text-white/80' : 'text-[#8B7355]'}`}>
            ·
          </span>
          <span>{brideName}</span>
        </h1>
        {weddingDate && (
          <p className={`text-sm tracking-widest ${main.heroImage ? 'text-white/90' : 'text-[#8B7355]'}`}>
            {formatDate(weddingDate)}
          </p>
        )}
      </div>

      {main.greeting && (
        <p
          className={`relative z-10 max-w-md whitespace-pre-line text-center text-sm leading-relaxed ${
            main.heroImage ? 'text-white/95' : 'text-[#5C4633]'
          }`}
        >
          {main.greeting}
        </p>
      )}
    </section>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
}
