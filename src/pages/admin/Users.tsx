import { Search, Store, ShieldCheck, User, ShieldAlert, CheckCircle, Truck, Ban, Trash2, Filter, CheckSquare, CircleDollarSign, X, FileText, VenetianMask } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, updateDoc, where, onSnapshot, deleteDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { format } from 'date-fns';
import { parseDate } from '../../lib/utils';
import { useNavigate } from "react-router-dom";

export function AdminUsers({ type = 'all' }: { type?: 'vendors' | 'clients' | 'drivers' | 'all' | 'cashiers' }) {
  const { t } = useTranslation();
  const { user, impersonateUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<'users' | 'approvals'>('users');
  const [viewDocumentUrl, setViewDocumentUrl] = useState<string | null>(null);
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const getTitle = () => {
    switch (type) {
      case 'vendors': return t('admin_manage_vendors', 'Gestion Vendeurs');
      case 'clients': return t('admin_manage_clients', 'Gestion Clients');
      case 'drivers': return t('admin_manage_drivers', 'Gestion Livreurs');
      case 'cashiers': return t('admin_manage_cashiers', 'Gestion Caissiers');
      default: return t('admin_users_entities', 'Users & Entities');
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const fetchedUsers: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(fetchedUsers);
      const pendingDrivers = fetchedUsers.filter(u => u.role === 'driver' && u.status === 'pending_verification');
      setDrivers(pendingDrivers);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    const pQ = query(collection(db, 'pharmacies'), where('status', '==', 'pending_verification'));
    const unsubscribePharmacies = onSnapshot(pQ, (pSnapshot) => {
      const fetchedPharmacies = pSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPharmacies(fetchedPharmacies);
    });

    return () => {
      unsubscribeUsers();
      unsubscribePharmacies();
    };
  }, [user]);

  const handleApprovePharmacy = async (pharmacyId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'pharmacies', pharmacyId), { status: 'approved' });
      await updateDoc(doc(db, 'users', userId), { status: 'approved' });
      setPharmacies(pharmacies.filter(p => p.id !== pharmacyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'pharmacies');
    }
  };
  
  const handleApproveDriver = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'approved' });
      setDrivers(drivers.filter(d => d.id !== userId));
      setUsers(users.map(u => u.id === userId ? { ...u, status: 'approved' } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm(t('confirm_delete_user', 'Are you sure you want to permanently delete this user?'))) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const handleImpersonate = (u: any) => {
    const targetUser = {
      uid: u.id,
      email: u.email,
      emailVerified: true,
      displayName: u.name,
      photoURL: null,
    };
    impersonateUser(targetUser, u.role || 'patient');
    navigate('/');
  };

  const handleBulkAction = async (action: 'approve' | 'suspend' | 'delete' | 'make_cashier') => {
    if (!selectedUsers.length) return;
    
    if (action === 'approve') {
       for (const uId of selectedUsers) {
         try {
           await updateDoc(doc(db, 'users', uId), { status: 'approved' });
         } catch (e) {
           console.error("Bulk approve failed for", uId);
         }
       }
       setUsers(users.map(u => selectedUsers.includes(u.id) ? { ...u, status: 'approved' } : u));
    } else if (action === 'suspend') {
       for (const uId of selectedUsers) {
         try {
           await updateDoc(doc(db, 'users', uId), { status: 'suspended' });
         } catch (e) {
           console.error("Bulk suspend failed for", uId);
         }
       }
       setUsers(users.map(u => selectedUsers.includes(u.id) ? { ...u, status: 'suspended' } : u));
    } else if (action === 'make_cashier') {
       for (const uId of selectedUsers) {
         try {
           await updateDoc(doc(db, 'users', uId), { role: 'cashier' });
         } catch (e) {
           console.error("Bulk make cashier failed for", uId);
         }
       }
       setUsers(users.map(u => selectedUsers.includes(u.id) ? { ...u, role: 'cashier' } : u));
    } else if (action === 'delete') {
       if (!window.confirm(t('confirm_bulk_delete_user', 'Are you sure you want to continuously delete selected users?'))) return;
       for (const uId of selectedUsers) {
         try {
           await deleteDoc(doc(db, 'users', uId));
         } catch (e) {
           console.error("Bulk delete failed for", uId);
         }
       }
       setUsers(users.filter(u => !selectedUsers.includes(u.id)));
    }
    setSelectedUsers([]);
  };

  const toggleSelectUser = (id: string) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(uId => uId !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const getFilteredUsers = () => {
    let baseFiltered = users;
    if (type === 'vendors') baseFiltered = users.filter((u) => u.role === 'pharmacy');
    if (type === 'clients') baseFiltered = users.filter((u) => u.role === 'patient');
    if (type === 'drivers') baseFiltered = users.filter((u) => u.role === 'driver');
    if (type === 'cashiers') baseFiltered = users.filter((u) => u.role === 'cashier');
    
    if (statusFilter !== 'all') {
      baseFiltered = baseFiltered.filter((u) => (u.status || 'approved') === statusFilter);
    }
    
    if (roleFilter !== 'all' && type === 'all') {
      baseFiltered = baseFiltered.filter((u) => u.role === roleFilter);
    }
    
    return baseFiltered.filter(u => 
      (u.name?.toLowerCase() || '').includes(search.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(search.toLowerCase())
    );
  };
  
  const filteredUsers = getFilteredUsers();
  const allSelected = filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending_verification':
        return <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold uppercase tracking-wider"> {t('pending_kyc', 'Pending KYC')} </span>;
      case 'suspended':
        return <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider"> {t('suspended', 'Suspended')} </span>;
      default:
        return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wider"> {t('active', 'Active')} </span>;
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-0 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-6">{getTitle()}</h1>
         <div className="flex gap-6 border-b-0 border-gray-100">
            <button 
               onClick={() => setActiveTab('users')} 
               className={`pb-3 text-sm font-bold border-b-2 ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
                {t('profiles', 'Profiles')} </button>
            {type !== 'clients' && type !== 'cashiers' && (
              <button 
                 onClick={() => setActiveTab('approvals')} 
                 className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 ${activeTab === 'approvals' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              >
                  {t('kyc_approvals', 'KYC Approvals')} {(type === 'vendors' && pharmacies.length > 0) && <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">{pharmacies.length}</span>}
                 {(type === 'drivers' && drivers.length > 0) && <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">{drivers.length}</span>}
                 {(type === 'all' && (pharmacies.length + drivers.length) > 0) && <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">{pharmacies.length + drivers.length}</span>}
              </button>
            )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
         {activeTab === 'users' ? (
           <>
             <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
               <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                 <div className="relative max-w-md w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder={t('search_users', 'Search users...')} 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-gray-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-slate-400" 
                    />
                 </div>
                 
                 <div className="flex gap-2">
                   <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white dark:bg-zinc-950 border border-gray-200 py-2.5 pl-9 pr-8 rounded-xl text-sm appearance-none outline-none focus:border-slate-400"
                      >
                         <option value="all">{t('all_status', 'All Status')}</option>
                         <option value="approved"> {t('active', 'Active')} </option>
                         <option value="pending_verification"> {t('pending_kyc', 'Pending KYC')} </option>
                         <option value="suspended"> {t('suspended', 'Suspended')} </option>
                      </select>
                   </div>
                   {type === 'all' && (
                     <select 
                        value={roleFilter} 
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-white dark:bg-zinc-950 border border-gray-200 py-2.5 px-4 rounded-xl text-sm outline-none focus:border-slate-400"
                      >
                         <option value="all">{t('all_roles', 'All Roles')}</option>
                         <option value="patient">{t('role_patient', 'Patient')}</option>
                         <option value="pharmacy">{t('role_pharmacy', 'Pharmacy')}</option>
                         <option value="driver">{t('role_driver', 'Driver')}</option>
                         <option value="admin">{t('role_admin', 'Admin')}</option>
                         <option value="cashier">{t('role_cashier', 'Cashier')}</option>
                      </select>
                   )}
                 </div>
               </div>
               
               {selectedUsers.length > 0 && (
                 <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-sm border border-indigo-100">
                    <span className="font-bold text-indigo-900 border-r border-indigo-200 pr-3 mr-1">{selectedUsers.length}  {t('selected', 'selected')} </span>
                    <button onClick={() => handleBulkAction('approve')} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition" title={t('approve', 'Approve')}><CheckCircle size={18} /></button>
                    <button onClick={() => handleBulkAction('suspend')} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition" title={t('suspend', 'Suspend')}><Ban size={18} /></button>
                    <button onClick={() => handleBulkAction('make_cashier')} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition" title={t('make_cashier', 'Make Cashier')}><CircleDollarSign size={18} /></button>
                    <button onClick={() => handleBulkAction('delete')} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition" title={t('delete', 'Delete')}><Trash2 size={18} /></button>
                 </div>
               )}
             </div>

             <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100">
                         <tr>
                            <th className="py-4 px-6 font-semibold w-12">
                              <button onClick={toggleSelectAll} className="block text-gray-400 hover:text-indigo-600">
                                {allSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <div className="w-[18px] h-[18px] border-2 border-gray-300 rounded-[4px]"></div>}
                              </button>
                            </th>
                            <th className="py-4 px-6 font-semibold">{t('user_label', 'User')}</th>
                            <th className="py-4 px-6 font-semibold">{t('role_label', 'Role')}</th>
                            <th className="py-4 px-6 font-semibold">{t('status_label', 'Status')}</th>
                            <th className="py-4 px-6 font-semibold">{t('joined_label', 'Joined')}</th>
                            <th className="py-4 px-6 font-semibold text-right">{t('actions_label', 'Actions')}</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">{t('loading_users', 'Loading users...')}</td></tr> : 
                         filteredUsers.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">{t('no_users_found', 'No users found.')}</td></tr> :
                         filteredUsers.map((u) => {
                           const isSelected = selectedUsers.includes(u.id);
                           return (
                             <tr key={u.id} onClick={() => toggleSelectUser(u.id)} className={`cursor-pointer hover:bg-gray-100 dark:bg-zinc-800/80 transition-colors even:bg-gray-50 dark:bg-zinc-900/30 ${isSelected ? 'bg-indigo-50/40 even:bg-indigo-50/40' : ''}`}>
                                <td className="py-4 px-6">
                                  <button onClick={(e) => { e.stopPropagation(); toggleSelectUser(u.id); }} className="block text-gray-400 hover:text-indigo-600">
                                    {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <div className="w-[18px] h-[18px] border-2 border-gray-300 rounded-[4px]"></div>}
                                  </button>
                                </td>
                                <td className="py-4 px-6">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold shrink-0">
                                         {u.name ? u.name.charAt(0).toUpperCase() : <User size={18} />}
                                      </div>
                                      <div>
                                         <h3 className="font-bold text-gray-900 dark:text-white text-sm">{u.name || 'Unknown User'}</h3>
                                         <p className="text-xs text-gray-500">{u.email}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="py-4 px-6">
                                   <select 
                                     value={u.role || 'patient'} 
                                     onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                     onClick={(e) => e.stopPropagation()}
                                     className="text-xs bg-white dark:bg-zinc-950 border border-gray-200 rounded-lg py-1.5 px-2 outline-none focus:ring-2 focus:ring-indigo-100"
                                   >
                                     <option value="patient">{t('role_patient', 'Patient')}</option>
                                     <option value="pharmacy">{t('role_pharmacy', 'Pharmacy')}</option>
                                     <option value="driver">{t('role_driver', 'Driver')}</option>
                                     <option value="admin">{t('role_admin', 'Admin')}</option>
                                     <option value="cashier">{t('role_cashier', 'Cashier')}</option>
                                   </select>
                                </td>
                                <td className="py-4 px-6">
                                   {getStatusBadge(u.status || 'approved')}
                                </td>
                                <td className="py-4 px-6 text-gray-500 whitespace-nowrap">
                                   {parseDate(u.createdAt) ? format(parseDate(u.createdAt)!, 'MMM d, yyyy') : 'Unknown'}
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleImpersonate(u);
                                       }}
                                       className="p-1.5 rounded-lg border transition-colors text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100"
                                       title={t('impersonate', 'Impersonate')}
                                     >
                                       <VenetianMask size={16} />
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleStatusChange(u.id, u.status === 'suspended' ? 'approved' : 'suspended');
                                       }}
                                       className={`p-1.5 rounded-lg border transition-colors ${
                                         u.status === 'suspended' 
                                           ? 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100' 
                                           : 'text-amber-600 bg-amber-50 border-amber-100 hover:bg-amber-100'
                                       }`}
                                       title={u.status === 'suspended' ? "Unsuspend" : "Suspend"}
                                     >
                                       {u.status === 'suspended' ? <CheckCircle size={16} /> : <Ban size={16} />}
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleDeleteUser(u.id);
                                       }}
                                       className="p-1.5 rounded-lg border transition-colors text-red-600 bg-red-50 border-red-100 hover:bg-red-100"
                                       title={t('delete', 'Delete')}
                                     >
                                       <Trash2 size={16} />
                                     </button>
                                  </div>
                                </td>
                             </tr>
                           )
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
           </>
         ) : (
           <div className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('pending_bg_checks', 'Pending Background Checks')}</h3>
              {loading ? <p className="text-sm text-gray-500">{t('loading', 'Loading...')}</p> :
               (pharmacies.length === 0 && drivers.length === 0) ? (
                 <div className="text-center py-12 px-6 bg-white dark:bg-zinc-950 rounded-2xl border border-gray-dashed">
                    <ShieldCheck size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">{t('all_operations_reviewed', 'All operations have been reviewed.')}</p>
                 </div>
               ) : (
                 <>
                   {(type === 'all' || type === 'vendors') && pharmacies.map((pharmacy) => (
                     <div key={pharmacy.id} className="bg-white dark:bg-zinc-950 rounded-2xl p-5 shadow-sm border border-orange-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-orange-100 text-orange-600 font-bold text-[10px] px-3 py-1 rounded-bl-xl uppercase"> {t('pharmacy_review', 'Pharmacy Review')} </div>
                        
                        <div className="flex items-center gap-3 mb-4">
                           <div className="w-12 h-12 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-xl">
                              <Store size={24} />
                           </div>
                           <div>
                              <h4 className="font-bold text-gray-900 dark:text-white text-lg">{pharmacy.name}</h4>
                              <p className="text-xs text-gray-500">{pharmacy.address}</p>
                           </div>
                        </div>
                        
                        <div className="space-y-2 mb-6">
                           <div className="flex justify-between text-sm">
                              <span className="text-gray-500"> {t('rccm_registration', 'RCCM / Registration:')} </span>
                              <span className="font-bold text-gray-900 dark:text-white">{pharmacy.registrationNumber}</span>
                           </div>
                           <div className="flex justify-between text-sm">
                              <span className="text-gray-500"> {t('phone', 'Phone:')} </span>
                              <span className="font-bold text-gray-900 dark:text-white">{pharmacy.phoneNumber}</span>
                           </div>
                           <div className="flex justify-between items-start text-sm">
                              <span className="text-gray-500 mt-1"> {t('license', 'License:')} </span>
                              {pharmacy.operatingLicenseUrl ? (
                                <button onClick={() => setViewDocumentUrl(pharmacy.operatingLicenseUrl)} className="flex flex-col items-end gap-1 group">
                                  <div className="w-24 h-16 rounded bg-gray-50 dark:bg-zinc-900 overflow-hidden border border-gray-200 group-hover:border-indigo-400 transition relative flex items-center justify-center">
                                    {pharmacy.operatingLicenseUrl.toLowerCase().includes('.pdf') ? (
                                      <FileText size={24} className="text-gray-400" />
                                    ) : (
                                      <img src={pharmacy.operatingLicenseUrl} alt="License" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                      <Search size={16} className="text-white" />
                                    </div>
                                  </div>
                                  <span className="font-bold text-xs text-indigo-600"> {t('view_document', 'View Document')} </span>
                                </button>
                              ) : (
                                <span className="text-gray-400 mt-1"> {t('not_uploaded', 'Not uploaded')} </span>
                              )}
                           </div>
                           <div className="flex justify-between items-start text-sm">
                              <span className="text-gray-500 mt-1"> {t('taxpayer_card', 'Taxpayer Card:')} </span>
                              {pharmacy.taxpayerCardUrl ? (
                                <button onClick={() => setViewDocumentUrl(pharmacy.taxpayerCardUrl)} className="flex flex-col items-end gap-1 group">
                                  <div className="w-24 h-16 rounded bg-gray-50 dark:bg-zinc-900 overflow-hidden border border-gray-200 group-hover:border-indigo-400 transition relative flex items-center justify-center">
                                    {pharmacy.taxpayerCardUrl.toLowerCase().includes('.pdf') ? (
                                      <FileText size={24} className="text-gray-400" />
                                    ) : (
                                      <img src={pharmacy.taxpayerCardUrl} alt="Taxpayer Card" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                      <Search size={16} className="text-white" />
                                    </div>
                                  </div>
                                  <span className="font-bold text-xs text-indigo-600"> {t('view_document', 'View Document')} </span>
                                </button>
                              ) : (
                                <span className="text-gray-400 mt-1"> {t('not_uploaded', 'Not uploaded')} </span>
                              )}
                           </div>
                           <div className="bg-gray-50 dark:bg-zinc-900 p-3 rounded-xl mt-2 flex items-start gap-2">
                              <ShieldAlert size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-gray-600"> {t('ensure_the_rccm_number_matches', 'Ensure the RCCM number matches official Cameroon business registries before approval.')} </p>
                           </div>
                        </div>
                        
                        <div className="flex gap-3">
                           <button className="flex-1 py-3 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-xl transition text-sm"> {t('reject', 'Reject')} </button>
                           <button onClick={() => handleApprovePharmacy(pharmacy.id, pharmacy.ownerId)} className="flex-1 py-3 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl transition text-sm flex items-center justify-center gap-2">
                             <CheckCircle size={16} />  {t('approve', 'Approve')} </button>
                        </div>
                     </div>
                   ))}

                   {(type === 'all' || type === 'drivers') && drivers.map((driver) => (
                     <div key={driver.id} className="bg-white dark:bg-zinc-950 rounded-2xl p-5 shadow-sm border border-blue-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 font-bold text-[10px] px-3 py-1 rounded-bl-xl uppercase"> {t('driver_check', 'Driver Check')} </div>
                        
                        <div className="flex items-center gap-3 mb-4">
                           <div className="w-12 h-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl">
                              <Truck size={24} />
                           </div>
                           <div>
                              <h4 className="font-bold text-gray-900 dark:text-white text-lg">{driver.name}</h4>
                              <p className="text-xs text-gray-500">{driver.email}</p>
                           </div>
                        </div>
                        
                        <div className="space-y-2 mb-6">
                           <div className="flex justify-between items-start text-sm">
                              <span className="text-gray-500 mt-1"> {t('national_id', 'National ID:')} </span>
                              {driver.nationalIdUrl ? (
                                <button onClick={() => setViewDocumentUrl(driver.nationalIdUrl)} className="flex flex-col items-end gap-1 group">
                                  <div className="w-24 h-16 rounded bg-gray-50 dark:bg-zinc-900 overflow-hidden border border-gray-200 group-hover:border-blue-400 transition relative flex items-center justify-center">
                                    {driver.nationalIdUrl.toLowerCase().includes('.pdf') ? (
                                      <FileText size={24} className="text-gray-400" />
                                    ) : (
                                      <img src={driver.nationalIdUrl} alt="National ID" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                      <Search size={16} className="text-white" />
                                    </div>
                                  </div>
                                  <span className="font-bold text-xs text-blue-600"> {t('view_document', 'View Document')} </span>
                                </button>
                              ) : (
                                <span className="text-gray-400 mt-1"> {t('not_uploaded', 'Not uploaded')} </span>
                              )}
                           </div>
                           <div className="flex justify-between items-start text-sm">
                              <span className="text-gray-500 mt-1"> {t('driver_license', 'Driver License:')} </span>
                              {driver.driverLicenseUrl ? (
                                <button onClick={() => setViewDocumentUrl(driver.driverLicenseUrl)} className="flex flex-col items-end gap-1 group">
                                  <div className="w-24 h-16 rounded bg-gray-50 dark:bg-zinc-900 overflow-hidden border border-gray-200 group-hover:border-blue-400 transition relative flex items-center justify-center">
                                    {driver.driverLicenseUrl.toLowerCase().includes('.pdf') ? (
                                      <FileText size={24} className="text-gray-400" />
                                    ) : (
                                      <img src={driver.driverLicenseUrl} alt="Driver License" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                      <Search size={16} className="text-white" />
                                    </div>
                                  </div>
                                  <span className="font-bold text-xs text-blue-600"> {t('view_document', 'View Document')} </span>
                                </button>
                              ) : (
                                <span className="text-gray-400 mt-1"> {t('not_uploaded', 'Not uploaded')} </span>
                              )}
                           </div>
                           <div className="bg-gray-50 dark:bg-zinc-900 p-3 rounded-xl mt-2 flex items-start gap-2">
                              <ShieldAlert size={16} className="text-blue-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-gray-600"> {t('please_verify_both_ids_are_cle', 'Please verify both IDs are clear, match the applicant\'s name, and are currently valid.')} </p>
                           </div>
                        </div>
                        
                        <div className="flex gap-3">
                           <button className="flex-1 py-3 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-xl transition text-sm"> {t('reject', 'Reject')} </button>
                           <button onClick={() => handleApproveDriver(driver.id)} className="flex-1 py-3 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-xl transition text-sm flex items-center justify-center gap-2">
                             <CheckCircle size={16} />  {t('approve_driver', 'Approve Driver')} </button>
                        </div>
                     </div>
                   ))}
                 </>
               )
              }
           </div>
         )}
      </div>
      
      {/* Document Viewer Modal */}
      {viewDocumentUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setViewDocumentUrl(null)}>
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-xl drop-shadow-md"> {t('document_verification', 'Document Verification')} </h3>
              <button 
                onClick={() => setViewDocumentUrl(null)}
                className="p-2 bg-white dark:bg-zinc-950/10 hover:bg-white dark:bg-zinc-950/20 text-white rounded-full transition backdrop-blur-md"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center min-h-[50vh]">
              {viewDocumentUrl.toLowerCase().includes('.pdf') ? (
                <iframe src={`${viewDocumentUrl}#toolbar=0`} className="w-full h-[80vh] rounded-2xl bg-white dark:bg-zinc-950" title={t('document_viewer', 'Document Viewer')} />
              ) : (
                <img src={viewDocumentUrl} alt="Document View" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
              )}
            </div>
            <div className="mt-4 flex justify-between gap-4">
               <a 
                 href={viewDocumentUrl} 
                 target="_blank" 
                 rel="noreferrer" 
                 className="flex-1 py-3 bg-white dark:bg-zinc-950/10 hover:bg-white dark:bg-zinc-950/20 text-white text-center font-bold rounded-xl transition backdrop-blur-md border border-white/10"
               >
                  {t('open_in_new_tab', 'Open in New Tab')} </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
