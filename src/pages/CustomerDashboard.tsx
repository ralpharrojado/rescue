import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc,
  orderBy,
  getDocs,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Phone, 
  X, 
  Navigation, 
  Wrench,
  ChevronRight,
  Loader2,
  MessageSquare
} from 'lucide-react';
import Map from '../components/Map';
import Chat from '../components/Chat';

export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const [activeRescue, setActiveRescue] = useState<any>(null);
  const [nearbyMechanics, setNearbyMechanics] = useState<any[]>([]);
  const [assignedMechanicProfile, setAssignedMechanicProfile] = useState<any>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [formData, setFormData] = useState({
    issue: '',
    issueCategory: 'Other',
    carModel: '',
    carPlate: '',
    phone: '',
    location: { lat: 11.5853, lng: 122.7511, address: 'Roxas City proper' }
  });

  const ISSUE_CATEGORIES = [
    'Engine',
    'Battery',
    'Tire',
    'Fuel',
    'Lockout',
    'Other'
  ];

  // Helper to calculate distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!user) return;

    // Listen for active rescue
    const q = query(
      collection(db, 'rescues'),
      where('customerId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted', 'in-progress', 'completed']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        // Only set as active if it's not completed OR if it's completed but not yet rated
        if (docData.status !== 'completed' || !docData.rating) {
          setActiveRescue({ id: snapshot.docs[0].id, ...docData });
        } else {
          setActiveRescue(null);
        }
      } else {
        setActiveRescue(null);
      }
    }, (error) => {
      if (error.code !== 'cancelled') {
        console.error("Rescue snapshot error:", error);
      }
    });

    // Listen for nearby online mechanics
    const qMechanics = query(
      collection(db, 'users'),
      where('role', '==', 'mechanic'),
      where('isOnline', '==', true)
    );

    const unsubMechanics = onSnapshot(qMechanics, (snapshot) => {
      setNearbyMechanics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubMechanics();
    };
  }, [user]);

  // Listen for assigned mechanic's real-time location
  useEffect(() => {
    if (!activeRescue?.mechanicId) {
      setAssignedMechanicProfile(null);
      return;
    }

    const unsubMechanic = onSnapshot(doc(db, 'users', activeRescue.mechanicId), (docSnap) => {
      if (docSnap.exists()) {
        setAssignedMechanicProfile(docSnap.data());
      }
    });

    return () => unsubMechanic();
  }, [activeRescue?.mechanicId]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // 1. Check for active rescue
    if (activeRescue) {
      alert("You already have an active rescue request. Please complete or cancel it before making a new one.");
      return;
    }

    setIsRequesting(true);

    try {
      const createRescue = async (lat?: number, lng?: number) => {
        const batch = writeBatch(db);
        const rescueRef = doc(collection(db, 'rescues'));
        const userRef = doc(db, 'users', user.uid);

        const rescueData = {
          customerId: user.uid,
          customerName: user.displayName,
          customerPhone: formData.phone,
          status: 'pending',
          issue: formData.issue,
          issueCategory: formData.issueCategory,
          carDetails: {
            model: formData.carModel,
            plate: formData.carPlate
          },
          location: lat && lng 
            ? { ...formData.location, lat, lng }
            : formData.location,
          createdAt: serverTimestamp(),
          mechanicId: null,
          mechanicName: null,
        };

        batch.set(rescueRef, rescueData);
        batch.update(userRef, { lastRequestAt: serverTimestamp() });

        await batch.commit();
        console.log("Rescue request submitted with ID:", rescueRef.id);
        setIsRequesting(false);
      };

      // Get current location if possible
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              await createRescue(latitude, longitude);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'rescues');
            }
          }, 
          async () => {
            // Fallback to form location
            try {
              await createRescue();
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'rescues');
            }
          }
        );
      } else {
        try {
          await createRescue();
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'rescues');
        }
      }
    } catch (error) {
      console.error("Request error:", error);
      setIsRequesting(false);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const distance = activeRescue?.location && assignedMechanicProfile?.location
    ? calculateDistance(
        activeRescue.location.lat, 
        activeRescue.location.lng, 
        assignedMechanicProfile.location.lat, 
        assignedMechanicProfile.location.lng
      )
    : null;

  const eta = distance ? Math.round(distance * 5) + 2 : null; // Rough estimate: 5 mins per km + 2 mins buffer

  const markers = [
    ...(activeRescue ? [{ id: 'rescue', lat: activeRescue.location.lat, lng: activeRescue.location.lng, type: 'customer' as const, label: 'Your Location' }] : []),
    ...(assignedMechanicProfile?.location ? [{ 
      id: 'assigned', 
      lat: assignedMechanicProfile.location.lat, 
      lng: assignedMechanicProfile.location.lng, 
      type: 'mechanic' as const, 
      label: `Mechanic ${assignedMechanicProfile.displayName}${eta ? ` • ETA: ${eta}m` : ''}` 
    }] : []),
    ...(!activeRescue ? nearbyMechanics.filter(m => m.location).map(m => ({ 
      id: m.uid, 
      lat: m.location.lat, 
      lng: m.location.lng, 
      type: 'mechanic' as const, 
      label: m.displayName,
      permanentLabel: false
    })) : [])
  ];

  const cancelRescue = async () => {
    if (!activeRescue || !cancelReason) return;
    try {
      await updateDoc(doc(db, 'rescues', activeRescue.id), {
        status: 'cancelled',
        cancellationReason: cancelReason,
        cancelledAt: serverTimestamp()
      });
      setShowCancelModal(false);
      setCancelReason('');
    } catch (error) {
      console.error("Cancel error:", error);
    }
  };

  const submitRating = async () => {
    if (!activeRescue || rating === 0) return;
    setIsSubmittingRating(true);
    try {
      await updateDoc(doc(db, 'rescues', activeRescue.id), {
        rating,
        review,
        ratedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Rating error:", error);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
      
      <AnimatePresence>
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
                  <p className="text-slate-500">Please provide a reason for cancelling your rescue request. This helps us improve our service.</p>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cancellation Reason</label>
                    <select
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Fixed it myself">Fixed it myself</option>
                      <option value="Found another mechanic">Found another mechanic</option>
                      <option value="Wait time too long">Wait time too long</option>
                      <option value="Incorrect location">Incorrect location</option>
                      <option value="Changed my mind">Changed my mind</option>
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
                      onClick={cancelRescue}
                      disabled={!cancelReason}
                      className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      Confirm Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      <AnimatePresence>
        {activeRescue && activeRescue.status !== 'pending' && activeRescue.status !== 'completed' && activeRescue.status !== 'cancelled' && (
          <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
            {showChat && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="w-[calc(100vw-2rem)] sm:w-[350px] md:w-[400px]"
              >
                <Chat 
                  rescueId={activeRescue.id} 
                  recipientName={activeRescue.mechanicName || 'Mechanic'} 
                  onClose={() => setShowChat(false)}
                />
              </motion.div>
            )}
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowChat(!showChat)}
              className="w-16 h-16 bg-orange-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-orange-600 transition-all"
            >
              {showChat ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rescue Dashboard</h1>
          <p className="text-slate-500">Get help quickly from nearby mechanics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Map & Status */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-[400px] lg:h-[600px] relative">
            <Map 
              className="w-full h-full"
              center={activeRescue?.location || { lat: 11.5853, lng: 122.7511 }}
              markers={markers}
              onLocationSelect={(lat, lng) => !activeRescue && setFormData(prev => ({ ...prev, location: { ...prev.location, lat, lng } }))}
              zoom={activeRescue ? 15 : 14}
            />
          </div>

          <AnimatePresence>
            {activeRescue && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${
                      activeRescue.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                      activeRescue.status === 'accepted' ? 'bg-blue-100 text-blue-600' :
                      activeRescue.status === 'completed' ? 'bg-green-100 text-green-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {activeRescue.status === 'pending' ? <Clock className="w-8 h-8" /> :
                       activeRescue.status === 'accepted' ? <Navigation className="w-8 h-8" /> :
                       activeRescue.status === 'completed' ? <CheckCircle2 className="w-8 h-8" /> :
                       <Wrench className="w-8 h-8" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 capitalize">
                        {activeRescue.status.replace('-', ' ')}
                      </h3>
                      <p className="text-slate-500 text-sm flex items-center gap-2">
                        {activeRescue.status === 'pending' ? 'Looking for nearby mechanics...' :
                         activeRescue.status === 'accepted' ? (
                           <>
                             <span className="flex items-center gap-1.5">
                               <span className="relative flex h-2 w-2">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                               </span>
                               Mechanic {activeRescue.mechanicName} is on the way!
                             </span>
                             {distance && <span className="font-bold text-blue-600">({distance.toFixed(1)} km away)</span>}
                             {eta && <span className="text-slate-400">• ETA: {eta} mins</span>}
                           </>
                         ) :
                         activeRescue.status === 'completed' ? 'Rescue completed! Please rate your experience.' :
                         'Mechanic is working on your car.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {(activeRescue.status === 'pending' || activeRescue.status === 'accepted' || activeRescue.status === 'in-progress') && (
                      <button 
                        onClick={() => setShowCancelModal(true)}
                        className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        Cancel
                      </button>
                    )}
                    {activeRescue.status !== 'pending' && activeRescue.status !== 'completed' && activeRescue.status !== 'cancelled' && (
                      <button className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-200">
                        <Phone className="w-5 h-5" />
                        Call Mechanic
                      </button>
                    )}
                  </div>
                </div>

                {activeRescue.status === 'completed' && !activeRescue.rating && (
                  <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <h4 className="text-lg font-bold text-slate-900 mb-4">Rate your Mechanic</h4>
                    <div className="flex items-center gap-2 mb-6">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`p-2 transition-all ${rating >= star ? 'text-yellow-400 scale-110' : 'text-slate-300 hover:text-yellow-200'}`}
                        >
                          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      placeholder="Write a short review (optional)..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none min-h-[100px] mb-4"
                    />
                    <button
                      onClick={submitRating}
                      disabled={rating === 0 || isSubmittingRating}
                      className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmittingRating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Rating'}
                    </button>
                  </div>
                )}

                {activeRescue.status !== 'pending' && (
                  <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRescue.mechanicId}`} alt="Mechanic" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{activeRescue.mechanicName}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Assigned Mechanic</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <Car className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{activeRescue.carDetails.model}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{activeRescue.carDetails.plate}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{activeRescue.issue}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Reported Issue</div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Request Form */}
        <div className="lg:col-span-4">
          {!activeRescue ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sticky top-24"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Request Rescue</h2>
              <form onSubmit={handleRequest} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Issue Category</label>
                  <select
                    required
                    value={formData.issueCategory}
                    onChange={e => setFormData(prev => ({ ...prev, issueCategory: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                  >
                    {ISSUE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">What's the issue?</label>
                  <textarea
                    required
                    value={formData.issue}
                    onChange={e => setFormData(prev => ({ ...prev, issue: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none min-h-[100px]"
                    placeholder="Describe your car problem..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Car Model</label>
                    <input
                      required
                      type="text"
                      value={formData.carModel}
                      onChange={e => setFormData(prev => ({ ...prev, carModel: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g. Toyota Vios"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Plate Number</label>
                    <input
                      required
                      type="text"
                      value={formData.carPlate}
                      onChange={e => setFormData(prev => ({ ...prev, carPlate: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                      placeholder="ABC 1234"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                    placeholder="0912 345 6789"
                  />
                </div>

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-orange-900 uppercase tracking-widest">Pickup Location</div>
                      <div className="text-sm text-orange-700 mt-1">Tap on the map to set your exact location.</div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRequesting}
                  className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      Request Rescue
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sticky top-24">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Active</h2>
                <p className="text-slate-500">We've notified nearby mechanics. Please stay with your vehicle.</p>
              </div>
              
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Safety Tip</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Turn on your hazard lights and set up your early warning device (EWD) if available.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
