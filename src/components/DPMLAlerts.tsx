import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function DPMLAlertBanner() {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('dpml_alertes')
        .select('*')
        .eq('statut', 'Actif')
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setActiveAlerts(data);
      }
    };

    fetchAlerts();

    // Set up realtime subscription
    const subscription = supabase
      .channel('dpml_alertes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dpml_alertes' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
            Alerte(s) Critique(s) DPML (Quarantaine requise)
          </h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-200">
            <ul className="list-disc pl-5 space-y-2">
              {activeAlerts.map(alert => (
                <li key={alert.id}>
                  <strong>{alert.titre}</strong> - Lot concerné: {alert.num_lot_concerne} 
                  {alert.dci_concerne ? ` (DCI: ${alert.dci_concerne})` : ''} 
                  <br />
                  <span className="text-xs opacity-90">{alert.description}</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 uppercase tracking-wide">
                      Action requise: {alert.action_requise}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DPMLDashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('dpml_alertes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAlerts(data);
      }
      setLoading(false);
    };

    fetchAlerts();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
            Vigilance DPML
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Registre officiel des alertes et retraits de lots du Ministère de la Santé
          </p>
        </div>
      </div>
      
      <div className="p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Aucune alerte DPML enregistrée.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {alerts.map(alert => (
              <div key={alert.id} className="p-6 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                         alert.statut === 'Actif' 
                           ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                           : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
                       }`}>
                         {alert.statut}
                       </span>
                       <span className="text-sm text-gray-500 dark:text-gray-400">
                         {new Date(alert.date_alerte).toLocaleDateString()}
                       </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {alert.titre}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {alert.description}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Numéro de Lot</span>
                        <span className="block text-sm text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded inline-block mt-1">
                          {alert.num_lot_concerne}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cible</span>
                        <span className="block text-sm text-gray-900 dark:text-white mt-1">
                          {alert.dci_concerne ? `DCI: ${alert.dci_concerne}` : `Médicament: ${alert.nom_commercial_concerne}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-6 flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                      {alert.action_requise}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
