import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router';
import {
  Settings, Bell, BarChart2, Users, Megaphone, Layers,
  ChevronRight, ChevronDown, Zap, Shield, HelpCircle, LogOut, Heart, MessageCircle,
  Monitor, Route, Smartphone, Target, FileBarChart2, ChartLine, Wrench, Code2, Menu
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const [experiencesOpen, setExperiencesOpen] = useState(false);
  const isRemoteConfigActive = location.pathname.startsWith('/remote_configuration') || location.pathname === '/';
  const staticItems = [
    { label: 'Favorites', icon: Heart },
    { label: 'Dashboard', icon: BarChart2 },
    { label: 'Messages', icon: MessageCircle },
    { label: 'Web Tools', icon: Monitor },
    { label: 'Journeys', icon: Route },
    { label: 'Mobile Inapp', icon: Smartphone },
    { label: 'Targeting', icon: Target },
    { label: 'Reports', icon: FileBarChart2 },
    { label: 'Analytics', icon: ChartLine },
    { label: 'Settings', icon: Wrench },
    { label: 'Developers', icon: Code2 },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col h-full shrink-0"
        style={{ width: 350, background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 px-5 py-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-3">
            <div style={{ fontSize: 18, lineHeight: 1, color: '#111827', fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'Georgia, serif' }}>netmera</div>
          </div>
          <ChevronRight size={18} color="#D1D5DB" />
        </div>

        {/* Workspace selector */}
        <div
          className="flex items-center justify-between mx-3 mt-3 mb-1 px-3 py-2 rounded-lg cursor-pointer"
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg flex items-center justify-center" style={{ width: 34, height: 34, background: '#2563EB' }}>
              <Menu size={16} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#111827', fontWeight: 700 }}>APP</div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Mindoor App</div>
            </div>
          </div>
          <ChevronDown size={16} color="#9CA3AF" />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-3">
          <div className="rounded-lg px-3 mb-3" style={{ border: '1px solid #E5E7EB', height: 40, display: 'flex', alignItems: 'center', color: '#9CA3AF' }}>
            <span style={{ fontSize: 14 }}>Search</span>
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.12em', padding: '8px 0 8px' }}>MAIN MENU</div>
          {staticItems.map(item => (
            <div key={item.label} className="flex items-center gap-3 px-3 rounded-lg" style={{ height: 46, color: '#111827', fontSize: 16, fontWeight: 500, cursor: 'default' }}>
              <item.icon size={18} color="#111827" />
              <span>{item.label}</span>
              <ChevronRight size={14} color="#9CA3AF" className="ml-auto" />
            </div>
          ))}

          <div
            className="relative mt-1"
            onMouseEnter={() => setExperiencesOpen(true)}
            onMouseLeave={() => setExperiencesOpen(false)}
          >
            <div
              className="flex items-center gap-3 px-3 rounded-lg transition-colors"
              style={{
                height: 46,
                background: experiencesOpen || isRemoteConfigActive ? '#111827' : '#FFFFFF',
                color: experiencesOpen || isRemoteConfigActive ? '#FFFFFF' : '#111827',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Zap size={18} />
              <span>Experiences</span>
              <ChevronDown size={14} className="ml-auto" />
            </div>

            {experiencesOpen && (
              <div
                className="absolute rounded-xl p-2"
                style={{ left: '100%', top: 0, marginLeft: 10, width: 270, background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 12px 32px rgba(17,24,39,0.12)', zIndex: 20 }}
              >
                <NavLink
                  to="/remote_configuration"
                  className="flex items-center gap-3 px-3 rounded-lg"
                  style={{ height: 44, color: '#111827', textDecoration: 'none', fontSize: 16, fontWeight: 500, background: isRemoteConfigActive ? '#F9FAFB' : '#FFFFFF' }}
                >
                  <Zap size={16} color="#111827" />
                  <span>Remote Configuration</span>
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4" style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 cursor-pointer"
            style={{ color: '#111827', fontSize: 16 }}
          >
            <HelpCircle size={15} />
            <span>Logout</span>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
            style={{ background: '#F3F4F6' }}
          >
            <div
              className="rounded-full flex items-center justify-center shrink-0 text-[#111827]"
              style={{ width: 40, height: 40, background: '#FFFFFF', fontSize: 20, fontWeight: 500, border: '1px solid #E5E7EB' }}
            >
              ES
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 600, lineHeight: 1.2 }}>Emre Sumer</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Europe/Istanbul</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 52, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: '#6B7280' }}>Platform</span>
            <ChevronRight size={12} color="#9CA3AF" />
            <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 500 }}>Remote Configuration</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg cursor-pointer"
              style={{ width: 32, height: 32, background: '#F3F4F6' }}
            >
              <Bell size={15} color="#6B7280" />
            </div>
            <div
              className="rounded-full flex items-center justify-center text-white"
              style={{ width: 30, height: 30, background: '#2563EB', fontSize: 11, fontWeight: 700 }}
            >
              JS
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
