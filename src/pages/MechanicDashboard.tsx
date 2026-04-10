import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Navigation, 
  ChevronRight,
  Loader2,
  Power,
  Car,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  X,
  Camera,
  User as UserIcon,
  Calendar,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import Map from '../components/Map';
import Chat from '../components/Chat';

const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

export default function MechanicDashboard() {
  const { user, profile } = useAuth();
  const skills = profile?.skills || [];
  const [pendingRescues, setPendingRescues] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [rescueHistory, setRescueHistory] = useState<any[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isUpdatingSkills, setIsUpdatingSkills] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageId = useRef<string | null>(null);
  const [appForm, setAppForm] = useState({
    fullName: profile?.displayName || '',
    birthday: '',
    idCardUrl: '',
    facePhotoUrl: ''
  });
  const [showNewJobAlert, setShowNewJobAlert] = useState(false);
  const [lastSeenRescueId, setLastSeenRescueId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'active' | 'error' | 'searching'>('searching');

  const isIncompleteProfile = !profile?.isVerified && (
    !profile?.application?.fullName || 
    !profile?.application?.birthday || 
    !profile?.application?.idCardUrl || 
    !profile?.application?.facePhotoUrl
  );

  const SKILLS_OPTIONS = [
    'Engine',
    'Battery',
    'Tire',
    'Fuel',
    'Lockout',
    'Other'
  ];

  useEffect(() => {
    // Auto-verify admin for testing
    const isAdmin = user?.email === "joseralpharrojado789@gmail.com";
    if (isAdmin && profile && !profile.isVerified) {
      setDoc(doc(db, 'users', user.uid), { isVerified: true }, { merge: true })
        .catch(err => console.error("Auto-verify error:", err));
    }
  }, [user, profile]);

  useEffect(() => {
    const isAdmin = user?.email === "joseralpharrojado789@gmail.com";
    if (!user || !profile?.isOnline || (!profile?.isVerified && !isAdmin)) {
      setLocationStatus('searching');
      return;
    }

    if (!('geolocation' in navigator)) {
      console.error("Geolocation not supported");
      setLocationStatus('error');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationStatus('active');
        setDoc(doc(db, 'users', user.uid), {
          location: { lat: latitude, lng: longitude }
        }, { merge: true }).catch(err => {
          console.error("Update location error:", err);
          setLocationStatus('error');
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user, profile?.isOnline, profile?.isVerified]);

  useEffect(() => {
    const isAdmin = user?.email === "joseralpharrojado789@gmail.com";
    if (!user || !profile?.isOnline || (!profile?.isVerified && !isAdmin)) {
      setPendingRescues([]);
      return;
    }

    // Listen for pending rescues
    const qPending = skills.length > 0 
      ? query(
          collection(db, 'rescues'),
          where('status', '==', 'pending'),
          where('issueCategory', 'in', skills),
          limit(10)
        )
      : query(
          collection(db, 'rescues'),
          where('status', '==', 'pending'),
          limit(10)
        );

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const rescues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory
      rescues.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis() || Date.now();
        const timeB = b.createdAt?.toMillis() || Date.now();
        return timeB - timeA;
      });

      // Check for new jobs to notify
      if (rescues.length > 0) {
        const newestId = rescues[0].id;
        if (lastSeenRescueId && newestId !== lastSeenRescueId) {
          setShowNewJobAlert(true);
          notificationSound.play().catch(e => console.log("Audio play blocked:", e));
          setTimeout(() => setShowNewJobAlert(false), 5000);
        }
        setLastSeenRescueId(newestId);
      } else {
        setLastSeenRescueId(null);
      }
      
      setPendingRescues(rescues);
    }, (error) => {
      if (error.code !== 'cancelled') {
        console.error("Pending rescues snapshot error:", error);
      }
    });

    // Listen for active job assigned to this mechanic
    const qActive = query(
      collection(db, 'rescues'),
      where('mechanicId', '==', user.uid),
      where('status', 'in', ['accepted', 'in-progress']),
      limit(1)
    );

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      if (!snapshot.empty) {
        setActiveJob({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveJob(null);
      }
    }, (error) => {
      if (error.code !== 'cancelled') {
        console.error("Active job snapshot error:", error);
      }
    });

    // Listen for recent reviews
    const qReviews = query(
      collection(db, 'rescues'),
      where('mechanicId', '==', user.uid),
      where('status', '==', 'completed'),
      orderBy('ratedAt', 'desc'),
      limit(5)
    );

    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      setRecentReviews(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => r.rating)
      );
    });

    // Listen for rescue history (completed or cancelled)
    const qHistory = query(
      collection(db, 'rescues'),
      where('mechanicId', '==', user.uid),
      where('status', 'in', ['completed', 'cancelled']),
      limit(20)
    );

    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis() || Date.now();
        const timeB = b.createdAt?.toMillis() || Date.now();
        return timeB - timeA;
      });
      setRescueHistory(docs);
    });

    return () => {
      unsubPending();
      unsubActive();
      unsubReviews();
      unsubHistory();
    };
  }, [user, profile?.isOnline, profile?.isVerified, JSON.stringify(skills)]);

  useEffect(() => {
    if (!activeJob?.id) {
      setUnreadCount(0);
      lastMessageId.current = null;
      return;
    }

    const q = query(
      collection(db, 'rescues', activeJob.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      
      const latestMsg = snapshot.docs[0];
      const data = latestMsg.data();
      
      if (data.senderId !== user?.uid) {
        if (showChat) {
          setUnreadCount(0);
        } else if (latestMsg.id !== lastMessageId.current) {
          setUnreadCount(prev => prev + 1);
        }
      }
      lastMessageId.current = latestMsg.id;
    });

    return () => unsubscribe();
  }, [activeJob?.id, showChat, user?.uid]);

  const toggleOnline = async () => {
    if (!user || !profile) return;
    if (isIncompleteProfile) {
      alert("Please complete your profile information before going online.");
      return;
    }
    if (!profile.isVerified) {
      alert("Your account is pending verification. Please wait for an admin to approve your account.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isOnline: !profile.isOnline
      });
    } catch (error) {
      console.error("Toggle online error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmittingApp(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        application: {
          ...appForm,
          submittedAt: serverTimestamp(),
          status: 'pending'
        }
      });
    } catch (error) {
      console.error("Application submission error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const handleSimulatedUpload = (field: 'idCardUrl' | 'facePhotoUrl') => {
    // In a real app, this would open a file picker and upload to Storage
    // For this demo, we'll use high-quality placeholder images
    const placeholders = {
      idCardUrl: 'https://images.unsplash.com/photo-1554224155-169641357599?auto=format&fit=crop&q=80&w=800',
      facePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800'
    };
    setAppForm(prev => ({ ...prev, [field]: placeholders[field] }));
  };

  const acceptJob = async (rescueId: string) => {
    if (!user || !profile) return;
    if (isIncompleteProfile) {
      alert("Please complete your profile information before accepting jobs.");
      return;
    }
    const isAdmin = user.email === "joseralpharrojado789@gmail.com";
    if (!profile.isVerified && !isAdmin) {
      alert("Your account is pending verification.");
      return;
    }
    setIsAccepting(true);
    try {
      await updateDoc(doc(db, 'rescues', rescueId), {
        mechanicId: user.uid,
        mechanicName: user.displayName || 'Mechanic',
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error("Accept job error:", error);
      if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
         handleFirestoreError(error, OperationType.UPDATE, `rescues/${rescueId}`);
         alert("Permission denied. Please ensure you are online and verified.");
      } else {
        alert("Could not accept job. It may have been taken by another mechanic or cancelled.");
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!activeJob) return;
    try {
      const updates: any = { status };
      if (status === 'completed') {
        updates.completedAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'rescues', activeJob.id), updates);
    } catch (error) {
      console.error("Update status error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `rescues/${activeJob.id}`);
    }
  };

  const cancelJob = async () => {
    if (!activeJob || !cancelReason) return;
    setIsCancelling(true);
    try {
      await updateDoc(doc(db, 'rescues', activeJob.id), {
        status: 'cancelled',
        cancellationReason: `Mechanic: ${cancelReason}`,
        cancelledAt: serverTimestamp()
      });
      setShowCancelModal(false);
      setCancelReason('');
    } catch (error) {
      console.error("Cancel job error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `rescues/${activeJob.id}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleSkill = async (skill: string) => {
    if (!user || !profile) return;
    setIsUpdatingSkills(true);
    try {
      const currentSkills = profile.skills || [];
      const newSkills = currentSkills.includes(skill)
        ? currentSkills.filter((s: string) => s !== skill)
        : [...currentSkills, skill];
      
      await updateDoc(doc(db, 'users', user.uid), {
        skills: newSkills
      });
    } catch (error) {
      console.error("Update skills error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsUpdatingSkills(false);
    }
  };

  return (
    <div className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
      <AnimatePresence>
        {(profile?.isVerified || user?.email === "joseralpharrojado789@gmail.com") && showNewJobAlert && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[100] w-full max-w-md px-4"
          >
            <div className="bg-orange-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-orange-400">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg">New Rescue Request!</h4>
                <p className="text-orange-100 text-sm">A new job matching your skills is available nearby.</p>
              </div>
              <button 
                onClick={() => setShowNewJobAlert(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">Cancel Rescue</h3>
                  <button onClick={() => setShowCancelModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-6">
                  <p className="text-slate-500">Please provide a reason for cancelling this rescue. This will notify the customer.</p>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cancellation Reason</label>
                    <select
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Vehicle issue too complex">Vehicle issue too complex</option>
                      <option value="Emergency at my end">Emergency at my end</option>
                      <option value="Customer not responding">Customer not responding</option>
                      <option value="Location unreachable">Location unreachable</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {cancelReason === 'Other' && (
                    <textarea
                      placeholder="Please specify..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none min-h-[100px]"
                      onChange={e => setCancelReason(e.target.value)}
                    />
                  )}
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={cancelJob}
                      disabled={!cancelReason || isCancelling}
                      className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Cancel"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {( !profile?.isVerified && user?.email !== "joseralpharrojado789@gmail.com") && (
        <div className="mb-12">
          {profile?.application?.status === 'pending' ? (
            <div className="p-8 bg-orange-50 border border-orange-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center flex-shrink-0 animate-pulse">
                <ShieldCheck className="w-12 h-12 text-orange-600" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold text-orange-900 mb-2">Application Under Review</h3>
                <p className="text-orange-700 leading-relaxed">
                  We've received your documents! Our team is currently verifying your identity and credentials. 
                  This usually takes 24-48 hours. You'll be notified once you're cleared to start accepting jobs.
                </p>
              </div>
              <div className="px-8 py-3 bg-orange-200 text-orange-800 rounded-2xl text-sm font-black uppercase tracking-widest">
                Pending
              </div>
            </div>
          ) : (
            <div id="application-form" className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="bg-slate-900 p-10 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-orange-500 rounded-2xl">
                    <Wrench className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold">Become a Verified Mechanic</h2>
                </div>
                <p className="text-slate-400 text-lg max-w-2xl">
                  Complete your profile to start receiving roadside assistance requests in your area.
                </p>
              </div>

              <form onSubmit={submitApplication} className="p-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Personal Information</h3>
                    
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-bold text-slate-700 mb-2 block">Full Legal Name</span>
                        <div className="relative">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input 
                            required
                            type="text"
                            value={appForm.fullName}
                            onChange={e => setAppForm(prev => ({ ...prev, fullName: e.target.value }))}
                            placeholder="As shown on your ID"
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-medium"
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-sm font-bold text-slate-700 mb-2 block">Date of Birth</span>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input 
                            required
                            type="date"
                            value={appForm.birthday}
                            onChange={e => setAppForm(prev => ({ ...prev, birthday: e.target.value }))}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-medium"
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Verification Documents</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valid ID Card</span>
                        <button 
                          type="button"
                          onClick={() => handleSimulatedUpload('idCardUrl')}
                          className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden relative group ${
                            appForm.idCardUrl ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 hover:border-orange-500 hover:bg-orange-50'
                          }`}
                        >
                          {appForm.idCardUrl ? (
                            <>
                              <img src={appForm.idCardUrl} alt="ID" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Upload className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500">Upload ID</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Face Photo</span>
                        <button 
                          type="button"
                          onClick={() => handleSimulatedUpload('facePhotoUrl')}
                          className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden relative group ${
                            appForm.facePhotoUrl ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 hover:border-orange-500 hover:bg-orange-50'
                          }`}
                        >
                          {appForm.facePhotoUrl ? (
                            <>
                              <img src={appForm.facePhotoUrl} alt="Face" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500">Take Photo</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      * Click the boxes above to simulate document upload for this demo.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-6">
                  <div className="flex items-center gap-3 text-slate-500">
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                    <p className="text-xs font-medium">Your data is encrypted and stored securely.</p>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSubmittingApp || !appForm.idCardUrl || !appForm.facePhotoUrl}
                    className="px-10 py-4 bg-orange-500 text-white rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-3"
                  >
                    {isSubmittingApp ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Application
                        <ArrowRight className="w-6 h-6" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Floating Chat Button */}
      <AnimatePresence>
        {(profile?.isVerified || user?.email === "joseralpharrojado789@gmail.com") && activeJob && (
          <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
            {showChat && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="w-[calc(100vw-2rem)] sm:w-[350px] md:w-[400px]"
              >
                <Chat 
                  rescueId={activeJob.id} 
                  recipientName={activeJob.customerName || 'Customer'} 
                  onClose={() => setShowChat(false)}
                />
              </motion.div>
            )}
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setShowChat(!showChat);
                if (!showChat) setUnreadCount(0);
              }}
              className="w-16 h-16 bg-orange-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-orange-600 transition-all relative"
            >
              {showChat ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
              {!showChat && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                  {unreadCount}
                </span>
              )}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {(profile?.isVerified || user?.email === "joseralpharrojado789@gmail.com") && (
        <>
          {isIncompleteProfile && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-orange-50 border-2 border-orange-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Complete Your Profile</h3>
                  <p className="text-slate-600 text-sm">You must provide your full name, birthday, and ID documents before you can go online or accept jobs.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById('application-form');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 whitespace-nowrap"
              >
                Complete Now
              </button>
            </motion.div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mechanic Dashboard</h1>
          <p className="text-slate-500">Manage your rescue jobs and availability.</p>
          {profile?.skills && profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.skills.map((skill: string) => (
                <span key={skill} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg uppercase tracking-wider border border-blue-100">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <button
            onClick={toggleOnline}
            className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center gap-3 shadow-xl ${
              profile?.isOnline 
                ? 'bg-green-500 text-white shadow-green-100 hover:bg-green-600' 
                : 'bg-slate-200 text-slate-600 shadow-slate-100 hover:bg-slate-300'
            }`}
          >
            <Power className="w-6 h-6" />
            {profile?.isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
          
          {profile?.isOnline && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest ${
              locationStatus === 'active' 
                ? 'bg-blue-50 text-blue-600 border-blue-100' 
                : locationStatus === 'error'
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-slate-50 text-slate-400 border-slate-100'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                locationStatus === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
              }`} />
              {locationStatus === 'active' ? 'Location Active' : locationStatus === 'error' ? 'GPS Error' : 'Searching GPS...'}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-bold text-slate-900">Manage Your Specialized Skills</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">Select the types of rescue requests you are qualified to handle. You will only see jobs that match your selected skills.</p>
        <div className="flex flex-wrap gap-3">
          {SKILLS_OPTIONS.map((skill) => {
            const isSelected = profile?.skills?.includes(skill);
            return (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                disabled={isUpdatingSkills}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                  isSelected
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-100'
                    : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200 hover:text-blue-400'
                } disabled:opacity-50`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Map & Active Job */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-[400px] lg:h-[500px]">
            <Map 
              className="w-full h-full"
              center={profile?.location || { lat: 11.5853, lng: 122.7511 }}
              markers={[
                ...(profile?.location ? [{ id: 'me', lat: profile.location.lat, lng: profile.location.lng, type: 'mechanic' as const, label: 'You' }] : []),
                ...(activeJob ? [{ id: 'job', lat: activeJob.location.lat, lng: activeJob.location.lng, type: 'rescue' as const, label: 'Rescue Location' }] : []),
                ...(!activeJob ? pendingRescues.map(r => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, type: 'rescue' as const, label: r.issue })) : [])
              ]}
              zoom={activeJob ? 15 : 14}
            />
          </div>

          <AnimatePresence>
            {activeJob && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
                      <Navigation className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">Active Job</h3>
                      <p className="text-slate-500">{activeJob.location.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowCancelModal(true)}
                      className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Cancel Job
                    </button>
                    <a 
                      href={`tel:${activeJob.customerPhone || ''}`}
                      className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                    >
                      <Phone className="w-5 h-5" />
                      Contact Customer
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <Car className="w-6 h-6 text-slate-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vehicle</div>
                        <div className="text-sm font-bold text-slate-900">{activeJob.carDetails.model} • {activeJob.carDetails.plate}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <AlertCircle className="w-6 h-6 text-slate-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue</div>
                        <div className="text-sm font-bold text-slate-900">{activeJob.issue}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <Clock className="w-6 h-6 text-slate-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requested At</div>
                        <div className="text-sm font-bold text-slate-900">
                          {activeJob.createdAt?.toDate().toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                      <DollarSign className="w-6 h-6 text-orange-500" />
                      <div>
                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Estimated Price</div>
                        <div className="text-sm font-bold text-orange-900">₱500 - ₱1,500</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  {activeJob.status === 'accepted' && (
                    <button
                      onClick={() => updateStatus('in-progress')}
                      className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                    >
                      I've Arrived
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )}
                  {activeJob.status === 'in-progress' && (
                    <button
                      onClick={() => updateStatus('completed')}
                      className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold text-lg hover:bg-green-600 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2"
                    >
                      Job Completed
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Reviews Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Recent Reviews
            </h2>
            {recentReviews.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500">No reviews yet. Complete jobs to receive feedback!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {recentReviews.map((review) => (
                  <div key={review.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full overflow-hidden border border-slate-200">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${review.customerId}`} alt="Customer" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{review.customerName}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                            {review.ratedAt?.toDate().toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-slate-300 fill-current'}`}
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    {review.review && (
                      <p className="text-slate-600 text-sm italic">"{review.review}"</p>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>{review.carDetails.model}</span>
                      <span>•</span>
                      <span>{review.issue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rescue History Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-500" />
                Rescue History
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Earnings</div>
                  <div className="text-lg font-bold text-green-600">
                    ₱{rescueHistory.reduce((sum, r) => sum + (r.price || 0), 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {rescueHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500">No rescue history yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-slate-100">
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vehicle</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Earnings</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rescueHistory.map((rescue) => (
                      <tr key={rescue.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full overflow-hidden">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rescue.customerId}`} alt="Customer" />
                            </div>
                            <span className="text-sm font-bold text-slate-900">{rescue.customerName}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-slate-600">{rescue.carDetails.model}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{rescue.carDetails.plate}</div>
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            rescue.status === 'completed' 
                              ? 'bg-green-50 text-green-600 border border-green-100' 
                              : 'bg-red-50 text-red-600 border border-red-100'
                          }`}>
                            {rescue.status}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`text-sm font-bold ${rescue.status === 'completed' ? 'text-green-600' : 'text-slate-400'}`}>
                            {rescue.status === 'completed' ? `₱${(rescue.price || 0).toLocaleString()}` : '—'}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-slate-500">
                          {rescue.createdAt?.toDate().toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pending Jobs */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sticky top-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Available Jobs</h2>
              <div className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {pendingRescues.length} Nearby
              </div>
            </div>

            {!profile?.isOnline ? (
              <div className="flex flex-col items-center text-center py-12 px-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Power className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">You're Offline</h3>
                <p className="text-sm text-slate-500">Go online to start receiving rescue requests from nearby drivers.</p>
              </div>
            ) : activeJob ? (
              <div className="flex flex-col items-center text-center py-12 px-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Wrench className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Job in Progress</h3>
                <p className="text-sm text-slate-500">Complete your current job to accept new ones.</p>
              </div>
            ) : pendingRescues.length === 0 ? (
              <div className="flex flex-col items-center text-center py-12 px-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Loader2 className="w-12 h-12 text-slate-300 mb-4 animate-spin" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Searching...</h3>
                <p className="text-sm text-slate-500">
                  {skills.length === 0 
                    ? "Waiting for any new rescue requests in Roxas City."
                    : `Waiting for ${skills.join(', ')} requests nearby.`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRescues.map((rescue) => (
                  <motion.div
                    key={rescue.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                          <Car className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{rescue.carDetails.model}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
                          NEW
                        </span>
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                          {rescue.issueCategory}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1 line-clamp-1">{rescue.issue}</h4>
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] mb-4">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{rescue.location.address}</span>
                    </div>
                    <button
                      onClick={() => acceptJob(rescue.id)}
                      disabled={isAccepting}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-orange-500 transition-all flex items-center justify-center gap-2 group-hover:bg-orange-500"
                    >
                      {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept Job'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </>
    )}
  </div>
);
}
