import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { 
  Trash2, Pause, Play, MoreVertical, 
  Copy, Lock, Unlock, AlertTriangle, CheckCircle 
} from 'lucide-react';

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
  <input {...props} className="w-full p-3 mb-4 bg-[#121212] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EAB308] focus:border-transparent transition-all" />
);

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "px-4 py-2 rounded-md font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#EAB308] text-[#121212] hover:opacity-90", // Updated to Gold with dark text
    secondary: "bg-[#3B82F6] text-white hover:opacity-80",
    danger: "bg-[#EF4444] text-white hover:opacity-80",
    warning: "bg-[#F59E0B] text-white hover:opacity-80",
    outline: "bg-transparent border border-[#333333] text-white hover:bg-[#262626]"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function FamguardApp() {
  // --- STATE MANAGEMENT ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [newQuota, setNewQuota] = useState(120);
  const [adminNote, setAdminNote] = useState('');
  
  // UI States
  const [toast, setToast] = useState({ show: false, message: '', type: 'default' });
  const [dialog, setDialog] = useState({ show: false, type: '', data: null });
  const [dialogInput, setDialogInput] = useState('');

  // --- FIREBASE LISTENERS ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
      if (!currentUser) {
        setGroup(null);
        setMembers([]);
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
          setAdminNote(doc.data().admin_note || "");
        } else {
          setGroup(null);
        }
      }, (error) => showToast("Failed to connect to Firebase: " + error.message, 'error'));

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

  // --- HELPER FUNCTIONS ---
  const showToast = (message, type = 'default') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'default' }), 3000);
  };

  const closeDialog = () => {
    setDialog({ show: false, type: '', data: null });
    setDialogInput('');
  };

  // --- ACTIONS ---
  const handleAuth = async (action) => {
    if (!authForm.email || !authForm.password) return showToast("Please enter email and password.", 'error');
    try {
      if (action === 'signin') {
        await auth.signInWithEmailAndPassword(authForm.email, authForm.password);
      } else {
        if (authForm.password.length < 6) return showToast("Password must be at least 6 characters.", 'error');
        await auth.createUserWithEmailAndPassword(authForm.email, authForm.password);
      }
    } catch (error) {
      showToast(`${action === 'signin' ? 'Login' : 'Account creation'} failed: ${error.message}`, 'error');
    }
  };

  const createGroup = async () => {
    if (!user) return showToast("You must be logged in.", 'error');
    if (isNaN(newQuota) || newQuota <= 0) return showToast("Please enter a valid quota.", 'error');
    
    const code = "FAM-" + Math.floor(1000 + Math.random() * 9000);
    try {
      await db.collection("groups").doc(code).set({
        adminUid: user.uid,
        admin_note: "Welcome to our data pool!",
        locked: false,
        quota_gb: Number(newQuota)
      });
    } catch (error) {
      showToast("Failed to create group: " + error.message, 'error');
    }
  };

  const updateQuota = async () => {
    const quota = parseFloat(dialogInput);
    if (!isNaN(quota) && quota > 0) {
      await db.collection("groups").doc(group.group_code).set({ quota_gb: quota }, { merge: true });
      showToast("Quota updated successfully.", 'success');
      closeDialog();
    } else {
      showToast("Invalid quota.", 'error');
    }
  };

  const toggleLock = () => {
    db.collection("groups").doc(group.group_code).set({ locked: !group.locked }, { merge: true });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(group.group_code);
    showToast(`Copied ${group.group_code} to clipboard!`, 'success');
  };

  const broadcastNote = async () => {
    await db.collection("groups").doc(group.group_code).set({ admin_note: adminNote }, { merge: true });
    showToast("Note broadcasted to all Android apps!", 'success');
  };

  const togglePauseMember = async (uid, isCurrentlyPaused) => {
    try {
      await db.collection("groups").doc(group.group_code).collection("members").doc(uid).update({ isPaused: !isCurrentlyPaused });
      closeDialog();
    } catch (error) {
      showToast("Failed to update status: " + error.message, 'error');
    }
  };

  const deleteMember = async () => {
    try {
      await db.collection("groups").doc(group.group_code).collection("members").doc(dialog.data.uid).delete();
      showToast("Member deleted permanently.", 'success');
      closeDialog();
    } catch (error) {
      showToast("Failed to delete member: " + error.message, 'error');
    }
  };

  const deleteAdminAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      if (group?.group_code) {
        const snapshot = await db.collection("groups").doc(group.group_code).collection("members").get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await db.collection("groups").doc(group.group_code).delete();
      }
      await currentUser.delete();
      showToast("Account and data pool deleted.", 'success');
      closeDialog();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        showToast("Security: Deleting requires a fresh login. Please sign out and back in.", 'error');
      } else {
        showToast("Failed to delete account: " + error.message, 'error');
      }
      closeDialog();
    }
  };

  // --- CALCULATIONS ---
  const totalConsumed = members.reduce((sum, m) => sum + (m.data_gb || 0), 0);
  const safeQuota = group?.quota_gb > 0 ? group.quota_gb : 1;
  let poolPercent = group?.quota_gb > 0 ? (totalConsumed / group.quota_gb) * 100 : 0;
  if (poolPercent > 100) poolPercent = 100;

  // --- VIEWS ---
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <img src="logo.jpg" alt="Famguard Logo" className="w-16 h-16 animate-pulse drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-4">
        <div className="bg-[#1E1E1E] border border-[#333333] p-8 rounded-xl w-full max-w-md shadow-2xl relative group">
          <div className="absolute inset-0 bg-[#EAB308]/5 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10 text-center">
            <img src="logo.jpg" alt="Famguard Logo" className="w-20 h-20 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" />
            <h2 className="text-2xl font-bold mb-2">Famguard Admin</h2>
            <p className="text-[#A0A0A0] text-sm mb-6">Sign in or register to securely manage your pool.</p>
            <Input type="email" placeholder="Email Address" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <Input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            <Button className="w-full mb-3" variant="primary" onClick={() => handleAuth('signin')}>Sign In</Button>
            <Button className="w-full" variant="outline" onClick={() => handleAuth('signup')}>Create Account</Button>
          </div>
        </div>
        {toast.show && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg border ${toast.type === 'error' ? 'bg-[#1E1E1E] border-[#EF4444] text-[#EF4444]' : 'bg-[#1E1E1E] border-[#EAB308] text-[#EAB308]'}`}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
        <header className="w-full max-w-4xl flex justify-between items-center mb-12">
          <div className="flex items-center gap-3 text-xl font-bold">
            <img src="logo.jpg" alt="Famguard Logo" className="w-8 h-8" /> 
            Famguard
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#A0A0A0] text-sm">{user.email}</span>
            <Button variant="outline" onClick={() => auth.signOut()}>Sign Out</Button>
          </div>
        </header>
        <div className="bg-[#1E1E1E] border border-[#333333] p-8 rounded-xl w-full max-w-lg text-center shadow-lg">
          <h3 className="text-xl font-bold mb-2">Create a Data Pool</h3>
          <p className="text-[#A0A0A0] text-sm mb-6">Set your family's monthly data limit to generate your secure invite code.</p>
          <div className="text-left mb-6">
            <label className="text-sm font-bold text-[#A0A0A0] block mb-2">Total Pool Quota (GB)</label>
            <Input type="number" value={newQuota} onChange={e => setNewQuota(e.target.value)} />
          </div>
          <Button variant="primary" className="w-full" onClick={createGroup}>Create Group</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 flex justify-center">
      <div className="w-full max-w-5xl">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3 text-2xl font-bold">
            <img src="logo.jpg" alt="Famguard Logo" className="w-10 h-10" /> 
            Famguard
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#A0A0A0] text-sm hidden md:block">{user.email}</span>
            <Button variant="outline" onClick={() => auth.signOut()}>Sign Out</Button>
          </div>
        </header>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl flex justify-between items-center shadow-md">
            <div>
              <h3 className="text-[#A0A0A0] font-semibold mb-1">Active Group ID</h3>
              <h1 className="text-3xl font-bold text-[#EAB308]">{group.group_code}</h1>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="text-sm py-1" onClick={copyCode}><Copy size={16}/> Copy</Button>
              <Button variant={group.locked ? 'danger' : 'primary'} className="text-sm py-1" onClick={toggleLock}>
                {group.locked ? <><Lock size={16}/> Locked</> : <><Unlock size={16}/> Open</>}
              </Button>
            </div>
          </div>

          <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl shadow-md">
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
              <div 
                className={`h-full transition-all duration-500 ${poolPercent > 90 ? 'bg-[#EF4444] animate-pulse' : poolPercent > 70 ? 'bg-[#F59E0B]' : 'bg-[#EAB308]'}`}
                style={{ width: `${poolPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Broadcast Note */}
        <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl mb-6 shadow-md">
          <h3 className="font-semibold mb-4">Admin Note to Members</h3>
          <textarea 
            className="w-full p-3 bg-[#121212] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-[#EAB308] mb-3"
            rows="2" value={adminNote} onChange={e => setAdminNote(e.target.value)}
          ></textarea>
          <Button variant="primary" onClick={broadcastNote}>Save & Broadcast</Button>
        </div>

        {/* Member Table */}
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl mb-6 shadow-md overflow-hidden">
          <div className="p-6 border-b border-[#333333]">
            <h3 className="font-semibold">{members.length} Members Connected</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#262626] text-[#A0A0A0] text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">First Joined</th>
                  <th className="p-4 font-medium">Last Sync</th>
                  <th className="p-4 font-medium w-1/4">Data Used</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333333]">
                {members.map(member => {
                  const dataUsed = member.data_gb || 0;
                  const memberSharePercent = Math.min((dataUsed / safeQuota) * 100, 100);
                  const isPaused = member.isPaused || false;

                  return (
                    <tr key={member.uid} className="hover:bg-[#262626] transition-colors group/row">
                      <td className="p-4">
                        <div className="font-bold text-white">{member.name || "Unknown"}</div>
                        <div className="text-xs text-[#A0A0A0]">{member.device_model || "Unknown Device"}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-bold uppercase rounded-md border ${isPaused ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]' : 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]'}`}>
                          {isPaused ? 'Paused' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#A0A0A0]">{member.joined_at ? new Date(member.joined_at).toLocaleString() : "Unknown"}</td>
                      <td className="p-4 text-sm text-[#A0A0A0]">{member.last_updated ? new Date(member.last_updated).toLocaleString() : "Never"}</td>
                      <td className="p-4">
                        <div className="font-bold text-sm mb-1">{dataUsed.toFixed(2)} GB</div>
                        <div className="h-1.5 w-full bg-[#121212] rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${memberSharePercent > 50 ? 'bg-[#EF4444]' : memberSharePercent > 25 ? 'bg-[#F59E0B]' : 'bg-[#EAB308]'}`}
                            style={{ width: `${memberSharePercent}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="relative inline-block text-left">
                          <button onClick={() => setDialog({ show: true, type: 'memberMenu', data: member })} className="text-[#A0A0A0] hover:text-white p-2">
                            <MoreVertical size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && (
                  <tr><td colSpan="6" className="p-8 text-center text-[#A0A0A0]">No members connected yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-[#EF4444] p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-md">
          <div className="mb-4 sm:mb-0">
            <h3 className="text-[#EF4444] font-bold text-lg mb-1 flex items-center gap-2"><AlertTriangle size={20}/> Danger Zone</h3>
            <div className="text-[#A0A0A0] text-sm">Delete your admin account, group pool, and all member details permanently.</div>
          </div>
          <Button variant="danger" onClick={() => setDialog({ show: true, type: 'deleteAdmin' })}>Delete Account & Group</Button>
        </div>
      </div>

      {/* --- CUSTOM DIALOGS --- */}
      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-xl w-full max-w-sm shadow-2xl">
            
            {dialog.type === 'editQuota' && (
              <>
                <h3 className="text-lg font-bold mb-4">Edit Pool Quota</h3>
                <Input type="number" value={dialogInput} onChange={e => setDialogInput(e.target.value)} placeholder="Total GB" autoFocus />
                <div className="flex gap-3 justify-end mt-4">
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button variant="primary" onClick={updateQuota}>Save</Button>
                </div>
              </>
            )}

            {dialog.type === 'memberMenu' && (
              <>
                <h3 className="text-lg font-bold mb-4">Manage {dialog.data.name}</h3>
                <div className="flex flex-col gap-2">
                  <Button variant={dialog.data.isPaused ? 'primary' : 'warning'} onClick={() => togglePauseMember(dialog.data.uid, dialog.data.isPaused)}>
                    {dialog.data.isPaused ? <><Play size={16}/> Resume Access</> : <><Pause size={16}/> Pause Access</>}
                  </Button>
                  <Button variant="danger" onClick={() => setDialog({ show: true, type: 'deleteMember', data: dialog.data })}>
                    <Trash2 size={16}/> Delete Member
                  </Button>
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                </div>
              </>
            )}

            {dialog.type === 'deleteMember' && (
              <>
                <h3 className="text-[#EF4444] font-bold mb-2 flex items-center gap-2"><AlertTriangle size={20}/> Confirm Deletion</h3>
                <p className="text-sm text-[#A0A0A0] mb-6">Are you sure you want to permanently delete this device? Their data usage will be removed from the total pool.</p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button variant="danger" onClick={deleteMember}>Delete</Button>
                </div>
              </>
            )}

            {dialog.type === 'deleteAdmin' && (
              <>
                <h3 className="text-[#EF4444] font-bold mb-2 flex items-center gap-2"><AlertTriangle size={20}/> WARNING</h3>
                <p className="text-sm text-[#A0A0A0] mb-6">This will permanently delete your Admin Account, your Data Group, and disconnect ALL members. This action CANNOT be undone. Proceed?</p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button variant="danger" onClick={deleteAdminAccount}>Delete Everything</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-[#1E1E1E] border-[#EF4444] text-[#EF4444]' : 'bg-[#1E1E1E] border-[#EAB308] text-[#EAB308]'}`}>
          {toast.type === 'error' ? <AlertTriangle size={20}/> : <CheckCircle size={20}/>}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
