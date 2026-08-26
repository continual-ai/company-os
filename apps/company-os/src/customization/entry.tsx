import { applicationConfig } from "@/customization/config"

/** Custom recognition surface shown beside the application-owned sign-in flow. */
export function EntryPanel() {
  return (
    <aside
      aria-labelledby="company-entry-title"
      className="relative hidden min-h-svh items-center overflow-hidden border-l bg-foreground text-background lg:flex"
    >
      <EntryBackdrop />

      <div className="relative z-10 w-full max-w-2xl p-10 xl:p-12">
        <p className="text-xs font-medium tracking-[0.16em] text-background/60 uppercase">
          {applicationConfig.entry.eyebrow}
        </p>
        <h2
          id="company-entry-title"
          className="mt-5 max-w-xl text-[clamp(2.75rem,4vw,4.75rem)] leading-[0.96] font-medium tracking-[-0.05em] text-balance"
        >
          {applicationConfig.entry.headline}
        </h2>
        <p className="mt-6 max-w-lg text-sm/relaxed text-background/65">
          {applicationConfig.entry.description}
        </p>

        <ul className="mt-10 max-w-xl border-t border-background/15 text-sm/relaxed text-background/75">
          {applicationConfig.entry.highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-4 border-b border-background/15 py-4"
            >
              <span
                aria-hidden="true"
                className="mt-[0.45rem] size-1.5 shrink-0 bg-background/45"
              />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function EntryBackdrop() {
  const media = applicationConfig.entry.media

  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:48px_48px] opacity-10" />
      {media ? <EntryMedia media={media} /> : null}
      <div className="absolute inset-0 bg-foreground/25" />
      <div className="absolute inset-0 [background:linear-gradient(to_bottom,transparent_10%,color-mix(in_oklch,var(--foreground)_18%,transparent)_42%,var(--foreground)_92%)]" />
    </div>
  )
}

function EntryMedia({
  media,
}: {
  media: NonNullable<(typeof applicationConfig.entry)["media"]>
}) {
  const style = media.position ? { objectPosition: media.position } : undefined

  if (media.kind === "image") {
    return (
      <img
        alt=""
        src={media.src}
        className="absolute inset-0 size-full object-cover"
        style={style}
      />
    )
  }

  return (
    <>
      <img
        alt=""
        src={media.poster}
        className="absolute inset-0 size-full object-cover"
        style={style}
      />
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={media.poster}
        preload="metadata"
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
        style={style}
      >
        <source
          media="(min-width: 64rem) and (prefers-reduced-motion: no-preference)"
          src={media.src}
        />
      </video>
    </>
  )
}
