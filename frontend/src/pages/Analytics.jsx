import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function Analytics() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/health/history');
        // Reverse for chronological order on charts
        setHistory(res.data.reverse());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div className="text-white animate-pulse">Loading analytics...</div>;

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const chartData = history.map(item => ({
    time: formatDate(item.timestamp),
    healthScore: item.health_score,
    heartRate: item.heart_rate,
    sleep: item.sleep_hours
  }));

  // If no data, provide mock data for preview
  const displayData = chartData.length > 0 ? chartData : [
    { time: '10:00', healthScore: 85, heartRate: 72, sleep: 7.5 },
    { time: '14:00', healthScore: 88, heartRate: 75, sleep: 7.5 },
    { time: '18:00', healthScore: 82, heartRate: 85, sleep: 7.5 },
    { time: '22:00', healthScore: 90, heartRate: 65, sleep: 8.0 },
  ];

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3">
          <BarChart3 className="text-blue-400" /> HISTORICAL TRENDS
        </h1>
        <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest">Longitudinal telemetry analysis</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Health Score Trend */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-2xl border-t border-white/10 h-96"
        >
          <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-4">HEALTH SCORE PROGRESSION</h2>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="healthScore" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Heart Rate Trend */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-6 rounded-2xl border-t border-white/10 h-96"
        >
          <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-4">CARDIOVASCULAR TELEMETRY (BPM)</h2>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

      </div>
    </div>
  );
}
