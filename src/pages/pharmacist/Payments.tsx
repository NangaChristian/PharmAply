import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, DollarSign, Download, Filter } from 'lucide-react';

export function PharmacistPayments() {
  const { t } = useTranslation();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <CreditCard size={24} />
            </div>
            {t('payments', 'Payments')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('manage_payments_desc', 'Track your payments and transactions.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
            <Filter size={16} />
            {t('filter', 'Filter')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
            <Download size={16} />
            {t('export', 'Export')}
          </button>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('available_balance', 'Available Balance')}</p>
           <h3 className="text-2xl font-bold text-gray-900 dark:text-white">0.00 $</h3>
           <button className="mt-4 w-full py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium text-sm rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition">
             {t('withdraw', 'Withdraw')}
           </button>
        </div>
        
         <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('pending_clearance', 'Pending Clearance')}</p>
           <h3 className="text-2xl font-bold text-gray-900 dark:text-white">0.00 $</h3>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('total_withdrawn', 'Total Withdrawn')}</p>
           <h3 className="text-2xl font-bold text-gray-900 dark:text-white">0.00 $</h3>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('platform_fees', 'Platform Fees')}</p>
           <h3 className="text-2xl font-bold text-gray-900 dark:text-white">0.00 $</h3>
        </div>
      </div>

       <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
           <h3 className="font-bold text-gray-900 dark:text-white">{t('recent_transactions', 'Recent Transactions')}</h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('transaction_id', 'Transaction ID')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('date', 'Date')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('amount', 'Amount')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status', 'Status')}</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('type', 'Type')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {t('no_transactions_found', 'No transactions found.')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
