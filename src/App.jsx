import React, { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { 
  Trash2, Pause, Play, MoreVertical, 
  Copy, Lock, Unlock, AlertTriangle, CheckCircle, Shield
} from 'lucide-react';
// import myLogo from './logo.png'; // Uncomment if using local logo

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
  <input {...props} className="w-full p-3 mb-4 bg-[#121212] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all" />
);

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "px-4 py-2 rounded-md font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#3B82F6] text-white hover:opacity-90",
    secondary: "bg-[#10B981] text-white hover:opacity-90",
    danger: "bg-[#EF4444] text-white hover:opacity-80",
    warning: "bg-[#F59E0B] text-white hover:opacity-80",
    outline: "bg-transparent border border-[#333333] text-white hover:bg-[#262626]"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function FamguardApp() {
  // --- STATE ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  
  // Form States
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [newQuota, setNewQuota] = useState(120);
  const [adminNote, setAdminNote] = useState('');
  
  // UI States
  const [toast, setToast] = useState({ show: false, message: '', type: 'default' });
  const [dialog, setDialog] = useState({ show: false, type: '', data: null });
  const [dialogInput, setDialogInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Refs for tracking initial load to prevent note overwrite
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
          
          // Only pull the admin note on first load to prevent erasing active typing
          if (isFirstGroupLoad.current) {
            setAdminNote(doc.data().admin_note || "");
            isFirstGroupLoad.current = false;
          }
        } else {
          setGroup(null);
        }
      }, (error) => showToast("Database error: " + error.message, 'error'));

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

      // Bug Fix: Loop until we find a unique group code
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

      // Bug Fix: Re-authenticate first to prevent "requires-recent-login" failures midway
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, passwordConfirm);
      await user.reauthenticateWithCredential(credential);

      // 1. Delete all members in subcollection
      if (group?.group_code) {
        const snapshot = await db.collection("groups").doc(group.group_code).collection("members").get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        // 2. Delete main group doc
        await db.collection("groups").doc(group.group_code).delete();
      }
      
      // 3. Delete auth account
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
  if (isInitializing) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1E1E1E] p-8 rounded-xl w-full max-w-md border border-[#333333] text-center">
          <Shield size={48} className="mx-auto mb-4 text-[#3B82F6]" />
          <h2 className="text-2xl font-bold text-white mb-2">Famguard Admin</h2>
          <p className="text-[#A0A0A0] mb-6">Sign in to manage your pool.</p>
          <Input type="email" placeholder="Email Address" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
          <Input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
          <Button className="w-full mb-3" onClick={() => handleAuth('signin')}>Sign In</Button>
          <Button variant="outline" className="w-full" onClick={() => handleAuth('signup')}>Create Account</Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#121212] p-6 text-white flex flex-col items-center">
        <div className="bg-[#1E1E1E] p-8 rounded-xl w-full max-w-md border border-[#333333] text-center mt-20">
          <h3 className="text-xl font-bold mb-2">Create a Data Pool</h3>
          <p className="text-[#A0A0A0] mb-6">Set your family's monthly data limit.</p>
          <Input type="number" placeholder="Total Pool Quota (GB)" value={newQuota} onChange={e => setNewQuota(e.target.value)} />
          <Button className="w-full" onClick={createGroup}>Create Group</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 flex justify-center">
      <div className="w-full max-w-5xl">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3 text-2xl font-bold">
            <Shield className="text-[#3B82F6]" /> Famguard
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#A0A0A0] text-sm">{user.email}</span>
            <Button variant="outline" onClick={() => auth.signOut()}>Sign Out</Button>
          </div>
        </header>

        {/* Dash Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl flex justify-between items-center">
            <div>
              <h3 className="text-[#A0A0A0] font-semibold mb-1">Active Group ID</h3>
              <h1 className="text-3xl font-bold text-[#10B981]">{group.group_code}</h1>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="text-sm py-1" onClick={() => { navigator.clipboard.writeText(group.group_code); showToast("Copied!"); }}><Copy size={16}/> Copy</Button>
              <Button variant={group.locked ? 'danger' : 'secondary'} className="text-sm py-1" onClick={() => db.collection("groups").doc(group.group_code).update({ locked: !group.locked })}>
                {group.locked ? <><Lock size={16}/> Locked</> : <><Unlock size={16}/> Open</>}
              </Button>
            </div>
          </div>

          <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-[#A0A0A0] font-semibold mb-1">Total Pool Usage</h3>
                <button className="text-[#3B82F6] text-sm hover:underline" onClick={() => { setDialogInput(group.quota_gb); setDialog({ show: true, type: 'editQuota' }); }}>Edit Quota</button>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">{totalConsumed.toFixed(2)} GB / {group.quota_gb.toFixed(2)} GB</span>
                <div className="text-[#A0A0A0] text-sm">{poolPercent.toFixed(1)}% Used</div>
              </div>
            </div>
            <div className="h-3 w-full bg-[#121212] rounded-full overflow-hidden border border-[#333333]">
              <div className={`h-full transition-all ${poolPercent > 90 ? 'bg-[#EF4444]' : poolPercent > 70 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`} style={{ width: `${poolPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl mb-6">
          <h3 className="font-semibold mb-4">Admin Note to Members</h3>
          <textarea className="w-full p-3 bg-[#121212] border border-[#333333] rounded-lg text-white mb-3 focus:outline-none focus:border-[#3B82F6]" rows="2" value={adminNote} onChange={e => setAdminNote(e.target.value)}></textarea>
          <Button onClick={() => { db.collection("groups").doc(group.group_code).update({ admin_note: adminNote }); showToast("Note broadcasted!"); }}>Save & Broadcast</Button>
        </div>

        {/* Members Table */}
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl mb-6 overflow-hidden">
          <div className="p-6 border-b border-[#333333]">
            <h3 className="font-semibold">{members.length} Members Connected</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#262626] text-[#A0A0A0] text-xs uppercase">
                  <th className="p-4">Member</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Data Used</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333333]">
                {members.map(member => (
                  <tr key={member.uid} className="hover:bg-[#262626]">
                    <td className="p-4">
                      <div className="font-bold">{member.name || "Unknown"}</div>
                      <div className="text-xs text-[#A0A0A0]">{member.device_model}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold uppercase rounded border ${member.isPaused ? 'text-[#F59E0B] border-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#10B981] border-[#10B981] bg-[#10B981]/10'}`}>
                        {member.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </td>
                    <td className="p-4 font-bold">{(member.data_gb || 0).toFixed(2)} GB</td>
                    <td className="p-4 text-right">
                      <button onClick={() => setDialog({ show: true, type: 'memberMenu', data: member })} className="p-2 hover:text-[#3B82F6]"><MoreVertical size={20} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-[#EF4444] p-6 rounded-xl flex justify-between items-center">
          <div>
            <h3 className="text-[#EF4444] font-bold mb-1 flex items-center gap-2"><AlertTriangle size={20}/> Danger Zone</h3>
            <div className="text-[#A0A0A0] text-sm">Permanently delete account and data.</div>
          </div>
          <Button variant="danger" onClick={() => setDialog({ show: true, type: 'deleteAdmin' })}>Delete Everything</Button>
        </div>
      </div>

      {/* DIALOGS */}
      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl w-full max-w-sm">
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
                  <Button variant={dialog.data.isPaused ? 'secondary' : 'warning'} onClick={() => { db.collection("groups").doc(group.group_code).collection("members").doc(dialog.data.uid).update({ isPaused: !dialog.data.isPaused }); closeDialog(); }}>
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
                <p className="text-sm text-[#A0A0A0] mb-4">This permanently deletes your account and data pool. Please enter your password to confirm.</p>
                <Input type="password" placeholder="Account Password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
                <div className="flex gap-3 justify-end"><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button variant="danger" onClick={deleteAdminAccount}>Delete</Button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-xl border flex items-center gap-3 ${toast.type === 'error' ? 'bg-[#1E1E1E] border-[#EF4444] text-[#EF4444]' : 'bg-[#1E1E1E] border-[#10B981] text-[#10B981]'}`}>
          {toast.type === 'error' ? <AlertTriangle size={20}/> : <CheckCircle size={20}/>}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
