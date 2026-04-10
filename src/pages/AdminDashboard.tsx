import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Wrench, 
  Car, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  TrendingUp, 
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ChevronRight,
  Search,
  Filter,
  FileText,
  UserCheck,
  UserX,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  getDoc,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'customer' | 'mechanic' | 'admin';
  isVerified?: boolean;
  application?: {
    fullName: string;
    birthday: string;
    idCardUrl: string;
    facePhotoUrl: string;
    submittedAt: any;
    status: 'pending' | 'approved' | 'rejected';
  };
  createdAt: any;
  photoURL?: string;
}

interface Rescue {
  id: string;
  customerName: string;
  mechanicName?: string;
  status: string;
  issue: string;
  createdAt: any;
  price?: number;
}

interface PricingSettings {
  baseFee: number;
  perKmFee: number;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rescues, setRescues] = useState<Rescue[]>([]);
  const [pricing, setPricing] = useState<PricingSettings>({ baseFee: 150, perKmFee: 20 });
  const [loading, setLoading] = useState(true);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'mechanics' | 'applications' | 'pricing' | 'rescues'>('overview');
  const [selectedApp, setSelectedApp] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Listen to users
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
    });

    // Listen to rescues
    const rescuesQuery = query(collection(db, 'rescues'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeRescues = onSnapshot(rescuesQuery, (snapshot) => {
      const rescuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rescue));
      setRescues(rescuesData);
      setLoading(false);
    });

    // Get pricing
    const getPricing = async () => {
      const pricingDoc = await getDoc(doc(db, 'settings', 'pricing'));
      if (pricingDoc.exists()) {
        setPricing(pricingDoc.data() as PricingSettings);
      }
    };
    getPricing();

    return () => {
      unsubscribeUsers();
      unsubscribeRescues();
    };
  }, []);

  const verifyMechanic = async (uid: string, status: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isVerified: status,
        'application.status': status ? 'approved' : 'rejected'
      });
    } catch (error) {
      console.error("Verification error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const reviewApplication = async (uid: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isVerified: status === 'approved',
        'application.status': status
      });
      setSelectedApp(null);
    } catch (error) {
      console.error("Review error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const savePricing = async () => {
    setIsSavingPricing(true);
    try {
      await setDoc(doc(db, 'settings', 'pricing'), {
        ...pricing,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.uid
      });
    } catch (error) {
      console.error("Pricing update error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/pricing');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const stats = {
    totalUsers: users.length,
    totalMechanics: users.filter(u => u.role === 'mechanic').length,
    pendingMechanics: users.filter(u => u.role === 'mechanic' && !u.isVerified).length,
    pendingApplications: users.filter(u => u.role === 'mechanic' && u.application?.status === 'pending').length,
    activeRescues: rescues.filter(r => ['pending', 'accepted', 'in-progress'].includes(r.status)).length,
    completedRescues: rescues.filter(r => r.status === 'completed').length,
    totalRevenue: rescues.filter(r => r.status === 'completed').reduce((acc, r) => acc + (r.price || 0), 0)
  };

  if (loading) {
    return (
      <div className="pt-32 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading admin data...</p>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-slate-500">Manage mechanics, pricing, and system operations</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto no-scrollbar">
          {(['overview', 'mechanics', 'applications', 'pricing', 'rescues'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all capitalize relative whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab}
              {tab === 'applications' && stats.pendingApplications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
                  {stats.pendingApplications}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'applications' && (
        <div className="space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900">Mechanic Applications</h2>
              <p className="text-slate-500">Review documents and verify new service providers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-bold">
                    <th className="px-8 py-4">Applicant</th>
                    <th className="px-8 py-4">Submitted</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'mechanic' && u.application).map((mechanic) => (
                    <tr key={mechanic.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                            {mechanic.displayName?.[0] || 'M'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{mechanic.application?.fullName || mechanic.displayName}</p>
                            <p className="text-xs text-slate-500">{mechanic.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-slate-500 text-sm">
                        {mechanic.application?.submittedAt ? new Date(mechanic.application.submittedAt.toDate()).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-8 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          mechanic.application?.status === 'approved' ? 'bg-green-100 text-green-600' :
                          mechanic.application?.status === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {mechanic.application?.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button 
                          onClick={() => setSelectedApp(mechanic)}
                          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                        >
                          Review Application
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.filter(u => u.role === 'mechanic' && u.application).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-slate-400">
                        No applications found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Application Review Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                    {selectedApp.displayName?.[0] || 'M'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Review Application</h3>
                    <p className="text-sm text-slate-500">{selectedApp.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedApp(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Applicant Details</h4>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</p>
                        <p className="font-bold text-slate-900">{selectedApp.application?.fullName}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Birthday</p>
                        <p className="font-bold text-slate-900">{selectedApp.application?.birthday}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Submission Date</p>
                        <p className="font-bold text-slate-900">
                          {selectedApp.application?.submittedAt ? new Date(selectedApp.application.submittedAt.toDate()).toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Documents</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">ID Card</p>
                        <div className="relative group aspect-video rounded-2xl overflow-hidden border border-slate-200">
                          <img 
                            src={selectedApp.application?.idCardUrl} 
                            alt="ID Card" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <a 
                            href={selectedApp.application?.idCardUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <ExternalLink className="w-8 h-8 text-white" />
                          </a>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Face Photo</p>
                        <div className="relative group aspect-video rounded-2xl overflow-hidden border border-slate-200">
                          <img 
                            src={selectedApp.application?.facePhotoUrl} 
                            alt="Face Photo" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <a 
                            href={selectedApp.application?.facePhotoUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <ExternalLink className="w-8 h-8 text-white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => reviewApplication(selectedApp.uid, 'rejected')}
                  className="flex-1 py-4 bg-white border border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <UserX className="w-5 h-5" />
                  Reject Application
                </button>
                <button 
                  onClick={() => reviewApplication(selectedApp.uid, 'approved')}
                  className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-5 h-5" />
                  Approve & Verify
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              icon={<Users className="w-6 h-6 text-blue-500" />} 
              label="Total Users" 
              value={stats.totalUsers} 
              color="blue"
            />
            <StatCard 
              icon={<Wrench className="w-6 h-6 text-orange-500" />} 
              label="Mechanics" 
              value={stats.totalMechanics} 
              subValue={`${stats.pendingMechanics} pending`}
              color="orange"
            />
            <StatCard 
              icon={<Car className="w-6 h-6 text-green-500" />} 
              label="Active Rescues" 
              value={stats.activeRescues} 
              color="green"
            />
            <StatCard 
              icon={<DollarSign className="w-6 h-6 text-purple-500" />} 
              label="Total Revenue" 
              value={`₱${stats.totalRevenue.toLocaleString()}`} 
              color="purple"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pending Mechanics */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-orange-500" />
                  Pending Applications
                </h2>
                <button 
                  onClick={() => setActiveTab('applications')}
                  className="text-orange-500 font-bold text-sm hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {users.filter(u => u.role === 'mechanic' && u.application?.status === 'pending').slice(0, 5).map((mechanic) => (
                  <div key={mechanic.uid} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                        {mechanic.displayName?.[0] || 'M'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{mechanic.application?.fullName || mechanic.displayName}</p>
                        <p className="text-xs text-slate-500">Submitted {new Date(mechanic.application?.submittedAt?.toDate()).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedApp(mechanic)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
                {stats.pendingApplications === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-200 mx-auto mb-3" />
                    <p className="text-slate-400">No pending applications</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-500" />
                  Recent Rescues
                </h2>
                <button 
                  onClick={() => setActiveTab('rescues')}
                  className="text-orange-500 font-bold text-sm hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {rescues.slice(0, 5).map((rescue) => (
                  <div key={rescue.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-slate-900">{rescue.customerName}</p>
                      <p className="text-xs text-slate-500">{rescue.issue}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={rescue.status} />
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(rescue.createdAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mechanics' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900">Mechanic Management</h2>
            <p className="text-slate-500">Verify and manage all service providers</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-bold">
                  <th className="px-8 py-4">Mechanic</th>
                  <th className="px-8 py-4">Email</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Joined</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.filter(u => u.role === 'mechanic').map((mechanic) => (
                  <tr key={mechanic.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                          {mechanic.displayName?.[0] || 'M'}
                        </div>
                        <span className="font-bold text-slate-900">{mechanic.displayName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-slate-500">{mechanic.email}</td>
                    <td className="px-8 py-4">
                      {mechanic.isVerified ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold">
                          <AlertCircle className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-slate-500 text-sm">
                      {new Date(mechanic.createdAt?.toDate()).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => verifyMechanic(mechanic.uid, !mechanic.isVerified)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          mechanic.isVerified 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-100'
                        }`}
                      >
                        {mechanic.isVerified ? 'Revoke' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-orange-100 rounded-2xl">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Pricing Control</h2>
                <p className="text-slate-500">Set global rates for rescue services</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Base Fee (₱)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input 
                      type="number"
                      value={pricing.baseFee}
                      onChange={(e) => setPricing({ ...pricing, baseFee: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">Flat fee charged for every rescue request</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Per KM Fee (₱)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input 
                      type="number"
                      value={pricing.perKmFee}
                      onChange={(e) => setPricing({ ...pricing, perKmFee: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">Additional fee per kilometer of travel</p>
                </div>
              </div>

              <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
                <h4 className="text-sm font-bold text-orange-900 mb-2">Example Calculation</h4>
                <p className="text-xs text-orange-700 leading-relaxed">
                  A 5km rescue would cost: <br />
                  <span className="font-bold">₱{pricing.baseFee}</span> (Base) + (<span className="font-bold">5km</span> × <span className="font-bold">₱{pricing.perKmFee}</span>) = <span className="font-bold text-lg">₱{pricing.baseFee + (5 * pricing.perKmFee)}</span>
                </p>
              </div>

              <button 
                onClick={savePricing}
                disabled={isSavingPricing}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingPricing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Pricing Rates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rescues' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Rescue History</h2>
              <p className="text-slate-500">Monitor all system activity</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  placeholder="Search rescues..."
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-bold">
                  <th className="px-8 py-4">Customer</th>
                  <th className="px-8 py-4">Mechanic</th>
                  <th className="px-8 py-4">Issue</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Price</th>
                  <th className="px-8 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rescues.map((rescue) => (
                  <tr key={rescue.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 font-bold text-slate-900">{rescue.customerName}</td>
                    <td className="px-8 py-4 text-slate-600">{rescue.mechanicName || '—'}</td>
                    <td className="px-8 py-4 text-slate-500 text-sm truncate max-w-[200px]">{rescue.issue}</td>
                    <td className="px-8 py-4">
                      <StatusBadge status={rescue.status} />
                    </td>
                    <td className="px-8 py-4 font-bold text-slate-900">
                      {rescue.price ? `₱${rescue.price}` : '—'}
                    </td>
                    <td className="px-8 py-4 text-slate-400 text-sm">
                      {new Date(rescue.createdAt?.toDate()).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: { icon: React.ReactNode, label: string, value: string | number, subValue?: string, color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50',
    orange: 'bg-orange-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50'
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className={`w-12 h-12 ${colorClasses[color]} rounded-2xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {subValue && <span className="text-xs text-slate-400">{subValue}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string, text: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    accepted: { bg: 'bg-blue-100', text: 'text-blue-600' },
    'in-progress': { bg: 'bg-purple-100', text: 'text-purple-600' },
    completed: { bg: 'bg-green-100', text: 'text-green-600' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-600' }
  };

  const config = configs[status] || configs.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.text}`}>
      {status}
    </span>
  );
}
