import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Shell for ADMIN/SERVANT pages: sidebar + inset content area.
 * Root element direction/language come from LanguageProvider's document
 * attributes; each topbar row re-asserts them for safety.
 */
export function AdminLayout() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-h-screen bg-soft">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
