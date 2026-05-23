import { FileText, Search, Filter, AlertTriangle, User, Trash2 } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, limit, getDocs, doc, deleteDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { parseDate } from '../../lib/utils';
import { useTranslation } from "react-i18next";

interface LogEntry {
  id: string;
  type: string;
  action: string;
  user: string;
  details: string;
  time: string;
  level: "info" | "warning" | "critical";
  createdAt?: any;
}

export function AdminAuditLogs() {
    const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setSearchQuery(value);
    }, 500);
  };

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = query(
        collection(db, "logs"),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      const snapshot = await getDocs(q);
      const fetchedLogs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const dateStr = parseDate(data.createdAt) ? parseDate(data.createdAt)!.toLocaleString() : "Unknown time";
        return {
          id: docSnap.id,
          action: data.action || "System Action",
          type: data.type || "System",
          user: data.userId || "system",
          details: data.details || "",
          level: data.level || "info",
          time: dateStr,
          createdAt: parseDate(data.createdAt) ? parseDate(data.createdAt)!.getTime() : 0,
        } as LogEntry;
      });

      setLogs(fetchedLogs);
    } catch (err: any) {
      console.error("Error fetching logs", err);
      setErrorMsg("Failed to load audit logs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDelete = async (logId: string) => {
    try {
      await deleteDoc(doc(db, "logs", logId));
      setLogs(prev => prev.filter(log => log.id !== logId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `logs/${logId}`);
      // fetchLogs(); // Optional: refetch logs on failure to sync state
    }
  };

  const filteredLogs = logs.filter(log => {
      const matchesSearch = 
        log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase());
        
      let matchesDate = true;
      if (startDate || endDate) {
         if (!log.createdAt) matchesDate = false;
         else {
             if (startDate && log.createdAt < new Date(startDate).getTime()) matchesDate = false;
             // Set end date to the end of the day
             if (endDate && log.createdAt > new Date(endDate).getTime() + 86400000) matchesDate = false;
         }
      }
      
      return matchesSearch && matchesDate;
  });

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1"> {t('audit_security_logs', 'Audit & Security Logs')} </h1>
         <p className="text-gray-500 text-sm mb-6"> {t('trace_application_activity_rol', 'Trace application activity, role changes, and alerts')} </p>
         
         <div className="flex flex-col lg:flex-row gap-4 lg:items-center w-full">
           <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                 type="text" 
                 value={inputValue}
                 onChange={handleSearchChange}
                 placeholder={t('search_by_id_user_action', 'Search by ID, User, Action...')} 
                 className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-slate-400" 
              />
           </div>
           
           <div className="flex items-center gap-2">
             <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 dark:bg-zinc-900 overflow-hidden">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent py-2.5 pl-3 pr-2 text-sm text-gray-600 focus:outline-none" 
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent py-2.5 pl-2 pr-3 text-sm text-gray-600 focus:outline-none" 
                />
             </div>
             
             <button className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 border border-gray-200 hover:bg-gray-200 rounded-xl text-gray-600 transition">
                <Filter size={18} />
             </button>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-4">
         {loading ? (
             <div className="text-center p-8 text-gray-500"> {t('loading_audit_logs', 'Loading audit logs...')} </div>
         ) : errorMsg ? (
             <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex flex-col items-center justify-center border border-red-100 shadow-sm text-center">
                 <AlertTriangle size={32} className="mb-2" />
                 <p className="font-bold">{errorMsg}</p>
             </div>
         ) : filteredLogs.length === 0 ? (
             <div className="text-center p-8 text-gray-500 border border-dashed border-gray-200 rounded-2xl">
                  {t('no_logs_found_matching_your_fi', 'No logs found matching your filters.')} </div>
         ) : (
             filteredLogs.map((log, i) => (
                <div key={log.id || i} className="bg-white dark:bg-zinc-950 rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition">
                   <div className="flex-1">
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                ${log.level === 'critical' ? 'bg-red-100 text-red-700' : 
                                  log.level === 'warning' ? 'bg-orange-100 text-orange-700' : 
                                  'bg-blue-100 text-blue-700'}`}>
                                {log.level}
                             </span>
                             <span className="text-xs font-bold text-gray-900 dark:text-white">{log.action}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-medium">{log.time}</span>
                       </div>
                       
                       <p className="text-sm text-gray-600 mb-3">{log.details}</p>
                       
                       <div className="flex items-center justify-between border-t border-gray-50 pt-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5 font-medium bg-gray-50 dark:bg-zinc-900 px-2 py-1 rounded-md">
                             <User size={12} /> {log.user}
                          </div>
                          <span className="font-mono text-[10px]">{log.id}</span>
                       </div>
                   </div>
                   <button 
                     onClick={() => handleDelete(log.id)}
                     className="w-10 h-10 shrink-0 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                     title={t('delete_log', 'Delete Log')}
                   >
                     <Trash2 size={18} />
                   </button>
                </div>
             ))
         )}
      </div>
    </div>
  );
}
