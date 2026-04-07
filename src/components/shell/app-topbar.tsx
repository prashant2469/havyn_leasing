import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopbar({ subtitle }: { subtitle?: string }) {
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-6" />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-sm">
          {subtitle ?? "Property management workspace"}
        </p>
      </div>
    </header>
  );
}
