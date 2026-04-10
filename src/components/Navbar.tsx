import React from 'react';
import { useAuth } from '../AuthContext';
import { LogOut, User, MapPin, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export default function Navbar() {
  const { user, profile, logout, updateRole } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-2 rounded-lg">
              <ShieldAlert className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:block">
              Roxas Rescue
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user && profile && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full border border-gray-200"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-900 leading-none">
                    {user.displayName}
                  </span>
                  <span className="text-[10px] font-medium text-orange-600 uppercase tracking-wider leading-none mt-0.5">
                    {profile.role}
                  </span>
                </div>
              </div>
            )}

            {user && profile && profile.role !== 'admin' && user.email?.toLowerCase() === "joseralpharrojado789@gmail.com" && (
              <button
                onClick={() => updateRole('admin')}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-orange-500 transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                Switch to Admin
              </button>
            )}
            
            {user && (
              <button 
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
