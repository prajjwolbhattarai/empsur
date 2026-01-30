
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { SurveyResponse, Question, QuestionType, Language, Answer } from '../types';
import { translations } from '../translations';

const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];
const DEFAULT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbzhsBtLWsN4IOF21kXDQxyXmwuvcmfde5jmLxPp0PNxKIZ1D39orL35SKamh8q5RIo/exec';

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
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem('sync_url') || DEFAULT_SYNC_URL);

  useEffect(() => {
    if (!localStorage.getItem('sync_url')) {
      localStorage.setItem('sync_url', DEFAULT_SYNC_URL);
    }
    loadLocalQuestions();
    fetchCloudData();
  }, []);

  const loadLocalQuestions = () => {
    const raw = localStorage.getItem('survey_questions');
    if (raw) setQuestions(JSON.parse(raw));
  };

  const fetchCloudData = async () => {
    if (!syncUrl) return;
    setIsSyncing(true);
    try {
      const response = await fetch(syncUrl);
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 1) {
        const headers = data[0];
        const rows = data.slice(1);
        
        // Map spreadsheet rows to SurveyResponse objects
        const parsedResponses: SurveyResponse[] = rows.map((row, rowIndex) => {
          const res: SurveyResponse = {
            id: `row-${rowIndex}`,
            timestamp: String(row[0] || ''),
            employeeEmail: String(row[1] || ''),
            department: '', // Dept might not be a separate column in existing script, we check headers
            month: '',
            year: '',
            answers: []
          };

          // Column 2 is "Month Year" in the provided script logic
          const monthYear = String(row[2] || '');
          const parts = monthYear.split(' ');
          if (parts.length >= 2) {
            res.month = parts[0];
            res.year = parts[1];
          }

          // Parse Questions from ID tags in headers
          headers.forEach((header: any, colIndex: number) => {
            const hStr = String(header);
            const match = hStr.match(/\[ID:(.*?)\]/);
            if (match) {
              const qId = match[1];
              res.answers.push({
                questionId: qId,
                value: row[colIndex]
              });
            }
            // Check if department is a custom header added later
            if (hStr.toLowerCase().includes('department') || hStr.toLowerCase().includes('abteilung')) {
              res.department = String(row[colIndex]);
            }
          });

          return res;
        });

        setResponses(parsedResponses);
        localStorage.setItem('survey_responses', JSON.stringify(parsedResponses));
      }
    } catch (e) {
      console.error("Cloud Fetch Error:", e);
      const local = JSON.parse(localStorage.getItem('survey_responses') || '[]');
      setResponses(local);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSchema = async () => {
    if (!syncUrl) return;
    setIsSyncing(true);
    try {
      await fetch(syncUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_schema',
          questions: questions
        })
      });
      alert('Schema Sync Triggered. Check your Google Sheet headers.');
    } catch (e) {
      console.error("Schema Sync Error", e);
    } finally {
      setIsSyncing(false);
    }
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
      // FIX: Filter out null/empty strings before converting to number to avoid type mismatch and incorrect 0 values.
      const scores = relevantAnswers
        .map(a => a.value)
        .filter(v => v !== null && v !== '' && v !== undefined)
        .map(v => Number(v))
        .filter(v => !isNaN(v));
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { q, count: scores.length, avg: Number(avg.toFixed(1)), max, percent: (avg / max) * 100 };
    });
  }, [questions, filteredResponses]);

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
                   <p className="text-[10px] font-bold text-slate-400 mb-1">{r.department || 'General'} • {r.employeeEmail}</p>
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
               <button onClick={() => setShowCloudSettings(false)} className="text-slate-400 font-bold">✕</button>
             </div>
             <div className="p-8 space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.cloudUrlLabel}</label>
                 <input type="text" value={syncUrl} onChange={(e) => setSyncUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 font-mono text-xs outline-none focus:border-slate-900" />
                 <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => { localStorage.setItem('sync_url', syncUrl); setShowCloudSettings(false); fetchCloudData(); }} className="bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">{t.saveUrl}</button>
                    <button onClick={syncSchema} disabled={isSyncing} className="bg-yellow-400 text-slate-900 py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">Sync Columns</button>
                 </div>
               </div>
               <p className="text-[10px] text-slate-400 italic">This will synchronize your Google Sheet headers with the currently active questions.</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CEODashboard;
