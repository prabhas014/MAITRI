import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Activity, MessageSquare, LayoutDashboard, LogOut, UserCircle, BarChart3, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Layout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'AI Assistant', path: '/chat', icon: MessageSquare },
    { name: 'Health Input', path: '/health', icon: Activity },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Datasets', path: '/datasets', icon: Database },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 glass-panel border-r border-white/10 flex flex-col z-10">
        <div className="p-6">
          <h1 className="text-3xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            MAITRI
          </h1>
          <p className="text-xs tracking-widest uppercase text-blue-200 mt-1 opacity-70">Astronaut Wellness AI</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.name} to={item.path}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                  <Icon size={20} />
                  <span className="font-medium tracking-wide">{item.name}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-2 mb-4">
            <UserCircle className="text-purple-400" size={24} />
            <div>
              <p className="text-sm font-medium text-white tracking-wider">{user?.username || 'Astronaut'}</p>
              <p className="text-xs text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
            <LogOut size={16} />
            Disconnect
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <motion.div 
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="p-8 h-full max-w-7xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
