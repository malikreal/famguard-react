import React, { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { 
  Trash2, Pause, Play, MoreVertical, 
  Copy, Lock, Unlock, AlertTriangle, CheckCircle,
  Key, PieChart, Megaphone, Users, Smartphone, Edit2, LogOut
} from 'lucide-react';
import myLogo from './logo.png';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB5BlBrKRYm_T1ryg8l6zx4em9sqL117L8",
  authDomain: "famguard-99.firebaseapp.com",
  projectId: "famguard-99",
  storageBucket: "famguard-99.firebasestorage.app",
  messagingSenderId: "108081533131",
  appId: "1:108081533131:web:dfd8114ce9e033e9a74b4e",
  measurementId: "G-RK641NQ6JE"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// --- REUSABLE COMPONENTS ---
const Input = (props) => (
  <input {...props} className="w-full p-3 mb-4 bg-[#121212] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#EAB308] transition-all text-sm" />
);

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "px-4 py-2 rounded-lg font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm";
  const variants = {
    primary: "bg-[#EAB308] text-[#121212] hover:opacity-90",
    secondary: "bg-[#D97706] text-white hover:opacity-90",
    danger: "bg-[#EF4444] text-white hover:opacity-80",
    warning: "bg-[#F59E0B] text-white hover:opacity-80",
    outline: "bg-transparent border border-[#333333] text-white hover:bg-[#262626]"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

// --- HELPER FUNCTIONS ---
const formatDate = (timestamp) => {
  if (!timestamp) return "Unknown";
  if (timestamp.toDate) return timestamp.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min ago";
  return Math.floor(seconds) + " sec ago";
};

export default function FamguardApp() {
  // --- STATE ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGroupLoading, setIsGroupLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [newQuota, setNewQuota] = useState(120);
  const [adminNote, setAdminNote] = useState('');
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'default' });
  const [dialog, setDialog] = useState({ show: false, type: '', data: null });
  const [dialogInput, setDialogInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const isFirstGroupLoad = useRef(true);

  // --- LISTENERS ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
      
      if (!currentUser) {
        setGroup(null);
        setMembers([]);
        isFirstGroupLoad.current = true;
        setIsGroupLoading(false);
      } else {
        setIsGroupLoading(true);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribeGroup = db.collection("groups")
      .where("adminUid", "==", user.uid)
      .limit(1)
      .onSnapshot((snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setGroup({ group_code: doc.id, ...doc.data() });
          
          if (isFirstGroupLoad.current) {
            setAdminNote(doc.data().admin_note || "");
            isFirstGroupLoad.current = false;
          }
        } else {
          setGroup(null);
        }
        setIsGroupLoading(false);
      }, (error) => {
        showToast("Database error: " + error.message, 'error');
        setIsGroupLoading(false); 
      });

    return () => unsubscribeGroup();
  }, [user]);

  useEffect(() => {
    if (!group?.group_code) return;

    const unsubscribeMembers = db.collection("groups").doc(group.group_code).collection("members")
      .onSnapshot((querySnapshot) => {
        const membersList = [];
        querySnapshot.forEach((doc) => {
          membersList.push({ uid: doc.id, ...doc.data() });
        });
        setMembers(membersList);
      });

    return () => unsubscribeMembers();
  }, [group?.group_code]);

  // --- ACTIONS ---
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'default' }), 3000);
  };

  const closeDialog = () => {
    setDialog({ show: false, type: '', data: null });
    setDialogInput('');
    setPasswordConfirm('');
  };

  const handleAuth = async (action) => {
    if (!authForm.email || !authForm.password) return showToast("Enter email and password.", 'error');
    try {
      if (action === 'signin') {
        await auth.signInWithEmailAndPassword(authForm.email, authForm.password);
      } else {
        if (authForm.password.length < 6) return showToast("Password must be 6+ chars.", 'error');
        await auth.createUserWithEmailAndPassword(authForm.email, authForm.password);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const createGroup = async () => {
    if (isNaN(newQuota) || newQuota <= 0) return showToast("Invalid quota.", 'error');
    try {
      let code;
      let isUnique = false;
      let groupRef;

      while (!isUnique) {
        code = "FAM-" + Math.floor(1000 + Math.random() * 9000);
        groupRef = db.collection("groups").doc(code);
        const doc = await groupRef.get();
        if (!doc.exists) isUnique = true;
      }

      await groupRef.set({
        adminUid: user.uid,
        admin_note: "Welcome to our data pool!",
        locked: false,
        quota_gb: Number(newQuota),
        kicked_data_gb: 0
      });
      isFirstGroupLoad.current = true; 
    } catch (error) {
      showToast("Failed to create: " + error.message, 'error');
    }
  };

  const updateQuota = async () => {
    const quota = parseFloat(dialogInput);
    if (!isNaN(quota) && quota > 0) {
      await db.collection("groups").doc(group.group_code).set({ quota_gb: quota }, { merge: true });
      showToast("Quota updated.", 'success');
      closeDialog();
    }
  };

  const deleteAdminAccount = async () => {
    try {
      if (!passwordConfirm) return showToast("Password required to delete account.", "error");

      const credential = firebase.auth.EmailAuthProvider.credential(user.email, passwordConfirm);
      await user.reauthenticateWithCredential(credential);

      if (group?.group_code) {
        const snapshot = await db.collection("groups").doc(group.group_code).collection("members").get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await db.collection("groups").doc(group.group_code).delete();
      }
      
      await user.delete();
      closeDialog();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // --- RENDER HELPERS ---
  const totalConsumed = members.reduce((sum, m) => sum + (m.data_gb || 0), group?.kicked_data_gb || 0);
  const safeQuota = group?.quota_gb > 0 ? group.quota_gb : 1;
  const poolPercent = Math.min((totalConsumed / safeQuota) * 100, 100);

  // --- VIEWS ---
  if (isInitializing || (user && isGroupLoading)) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-white">
        <img src={myLogo} alt="Loading" className="w-16 h-16 mb-4 animate-pulse object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
        <p className="text-[#A0A0A0] text-sm tracking-wide">Connecting to pool...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1C1C1C] p-8 rounded-2xl w-full max-w-md border border-[#333] text-center shadow-2xl relative group">
          <div className="absolute inset-0 bg-[#EAB308]/5 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <img src={myLogo} alt="Famguard Logo" className="w-20 h-20 mx-auto mb-4 object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.2)]" />
            <h2 className="text-2xl font-bold text-white mb-1">Famguard</h2>
            <p className="text-[#A0A0A0] text-sm mb-6">Admin Portal</p>
            <Input type="email" placeholder="Email Address" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <Input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            <Button className="w-full mb-3" onClick={() => handleAuth('signin')}>Sign In</Button>
            <Button variant="outline" className="w-full" onClick={() => handleAuth('signup')}>Create Account</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#121212] p-6 text-white flex flex-col items-center">
        <header className="w-full max-w-5xl flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <img src={myLogo} alt="Famguard Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(234,179,8,0.2)]" /> 
            <div>
              <h1 className="text-lg font-bold leading-tight">Famguard</h1>
              <p className="text-xs text-[#A0A0A0]">Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#A0A0A0] text-sm hidden md:block">{user.email}</span>
            <Button variant="outline" onClick={() => auth.signOut()}><LogOut size={16}/> Sign Out</Button>
          </div>
        </header>
        <div className="bg-[#1C1C1C] p-8 rounded-2xl w-full max-w-md border border-[#333] text-center shadow-lg mt-10">
          <h3 className="text-xl font-bold mb-2">Create a Data Pool</h3>
          <p className="text-[#A0A0A0] text-sm mb-6">Set your family's monthly data limit.</p>
          <Input type="number" placeholder="Total Pool Quota (GB)" value={newQuota} onChange={e => setNewQuota(e.target.value)} />
          <Button className="w-full" onClick={createGroup}>Create Group</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 flex justify-center font-sans">
      <div className="w-full max-w-5xl">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <img src={myLogo} alt="Famguard Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(234,179,8,0.2)]" /> 
            <div>
              <h1 className="text-lg font-bold leading-tight">Famguard</h1>
              <p className="text-xs text-[#A0A0A0]">Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#A0A0A0] text-sm hidden md:block">{user.email}</span>
            <Button variant="outline" className="text-xs py-1.5 px-3 border-[#333] text-[#A0A0A0] hover:text-white" onClick={() => auth.signOut()}>
              <LogOut size={14}/> Sign Out
            </Button>
          </div>
        </header>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-[#1C1C1C] border border-[#EAB308]/20 p-6 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.07)] transition-all hover:shadow-[0_0_25px_rgba(234,179,8,0.12)] relative">
            <h3 className="text-[#A0A0A0] text-xs font-semibold mb-3 tracking-wider flex items-center gap-2 uppercase relative z-10">
              <Key size={14} /> Active Group ID
            </h3>
            <h1 className="text-4xl font-bold text-[#EAB308] mb-4 relative z-10">{group.group_code}</h1>
            <div className="flex gap-2 relative z-10">
              <Button variant="outline" className="text-xs py-1.5 border-[#333]" onClick={() => { navigator.clipboard.writeText(group.group_code); showToast("Copied!"); }}>
                <Copy size={14}/> Copy Code
              </Button>
              <Button variant={group.locked ? 'danger' : 'primary'} className="text-xs py-1.5" onClick={() => db.collection("groups").doc(group.group_code).update({ locked: !group.locked })}>
                {group.locked ? <><Lock size={14}/> Locked</> : <><Unlock size={14}/> Accepting Members</>}
              </Button>
            </div>
          </div>

          <div className="bg-[#1C1C1C] border border-[#EAB308]/20 p-6 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.07)] transition-all hover:shadow-[0_0_25px_rgba(234,179,8,0.12)] flex flex-col justify-between relative">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[#A0A0A0] text-xs font-semibold tracking-wider flex items-center gap-2 uppercase">
                  <PieChart size={14} /> Total Pool Usage
                </h3>
                <div className="text-right">
                  <span className="text-xl font-bold">{totalConsumed.toFixed(2)}</span>
                  <span className="text-[#A0A0A0] text-sm font-normal"> / {group.quota_gb.toFixed(2)} GB</span>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <button className="text-[#EAB308] text-xs flex items-center gap-1 hover:opacity-80 transition-opacity" onClick={() => { setDialogInput(group.quota_gb); setDialog({ show: true, type: 'editQuota' }); }}>
                  <Edit2 size={12}/> Edit Quota
                </button>
                <div className="text-[#A0A0A0] text-xs">{poolPercent.toFixed(1)}% Used</div>
              </div>
            </div>
            
            <div className="relative w-full h-1 bg-[#121212] rounded-full mt-2 z-10">
              <div 
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${poolPercent > 90 ? 'bg-[#EF4444]' : poolPercent > 70 ? 'bg-[#F59E0B]' : 'bg-[#EAB308]'}`} 
                style={{ width: `${poolPercent}%` }}
              >
                {/* Glowing Dot at the end of the bar */}
                <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${poolPercent > 90 ? 'bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]' : poolPercent > 70 ? 'bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`}></div>
              </div>
            </div>
          </div>
        </div>

        {/* ADMIN NOTE */}
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] p-6 rounded-2xl mb-4 shadow-sm">
          <h3 className="text-[#A0A0A0] text-xs font-semibold mb-4 tracking-wider flex items-center gap-2 uppercase">
            <Megaphone size={14} /> Admin Note to Members
          </h3>
          <textarea className="w-full p-3 bg-[#121212] border border-[#2A2A2A] rounded-lg text-sm text-white mb-3 focus:outline-none focus:border-[#EAB308] transition-all resize-none" rows="2" value={adminNote} onChange={e => setAdminNote(e.target.value)}></textarea>
          <Button className="text-xs py-1.5 px-4" onClick={() => { db.collection("groups").doc(group.group_code).update({ admin_note: adminNote }); showToast("Note broadcasted!"); }}>
            Save & Broadcast
          </Button>
        </div>

        {/* MEMBERS TABLE */}
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl mb-6 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-[#2A2A2A]">
            <h3 className="text-white text-sm font-semibold flex items-center gap-2">
              <Users size={16} className="text-[#EAB308]" /> {members.length} Members Connected
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  <th className="px-6 py-4 text-[#A0A0A0] text-xs font-semibold uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-[#A0A0A0] text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[#A0A0A0] text-xs font-semibold uppercase tracking-wider">First Connected</th>
                  <th className="px-6 py-4 text-[#A0A0A0] text-xs font-semibold uppercase tracking-wider">Last Sync</th>
                  <th className="px-6 py-4 text-[#A0A0A0] text-xs font-semibold uppercase tracking-wider w-1/4">Data Used</th>
                  <th className="px-6 py-4 text-[#A0A0A0] text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {members.map(member => (
                  <tr key={member.uid} className="hover:bg-[#222] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm">{member.name || "Unknown"}</div>
                      <div className="text-xs text-[#A0A0A0] flex items-center gap-1 mt-1">
                        <Smartphone size={12} /> {member.device_model || "Unknown Device"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full border ${member.isPaused ? 'text-[#EF4444] border-[#EF4444] bg-[#EF4444]/10' : 'text-[#EAB308] border-[#EAB308] bg-[#EAB308]/10'}`}>
                        {member.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#A0A0A0] whitespace-nowrap">
                      {formatDate(member.joined_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-[#A0A0A0]">{formatDate(member.last_updated)}</div>
                      <div className="text-[10px] text-[#777] mt-0.5">{timeAgo(member.last_updated)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-xs mb-1.5">{(member.data_gb || 0).toFixed(2)} GB</div>
                      <div className="relative w-full h-1 bg-[#121212] rounded-full">
                        <div 
                          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${((member.data_gb || 0) / safeQuota) * 100 > 50 ? 'bg-[#EF4444]' : 'bg-[#EAB308]'}`} 
                          style={{ width: `${Math.min(((member.data_gb || 0) / safeQuota) * 100, 100)}%` }}
                        >
                           {/* Mini Dot at the end of the member bar */}
                           <div className={`absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${((member.data_gb || 0) / safeQuota) * 100 > 50 ? 'bg-[#EF4444]' : 'bg-[#EAB308]'}`}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setDialog({ show: true, type: 'memberMenu', data: member })} className="p-1 text-[#A0A0A0] hover:text-white transition-colors"><MoreVertical size={16} /></button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan="6" className="p-8 text-center text-[#A0A0A0] text-sm">No members connected yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-[#1C1C1C] border border-[#EF4444]/30 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-[#EF4444]/5 pointer-events-none"></div>
          <div className="mb-4 sm:mb-0 relative z-10">
            <h3 className="text-[#EF4444] text-sm font-semibold mb-1 flex items-center gap-2">
              <AlertTriangle size={16}/> Danger Zone
            </h3>
            <div className="text-[#A0A0A0] text-xs">Delete your admin account, group pool, and all member details permanently.</div>
          </div>
          <Button variant="danger" className="text-xs relative z-10" onClick={() => setDialog({ show: true, type: 'deleteAdmin' })}>Delete Account & Group</Button>
        </div>
      </div>

      {/* DIALOGS */}
      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#333] p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            {dialog.type === 'editQuota' && (
              <>
                <h3 className="text-lg font-bold mb-4">Edit Pool Quota</h3>
                <Input type="number" value={dialogInput} onChange={e => setDialogInput(e.target.value)} autoFocus />
                <div className="flex gap-3 justify-end"><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button onClick={updateQuota}>Save</Button></div>
              </>
            )}

            {dialog.type === 'memberMenu' && (
              <>
                <h3 className="text-lg font-bold mb-4">Manage {dialog.data.name}</h3>
                <div className="flex flex-col gap-2">
                  <Button variant={dialog.data.isPaused ? 'primary' : 'outline'} className={dialog.data.isPaused ? '' : 'border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10'} onClick={() => { db.collection("groups").doc(group.group_code).collection("members").doc(dialog.data.uid).update({ isPaused: !dialog.data.isPaused }); closeDialog(); }}>
                    {dialog.data.isPaused ? 'Resume Access' : 'Pause Access'}
                  </Button>
                  <Button variant="danger" onClick={() => { db.collection("groups").doc(group.group_code).collection("members").doc(dialog.data.uid).delete(); closeDialog(); }}>Remove Member</Button>
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                </div>
              </>
            )}

            {dialog.type === 'deleteAdmin' && (
              <>
                <h3 className="text-[#EF4444] font-bold mb-2 flex items-center gap-2"><AlertTriangle size={20}/> Confirm Deletion</h3>
                <p className="text-xs text-[#A0A0A0] mb-4">This permanently deletes your account and data pool. Please enter your password to confirm.</p>
                <Input type="password" placeholder="Account Password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
                <div className="flex gap-3 justify-end"><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button variant="danger" onClick={deleteAdminAccount}>Delete</Button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-[#1C1C1C] border-[#EF4444] text-[#EF4444]' : 'bg-[#1C1C1C] border-[#EAB308] text-[#EAB308]'}`}>
          {toast.type === 'error' ? <AlertTriangle size={18}/> : <CheckCircle size={18}/>}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
