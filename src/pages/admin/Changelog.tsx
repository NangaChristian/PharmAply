import { History, Star, Bug, Rocket } from "lucide-react";

export function AdminChangelog() {
  const versions = [
    {
      version: "v2.1.0",
      date: "May 8, 2026",
      type: "feature",
      title: "Delivery Zones Upgrade",
      features: [
        "Added granular map drawing for delivery zones.",
        "Automatic surge pricing depending on active driver density.",
        "New UI for Admin Dashboard."
      ]
    },
    {
      version: "v2.0.4",
      date: "April 20, 2026",
      type: "bugfix",
      title: "Hotfix: Order Sync",
      features: [
        "Fixed a rare race condition where pharmacy accepting and driver arriving triggered simultaneously.",
        "Memory leak in driver live tracking resolved."
      ]
    },
    {
      version: "v2.0.0",
      date: "March 15, 2026",
      type: "major",
      title: "The Scalability Update",
      features: [
        "Migrated to fully typed Firebase functions.",
        "New Analytics & Reporting engine.",
        "Released iOS patient App version."
      ]
    }
  ];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 text-2xl mb-1">Changelog</h1>
         <p className="text-gray-500 text-sm">Platform updates and release notes</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
         <div className="relative border-l-2 border-slate-200 ml-4 space-y-10 py-4">
            {versions.map((ver, i) => (
              <div key={i} className="relative pl-8">
                 <div className={`absolute -left-[21px] top-0 w-10 h-10 rounded-full border-4 border-slate-50 flex items-center justify-center
                    ${ver.type === 'feature' ? 'bg-indigo-100 text-indigo-600' : ''}
                    ${ver.type === 'bugfix' ? 'bg-amber-100 text-amber-600' : ''}
                    ${ver.type === 'major' ? 'bg-emerald-100 text-emerald-600' : ''}
                 `}>
                    {ver.type === 'feature' && <Star size={16} />}
                    {ver.type === 'bugfix' && <Bug size={16} />}
                    {ver.type === 'major' && <Rocket size={16} />}
                 </div>
                 
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold text-slate-800">{ver.title}</h3>
                       <div className="text-right">
                          <span className="font-mono text-sm font-bold text-slate-900">{ver.version}</span>
                          <p className="text-xs text-slate-500">{ver.date}</p>
                       </div>
                    </div>
                    
                    <ul className="space-y-2 mt-2">
                       {ver.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                             {feat}
                          </li>
                       ))}
                    </ul>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
