import { Menu, PanelLeftClose, PanelLeftOpen, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import mindskitLogo from "@/assets/mindskit.png";
import appBackground from "@/assets/bg.png";
import { Footer } from "@/components/layout/footer";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { QUICK_ACTIONS_UPDATED_EVENT, QuickActions, readQuickActionsState } from "@/components/layout/quick-actions";
import { ThemeSelector } from "@/components/layout/theme-selector";
import { Button } from "@/components/ui/button";
import { categories, tools } from "@/config/tools";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppShell() {
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [quickActions, setQuickActions] = useState(readQuickActionsState);

  useEffect(() => {
    const syncQuickActions = () => setQuickActions(readQuickActionsState());
    window.addEventListener(QUICK_ACTIONS_UPDATED_EVENT, syncQuickActions);
    return () => window.removeEventListener(QUICK_ACTIONS_UPDATED_EVENT, syncQuickActions);
  }, []);

  const topCategories = useMemo(() => {
    const usageByCategory = new Map(categories.map((category) => [category.id, 0]));
    for (const [toolId, count] of Object.entries(quickActions.usage)) {
      const category = tools.find((tool) => tool.id === toolId)?.category;
      if (category) usageByCategory.set(category, (usageByCategory.get(category) ?? 0) + count);
    }
    return [...categories].sort((left, right) => (usageByCategory.get(right.id) ?? 0) - (usageByCategory.get(left.id) ?? 0)).slice(0, 3);
  }, [quickActions.usage]);

  const favoriteTool = quickActions.favorites.map((id) => tools.find((tool) => tool.id === id)).find(Boolean);
  const isToolPage = tools.some((tool) => tool.path === pathname);
  const isConstrainedPage = isToolPage || pathname === "/";
  const isFullWidthTool = pathname === "/text-tools/readme-builder";

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <div
        aria-hidden="true"
        className="app-gradient-bg pointer-events-none fixed inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[min(56vw,58rem)] bg-contain bg-bottom bg-no-repeat opacity-70"
        style={{ backgroundImage: `url(${appBackground})` }}
      />
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:sticky">
        <div className="mx-auto flex h-full w-full max-w-[1120px] items-center gap-2">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-4">
            <SheetHeader className="p-0 pb-4">
              <SheetTitle asChild>
                <Link
                  to="/"
                  className="flex items-center gap-2 text-base font-semibold">
                  <Wrench className="size-5 text-primary" />
                  MindsKit
                </Link>
              </SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              <QuickActions variant="sidebar" />
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold">
          <img src={mindskitLogo} alt="" className="size-9 object-contain" />
          MindsKit
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            v0.2.0
          </span>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          onClick={() => setSidebarVisible((visible) => !visible)}>
          {sidebarVisible ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden min-w-0 items-center gap-1 xl:flex">
            {topCategories.map((category) => (
              <a key={category.id} href={`/#${category.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                {category.name}
              </a>
            ))}
            {favoriteTool && (
              <Link to={favoriteTool.path} className="flex max-w-36 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <favoriteTool.icon className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{favoriteTool.name}</span>
              </Link>
            )}
            <QuickActions variant="header" />
          </div>
          <div className="xl:hidden"><QuickActions variant="header" /></div>
          <ThemeSelector />
        </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-visible">
        <aside
          className={sidebarVisible ? "absolute inset-y-0 left-0 z-30 hidden w-60 flex-col gap-3 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 shadow-xl shadow-black/10 lg:flex" : "hidden"}>
          <QuickActions variant="sidebar" />
          <SidebarNav />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-visible px-4 pt-[calc(3.5rem+1rem)] pb-4 sm:px-6 sm:pt-[calc(3.5rem+1.5rem)] sm:pb-6 lg:overflow-x-hidden lg:p-6">
          <div className={isConstrainedPage ? `flex min-h-0 w-full flex-1 flex-col ${isFullWidthTool ? "" : "lg:mx-auto lg:max-w-[1120px]"}` : "w-full"}>
            <Outlet />
          </div>
        </main>
      </div>

      <QuickActions />
      <Footer />
    </div>
  );
}
