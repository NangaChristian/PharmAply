import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export function PharmacistSales() {
  const { t } = useTranslation();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <BarChart2 size={24} />
            </div>
            {t('sales', 'Sales')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('monitor_sales_desc', 'Monitor your sales performance.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
            <Calendar size={16} />
            {t('this_month', 'This Month')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('total_revenue', 'Total Revenue')}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(0)}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-medium">
            <TrendingUp size={16} /> 0% {t('vs_last_month', 'vs last month')}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
           <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('items_sold', 'Items Sold')}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">0</h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 font-medium">
             {t('no_data_yet', 'No data yet')}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
           <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('refunds', 'Refunds')}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">0</h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 font-medium">
              {t('no_data_yet', 'No data yet')}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8 text-center text-gray-500 h-64 flex items-center justify-center">
        {t('chart_placeholder', 'Sales chart will appear here.')}
      </div>
    </div>
  );
}
