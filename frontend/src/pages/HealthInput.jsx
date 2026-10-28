import { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebcamEmotion from '../components/WebcamEmotion';
import { useAuth } from '../hooks/useAuth';

export default function HealthInput() {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    heart_rate: 75,
    spo2: 98,
    temperature: 36.6,
    sleep_hours: 7.5,
    blood_pressure: "120/80",
    weight: 70,
    exercise_duration: 30,
    emotion: "Neutral",
    eda: 1.0,
    respiration: 16,
    water_intake: 1.8,
    activity: "Resting"
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmotionDetected = (emotion) => {
    if (emotion) {
      setFormData(prev => ({ ...prev, emotion }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    try {
      const payload = {
        heart_rate: parseInt(formData.heart_rate, 10),
        spo2: parseFloat(formData.spo2),
        temperature: parseFloat(formData.temperature),
        sleep_hours: parseFloat(formData.sleep_hours),
        blood_pressure: formData.blood_pressure || "120/80",
        weight: parseFloat(formData.weight || 70),
        exercise_duration: parseInt(formData.exercise_duration, 10),
        emotion: formData.emotion || "Neutral",
        eda: parseFloat(formData.eda || 1.0),
        respiration: parseFloat(formData.respiration || 16.0),
        water_intake: parseFloat(formData.water_intake !== "" && formData.water_intake !== undefined ? formData.water_intake : 1.8),
        activity: formData.activity || "Resting"
      };

      const authToken = token || localStorage.getItem('token') || 'dummy_token';
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

      const res = await axios.post('http://localhost:8000/api/health/score', payload, { headers });
      setLastResult(res.data);
      setStatus('success');
      setTimeout(() => {
        navigate('/');
      }, 1800);
    } catch (err) {
      console.error("Submission failed:", err);
      const detail = err.response?.data?.detail || err.message || 'Error transmitting data. Check connection.';
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3">
          <Activity className="text-blue-400" /> TELEMETRY INPUT
        </h1>
        <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest">Manual vital sign logging</p>
      </header>

      {status === 'success' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center border-green-500/30 text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-wider">DATA ACCEPTED</h2>
          <p className="text-gray-400 uppercase tracking-widest mb-4">Synchronizing with MAITRI core...</p>
          {lastResult && (
            <div className="text-sm font-mono text-cyan-300 bg-slate-900/80 px-6 py-3 rounded-xl border border-cyan-500/30 space-y-1">
              <div>Health Score: <span className="font-bold text-emerald-400">{lastResult.health_score} / 100</span></div>
              <div>Stress Level: <span className="font-bold text-purple-400">{lastResult.stress_prediction}</span></div>
              <div>Detected Emotion: <span className="font-bold text-blue-400">{lastResult.emotion}</span></div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-2xl border-t border-white/10"
        >
          <div className="mb-8">
            <h2 className="text-sm font-medium tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
              <Camera size={16} /> EMOTION DATASET ANALYSIS
            </h2>
            <div className="w-full max-w-sm mx-auto">
              <WebcamEmotion onEmotionDetected={handleEmotionDetected} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Heart Rate (BPM)</label>
                <input type="number" name="heart_rate" value={formData.heart_rate} onChange={handleChange} required
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">SpO2 (%)</label>
                <input type="number" name="spo2" value={formData.spo2} onChange={handleChange} required step="0.1"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Temperature (°C)</label>
                <input type="number" name="temperature" value={formData.temperature} onChange={handleChange} required step="0.1"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Sleep Duration (hrs)</label>
                <input type="number" name="sleep_hours" value={formData.sleep_hours} onChange={handleChange} required step="0.1"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Blood Pressure</label>
                <input type="text" name="blood_pressure" value={formData.blood_pressure} onChange={handleChange} required placeholder="120/80"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Weight (kg)</label>
                <input type="number" name="weight" value={formData.weight} onChange={handleChange} required step="0.5"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Exercise Duration (min)</label>
                <input type="number" name="exercise_duration" value={formData.exercise_duration} onChange={handleChange} required
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Detected / Selected Emotion</label>
                <select
                  name="emotion"
                  value={formData.emotion}
                  onChange={handleChange}
                  className="w-full bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-blue-300 outline-none font-mono focus:border-blue-400"
                >
                  <option value="Neutral" className="bg-slate-900 text-white">Neutral</option>
                  <option value="Happy" className="bg-slate-900 text-white">Happy</option>
                  <option value="Sad" className="bg-slate-900 text-white">Sad</option>
                  <option value="Angry" className="bg-slate-900 text-white">Angry</option>
                  <option value="Fear" className="bg-slate-900 text-white">Fear</option>
                  <option value="Disgust" className="bg-slate-900 text-white">Disgust</option>
                  <option value="Surprise" className="bg-slate-900 text-white">Surprise</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Water Intake (Liters)</label>
                <input 
                  type="number" 
                  name="water_intake" 
                  value={formData.water_intake} 
                  onChange={handleChange} 
                  required 
                  step="0.1" 
                  min="0" 
                  max="10"
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500/50 outline-none font-mono" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-widest text-gray-400 uppercase">Current Activity</label>
                <select
                  name="activity"
                  value={formData.activity}
                  onChange={handleChange}
                  className="w-full bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-blue-300 outline-none font-mono focus:border-blue-400"
                >
                  <option value="Resting" className="bg-slate-900 text-white">Resting</option>
                  <option value="Active" className="bg-slate-900 text-white">Active</option>
                  <option value="Working" className="bg-slate-900 text-white">Working</option>
                </select>
              </div>

            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] disabled:opacity-50"
              >
                {status === 'loading' ? 'Transmitting...' : 'Transmit Telemetry'}
              </button>
            </div>
            {status === 'error' && (
              <p className="text-red-400 text-sm mt-4 text-center">
                {errorMessage || 'Error transmitting data. Check connection.'}
              </p>
            )}
          </form>
        </motion.div>
      )}
    </div>
  );
}
