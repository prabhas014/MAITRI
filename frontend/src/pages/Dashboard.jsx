import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Heart, BrainCircuit, Activity, Smile, AlertCircle, Moon, Droplet } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [decision, setDecision] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const authToken = token || localStorage.getItem('token') || 'dummy_token';
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

        // 1. Fetch health history from backend
        const historyRes = await axios.get('http://localhost:8000/api/health/history', { headers });
        const records = historyRes.data || [];
        const latest = records.length > 0 ? records[0] : null;
        setHealthData(latest);

        if (latest) {
          // 2. Prepare real multimodal state payload for AI Decision Engine
          const sleepHours = latest.sleep_hours;
          const sleepQuality = latest.sleep_quality || (sleepHours >= 7 ? "Good" : (sleepHours >= 5 ? "Fair" : "Poor"));
          const activity = latest.activity || (
            (latest.exercise_duration >= 30 || latest.heart_rate >= 100) ? "Working" :
              (latest.exercise_duration > 0 ? "Active" : "Resting")
          );
          const stressLevel = latest.stress_prediction || "Low Stress";
          const emotion = latest.emotion || "Neutral";

          const statePayload = {
            stress_level: stressLevel,
            emotion: emotion,
            sleep_quality: sleepQuality,
            activity: activity
          };

          // 3. Evaluate AI Decision Engine with REAL latest values
          const decisionRes = await axios.post('http://localhost:8000/api/decision/evaluate', statePayload);
          setDecision(decisionRes.data);
        } else {
          setDecision({
            fatigue_risk: 'N/A',
            recommendation: 'No telemetry records logged yet. Please log vitals in Telemetry Input.'
          });
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  const latest = healthData;
  const healthScore = latest ? latest.health_score : "--";
  const stress = latest ? (latest.stress_prediction || "Unavailable") : "No Telemetry";
  const currentEmotion = latest ? (latest.emotion || "Unavailable") : "No Telemetry";
  const sleepHours = latest?.sleep_hours;
  const sleepQuality = latest ? (latest.sleep_quality || (sleepHours >= 7 ? "Good" : (sleepHours >= 5 ? "Fair" : "Poor"))) : "No Telemetry";
  const activity = latest ? (latest.activity || "Resting") : "No Telemetry";
  const heartRate = latest?.heart_rate != null ? latest.heart_rate : "--";
  const exercise = latest?.exercise_duration != null ? `${latest.exercise_duration} min` : "--";
  const waterIntake = latest?.water_intake != null
    ? `${latest.water_intake}L / 2.5L`
    : (latest ? "Not recorded" : "--");

  if (loading) return <div className="text-white animate-pulse">Running AI Decision Engine...</div>;

  return (
    <div className="space-y-6">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">MISSION CONTROL: AI ENGINE</h1>
          <p className="text-gray-400">Multimodal Neural Assessment</p>
        </div>
        {latest && (
          <div className="text-right hidden sm:block">
            <span className="text-xs uppercase tracking-widest text-gray-400">Telemetry Status</span>
            <div className="text-sm font-mono text-emerald-400">● LIVE (Score: {healthScore}/100)</div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {/* Fatigue Risk (Decision Engine) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`glass-card p-6 rounded-2xl flex flex-col justify-between col-span-1 md:col-span-2 ${decision?.fatigue_risk === 'HIGH' ? 'border-red-500/30' :
            decision?.fatigue_risk === 'MEDIUM' ? 'border-amber-500/30' : 'border-green-500/30'
            }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={
              decision?.fatigue_risk === 'HIGH' ? 'text-red-400' :
                decision?.fatigue_risk === 'MEDIUM' ? 'text-amber-400' : 'text-green-400'
            }>
              <AlertCircle size={24} />
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${decision?.fatigue_risk === 'HIGH' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
              decision?.fatigue_risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-green-500/20 text-green-400 border-green-500/50'
              }`}>
              FATIGUE RISK: {decision?.fatigue_risk || 'UNKNOWN'}
            </span>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">AI DECISION ENGINE</h2>
            <p className="text-xl font-bold text-white">{decision?.recommendation}</p>
          </div>
        </motion.div>

        {/* Stress Level */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-6 rounded-2xl flex flex-col justify-between"
        >
          <div className="text-purple-400"><BrainCircuit size={24} /></div>
          <div>
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">WESAD STRESS %</h2>
            <p className={`text-3xl font-bold ${stress === 'High Stress' ? 'text-red-400' :
              stress === 'Medium Stress' ? 'text-amber-400' : 'text-emerald-400'
              }`}>{stress}</p>
          </div>
        </motion.div>

        {/* Emotion Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-2xl flex flex-col justify-between"
        >
          <div className="text-cyan-400"><Smile size={24} /></div>
          <div>
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">FER2013 EMOTION</h2>
            <p className="text-3xl font-bold text-white">{currentEmotion}</p>
          </div>
        </motion.div>

        {/* Sleep Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-6 rounded-2xl flex flex-col justify-between"
        >
          <div className="text-indigo-400"><Moon size={24} /></div>
          <div>
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">SLEEP EDF SCORE</h2>
            <p className="text-3xl font-bold text-white">{sleepQuality}</p>
          </div>
        </motion.div>

        {/* Heart Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card p-6 rounded-2xl flex flex-col justify-between"
        >
          <div className="text-pink-400"><Heart size={24} /></div>
          <div>
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">HEART RATE</h2>
            <p className="text-3xl font-bold text-white">{heartRate} BPM</p>
          </div>
        </motion.div>

        {/* Activity & Voice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card p-6 rounded-2xl flex flex-col justify-between"
        >
          <div className="text-yellow-400"><Activity size={24} /></div>
          <div>
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">UCI HAR ACTIVITY</h2>
            <p className="text-3xl font-bold text-white">{activity}</p>
          </div>
        </motion.div>

        {/* Water & Exercise summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="glass-card p-6 rounded-2xl flex flex-col justify-between"
        >
          <div className="flex gap-4">
            <div className="text-blue-400"><Droplet size={24} /></div>
            <div className="text-green-400"><Activity size={24} /></div>
          </div>
          <div className="mt-4">
            <h2 className="text-sm font-medium text-gray-400 tracking-wider mb-1">DAILY TARGETS</h2>
            <p className="text-md text-white">Health Score: <span className="font-bold text-emerald-400">{healthScore} / 100</span></p>
            <p className="text-md text-white">Water: {waterIntake}</p>
            <p className="text-md text-white">Exercise: {exercise}</p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
