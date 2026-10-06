/** Building blocks shared by the cards on the Settings page. */

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60px] flex-col gap-3 border-t border-divider px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {children}
    </div>
  );
}

export function RowLabel({
  htmlFor,
  id,
  title,
  description,
}: {
  htmlFor?: string;
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  const Title = htmlFor ? "label" : "span";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Title htmlFor={htmlFor} id={id} className="text-sm font-medium">
        {title}
      </Title>
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-medium text-subtle-foreground">{title}</h2>
      <div className="flex flex-col rounded-lg border border-border bg-surface">{children}</div>
    </section>
  );
}
