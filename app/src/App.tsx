import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen, Video, Radio, Bot, LayoutDashboard, Menu, Home, Sparkles,
  LogOut, User, Settings, ChevronDown
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import HomePage from '@/pages/HomePage';
import ResourcesPage from '@/pages/ResourcesPage';
import CoursesPage from '@/pages/CoursesPage';
import LivePage from '@/pages/LivePage';
import AIPage from '@/pages/AIPage';
import AdminPage from '@/pages/AdminPage';
import LoginPage from '@/pages/LoginPage';

const navItems = [
  { path: '/', label: '首页', icon: Home, requireAuth: false },
  { path: '/resources', label: '资料库', icon: BookOpen, requireAuth: false },
  { path: '/courses', label: '网课中心', icon: Video, requireAuth: false },
  { path: '/live', label: '直播中心', icon: Radio, requireAuth: false },
  { path: '/ai', label: 'AI助手', icon: Bot, requireAuth: false },
  { path: '/admin', label: '管理后台', icon: LayoutDashboard, requireAuth: true, adminOnly: true },
];

function UserMenu() {
  const { user, logoutFn } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login">
        <Button size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-sm gap-1.5">
          <User className="w-4 h-4" />登录
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-2 pl-3 pr-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{user.displayName[0]}</span>
          </div>
          <span className="hidden sm:inline text-sm">{user.displayName}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <div className="px-3 py-2">
          <p className="text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-gray-500">@{user.username}</p>
          {user.role === 'admin' && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-1">
              <Settings className="w-3 h-3" />管理员
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        {user.role === 'admin' && (
          <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
            <LayoutDashboard className="w-4 h-4 mr-2" />管理后台
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { logoutFn(); navigate('/'); }} className="cursor-pointer text-red-600">
          <LogOut className="w-4 h-4 mr-2" />退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Navigation() {
  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hide nav on login page
  if (location.pathname === '/login') return null;

  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition-colors">高中数学资料库</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {visibleNavItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button variant={isActive ? 'default' : 'ghost'} size="sm"
                    className={`rounded-lg text-sm gap-1.5 ${
                      isActive ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <UserMenu />
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-4">
                <div className="flex flex-col gap-1 mt-6">
                  <div className="mb-3 px-2">
                    <UserMenu />
                  </div>
                  {visibleNavItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                        <Button variant={isActive ? 'default' : 'ghost'} className={`w-full justify-start gap-2 rounded-lg ${
                          isActive ? 'bg-blue-600 text-white' : 'text-gray-600'
                        }`}>
                          <item.icon className="w-4 h-4" />{item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/live" element={<LivePage />} />
      <Route path="/ai" element={<AIPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navigation />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
