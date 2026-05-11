import { FileText, Search, Filter, AlertTriangle, User } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";

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
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, "logs"),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const fetchedLogs = snapshot.docs.map((doc) => {
          const data = doc.data();
          const dateStr = data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleString() : "Unknown time";
          return {
            id: doc.id,
            action: data.action || "System Action",
            type: data.type || "System",
            user: data.userId || "system",
            details: data.details || "",
            level: data.level || "info",
            time: dateStr,
          } as LogEntry;
        });

        if (fetchedLogs.length > 0) {
          setLogs(fetchedLogs);
        } else {
          // Mock fallback if empty
          setLogs([
            { id: "LOG-9281", type: "Security", action: "Admin Login", user: "system_admin", details: "Successful login from 192.168.1.1", time: "2 mins ago", level: "info" },
            { id: "LOG-9280", type: "Financial", action: "Payout Approved", user: "system_admin", details: "Approved payout batch #B4502 for City Pharmacy", time: "1 hour ago", level: "warning" },
            { id: "LOG-9279", type: "System", action: "Role Modified", user: "super_admin", details: "Changed 'Ahmed Hassan' role to Verified_Driver", time: "3 hours ago", level: "critical" },
            { id: "LOG-9278", type: "Pharmacy", action: "Inventory Bulk Update", user: "pharmacy_1102", details: "Updated prices for 45 items via API", time: "5 hours ago", level: "info" },
          ]);
        }
      } catch (err) {
        console.error("Error fetching logs", err);
        setLogs([
            { id: "LOG-9281", type: "Security", action: "Admin Login", user: "system_admin", details: "Successful login from 192.168.1.1", time: "2 mins ago", level: "info" },
            { id: "LOG-9280", type: "Financial", action: "Payout Approved", user: "system_admin", details: "Approved payout batch #B4502 for City Pharmacy", time: "1 hour ago", level: "warning" },
        ]);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 text-2xl mb-1">Audit & Security Logs</h1>
         <p className="text-gray-500 text-sm mb-6">Trace application activity, role changes, and alerts</p>
         
         <div className="flex gap-4 max-w-xl">
           <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Search by ID, User, Action..." className="w-full bg-gray-50 border border-gray-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
           </div>
           <button className="w-10 h-10 flex items-center justify-center bg-gray-100 border border-gray-200 hover:bg-gray-200 rounded-xl text-gray-600 transition">
              <Filter size={18} />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-4">
         {logs.map((log, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
               <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                     <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                        ${log.level === 'critical' ? 'bg-red-100 text-red-700' : 
                          log.level === 'warning' ? 'bg-orange-100 text-orange-700' : 
                          'bg-blue-100 text-blue-700'}`}>
                        {log.level}
                     </span>
                     <span className="text-xs font-bold text-gray-900">{log.action}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{log.time}</span>
               </div>
               
               <p className="text-sm text-gray-600 mb-3">{log.details}</p>
               
               <div className="flex items-center justify-between border-t border-gray-50 pt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5 font-medium bg-gray-50 px-2 py-1 rounded-md">
                     <User size={12} /> {log.user}
                  </div>
                  <span className="font-mono text-[10px]">{log.id}</span>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
}
