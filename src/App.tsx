import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Department, Appointment, Report, UserRole } from './types';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  LogOut, 
  Plus, 
  Building2, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Menu,
  X,
  User as UserIcon,
  Briefcase,
  Search,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) errorMessage = `Database Error: ${parsed.error}`;
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-purple-50 p-4">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-600 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Application Error</h1>
            <p className="text-gray-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Auth Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role: 'user',
              photoURL: firebaseUser.photoURL || undefined
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// --- Components ---

function Navbar() {
  const { profile, logout, signIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                <Building2 className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
                PurpleCorp
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/departments" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">Departments</Link>
            {profile ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">Dashboard</Link>
                {profile.role === 'admin' && (
                  <Link to="/admin" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">Admin</Link>
                )}
                <div className="flex items-center space-x-4 pl-4 border-l border-gray-100">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
                    <p className="text-xs text-purple-500 capitalize">{profile.role}</p>
                  </div>
                  <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <button 
                onClick={signIn}
                className="bg-purple-600 text-white px-6 py-2 rounded-full font-medium hover:bg-purple-700 transition-all shadow-md shadow-purple-100"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-gray-600">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              <Link to="/departments" className="block px-3 py-2 text-gray-600 font-medium" onClick={() => setIsOpen(false)}>Departments</Link>
              {profile ? (
                <>
                  <Link to="/dashboard" className="block px-3 py-2 text-gray-600 font-medium" onClick={() => setIsOpen(false)}>Dashboard</Link>
                  {profile.role === 'admin' && (
                    <Link to="/admin" className="block px-3 py-2 text-gray-600 font-medium" onClick={() => setIsOpen(false)}>Admin</Link>
                  )}
                  <button onClick={logout} className="w-full text-left px-3 py-2 text-red-500 font-medium">Logout</button>
                </>
              ) : (
                <button onClick={signIn} className="w-full text-left px-3 py-2 text-purple-600 font-medium">Sign In</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// --- Pages ---

function HomePage() {
  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-30 animate-pulse delay-700" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wide text-purple-600 uppercase bg-purple-50 rounded-full">
              Innovating the Future
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
              Empowering Teams with <br />
              <span className="text-purple-600">PurpleCorp Connect</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              The all-in-one platform for modern enterprise management. Connect with departments, book appointments, and streamline your workflow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/departments" className="w-full sm:w-auto bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-purple-700 transition-all shadow-xl shadow-purple-200 hover:-translate-y-1">
                Explore Departments
              </Link>
              <Link to="/dashboard" className="w-full sm:w-auto bg-white text-gray-900 border-2 border-gray-100 px-8 py-4 rounded-2xl font-bold text-lg hover:border-purple-200 transition-all hover:-translate-y-1">
                Go to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-12 bg-white rounded-[2rem] shadow-xl shadow-gray-100 border border-gray-50">
          {[
            { label: 'Departments', value: '12+' },
            { label: 'Active Workers', value: '500+' },
            { label: 'Appointments', value: '10k+' },
            { label: 'Satisfaction', value: '99%' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-purple-600 mb-1">{stat.value}</p>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to succeed</h2>
          <p className="text-gray-600">Streamlined tools for every member of the organization.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Calendar, title: 'Easy Booking', desc: 'Schedule time with managers across any department in seconds.' },
            { icon: FileText, title: 'Work Reports', desc: 'Workers can easily submit and track their daily progress reports.' },
            { icon: LayoutDashboard, title: 'Central Dashboard', desc: 'A unified view of all your activities, appointments, and tasks.' },
          ].map((feature, i) => (
            <div key={i} className="p-8 bg-purple-50/50 rounded-3xl border border-purple-100 hover:bg-purple-50 transition-colors group">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <feature.icon className="text-purple-600 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState<UserProfile | null>(null);
  const { profile, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubDeps = onSnapshot(collection(db, 'departments'), (snap) => {
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'departments'));

    const unsubManagers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'manager')), (snap) => {
      setManagers(snap.docs.map(doc => doc.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    setLoading(false);
    return () => { unsubDeps(); unsubManagers(); };
  }, []);

  const handleBook = (manager: UserProfile) => {
    if (!profile) {
      signIn();
      return;
    }
    setSelectedManager(manager);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <header className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Departments</h1>
        <p className="text-gray-600 text-lg">Browse through our specialized divisions and connect with our leadership team.</p>
      </header>

      {departments.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No departments found. Admin needs to add some.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {departments.map((dept) => (
            <div key={dept.id} className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="aspect-video relative overflow-hidden">
                <img src={dept.image} alt={dept.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <h3 className="absolute bottom-4 left-6 text-2xl font-bold text-white">{dept.name}</h3>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-gray-600 line-clamp-2">{dept.description}</p>
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Department Managers</h4>
                  <div className="space-y-3">
                    {managers.filter(m => m.departmentId === dept.id).map(manager => (
                      <div key={manager.uid} className="flex items-center justify-between p-3 bg-purple-50 rounded-2xl">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center overflow-hidden">
                            {manager.photoURL ? <img src={manager.photoURL} alt={manager.name} className="w-full h-full object-cover" /> : <UserIcon className="text-purple-500 w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{manager.name}</p>
                            <p className="text-xs text-purple-600">Available</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleBook(manager)}
                          className="px-4 py-1.5 bg-white text-purple-600 text-xs font-bold rounded-xl border border-purple-100 hover:bg-purple-600 hover:text-white transition-all"
                        >
                          Book
                        </button>
                      </div>
                    ))}
                    {managers.filter(m => m.departmentId === dept.id).length === 0 && (
                      <p className="text-xs text-gray-400 italic">No managers assigned yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedManager && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedManager(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Book Appointment</h2>
                  <p className="text-gray-500">With {selectedManager.name}</p>
                </div>
                <button onClick={() => setSelectedManager(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const date = formData.get('date') as string;
                const time = formData.get('time') as string;
                const notes = formData.get('notes') as string;

                if (!profile) return;

                const appointment: Omit<Appointment, 'id'> = {
                  userId: profile.uid,
                  userName: profile.name,
                  managerId: selectedManager.uid,
                  managerName: selectedManager.name,
                  date,
                  time,
                  status: 'pending',
                  notes,
                  createdAt: new Date().toISOString()
                };

                try {
                  await addDoc(collection(db, 'appointments'), appointment);
                  setSelectedManager(null);
                  navigate('/dashboard');
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, 'appointments');
                }
              }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Select Date</label>
                  <input required name="date" type="date" min={format(new Date(), 'yyyy-MM-dd')} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Select Time</label>
                  <select required name="time" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all">
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Notes (Optional)</label>
                  <textarea name="notes" placeholder="What would you like to discuss?" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all h-24 resize-none" />
                </div>
                <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-100">
                  Confirm Booking
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardPage() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [activeTab, setActiveTab] = useState<'appointments' | 'reports'>('appointments');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    let qApp;
    if (profile.role === 'manager') {
      qApp = query(collection(db, 'appointments'), where('managerId', '==', profile.uid), orderBy('createdAt', 'desc'));
    } else if (profile.role === 'admin') {
      qApp = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
    } else {
      qApp = query(collection(db, 'appointments'), where('userId', '==', profile.uid), orderBy('createdAt', 'desc'));
    }

    const unsubApps = onSnapshot(qApp, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    let qReports;
    if (profile.role === 'worker') {
      qReports = query(collection(db, 'reports'), where('workerId', '==', profile.uid), orderBy('createdAt', 'desc'));
    } else if (profile.role === 'admin' || profile.role === 'manager') {
      qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    } else {
      qReports = null;
    }

    let unsubReports = () => {};
    if (qReports) {
      unsubReports = onSnapshot(qReports, (snap) => {
        setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'reports'));
    }

    return () => { unsubApps(); unsubReports(); };
  }, [profile]);

  if (!profile) return <Navigate to="/" />;

  const handleStatusUpdate = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleExportCSV = () => {
    const filteredReports = reports.filter(r => 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.workerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const headers = ['Title', 'Worker Name', 'Content', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...filteredReports.map(r => [
        `"${r.title.replace(/"/g, '""')}"`,
        `"${r.workerName.replace(/"/g, '""')}"`,
        `"${r.content.replace(/"/g, '""')}"`,
        `"${format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reports_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {profile.name}</h1>
          <p className="text-gray-500">Manage your activities and track your progress.</p>
        </div>
        {profile.role === 'worker' && (
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
          >
            <Plus className="w-5 h-5" />
            <span>Submit Work Report</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex space-x-1 p-1 bg-gray-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('appointments')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'appointments' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Appointments
          </button>
          {(profile.role === 'worker' || profile.role === 'manager' || profile.role === 'admin') && (
            <button 
              onClick={() => setActiveTab('reports')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'reports' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Reports
            </button>
          )}
        </div>

        {activeTab === 'reports' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
              />
            </div>
            {(profile.role === 'admin' || profile.role === 'manager') && (
              <button 
                onClick={handleExportCSV}
                className="flex items-center justify-center space-x-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all shadow-sm w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'appointments' ? (
        <div className="grid gap-6">
          {appointments.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No appointments scheduled yet.</p>
            </div>
          ) : (
            appointments.map((app) => (
              <div 
                key={app.id} 
                onClick={() => profile.role === 'manager' && setSelectedAppointment(app)}
                className={cn(
                  "bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all",
                  profile.role === 'manager' && "cursor-pointer hover:border-purple-200 hover:shadow-md"
                )}
              >
                <div className="flex items-center space-x-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                    app.status === 'confirmed' ? "bg-green-50 text-green-600" : 
                    app.status === 'cancelled' ? "bg-red-50 text-red-600" : "bg-purple-50 text-purple-600"
                  )}>
                    {app.status === 'confirmed' ? <CheckCircle2 className="w-7 h-7" /> : 
                     app.status === 'cancelled' ? <XCircle className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {profile.role === 'manager' ? `Meeting with ${app.userName}` : `Meeting with ${app.managerName}`}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> {app.date}</span>
                      <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5" /> {app.time}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {profile.role === 'manager' && app.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleStatusUpdate(app.id, 'confirmed')}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(app.id, 'cancelled')}
                        className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 transition-all"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                    app.status === 'confirmed' ? "bg-green-100 text-green-700" : 
                    app.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
                  )}>
                    {app.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          {reports.filter(r => 
            r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            r.workerName.toLowerCase().includes(searchTerm.toLowerCase())
          ).length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? `No reports matching "${searchTerm}"` : "No reports submitted yet."}
              </p>
            </div>
          ) : (
            reports
              .filter(r => 
                r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                r.workerName.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((report) => (
              <div key={report.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">Submitted by {report.workerName} • {format(new Date(report.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                  <FileText className="w-6 h-6 text-purple-200" />
                </div>
                <div className="prose prose-purple max-w-none text-gray-600">
                  {report.content}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Submit Work Report</h2>
                  <p className="text-gray-500">Document your progress and achievements.</p>
                </div>
                <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const title = formData.get('title') as string;
                const content = formData.get('content') as string;

                if (!profile) return;

                const report: Omit<Report, 'id'> = {
                  workerId: profile.uid,
                  workerName: profile.name,
                  title,
                  content,
                  createdAt: new Date().toISOString()
                };

                try {
                  await addDoc(collection(db, 'reports'), report);
                  setIsReportModalOpen(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, 'reports');
                }
              }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Report Title</label>
                  <input required name="title" placeholder="e.g., Daily Progress - March 30" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Content</label>
                  <textarea required name="content" placeholder="Describe your work today..." className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all h-48 resize-none" />
                </div>
                <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-100">
                  Submit Report
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appointment Detail Modal */}
      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAppointment(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Appointment Details</h2>
                  <p className="text-gray-500">Meeting with {selectedAppointment.userName}</p>
                </div>
                <button onClick={() => setSelectedAppointment(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                    <p className="text-sm font-bold text-gray-900">{selectedAppointment.date}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time</p>
                    <p className="text-sm font-bold text-gray-900">{selectedAppointment.time}</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    selectedAppointment.status === 'confirmed' ? "bg-green-100 text-green-700" : 
                    selectedAppointment.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
                  )}>
                    {selectedAppointment.status}
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes from User</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {selectedAppointment.notes || "No notes provided."}
                  </p>
                </div>

                {selectedAppointment.status === 'pending' && profile.role === 'manager' && (
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => {
                        handleStatusUpdate(selectedAppointment.id, 'confirmed');
                        setSelectedAppointment(null);
                      }}
                      className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all"
                    >
                      Confirm
                    </button>
                    <button 
                      onClick={() => {
                        handleStatusUpdate(selectedAppointment.id, 'cancelled');
                        setSelectedAppointment(null);
                      }}
                      className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => doc.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    const unsubDeps = onSnapshot(collection(db, 'departments'), (snap) => {
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'departments'));

    return () => { unsubUsers(); unsubDeps(); };
  }, [profile]);

  if (profile?.role !== 'admin') return <Navigate to="/" />;

  const handleRoleUpdate = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeptUpdate = async (uid: string, departmentId: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { departmentId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Control Panel</h1>
          <p className="text-gray-500">Manage organization structure and user permissions.</p>
        </div>
        <button 
          onClick={() => setIsDeptModalOpen(true)}
          className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
        >
          <Plus className="w-5 h-5" />
          <span>Add Department</span>
        </button>
      </div>

      <div className="flex space-x-1 p-1 bg-gray-100 rounded-2xl w-fit mb-8">
        <button 
          onClick={() => setActiveTab('users')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'users' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Users
        </button>
        <button 
          onClick={() => setActiveTab('departments')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'departments' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Departments
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden">
                        {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <UserIcon className="text-purple-500 w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.role} 
                      onChange={(e) => handleRoleUpdate(u.uid, e.target.value as UserRole)}
                      className="text-sm bg-transparent border-none focus:ring-0 font-medium text-purple-600 cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="worker">Worker</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.departmentId || ''} 
                      onChange={(e) => handleDeptUpdate(u.uid, e.target.value)}
                      className="text-sm bg-transparent border-none focus:ring-0 font-medium text-gray-600 cursor-pointer"
                    >
                      <option value="">None</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-red-500 transition-colors">
                      <AlertCircle className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div key={dept.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                  <Building2 className="text-purple-600 w-6 h-6" />
                </div>
                <button onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'departments', dept.id));
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `departments/${dept.id}`);
                  }
                }} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{dept.name}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{dept.description}</p>
              </div>
              <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                  {users.filter(u => u.departmentId === dept.id).length} Members
                </span>
                <button className="text-gray-400 hover:text-purple-600">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dept Modal */}
      <AnimatePresence>
        {isDeptModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeptModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Add Department</h2>
                <button onClick={() => setIsDeptModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                const description = formData.get('description') as string;
                const image = formData.get('image') as string;

                try {
                  await addDoc(collection(db, 'departments'), { name, description, image });
                  setIsDeptModalOpen(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, 'departments');
                }
              }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Name</label>
                  <input required name="name" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Description</label>
                  <textarea required name="description" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all h-24 resize-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Image URL</label>
                  <input required name="image" defaultValue="https://picsum.photos/seed/office/800/600" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all" />
                </div>
                <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-100">
                  Create Department
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main App ---

export default function App() {
  useEffect(() => {
    const seedData = async () => {
      const snap = await getDocs(collection(db, 'departments'));
      if (snap.empty) {
        const initialDeps = [
          { name: 'Engineering', description: 'Building the future with cutting-edge technology and robust infrastructure.', image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800' },
          { name: 'Design', description: 'Crafting beautiful, intuitive experiences that delight our users.', image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&q=80&w=800' },
          { name: 'Marketing', description: 'Spreading the word and connecting our products with the world.', image: 'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&q=80&w=800' }
        ];
        for (const dept of initialDeps) {
          await addDoc(collection(db, 'departments'), dept);
        }
      }
    };
    seedData();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-[#FAFAFB] font-sans text-gray-900">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </main>
            <footer className="bg-white border-t border-gray-100 py-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Building2 className="text-white w-5 h-5" />
                    </div>
                    <span className="text-lg font-bold text-gray-900">PurpleCorp</span>
                  </div>
                  <p className="text-gray-500 text-sm">© 2026 PurpleCorp Connect. All rights reserved.</p>
                  <div className="flex space-x-6">
                    <a href="#" className="text-gray-400 hover:text-purple-600 transition-colors">Privacy</a>
                    <a href="#" className="text-gray-400 hover:text-purple-600 transition-colors">Terms</a>
                    <a href="#" className="text-gray-400 hover:text-purple-600 transition-colors">Contact</a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
