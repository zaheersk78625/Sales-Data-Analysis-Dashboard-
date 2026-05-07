import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Filter, 
  Download, 
  BrainCircuit,
  BarChart3,
  PieChart as PieChartIcon,
  LayoutDashboard,
  Calendar,
  ChevronDown,
  Bell,
  BellRing,
  Settings,
  X,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  PieChart,
  Cell,
  Legend,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, startOfYear, endOfYear, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { mockSalesData, CATEGORIES, REGIONS, createRealTimeSale, type SaleRecord } from './data';
import { getSalesInsights } from './services/geminiService';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  updateDoc 
} from './lib/firebase';
import type { User } from './lib/firebase';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const KPIWebCard = ({ title, value, change, icon: Icon, color }: { 
  title: string; 
  value: string; 
  change?: string; 
  icon: any;
  color: string;
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm hover:border-zinc-700 transition-colors group"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-2 rounded-xl bg-opacity-10", color)}>
        <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
      </div>
      {change && (
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          change.startsWith('+') ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
        )}>
          {change}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <h3 className="text-zinc-400 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  </motion.div>
);

const CURRENCIES = [
  { code: 'USD', symbol: '$', rate: 1 },
  { code: 'EUR', symbol: '€', rate: 0.92 },
  { code: 'GBP', symbol: '£', rate: 0.79 },
  { code: 'JPY', symbol: '¥', rate: 151.4 },
  { code: 'INR', symbol: '₹', rate: 83.3 },
  { code: 'CAD', symbol: 'C$', rate: 1.36 },
  { code: 'AUD', symbol: 'A$', rate: 1.52 },
  { code: 'CNY', symbol: '¥', rate: 7.23 }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(mockSalesData);
  const [timeframe, setTimeframe] = useState<'Day' | 'Month' | 'Year'>('Month');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<{ insights: string[], forecast: string, recommendations: string[] } | null>(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState({
    enabled: true,
    receiver: '',
    threshold: 1000 // Alert if profit falls below this
  });

  // --- Auth & Sync ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Sync preferences from Firestore
    const userPrefDoc = doc(db, 'userPreferences', user.uid);
    
    const unsubscribeSnapshot = onSnapshot(userPrefDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setNotificationConfig({
          enabled: data.notificationEnabled ?? true,
          receiver: data.receiverEmail ?? '',
          threshold: data.profitThreshold ?? 1000
        });
        const savedCurrency = CURRENCIES.find(c => c.code === data.currency) || CURRENCIES[0];
        setCurrency(savedCurrency);
      } else {
        // Init default prefs if none exist
        setDoc(userPrefDoc, {
          userId: user.uid,
          notificationEnabled: true,
          receiverEmail: user.email || '',
          profitThreshold: 1000,
          currency: 'USD',
          updatedAt: new Date().toISOString()
        });
      }
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const savePreferences = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'userPreferences', user.uid), {
        notificationEnabled: notificationConfig.enabled,
        receiverEmail: notificationConfig.receiver,
        profitThreshold: notificationConfig.threshold,
        currency: currency.code,
        updatedAt: new Date().toISOString()
      });
      setShowNotificationSettings(false);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const triggerNotification = async (type: string, payload: string) => {
    if (!notificationConfig.enabled) return;
    
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          payload,
          receiver: notificationConfig.receiver || user?.email || undefined
        })
      });
    } catch (error) {
      console.error("Notification delivery failed:", error);
    }
  };

  const exportData = () => {
    const headers = ['Order ID', 'Date', 'Category', 'Region', 'Sales', 'Profit', 'Quantity', 'Currency'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(r => [
        r.id,
        r.date,
        r.category,
        r.region,
        (r.sales * currency.rate).toFixed(2),
        (r.profit * currency.rate).toFixed(2),
        r.quantity,
        currency.code
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `nexus_sales_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Real-time Simulation ---
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      // 30% chance of a new sale every 10 seconds to simulate "live" activity
      if (Math.random() > 0.7) {
        const newSale = createRealTimeSale();
        setSalesRecords(prev => [...prev, newSale]);
        
        // Potential performance notification for massive sales
        if (newSale.sales > 2000) {
          triggerNotification('PERFORMANCE_ALERT', `🔥 High-value order detected! ${newSale.id} just closed for $${newSale.sales}`);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  // --- Filtered Data ---
  const filteredData = useMemo(() => {
    return salesRecords.filter(item => {
      const regionMatch = selectedRegion === 'All' || item.region === selectedRegion;
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const dateMatch = item.date >= dateRange.start && item.date <= dateRange.end;
      return regionMatch && categoryMatch && dateMatch;
    });
  }, [salesRecords, selectedRegion, selectedCategory, dateRange]);

  // --- Aggregations ---
  const stats = useMemo(() => {
    const totalRevenue = filteredData.reduce((acc, curr) => acc + curr.sales, 0) * currency.rate;
    const totalProfit = filteredData.reduce((acc, curr) => acc + curr.profit, 0) * currency.rate;
    const totalOrders = filteredData.length;
    const avgOrderValue = totalRevenue / (totalOrders || 1);

    return {
      revenue: `${currency.symbol}${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      profit: `${currency.symbol}${totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      orders: totalOrders.toLocaleString(),
      avgValue: `${currency.symbol}${avgOrderValue.toFixed(2)}`,
      rawProfit: totalProfit
    };
  }, [filteredData, currency]);

  const chartData = useMemo(() => {
    const groupedData: Record<string, { date: string, sales: number, profit: number }> = {};
    
    filteredData.forEach(item => {
      let label = '';
      const date = parseISO(item.date);
      
      if (timeframe === 'Year') {
        label = format(date, 'yyyy');
      } else if (timeframe === 'Month') {
        label = format(date, 'MMM yyyy');
      } else {
        label = format(date, 'MMM dd');
      }

      if (!groupedData[label]) {
        groupedData[label] = { date: label, sales: 0, profit: 0 };
      }
      groupedData[label].sales += item.sales;
      groupedData[label].profit += item.profit;
    });

    return Object.values(groupedData).sort((a, b) => {
       if (timeframe === 'Year') return parseInt(a.date) - parseInt(b.date);
       return new Date(a.date).getTime() - new Date(b.date).getTime();
    }).map(point => ({
      ...point,
      sales: point.sales * currency.rate,
      profit: point.profit * currency.rate
    })).slice(-15);
  }, [filteredData, timeframe, currency]);

  const categoryDistribution = useMemo(() => {
    const data: Record<string, number> = {};
    filteredData.forEach(item => {
      data[item.category] = (data[item.category] || 0) + item.sales;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // --- AI Insights Engine ---
  const generateInsights = async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    const dataSummary = {
      totalRevenue: stats.revenue,
      totalProfit: stats.profit,
      topCategory: categoryDistribution.sort((a,b) => b.value - a.value)[0]?.name,
      avgOrder: stats.avgValue
    };
    
    const result = await getSalesInsights(dataSummary);
    if (result) {
      setAiInsights(result);
      if (user) {
        triggerNotification('AI_INSIGHTS', `New strategic insights generated: ${result.forecast}`);
      }
    }
    setIsAiLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    
    // Initial fetch of AI insights if not already present
    if (!aiInsights) {
      generateInsights();
    }

    // Check for performance alerts on data change
    if (chartData.length > 0) {
      const latestMonth = chartData[chartData.length - 1];
      if (latestMonth.profit < notificationConfig.threshold) {
        triggerNotification('PERFORMANCE_ALERT', 
          `Monthly profit for ${latestMonth.date} ($${latestMonth.profit.toFixed(0)}) has fallen below your target threshold of $${notificationConfig.threshold}.`
        );
      }
    }
  }, [user, notificationConfig.threshold]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 selection:bg-indigo-500/30">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center space-y-8 shadow-2xl"
        >
          <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <LayoutDashboard className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Nexus Analytics</h1>
            <p className="text-zinc-500 text-sm">Professional Sales Intelligence Platform</p>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-zinc-950 py-4 px-6 rounded-2xl font-bold hover:bg-zinc-100 transition-all active:scale-[0.98] shadow-lg"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Sign in with Google
            </button>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Secure Enterprise Access Only</p>
          </div>

          <div className="pt-6 border-t border-zinc-800 flex items-center justify-center gap-4 text-zinc-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs">SOC2 Compliant</span>
            </div>
            <div className="w-1 h-1 bg-zinc-700 rounded-full" />
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono">v1.2.0</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const COLORS = ['#818CF8', '#34D399', '#FB7185', '#FBBF24'];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-900/50 border-r border-zinc-800 p-6 hidden lg:block backdrop-blur-xl z-50">
        <div className="flex items-center gap-3 mb-10 px-2 text-white">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Nexus Sales</h1>
        </div>

        <nav className="space-y-6">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              {[
                { icon: LayoutDashboard, label: 'Overview', active: true },
                { icon: BarChart3, label: 'Analytics', active: false },
                { icon: Users, label: 'Customers', active: false },
                { icon: ShoppingCart, label: 'Orders', active: false },
              ].map((item) => (
                <button 
                  key={item.label}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                    item.active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* User Info Sidebar */}
        <div className="absolute bottom-8 left-6 right-6">
          <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
            {user.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-9 h-9 rounded-xl border border-zinc-700" />
            ) : (
              <div className="w-9 h-9 bg-zinc-700 rounded-xl flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-zinc-400" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user.displayName || 'User'}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50 px-8 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h2 className="text-xl font-semibold">Executive Overview</h2>
              <p className="text-xs text-zinc-500">Real-time performance metrics</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {currency.code} ({currency.symbol})
              </div>
              <button 
                onClick={() => setShowNotificationSettings(true)}
                className="relative p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Notification Settings"
              >
                {notificationConfig.enabled ? <BellRing className="w-5 h-5 text-indigo-400" /> : <Bell className="w-5 h-5" />}
                {notificationConfig.enabled && <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full" />}
              </button>

              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-white">Live</button>
                <button className="px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-white">Historical</button>
              </div>
              <button 
                onClick={generateInsights}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                {isAiLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                Refresh AI Insights
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Filters Row */}
          <section className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <select 
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none w-40 cursor-pointer hover:border-zinc-700 transition-colors"
                >
                  <option value="All">All Regions</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>

              <div className="relative group">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none w-48 cursor-pointer hover:border-zinc-700 transition-colors"
                >
                  <option value="All">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                {(['Day', 'Month', 'Year'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-tighter",
                      timeframe === t ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 bg-zinc-900 border rounded-xl text-xs transition-all",
                    showDatePicker ? "border-indigo-500 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(dateRange.start), 'MMM d, yy')} - {format(parseISO(dateRange.end), 'MMM d, yy')}
                </button>
                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl z-50 space-y-4"
                    >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Start Date</label>
                          <input 
                            type="date" 
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">End Date</label>
                          <input 
                            type="date" 
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowDatePicker(false)}
                        className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors"
                      >
                        Apply Filter
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button 
                onClick={exportData}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </section>

          {/* KPI Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPIWebCard 
              title="Total Revenue" 
              value={stats.revenue} 
              change="+12.5%" 
              icon={DollarSign} 
              color="bg-indigo-500" 
            />
            <KPIWebCard 
              title="Total Margin" 
              value={stats.profit} 
              change="+8.2%" 
              icon={TrendingUp} 
              color="bg-emerald-500" 
            />
            <KPIWebCard 
              title="Total Orders" 
              value={stats.orders} 
              change="-2.4%" 
              icon={ShoppingCart} 
              color="bg-rose-500" 
            />
            <KPIWebCard 
              title="Avg. Order Value" 
              value={stats.avgValue} 
              change="+15.3%" 
              icon={Users} 
              color="bg-amber-500" 
            />
          </section>

          {/* AI Insights Panel */}
          <AnimatePresence mode="wait">
            {aiInsights && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-3xl overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
                    <BrainCircuit className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white tracking-tight">AI Strategic Insights</h3>
                      <span className="text-[10px] font-bold py-1 px-3 bg-indigo-600 text-white rounded-full uppercase tracking-tighter">Generated by Nexus AI</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <p className="text-indigo-200 text-sm italic font-medium leading-relaxed">"{aiInsights.forecast}"</p>
                        <div className="space-y-2">
                          {aiInsights.insights.map((insight, idx) => (
                            <div key={idx} className="flex gap-2 text-sm text-zinc-300">
                              <span className="text-indigo-400 font-bold">•</span>
                              {insight}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4 border-l border-indigo-500/10 pl-8">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Recommendations</h4>
                        <div className="space-y-3">
                          {aiInsights.recommendations.map((rec, idx) => (
                            <div key={idx} className="bg-zinc-950/40 p-3 rounded-xl border border-white/5 text-sm font-medium">
                                {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Charts Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold">Revenue & Profit Trend</h3>
                  <p className="text-xs text-zinc-500">Monthly performance tracking</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-2 text-indigo-400"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Revenue</div>
                  <div className="flex items-center gap-2 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Profit</div>
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${currency.symbol}${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} formatter={(v) => `${currency.symbol}${Number(v).toLocaleString()}`} />
                    <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-sm">
              <div className="mb-8">
                <h3 className="text-lg font-bold">Category Mix</h3>
                <p className="text-xs text-zinc-500">Revenue distribution</p>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryDistribution} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {categoryDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Recent Transactions Table */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Recent Transactions</h3>
                <p className="text-xs text-zinc-500">Latest sales across all regions</p>
              </div>
              <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">View All Orders</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/50">
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Order ID</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Category</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Region</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Sales ({currency.symbol})</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Profit ({currency.symbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredData.slice(-10).reverse().map((sale) => (
                    <tr key={sale.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-8 py-4">
                        <span className="text-sm font-mono font-bold text-zinc-300">{sale.id}</span>
                      </td>
                      <td className="px-8 py-4 text-xs text-zinc-400">
                        {format(parseISO(sale.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-8 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {sale.category}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-xs text-zinc-400">
                        {sale.region}
                      </td>
                      <td className="px-8 py-4 text-sm font-bold text-white text-right">
                        {currency.symbol}{(sale.sales * currency.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-8 py-4 text-sm font-bold text-emerald-400 text-right">
                        {currency.symbol}{(sale.profit * currency.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showNotificationSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotificationSettings(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3"><Settings className="w-5 h-5 text-indigo-400" /><h3 className="text-xl font-bold">Alert Settings</h3></div>
                <button onClick={() => setShowNotificationSettings(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <div><p className="text-sm font-bold">Enabled Alerts</p><p className="text-xs text-zinc-500">AI & performance</p></div>
                  <button onClick={() => setNotificationConfig(p => ({ ...p, enabled: !p.enabled }))} className={cn("w-12 h-6 rounded-full relative transition-colors", notificationConfig.enabled ? "bg-indigo-600" : "bg-zinc-800")}>
                    <motion.div animate={{ x: notificationConfig.enabled ? 24 : 4 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg" />
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Target Email</label>
                  <input type="email" value={notificationConfig.receiver} onChange={(e) => setNotificationConfig(p => ({ ...p, receiver: e.target.value }))} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Base Currency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setCurrency(c)}
                        className={cn(
                          "py-2 rounded-xl border text-xs font-bold transition-all",
                          currency.code === c.code 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                            : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        {c.symbol}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Profit Alert Threshold ({currency.symbol})</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="0" max="10000" step="100" value={notificationConfig.threshold} onChange={(e) => setNotificationConfig(p => ({ ...p, threshold: parseInt(e.target.value) }))} className="flex-1 accent-indigo-600 h-1 bg-zinc-800 rounded-lg appearance-none" />
                    <span className="text-sm font-mono text-indigo-400 font-bold">{currency.symbol}{notificationConfig.threshold}</span>
                  </div>
                </div>
                <button onClick={savePreferences} className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98]">Save Preferences</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
