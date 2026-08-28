export function PageHeading({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) {
  return (
    <div className="page-heading">
      <span className="section-eyebrow">02 / CATEGORY</span>
      <h1
        id="page-title"
        className="text-foreground"
      >
        {title}
      </h1>
      {meta ? <p>{meta}</p> : null}
    </div>
  );
}
