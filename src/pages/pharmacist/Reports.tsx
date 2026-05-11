import { BarChart3, TrendingUp, DollarSign, Package } from "lucide-react";

export function PharmacistReports() {
  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 bg-white shadow-sm z-10">
         <h1 className="font-bold text-gray-900 text-xl">Reports & Analytics</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Summary Cards */}
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
               <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-3">
                  <DollarSign size={20} />
               </div>
               <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
               <h3 className="text-xl font-bold text-gray-900 mt-1">$4,250<span className="text-xs text-gray-400 font-normal">.00</span></h3>
               <p className="text-[10px] text-green-600 bg-green-50 inline-block px-1.5 py-0.5 rounded mt-2 px-1 font-bold">+12% this week</p>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
               <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
                  <Package size={20} />
               </div>
               <p className="text-xs text-gray-500 font-medium">Orders Completed</p>
               <h3 className="text-xl font-bold text-gray-900 mt-1">142</h3>
               <p className="text-[10px] text-indigo-600 bg-indigo-50 inline-block px-1.5 py-0.5 rounded mt-2 px-1 font-bold">+5% this week</p>
            </div>
         </div>

         {/* Chart Placeholder */}
         <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-gray-900 text-sm">Sales Overview</h3>
               <select className="bg-gray-50 text-xs text-gray-600 font-bold py-1.5 px-3 rounded-lg outline-none cursor-pointer">
                  <option>This Week</option>
                  <option>This Month</option>
               </select>
            </div>
            <div className="h-40 flex items-end gap-2 justify-between px-2">
               {/* Synthetic bars */}
               <div className="w-1/6 bg-indigo-100 rounded-t-lg h-12 relative group"><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">$120</div></div>
               <div className="w-1/6 bg-indigo-100 rounded-t-lg h-24 relative group"><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">$240</div></div>
               <div className="w-1/6 bg-indigo-100 rounded-t-lg h-16 relative group"><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">$160</div></div>
               <div className="w-1/6 bg-indigo-600 rounded-t-lg h-32 relative shadow-lg shadow-indigo-200"><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-indigo-600">$320</div></div>
               <div className="w-1/6 bg-indigo-100 rounded-t-lg h-20 relative group"><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">$200</div></div>
               <div className="w-1/6 bg-indigo-100 rounded-t-lg h-10 relative group"><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">$100</div></div>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-2 px-2 uppercase">
               <span>Mon</span>
               <span>Tue</span>
               <span>Wed</span>
               <span className="text-indigo-600">Thu</span>
               <span>Fri</span>
               <span>Sat</span>
            </div>
         </div>

         {/* Withdrawals */}
         <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
               <div>
                  <h3 className="font-bold text-gray-900 text-sm">Available for Withdrawal</h3>
                  <p className="font-bold text-green-600 text-xl mt-1">$1,250.00</p>
               </div>
               <button className="bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-xl">Withdraw</button>
            </div>
         </div>
         
         <div className="h-8"></div>
      </div>
    </div>
  );
}
