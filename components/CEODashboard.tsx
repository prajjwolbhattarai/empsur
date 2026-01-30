
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from 'recharts';
import { SurveyResponse, Question, QuestionType, Language } from '../types';
import { translations } from '../translations';

const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];

interface CEODashboardProps {
  lang: Language;
}

const CEODashboard: React.FC<CEODashboardProps> = ({ lang }) => {
  const t = translations[lang];
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedDept, setSelectedDept] = useState('All');
  const [showManager, setShowManager] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem('sync_url') || '');

  // Local Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>(QuestionType.SATISFACTION_SCALE);

  useEffect(() => {
    loadLocalQuestions();
    fetchCloudData();
  }, []);

  const loadLocalQuestions = () => {
    const raw = localStorage.getItem('survey_questions');
    if (raw) setQuestions(JSON.parse(raw));
  };

  const fetchCloudData = async () => {
    if (!syncUrl) {
      const local = JSON.parse(localStorage.getItem('survey_responses') || '[]');
      setResponses(local);
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch(syncUrl);
      const data = await response.json();
      if (Array.isArray(data)) {
        setResponses(data);
        localStorage.setItem('survey_responses', JSON.stringify(data));
      }
    } catch (e) {
      console.error("Fetch error", e);
      // Fallback to local
      const local = JSON.parse(localStorage.getItem('survey_responses') || '[]');
      setResponses(local);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveUrl = () => {
    localStorage.setItem('sync_url', syncUrl);
    setShowCloudSettings(false);
    fetchCloudData();
  };

  const filteredResponses = useMemo(() => {
    return responses.filter(r => {
      const monthMatch = selectedMonth === 'All' || r.month === selectedMonth;
      const yearMatch = r.year === selectedYear;
      const deptMatch = selectedDept === 'All' || r.department === selectedDept;
      return monthMatch && yearMatch && deptMatch;
    });
  }, [responses, selectedMonth, selectedYear, selectedDept]);

  const trendData = useMemo(() => {
    return t.months.map((m: string, i: number) => {
      const monthResponses = responses.filter(r => r.month === m && r.year === selectedYear && (selectedDept === 'All' || r.department === selectedDept));
      let totalScore = 0;
      let scoreCount = 0;

      monthResponses.forEach(r => {
        r.answers.forEach(a => {
          const q = questions.find(que => que.id === a.questionId);
          if (q && q.type !== QuestionType.TEXT_FEEDBACK && a.value) {
            const val = Number(a.value);
            const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
            totalScore += (val / max) * 100;
            scoreCount++;
          }
        });
      });

      return {
        name: t.shortMonths[i],
        avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0
      };
    });
  }, [responses, selectedYear, selectedDept, questions, t]);

  const cardStats = useMemo(() => {
    return questions.filter(q => !q.hidden).map(q => {
      const relevantAnswers = filteredResponses.flatMap(r => r.answers.filter(a => a.questionId === q.id));
      if (q.type === QuestionType.TEXT_FEEDBACK) return { q, count: relevantAnswers.length, avg: null };
      const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
      const scores = relevantAnswers.map(a => Number(a.value)).filter(v => !isNaN(v));
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { q, count: scores.length, avg: Number(avg.toFixed(1)), max, percent: (avg / max) * 100 };
    });
  }, [questions, filteredResponses]);

  const appsScriptCode = `
function doGet() {
  var sheet = SpreadSheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = data.slice(1).map(function(row) {
    var obj = { answers: [] };
    headers.forEach(function(h, i) {
      if (h === 'id') obj.id = row[i];
      else if (h === 'email') obj.employeeEmail = row[i];
      else if (h === 'dept') obj.department = row[i];
      else if (h === 'month') obj.month = row[i];
      else if (h === 'year') obj.year = row[i];
      else if (h === 'timestamp') obj.timestamp = row[i];
      else obj.answers.push({ questionId: h, value: row[i] });
    });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  if (params.action === 'submit_response') {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var payload = params.payload;
    // Map headers and append row logic here...
    // Simplest: sheet.appendRow([payload.id, payload.employeeEmail, payload.department, ...]);
  }
  return ContentService.createTextOutput("Success");
}
  `;

  return (
    <div className="space-y-8 pb-24">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900 p-8 md:p-12 rounded-[3rem] text-white shadow-2xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400 mb-2 block">{t.executivePulse}</span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">{t.opsIntelligence}</h2>
          <div className="flex gap-6 mt-4 opacity-50 text-[10px] font-black uppercase tracking-widest">
            <span>{responses.length} {t.totalEntries}</span>
            <span>{filteredResponses.length} {t.viewActive}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 text-[10px] font-black uppercase outline-none focus:border-yellow-400">
            <option value="All">{t.allDepts}</option>
            {t.depts.map((d: string) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 text-[10px] font-black uppercase outline-none focus:border-yellow-400">
            <option value="All">{t.fullYear}</option>
            {t.months.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 text-[10px] font-black uppercase outline-none focus:border-yellow-400">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchCloudData} className="bg-yellow-400 text-slate-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-all">
            {isSyncing ? '...' : t.refresh}
          </button>
          <button onClick={() => setShowCloudSettings(true)} className="bg-white/10 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase border border-white/20 hover:bg-white/20">
            Cloud
          </button>
          <button onClick={() => setShowManager(true)} className="bg-white text-slate-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100">
            {t.structure}
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6">{t.performanceOverTime}</h3>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="col" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} />
              <RechartsTooltip />
              <Area type="monotone" dataKey="avgScore" stroke="#facc15" strokeWidth={4} fill="url(#col)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between">
           <div>
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400 mb-6">{t.fieldIntelligence}</h3>
             <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
               {filteredResponses.flatMap(r => r.answers.filter(a => {
                 const q = questions.find(que => que.id === a.questionId);
                 return q?.type === QuestionType.TEXT_FEEDBACK && a.value;
               })).length === 0 ? <p className="text-slate-500 italic text-xs">{t.noActiveComments}</p> : 
               filteredResponses.flatMap(r => r.answers.filter(a => {
                 const q = questions.find(que => que.id === a.questionId);
                 return q?.type === QuestionType.TEXT_FEEDBACK && a.value;
               }).map((a, i) => (
                 <div key={i} className="border-l-2 border-yellow-400 pl-4 py-1">
                   <p className="text-[10px] font-bold text-slate-400 mb-1">{r.department} • {r.employeeEmail}</p>
                   <p className="text-xs italic leading-relaxed">"{a.value}"</p>
                 </div>
               )))}
             </div>
           </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardStats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:border-yellow-400 transition-all flex flex-col justify-between h-[220px]">
            <div className="flex justify-between items-start">
              <p className="text-[11px] font-black uppercase tracking-tight text-slate-900 leading-snug max-w-[70%]">{stat.q.text}</p>
              <span className="bg-slate-50 text-[8px] font-black px-2 py-1 rounded">{stat.count}</span>
            </div>
            
            {stat.avg !== null ? (
              <div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-black ${stat.percent && stat.percent > 75 ? 'text-emerald-500' : stat.percent && stat.percent > 45 ? 'text-yellow-500' : 'text-red-500'}`}>{stat.avg}</span>
                  <span className="text-slate-300 text-xs font-bold">/{stat.max}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.percent && stat.percent > 75 ? 'bg-emerald-500' : stat.percent && stat.percent > 45 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${stat.percent}%`}} />
                </div>
              </div>
            ) : <div className="text-slate-200 text-4xl">💬</div>}
          </div>
        ))}
      </div>

      {/* Cloud Settings Modal */}
      {showCloudSettings && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-8 border-b flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-black uppercase tracking-tight">{t.cloudSetup}</h3>
               <button onClick={() => setShowCloudSettings(false)} className="text-slate-400 hover:text-slate-900 font-bold">✕</button>
             </div>
             <div className="p-8 overflow-y-auto space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.cloudUrlLabel}</label>
                 <input type="text" value={syncUrl} onChange={(e) => setSyncUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 font-mono text-xs outline-none focus:border-slate-900" />
                 <button onClick={handleSaveUrl} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest mt-2">{t.saveUrl}</button>
               </div>
               <div className="space-y-2 pt-4 border-t">
                 <p className="text-[10px] font-black text-slate-900 uppercase">{t.scriptCopy}</p>
                 <pre className="bg-slate-50 p-4 rounded-xl text-[9px] font-mono text-slate-600 border overflow-x-auto">
                   {appsScriptCode}
                 </pre>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Structure Manager (Placeholder for edits) */}
      {showManager && (
        <div className="fixed inset-0 bg-slate-900/95 z-[150] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-4xl p-10 relative">
             <button onClick={() => setShowManager(false)} className="absolute top-8 right-8 text-2xl">✕</button>
             <h3 className="text-3xl font-black uppercase tracking-tighter mb-8">{t.metricInfra}</h3>
             <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
               {questions.map(q => (
                 <div key={q.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border">
                   <span className="font-bold text-sm uppercase">{q.text}</span>
                   <span className="text-[10px] font-black bg-white px-2 py-1 rounded border uppercase">{q.type}</span>
                 </div>
               ))}
             </div>
             <button onClick={() => setShowManager(false)} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase mt-8">{t.done}</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default CEODashboard;
