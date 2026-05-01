export function ClosingSlide({ message }: { message: string }) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-xs tracking-[0.3em] text-[var(--mw-accent)]">THANK YOU</p>
      <p className="max-w-md whitespace-pre-line text-base leading-relaxed">
        {message}
      </p>
    </section>
  );
}
