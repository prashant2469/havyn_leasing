export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const normalizedDescription =
    description === "Configure dev auth on the dashboard home first." || description === "Configure dev auth first."
      ? "Sign in with an invited account on /login, then choose your organization from the top bar."
      : description;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {normalizedDescription ? (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{normalizedDescription}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
