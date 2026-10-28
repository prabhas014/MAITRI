import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, UploadCloud, Trash2, FileText, CheckCircle, 
  AlertCircle, Loader2, BrainCircuit, Play, HelpCircle, 
  FileSpreadsheet, ArrowRight, BarChart3, ShieldCheck, Eye 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Datasets() {
  const [activeTab, setActiveTab] = useState('rag'); // 'rag' or 'ml'
  
  // RAG State
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // ML Training State - Stress
  const [trainingFile, setTrainingFile] = useState(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingStats, setTrainingStats] = useState(null);
  const [mlDragActive, setMlDragActive] = useState(false);
  
  // ML Training State - Emotion (FER2013)
  const [selectedModel, setSelectedModel] = useState('stress'); // 'stress' or 'emotion'
  const [emotionLoading, setEmotionLoading] = useState(false);
  const [emotionStats, setEmotionStats] = useState(null);
  
  // Shared Notification State
  const [notifications, setNotifications] = useState([]);

  const addNotification = (type, message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  };

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:8000/api/datasets');
      setDatasets(res.data);
    } catch (err) {
      console.error(err);
      addNotification('error', 'Failed to retrieve RAG datasets from core memory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // RAG Drag & Drop Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processRAGFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processRAGFile(e.target.files[0]);
    }
  };

  const processRAGFile = async (file) => {
    const allowedExtensions = ['.txt', '.md', '.csv', '.json', '.pdf'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(fileExt)) {
      addNotification('error', 'Unsupported document format. Use TXT, MD, CSV, JSON, or PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addNotification('error', 'File size exceeds 10MB uplink cap.');
      return;
    }

    const exists = datasets.some(d => d.name === file.name);
    if (exists) {
      addNotification('error', `A knowledge source named "${file.name}" is already ingested.`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await axios.post('http://localhost:8000/api/datasets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      addNotification('success', res.data.message || `Successfully ingested "${file.name}".`);
      fetchDatasets();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Ingestion failure. Verify document syntax.';
      addNotification('error', errMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteRAG = async (filename) => {
    if (window.confirm(`Remove "${filename}" from the dynamic knowledge retrieval memory?`)) {
      try {
        await axios.delete(`http://localhost:8000/api/datasets/${encodeURIComponent(filename)}`);
        addNotification('success', `Removed "${filename}" successfully.`);
        setDatasets((prev) => prev.filter((d) => d.name !== filename));
      } catch (err) {
        console.error(err);
        addNotification('error', err.response?.data?.detail || 'Failed to remove source.');
      }
    }
  };

  // ML Training Handlers - Stress
  const handleMlDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setMlDragActive(true);
    } else if (e.type === "dragleave") {
      setMlDragActive(false);
    }
  };

  const handleMlDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMlDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processMlFile(e.dataTransfer.files[0]);
    }
  };

  const handleMlFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processMlFile(e.target.files[0]);
    }
  };

  const processMlFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      addNotification('error', 'ML training dataset must be a structured CSV file.');
      return;
    }
    setTrainingFile(file);
    addNotification('success', `Training dataset "${file.name}" ready for execution.`);
  };

  const triggerModelTraining = async () => {
    if (!trainingFile) return;

    const formData = new FormData();
    formData.append('file', trainingFile);

    try {
      setTrainingLoading(true);
      const res = await axios.post('http://localhost:8000/api/ml/train-stress', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setTrainingStats(res.data);
      addNotification('success', `Telemetry Stress Random Forest trained successfully!`);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Model training execution failed.';
      addNotification('error', errMsg);
    } finally {
      setTrainingLoading(false);
    }
  };

  const triggerEmotionTraining = async () => {
    try {
      setEmotionLoading(true);
      const res = await axios.post('http://localhost:8000/api/ml/train-emotion');
      setEmotionStats(res.data);
      addNotification('success', `Facial Emotion Recognition model trained successfully using local FER2013 archive.`);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to fit local emotion classifier. Ensure archive.zip is in Downloads.';
      addNotification('error', errMsg);
    } finally {
      setEmotionLoading(false);
    }
  };

  const loadSampleTrainingData = () => {
    let csvRows = ['heart_rate,eda,temp,respiration,stress_level'];
    
    // Class 0: Low Stress - 60 samples
    for (let i = 0; i < 60; i++) {
      const hr = Math.round(60 + Math.random() * 15);
      const eda = (0.2 + Math.random() * 0.5).toFixed(3);
      const temp = (36.2 + Math.random() * 0.5).toFixed(1);
      const resp = Math.round(11 + Math.random() * 4);
      csvRows.push(`${hr},${eda},${temp},${resp},0`);
    }
    
    // Class 1: Medium Stress - 50 samples
    for (let i = 0; i < 50; i++) {
      const hr = Math.round(80 + Math.random() * 15);
      const eda = (1.1 + Math.random() * 0.6).toFixed(3);
      const temp = (36.8 + Math.random() * 0.4).toFixed(1);
      const resp = Math.round(16 + Math.random() * 4);
      csvRows.push(`${hr},${eda},${temp},${resp},1`);
    }
    
    // Class 2: High Stress - 50 samples
    for (let i = 0; i < 50; i++) {
      const hr = Math.round(100 + Math.random() * 20);
      const eda = (2.4 + Math.random() * 1.2).toFixed(3);
      const temp = (37.3 + Math.random() * 0.6).toFixed(1);
      const resp = Math.round(21 + Math.random() * 5);
      csvRows.push(`${hr},${eda},${temp},${resp},2`);
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'wesad_synthetic_stress_training_data.csv', { type: 'text/csv' });
    
    setTrainingFile(file);
    addNotification('success', 'Loaded WESAD telemetry training dataset.');
  };

  // Format Recharts data for Stress feature importances
  const chartData = trainingStats?.importances ? [
    { name: 'Heart Rate', value: parseFloat((trainingStats.importances.heart_rate * 100).toFixed(1)) },
    { name: 'EDA (Sweat)', value: parseFloat((trainingStats.importances.eda * 100).toFixed(1)) },
    { name: 'Temperature', value: parseFloat((trainingStats.importances.temp * 100).toFixed(1)) },
    { name: 'Respiration', value: parseFloat((trainingStats.importances.respiration * 100).toFixed(1)) },
  ] : [];

  const CHART_COLORS = ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7'];

  return (
    <div className="space-y-6">
      {/* Toast Notification Container */}
      <div className="fixed top-6 right-6 z-50 space-y-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] border pointer-events-auto flex items-center gap-3 w-85 backdrop-blur-md ${
                n.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {n.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="text-xs font-medium tracking-wide">{n.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3">
            <Database className="text-blue-400 animate-pulse" /> DATASETS & TRAINING
          </h1>
          <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest">Augment Assistant Memory or Train Stress/Emotion Classifiers</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('rag')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'rag'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText size={14} /> Dynamic RAG
          </button>
          <button
            onClick={() => setActiveTab('ml')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'ml'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BrainCircuit size={14} /> ML Classifier
          </button>
        </div>
      </header>

      {activeTab === 'rag' ? (
        /* ==================== TAB 1: RAG KNOWLEDGE BASE ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Container */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[360px]">
              <div>
                <h2 className="text-lg font-bold text-white tracking-wider mb-2">DYNAMIC INGESTION</h2>
                <p className="text-xs text-gray-400 leading-relaxed mb-6">
                  Uplink documents, safety procedures, or mission documentation to dynamically augment MAITRI's RAG knowledge retrieval.
                </p>
              </div>

              <form
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-input').click()}
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group h-[200px] ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : 'border-white/10 hover:border-blue-500/40 hover:bg-white/5'
                }`}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".txt,.md,.csv,.json,.pdf"
                  disabled={uploading}
                />
                
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="text-blue-400 animate-spin" size={40} />
                    <p className="text-xs font-semibold text-blue-400 tracking-wider uppercase animate-pulse">
                      Ingesting & Chunking...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <UploadCloud
                      size={36}
                      className={`mb-3 transition-colors ${
                        dragActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400'
                      }`}
                    />
                    <p className="text-sm font-medium text-white tracking-wide">
                      Drag and Drop document here
                    </p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">
                      or click to browse local files
                    </p>
                  </div>
                )}
              </form>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ingestion Specs</h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">MAX SIZE</span>
                  <span className="text-white">10.00 MB</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">FORMATS</span>
                  <span className="text-white">TXT, MD, CSV, JSON, PDF</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-gray-500">VECTOR STORE</span>
                  <span className="text-blue-400 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span> ChromaDB
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Datasets Table */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-2xl border border-white/5 h-[480px] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/10">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-wider">KNOWLEDGE SOURCES</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Currently loaded training manuals and reference datasets</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Total Files: {datasets.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin text-blue-400 mb-2" size={32} />
                    <span className="text-xs tracking-widest font-mono uppercase">Syncing vector store...</span>
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                    <Database size={40} className="text-gray-700 mb-3" />
                    <p className="text-sm font-semibold text-gray-400">No active knowledge bases</p>
                    <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
                      Upload reference materials on the left to inject customized knowledge context.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-gray-500 font-mono font-bold bg-white/5">
                        <th className="py-4 px-6">SOURCE NAME</th>
                        <th className="py-4 px-4 text-center">VECTOR CHUNKS</th>
                        <th className="py-4 px-4">FILE SIZE</th>
                        <th className="py-4 px-4">INGESTED ON</th>
                        <th className="py-4 px-6 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {datasets.map((dataset) => {
                        const isDefault = dataset.user === 'System' || dataset.uploaded_at === 'System Default';
                        return (
                          <tr key={dataset.name} className="hover:bg-white/5 transition-colors group">
                            <td className="py-4 px-6 font-medium text-white flex items-center gap-3 max-w-[220px] truncate">
                              <FileText size={16} className={isDefault ? "text-purple-400" : "text-blue-400"} />
                              <span className="truncate" title={dataset.name}>{dataset.name}</span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-semibold text-gray-300">
                              {dataset.chunks}
                            </td>
                            <td className="py-4 px-4 font-mono text-gray-400">
                              {dataset.file_size}
                            </td>
                            <td className="py-4 px-4 text-gray-400 font-mono">
                              {isDefault ? (
                                <span className="text-purple-400 text-[10px] tracking-wider uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                  PRE-LOADED
                                </span>
                              ) : (
                                new Date(dataset.uploaded_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              )}
                            </td>
                            <td className="py-4 px-6 text-right">
                              {isDefault ? (
                                <span className="text-[10px] text-gray-600 font-mono select-none uppercase">Immutable</span>
                              ) : (
                                <button
                                  onClick={() => handleDeleteRAG(dataset.name)}
                                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
                                  title="Delete dataset"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== TAB 2: ML CLASSIFIER TRAINING ==================== */
        <div className="space-y-6">
          {/* Sub-tab selection for Stress vs Emotion */}
          <div className="flex bg-black/40 border border-white/10 p-1.5 rounded-xl w-fit">
            <button
              onClick={() => setSelectedModel('stress')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                selectedModel === 'stress'
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Stress Classifier (WESAD)
            </button>
            <button
              onClick={() => setSelectedModel('emotion')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                selectedModel === 'emotion'
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Emotion Classifier (FER2013)
            </button>
          </div>

          {selectedModel === 'stress' ? (
            /* ----- STRESS CLASSIFIER VIEW ----- */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CSV File Upload Section */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[360px]">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-lg font-bold text-white tracking-wider">FIT CLASSIFIER</h2>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Random Forest
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                      Train the stress prediction engine. Upload a CSV file mapping telemetry vitals (heart rate, respiration, EDA, temperature) to stress scores.
                    </p>
                  </div>

                  {trainingFile ? (
                    <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 flex flex-col justify-between h-[180px]">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="text-purple-400 shrink-0" size={24} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{trainingFile.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{(trainingFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => setTrainingFile(null)}
                          className="flex-1 py-2 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
                          disabled={trainingLoading}
                        >
                          Clear
                        </button>
                        <button
                          onClick={triggerModelTraining}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                          disabled={trainingLoading}
                        >
                          {trainingLoading ? (
                            <>
                              <Loader2 className="animate-spin" size={14} /> Fitting...
                            </>
                          ) : (
                            <>
                              <Play size={12} fill="white" /> Train Model
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      onDragEnter={handleMlDrag}
                      onDragOver={handleMlDrag}
                      onDragLeave={handleMlDrag}
                      onDrop={handleMlDrop}
                      onClick={() => document.getElementById('ml-upload-input').click()}
                      className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group h-[180px] ${
                        mlDragActive
                          ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                          : 'border-white/10 hover:border-purple-500/40 hover:bg-white/5'
                      }`}
                    >
                      <input
                        id="ml-upload-input"
                        type="file"
                        className="hidden"
                        onChange={handleMlFileChange}
                        accept=".csv"
                      />
                      <UploadCloud
                        size={36}
                        className={`mb-2 transition-colors ${
                          mlDragActive ? 'text-purple-400' : 'text-gray-500 group-hover:text-purple-400'
                        }`}
                      />
                      <p className="text-xs font-semibold text-white text-center">
                        Drag and Drop training CSV here
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1 font-mono">
                        or click to browse local storage
                      </p>
                    </form>
                  )}
                </div>

                <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Training Sandbox</h3>
                    <button
                      onClick={loadSampleTrainingData}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-mono font-bold tracking-wider uppercase bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                    >
                      Load WESAD Dataset
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                    Don't have a dataset? Click the button above to generate a 160-row stress training file containing biosensor measurements.
                  </p>
                </div>
              </div>

              {/* Model Stats Section */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Accuracy Status */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[150px]">
                    <ShieldCheck className="text-green-400" size={24} />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">CLASSIFIER ACCURACY</h3>
                      <p className="text-3xl font-extrabold text-white">
                        {trainingStats ? `${(trainingStats.accuracy * 100).toFixed(1)}%` : '---'}
                      </p>
                    </div>
                  </div>

                  {/* Sample Size */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[150px]">
                    <Database className="text-purple-400" size={24} />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">DATASET SAMPLES</h3>
                      <p className="text-3xl font-extrabold text-white">
                        {trainingStats ? `${trainingStats.samples} rows` : '---'}
                      </p>
                    </div>
                  </div>

                  {/* Active State */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[150px]">
                    <BarChart3 className="text-blue-400" size={24} />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ACTIVE MODEL STATUS</h3>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${trainingStats ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`}></span>
                        {trainingStats ? 'Custom-Trained' : 'Synthetic Default'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature Importance Recharts Graph */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[290px]">
                  <div>
                    <h2 className="text-md font-bold text-white tracking-wider">FEATURE IMPORTANCE COEFFICIENTS</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Contribution weight of each bio-metric sensor feature</p>
                  </div>

                  <div className="flex-1 mt-4">
                    {trainingStats ? (
                      <div className="h-full flex items-center">
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="%" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                              formatter={(value) => [`${value}%`, 'Weight']}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center">
                        <BrainCircuit size={40} className="text-gray-800 mb-2" />
                        <p className="text-xs font-semibold">Classifier Metrics Standby</p>
                        <p className="text-[10px] text-gray-600 max-w-sm mt-0.5">
                          Upload or load the training telemetry dataset and click "Train Model" to fit the weights and render feature coefficients.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ----- FACIAL EMOTION CLASSIFIER VIEW ----- */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Local File Training Controls */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[360px]">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-lg font-bold text-white tracking-wider">FIT CLASSIFIER</h2>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        SGD Classifier
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                      Fit a local model on the Kaggle FER2013 dataset. The system will look for `archive.zip` inside your Downloads folder, extracting and parsing facial pixels.
                    </p>
                  </div>

                  <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 flex flex-col justify-between h-[180px]">
                    <div className="flex items-center gap-3">
                      <Database className="text-purple-400 shrink-0" size={24} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white">Downloads/archive.zip</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">~60.3 MB Compressed</p>
                      </div>
                    </div>

                    <button
                      onClick={triggerEmotionTraining}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      disabled={emotionLoading}
                    >
                      {emotionLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={14} /> Extracting & Fitting...
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="white" /> Train Emotion Model
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Model Pipeline</h3>
                  <div className="space-y-2.5 font-mono text-[11px] leading-relaxed text-gray-400">
                    <p className="flex items-center gap-2">
                      <ArrowRight size={12} className="text-purple-400" /> Image size: <span className="text-white">48x48 pixels</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <ArrowRight size={12} className="text-purple-400" /> Color: <span className="text-white">Grayscale (1-channel)</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <ArrowRight size={12} className="text-purple-400" /> Features: <span className="text-white">2,304 pixel weights</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <ArrowRight size={12} className="text-purple-400" /> Method: <span className="text-white">Linear SGD Classifier</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Emotion Classifier Stats */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Accuracy */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[150px]">
                    <ShieldCheck className="text-green-400" size={24} />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">VAL ACCURACY</h3>
                      <p className="text-3xl font-extrabold text-white">
                        {emotionStats ? `${(emotionStats.accuracy * 100).toFixed(1)}%` : '---'}
                      </p>
                    </div>
                  </div>

                  {/* Samples */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[150px]">
                    <Database className="text-purple-400" size={24} />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">DATASET ENTRIES</h3>
                      <p className="text-3xl font-extrabold text-white">
                        {emotionStats ? `${emotionStats.samples} images` : '---'}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[150px]">
                    <Eye className="text-blue-400" size={24} />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ACTIVE MODEL STATUS</h3>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${emotionStats ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`}></span>
                        {emotionStats ? 'Custom-Trained' : 'Gemini Vision Fallback'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Categories Card */}
                <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-[290px]">
                  <div>
                    <h2 className="text-md font-bold text-white tracking-wider">CLASSIFICATION CATEGORIES</h2>
                    <p className="text-xs text-gray-400 mt-0.5">The model learns to map facial geometry to 7 emotions</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 mt-6">
                    {['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise'].map((emotion, idx) => (
                      <div key={emotion} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-xl text-center group hover:border-purple-500/20 transition-all duration-300">
                        <span className="text-xs font-bold text-white mb-1">{emotion}</span>
                        <span className="text-[10px] text-gray-500 font-mono">Class {idx}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500 leading-relaxed font-sans border-t border-white/5 pt-4 mt-4">
                    <p>
                      <strong>Note:</strong> SGD Classifier training runs online and fits in less than 30 seconds by loading 500 representative images per class from train/ folders. Once fitted, predictions run entirely locally inside your browser webcam module.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
