import React from 'react';
import { useAuth, UserRole } from '../AuthContext';
import { motion } from 'motion/react';
import { Car, Wrench, ShieldCheck, ArrowRight, MapPin, Clock, Star } from 'lucide-react';

export default function Landing() {
  const { signIn, updateRole, user, profile } = useAuth();

  const handleRoleSelect = async (role: UserRole) => {
    await updateRole(role);
  };

  if (user && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
        >
          <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Welcome!</h2>
          <p className="text-slate-500 text-center mb-8">How would you like to use Roxas Rescue?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => handleRoleSelect('customer')}
              className="group relative p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all text-left"
            >
              <div className="bg-orange-100 p-3 rounded-xl w-fit mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <Car className="w-8 h-8 text-orange-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">I'm a Driver</h3>
              <p className="text-slate-500 text-sm">I need roadside assistance or emergency car repairs.</p>
              <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-orange-500 transition-colors" />
            </button>

            <button
              onClick={() => handleRoleSelect('mechanic')}
              className="group relative p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all text-left"
            >
              <div className="bg-green-100 p-3 rounded-xl w-fit mb-4 group-hover:bg-green-500 group-hover:text-white transition-colors">
                <Wrench className="w-8 h-8 text-green-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">I'm a Mechanic</h3>
              <p className="text-slate-500 text-sm">I want to provide rescue services and earn money.</p>
              <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-green-500 transition-colors" />
            </button>

            {user.email?.toLowerCase() === "joseralpharrojado789@gmail.com" && (
              <button
                onClick={() => handleRoleSelect('admin')}
                className="md:col-span-2 group relative p-6 bg-slate-900 border-2 border-slate-800 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all text-left"
              >
                <div className="bg-slate-800 p-3 rounded-xl w-fit mb-4 group-hover:bg-orange-500 transition-colors">
                  <ShieldCheck className="w-8 h-8 text-orange-500 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">System Administrator</h3>
                <p className="text-slate-400 text-sm">Access the control center to manage mechanics and pricing.</p>
                <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-600 group-hover:text-orange-500 transition-colors" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-orange-100 text-orange-700 mb-6">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  24/7 Roadside Assistance in Roxas City
                </span>
                <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[0.9] mb-6">
                  STRANDED? <br />
                  <span className="text-orange-500 italic">WE'RE ON OUR WAY.</span>
                </h1>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                  The fastest way to get a mechanic to your location in Roxas City. 
                  Real-time matching, transparent pricing, and trusted professionals.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={signIn}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                  >
                    Get Started Now
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-4 px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <img 
                          key={i}
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} 
                          className="w-8 h-8 rounded-full border-2 border-white"
                          alt="User"
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      Joined by 50+ local mechanics
                    </span>
                  </div>
                </div>

                {/* Safari/Iframe Login Help */}
                {/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && window.self !== window.top && (
                  <div className="mt-8 p-6 bg-orange-50 rounded-2xl border border-orange-100 max-w-md">
                    <h4 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Safari Login Issues?
                    </h4>
                    <p className="text-xs text-orange-700 mb-4 leading-relaxed">
                      Safari's security settings often block logins inside previews. 
                      If you're having trouble logging in, please use the button below to open the app in a dedicated tab.
                    </p>
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-md shadow-orange-100 flex items-center justify-center gap-2"
                    >
                      Open in New Tab & Login
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
            
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative w-full"
              >
                <div className="absolute -top-4 -left-4 w-72 h-72 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
                <div className="absolute -bottom-8 -right-8 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
                
                <div className="relative bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden border-8 border-slate-800">
                  <div className="bg-slate-100 rounded-[2rem] aspect-[4/3] overflow-hidden relative">
                    {/* Simulated App Preview */}
                    <div className="absolute inset-0 p-6 flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                          <Car className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                          LIVE MAP
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-200 rounded-2xl mb-4 relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          <MapPin className="w-8 h-8 text-orange-500 animate-bounce" />
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-slate-100 rounded-full overflow-hidden">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=mechanic" alt="Mechanic" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">Juan Dela Cruz</div>
                            <div className="text-[10px] text-slate-500">Master Mechanic • 4.9 ★</div>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-orange-500"
                            animate={{ width: ['0%', '100%'] }}
                            transition={{ duration: 3, repeat: Infinity }}
                          />
                        </div>
                        <div className="text-[10px] text-center mt-1 font-medium text-slate-400 uppercase tracking-widest">
                          Arriving in 5 mins
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-slate-50 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Fast Response</h3>
              <p className="text-slate-600">Our first-to-accept system ensures the nearest mechanic gets to you in minutes.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Verified Pros</h3>
              <p className="text-slate-600">All mechanics are vetted and rated by the community for quality and trust.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Fair Pricing</h3>
              <p className="text-slate-600">Transparent pricing models so you know what to expect before the work starts.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
