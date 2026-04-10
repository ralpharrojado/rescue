/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import CustomerDashboard from './pages/CustomerDashboard';
import MechanicDashboard from './pages/MechanicDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-900 animate-pulse">Roxas Rescue</h2>
        <p className="text-slate-400 text-sm mt-2">Connecting you to local mechanics...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main>
        {profile.role === 'customer' && <CustomerDashboard />}
        {profile.role === 'mechanic' && <MechanicDashboard />}
        {profile.role === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
