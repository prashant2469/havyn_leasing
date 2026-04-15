export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-b border-border/60 bg-muted/15 px-4 py-3 md:px-8">
        <p className="text-muted-foreground text-xs font-medium tracking-tight md:text-sm">Havyn · leasing microsites</p>
      </header>
      {children}
      <footer className="text-muted-foreground border-t border-border/60 bg-muted/10 px-4 py-6 text-center text-[11px] leading-relaxed md:px-8 md:text-xs">
        Listings are hosted on Havyn and delivered to the property team you contacted.
      </footer>
    </div>
  );
}

