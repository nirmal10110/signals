import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  Building2, 
  Bell, 
  FileText, 
  Settings,
  Search,
  Mail,
  LifeBuoy
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const monitoringItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Top Targets",
    url: createPageUrl("TopTargets"),
    icon: Building2,
  },
  {
    title: "Alerts",
    url: createPageUrl("Alerts"),
    icon: Bell,
  },
  {
    title: "Digests",
    url: createPageUrl("Digests"),
    icon: Mail,
  },
  {
    title: "Templates",
    url: createPageUrl("Templates"),
    icon: FileText,
  },
  {
    title: "Monitoring",
    url: createPageUrl("Monitoring"),
    icon: Search,
  },
  {
    title: "Settings",
    url: createPageUrl("Settings"),
    icon: Settings,
  },
];

const adminItems = [
  {
    title: "Digest Recovery",
    url: createPageUrl("DigestRecovery"),
    icon: LifeBuoy,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary: 142 76% 36%;
          --primary-foreground: 210 40% 98%;
          --secondary: 217 19% 27%;
          --accent: 142 76% 36%;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f5e8c214c862c9e823b068/21277dc16_volpi.png" 
                alt="Volpi Capital" 
                className="h-10 w-auto"
              />
            </div>
            <div className="mt-3">
              <h2 className="font-bold text-emerald-700 text-lg">Volpi Lens</h2>
              <p className="text-xs text-slate-500 font-medium">Intelligence Platform</p>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                📊 Intelligence Monitoring
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {monitoringItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-emerald-50 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                            : 'text-slate-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="my-4 border-t border-slate-200" />

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                🛠️ Admin Tools
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-amber-50 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-amber-600 text-white hover:bg-amber-700' 
                            : 'text-slate-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-700 font-semibold text-sm">VC</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">Volpi Capital</p>
                <p className="text-xs text-slate-500 truncate">Investment Team</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-emerald-700">Volpi Lens</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}