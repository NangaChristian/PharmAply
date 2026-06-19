import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Download } from 'lucide-react';

export function PharmacistCustomers() {
  const { t } = useTranslation();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Users size={24} />
            </div>
            {t('customers', 'Customers')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('manage_customers_desc', 'View and manage your customer list.')}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
          <Download size={16} />
          {t('export', 'Export')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder={t('search_customers', 'Search customers by name or phone...')}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('customer', 'Customer')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('contact', 'Contact')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('total_orders', 'Total Orders')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('total_spent', 'Total Spent')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('last_order', 'Last Order')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {t('no_customers_found', 'No customers found.')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
