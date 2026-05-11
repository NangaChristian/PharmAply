import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, deleteDoc, onSnapshot, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Search, MessagesSquare, Clock, CheckCircle2, User } from "lucide-react";

export function AdminSupport() {
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "support_queries"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQueries(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredQueries = queries.filter(q => 
    (q.subject?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (q.userId?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Customer Support</h1>
             <p className="text-gray-500 text-sm">Manage user queries, complaints, and requests</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
             <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search subject or user ID..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                />
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500">Loading queries...</div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold">User / ID</th>
                            <th className="py-4 px-6 font-semibold">Subject</th>
                            <th className="py-4 px-6 font-semibold">Status</th>
                            <th className="py-4 px-6 font-semibold text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredQueries.map((q) => (
                           <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-6">
                                 <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                      <User size={14} />
                                   </div>
                                   <span className="font-mono text-xs">{q.userId?.slice(0,8)}</span>
                                 </div>
                              </td>
                              <td className="py-4 px-6">
                                 <p className="font-bold text-slate-800">{q.subject || 'No Subject'}</p>
                                 <p className="text-xs text-slate-500 truncate max-w-[300px]">{q.message}</p>
                              </td>
                              <td className="py-4 px-6">
                                 {q.status === 'resolved' ? (
                                   <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold w-max">
                                     <CheckCircle2 size={12} /> Resolved
                                   </span>
                                 ) : (
                                   <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold w-max">
                                     <Clock size={12} /> Open
                                   </span>
                                 )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                 <button className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
                                    Reply
                                 </button>
                              </td>
                           </tr>
                         ))}
                         {filteredQueries.length === 0 && (
                           <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500">No support queries found.</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      </div>
    </div>
  );
}
