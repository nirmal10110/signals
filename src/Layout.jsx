
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
  TrendingUp,
  Mail,
  Sparkles,
  BookOpen,
  PenTool
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

// HIDDEN - Email generator section removed from sidebar
// const emailGeneratorItems = [
//   {
//     title: "Cold Email Generator",
//     url: createPageUrl("ColdEmailGenerator"),
//     icon: Sparkles,
//   },
//   {
//     title: "Research Library",
//     url: createPageUrl("ResearchLibrary"),
//     icon: BookOpen,
//   },
//   {
//     title: "Email Guidelines",
//     url: createPageUrl("EmailGuidelines"),
//     icon: Settings,
//   },
// ];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary: 222 47% 11%;
          --primary-foreground: 210 40% 98%;
          --secondary: 217 19% 27%;
          --accent: 142 76% 36%;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Deal Intel</h2>
                <p className="text-xs text-slate-500 font-medium">Origination Platform</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {/* Monitoring Workflow */}
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
                        className={`hover:bg-slate-100 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-slate-900 text-white hover:bg-slate-800' 
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

            {/* Email Generator Section - HIDDEN */}
            {/* Divider */}
            {/* <div className="my-4 border-t border-slate-200" /> */}

            {/* Email Generator Workflow */}
            {/* <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                ✉️ Cold Email Generator
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {emailGeneratorItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-slate-100 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-slate-900 text-white hover:bg-slate-800' 
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
            </SidebarGroup> */}
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-slate-700 font-semibold text-sm">PE</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">Origination Team</p>
                <p className="text-xs text-slate-500 truncate">Investment Professional</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-slate-900">Deal Intel</h1>
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
