
import React, { useState, useEffect, useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { SurveyResponse, Question, QuestionType, Language } from '../types';
import { translations } from '../translations';

const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];
const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhsBtLWsN4IOF21kXDQxyXmwuvcmfde5jmLxPp0PNxKIZ1D39orL35SKamh8q5RIo/exec';

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
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadLocalQuestions();
    fetchCloudData();
  }, []);

  const loadLocalQuestions = () => {
    const raw = localStorage.getItem('survey_questions');
    if (raw) setQuestions(JSON.parse(raw));
  };

  const fetchCloudData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(APPSCRIPT_URL);
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 1) {
        const headers = data[0];
        const rows = data.slice(1);
        
        const parsed: SurveyResponse[] = rows.map((row: any[], idx: number) => {
          const emailField = String(row[1] || '');
          // Extract department from formatted email "Email [Department]"
          const deptMatch = emailField.match(/\[(.*?)\]/);
          const dept = deptMatch ? deptMatch[1] : 'General';
          const email = emailField.replace(/\s\[.*?\]/, '');

          const monthYear = String(row[2] || '');
          const [m, y] = monthYear.split(' ');

          const res: SurveyResponse = {
            id: `row-${idx}`,
            timestamp: String(row[0]),
            employeeEmail: email,
            department: dept,
            month: m || 'Januar',
            year: y || '2026',
            answers: []
          };

          headers.forEach((h: any, colIdx: number) => {
            const match = String(h).match(/\[ID:(.*?)\]/);
            if (match) {
              res.answers.push({
                questionId: match[1],
                value: row[colIdx]
              });
            }
          });
          return res;
        });
        setResponses(parsed);
      }
    } catch (e) {
      console.error("Fetch error", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSchema = async () => {
    setIsSyncing(true);
    try {
      await fetch(APPSCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_schema', questions })
      });
      alert('Schema Sync Triggered. Spreadsheet headers updated.');
    } catch (e) {
      console.error("Sync error", e);
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
      let score = 0, count = 0;
      monthResponses.forEach(r => r.answers.forEach(a => {
        const q = questions.find(que => que.id === a.questionId);
        if (q && q.type !== QuestionType.TEXT_FEEDBACK && a.value) {
          const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
          score += (Number(a.value) / max) * 100;
          count++;
        }
      }));
      return { name: t.shortMonths[i], avg: count > 0 ? Math.round(score / count) : 0 };
    });
  }, [responses, selectedYear, selectedDept, questions, t]);

  const cardStats = useMemo(() => {
    return questions.filter(q => !q.hidden).map(q => {
      const ans = filteredResponses.flatMap(r => r.answers.filter(a => a.questionId === q.id));
      if (q.type === QuestionType.TEXT_FEEDBACK) return { q, count: ans.filter(x => x.value).length, avg: null };
      const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
      const scores = ans.map(a => Number(a.value)).filter(v => !isNaN(v) && v > 0);
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { q, count: scores.length, avg: Number(avg.toFixed(1)), max, percent: (avg / max) * 100 };
    });
  }, [questions, filteredResponses]);

  return (
    <div className="space-y-8 pb-24">
      <div className="bg-slate-900 p-8 md:p-12 rounded-[3rem] text-white shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">{t.opsIntelligence}</h2>
          <div className="flex gap-4 mt-4 opacity-50 text-[10px] font-black uppercase">
            <span>{responses.length} {t.totalEntries}</span>
            <span>{filteredResponses.length} {t.viewActive}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 text-[10px] font-black uppercase outline-none focus:border-yellow-400">
            <option value="All">{t.allDepts}</option>
            {t.depts.map((d: string) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 text-[10px] font-black uppercase outline-none">
            <option value="All">{t.fullYear}</option>
            {t.months.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 text-[10px] font-black uppercase outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchCloudData} className="bg-yellow-400 text-slate-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-yellow-500 transition-all">
            {isSyncing ? '...' : t.refresh}
          </button>
          <button onClick={syncSchema} className="bg-white/10 px-4 py-3 rounded-xl text-[10px] font-black uppercase border border-white/20 hover:bg-white/20">
            Sync Schema
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6">{t.performanceOverTime}</h3>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} />
              <RechartsTooltip />
              <Area type="monotone" dataKey="avg" stroke="#facc15" strokeWidth={4} fill="#fef9c3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400 mb-6">{t.fieldIntelligence}</h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-grow">
            {/* Fix: Wrap the response and answer into an object in flatMap to maintain access to 'r' in the map function */}
            {filteredResponses.flatMap(r => 
              r.answers
                .filter(a => {
                  const q = questions.find(que => que.id === a.questionId);
                  return q?.type === QuestionType.TEXT_FEEDBACK && a.value;
                })
                .map(a => ({ r, a }))
            ).map(({ r, a }, i) => (
              <div key={i} className="border-l-2 border-yellow-400 pl-4 py-1">
                <p className="text-[10px] font-bold text-slate-500">{r.department} • {r.employeeEmail}</p>
                <p className="text-xs italic">"{a.value}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardStats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="flex justify-between items-start">
              <p className="text-[11px] font-black uppercase tracking-tight text-slate-900 max-w-[70%]">{stat.q.text}</p>
              <span className="bg-slate-50 text-[8px] font-black px-2 py-1 rounded">{stat.count}</span>
            </div>
            {stat.avg !== null ? (
              <div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-black ${stat.percent && stat.percent > 75 ? 'text-emerald-500' : 'text-yellow-500'}`}>{stat.avg}</span>
                  <span className="text-slate-300 text-xs font-bold">/{stat.max}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.percent && stat.percent > 75 ? 'bg-emerald-500' : 'bg-yellow-500'}`} style={{width: `${stat.percent}%`}} />
                </div>
              </div>
            ) : <div className="text-slate-200 text-4xl">💬</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CEODashboard;
