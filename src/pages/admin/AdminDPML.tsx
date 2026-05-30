import React from 'react';
import { DPMLDashboard } from '../../components/DPMLAlerts';

export function AdminDPML() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conformité DPML</h1>
        <p className="text-gray-500 dark:text-gray-400">Réglementation et alertes de santé publique</p>
      </div>

      <DPMLDashboard />
    </div>
  );
}
