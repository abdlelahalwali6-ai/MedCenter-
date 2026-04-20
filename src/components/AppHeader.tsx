import { useAuth } from '@/context/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppHeader() {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-primary transition-all" />
        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
        <div className="hidden sm:block">
          <h2 className="text-sm font-bold text-slate-800 leading-none mb-1">
            نظام الإدارة المتكامل
          </h2>
          <p className="text-[0.65rem] text-muted-foreground font-medium uppercase tracking-wider">
            {new Intl.DateTimeFormat('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end hidden md:flex">
          <span className="text-[0.8rem] font-black text-slate-900 leading-none mb-0.5">
            {profile?.displayName || 'مستخدم'}
          </span>
          <span className="text-[0.6rem] font-bold text-primary uppercase tracking-tighter bg-primary/10 px-1.5 py-0.5 rounded-md">
            {profile?.role === 'admin' ? 'المدير الطبي' : profile?.role === 'doctor' ? 'طبيب متخصص' : profile?.role}
          </span>
        </div>
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center font-black text-primary text-xs shadow-sm ring-2 ring-white ring-offset-2 ring-offset-slate-100">
          {profile?.displayName?.substring(0, 2) || 'أ.ع'}
        </div>
      </div>
    </header>
  );
}
