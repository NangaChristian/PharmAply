import { Book, Code, Terminal, Server } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AdminDocumentation() {
    const { t } = useTranslation();
  const sections = [
    {
      title: "Platform Overview",
      icon: Book,
      color: "text-blue-600",
      bg: "bg-blue-50",
      content: "PharmAply connects patients, pharmacies, and drivers. The platform handles real-time syncing for orders, GPS driver tracking, and inventory management."
    },
    {
      title: "API Integration",
      icon: Code,
      color: "text-purple-600",
      bg: "bg-purple-50",
      content: "Pharmacies can integrate their POS systems using our Webhook API. Setup can be found in the Merchant Dashboard under API Settings."
    },
    {
      title: "Driver App Setup",
      icon: Terminal,
      color: "text-orange-600",
      bg: "bg-orange-50",
      content: "Drivers must download the latest APK from the verified links and sign in using the phone number they registered in the system."
    },
    {
      title: "Server & Architecture",
      icon: Server,
      color: "text-green-600",
      bg: "bg-green-50",
      content: "The backend is entirely serverless powered by Firebase. Firestore handles real-time updates, Auth handles identity, and Cloud Functions run secure billing."
    }
  ];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1"> {t('documentation', 'Documentation')} </h1>
         <p className="text-gray-500 text-sm"> {t('system_architecture_api_docs_a', 'System architecture, API docs, and platform guidelines')} </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((sec, i) => (
               <div key={i} className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mb-4 ${sec.bg}`}>
                     <sec.icon className={sec.color} size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{sec.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{sec.content}</p>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
