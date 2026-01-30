
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from 'recharts';
import { SurveyResponse, Question, QuestionType, Language } from '../types';
import { translations } from '../translations';

const YEARS = ['2026', '2027', '2028', '2029', '2030'];

interface CEODashboardProps {
  lang: Language;
}

const CEODashboard: React.FC<CEODashboardProps> = ({ lang }) => {
  const t = translations[lang];
  const APPSCRIPT_URL = localStorage.getItem('sync_url') || 'https://script.google.com/macros/s/AKfycbzhsBtLWsN4IOF21kXDQxyXmwuvcmfde5jmLxPp0PNxKIZ1D39orL35SKamh8q5RIo/exec';
  
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [showManager, setShowManager] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>(QuestionType.SATISFACTION_SCALE);
  const [newIsRecurring, setNewIsRecurring] = useState(true);
  const [newActiveYears, setNewActiveYears] = useState<string[]>(['2026']);
  const [newActiveMonths, setNewActiveMonths] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('sync_url', APPSCRIPT_URL);
    loadLocalQuestions();
    fetchCloudData();
  }, []);

  const loadLocalQuestions = () => {
    const rawSaved = localStorage.getItem('survey_questions');
    if (rawSaved !== null) {
      try {
        setQuestions(JSON.parse(rawSaved));
      } catch (e) {
        console.error("Failed to parse local questions", e);
      }
    }
  };

  const fetchCloudData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(APPSCRIPT_URL);
      const rows = await response.json();
      
      if (Array.isArray(rows) && rows.length > 0) {
        const headers = rows[0];
        const currentQuestions = JSON.parse(localStorage.getItem('survey_questions') || '[]');
        
        const cloudResponses: SurveyResponse[] = rows.slice(1).map((row: any[], index: number) => {
          const periodStr = row[2] || "";
          const [m, y] = periodStr.split(' ');
          
          return {
            id: `cloud-${index}`,
            timestamp: row[0],
            employeeEmail: row[1],
            month: m || 'Unknown',
            year: y || 'Unknown',
            answers: currentQuestions.map((q: Question) => {
              const colIndex = headers.findIndex((h: string) => h && h.toString().includes(`ID:${q.id}`));
              return {
                questionId: q.id,
                value: colIndex > -1 ? row[colIndex] : '',
                discloseName: true
              };
            })
          };
        });
        
        setResponses(cloudResponses);
        localStorage.setItem('survey_responses', JSON.stringify(cloudResponses));
      } else {
        setResponses([]);
      }
    } catch (e) {
      console.error("Cloud Fetch Failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSchemaToCloud = async (updatedQuestions: Question[]) => {
    setIsSyncing(true);
    try {
      await fetch(APPSCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'sync_schema', questions: updatedQuestions })
      });
      setTimeout(() => fetchCloudData(), 2000);
    } catch (e) {
      console.error("Schema Sync Failed", e);
      setIsSyncing(false);
    }
  };

  const handleUpsertQuestion = async () => {
    if (!newQuestionText.trim()) return;
    
    let updatedQuestions: Question[];
    if (editingId) {
      updatedQuestions = questions.map(q => 
        q.id === editingId ? { 
          ...q, 
          text: newQuestionText, 
          type: newQuestionType, 
          isRecurring: newIsRecurring,
          activeYears: newActiveYears,
          activeMonths: newActiveMonths
        } : q
      );
    } else {
      const newQ: Question = {
        id: `q-${Date.now()}`,
        text: newQuestionText,
        type: newQuestionType,
        hidden: false,
        isRecurring: newIsRecurring,
        activeYears: newActiveYears,
        activeMonths: newActiveMonths
      };
      updatedQuestions = [...questions, newQ];
    }
    
    setQuestions([...updatedQuestions]);
    localStorage.setItem('survey_questions', JSON.stringify(updatedQuestions));
    resetEditor();
    await syncSchemaToCloud(updatedQuestions);
  };

  const toggleHideQuestion = async (id: string) => {
    const updated = questions.map(q => q.id === id ? { ...q, hidden: !q.hidden } : q);
    setQuestions([...updated]);
    localStorage.setItem('survey_questions', JSON.stringify(updated));
    resetEditor();
    await syncSchemaToCloud(updated);
  };

  const resetEditor = () => {
    setNewQuestionText('');
    setNewQuestionType(QuestionType.SATISFACTION_SCALE);
    setEditingId(null);
    setNewIsRecurring(true);
    setNewActiveYears(['2026']);
    setNewActiveMonths([]);
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setNewQuestionText(q.text);
    setNewQuestionType(q.type);
    setNewIsRecurring(q.isRecurring ?? true);
    setNewActiveYears(q.activeYears ?? ['2026']);
    setNewActiveMonths(q.activeMonths ?? []);
    setShowManager(true);
  };

  const toggleSelection = (val: string, list: string[], setter: (v: string[]) => void) => {
    if (list.includes(val)) setter(list.filter(v => v !== val));
    else setter([...list, val]);
  };

  const filteredResponses = useMemo(() => {
    return responses.filter(r => {
      const monthMatch = selectedMonth === 'All' || r.month === selectedMonth;
      const yearMatch = r.year === selectedYear;
      return monthMatch && yearMatch;
    });
  }, [responses, selectedMonth, selectedYear]);

  const trendData = useMemo(() => {
    return t.months.map((m: string, i: number) => {
      const monthResponses = responses.filter(r => r.month === m && r.year === selectedYear);
      let totalScore = 0;
      let scoreCount = 0;

      monthResponses.forEach(r => {
        r.answers.forEach(a => {
          const q = questions.find(que => que.id === a.questionId);
          if (q && q.type !== QuestionType.TEXT_FEEDBACK && a.value) {
            const val = Number(a.value);
            if (!isNaN(val)) {
              const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
              const normalized = (val / max) * 100;
              totalScore += normalized;
              scoreCount++;
            }
          }
        });
      });

      return {
        name: t.shortMonths[i],
        responses: monthResponses.length,
        avgScore: scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : 0
      };
    });
  }, [responses, selectedYear, questions, t]);

  const comparisonData = useMemo(() => {
    return questions
      .filter(q => {
        if (q.hidden) return false;
        if (q.isRecurring) return true;
        return q.activeYears.includes(selectedYear) && (selectedMonth === 'All' || q.activeMonths.includes(selectedMonth));
      })
      .map(q => {
        const relevantAnswers = filteredResponses.flatMap(r => r.answers.filter(a => a.questionId === q.id));
        const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
        const scores = relevantAnswers.map(a => Number(a.value)).filter(v => !isNaN(v) && v > 0);
        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return {
          label: q.text.slice(0, 20) + (q.text.length > 20 ? '...' : ''),
          avg: Number(((avg / max) * 100).toFixed(1)),
          raw: Number(avg.toFixed(1))
        };
      })
      .filter(d => !isNaN(d.avg));
  }, [questions, filteredResponses, selectedMonth, selectedYear]);

  const activeQuestionsForDashboard = useMemo(() => {
    return questions.filter(q => {
      if (q.hidden) return false;
      if (q.isRecurring) return true;
      if (selectedMonth === 'All') return q.activeYears.includes(selectedYear);
      return q.activeYears.includes(selectedYear) && q.activeMonths.includes(selectedMonth);
    });
  }, [questions, selectedMonth, selectedYear]);

  const getQuestionStats = (q: Question) => {
    const relevantAnswers = filteredResponses.flatMap(r => r.answers.filter(a => a.questionId === q.id));
    if (q.type === QuestionType.TEXT_FEEDBACK) return { avg: null, count: relevantAnswers.filter(a => a.value !== '').length, max: 0, distribution: [] };
    const max = q.type === QuestionType.SATISFACTION_SCALE ? 5 : 10;
    const scores = relevantAnswers.map(a => Number(a.value)).filter(v => !isNaN(v) && v > 0);
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const distribution = Array.from({ length: max }, (_, i) => ({ score: i + 1, count: scores.filter(s => s === i + 1).length }));
    return { id: q.id, name: q.text, avg: Number(avg.toFixed(1)), count: scores.length, max, percent: (avg / max) * 100, distribution };
  };

  const recentFeedback = useMemo(() => {
    return filteredResponses.flatMap(r => 
      r.answers.filter(a => {
        const q = questions.find(que => que.id === a.questionId);
        return q && !q.hidden && q.type === QuestionType.TEXT_FEEDBACK && a.value;
      }).map(a => ({ email: r.employeeEmail, text: a.value as string, time: r.timestamp, period: `${r.month} ${r.year}` }))
    ).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
  }, [filteredResponses, questions]);

  return (
    <div className="space-y-6 md:space-y-10 pb-24 px-2 md:px-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900 p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400 mb-2 block">{t.executivePulse}</span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">{t.opsIntelligence}</h2>
          <div className="flex items-center gap-6 mt-6">
            <div className="flex flex-col"><span className="text-2xl font-black text-white">{responses.length}</span><span className="text-[8px] font-black uppercase text-slate-400">{t.totalEntries}</span></div>
            <div className="h-10 w-px bg-slate-700"></div>
            <div className="flex flex-col"><span className="text-2xl font-black text-emerald-400">{filteredResponses.length}</span><span className="text-[8px] font-black uppercase text-slate-400">{t.viewActive}</span></div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full lg:w-auto relative z-10">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="flex-grow lg:flex-none px-6 py-4 rounded-2xl bg-slate-800 text-white border-2 border-slate-700 text-xs font-black uppercase tracking-widest outline-none focus:border-yellow-400 transition-all cursor-pointer">
            <option value="All">{t.fullYear}</option>{t.months.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="flex-grow lg:flex-none px-6 py-4 rounded-2xl bg-slate-800 text-white border-2 border-slate-700 text-xs font-black uppercase tracking-widest outline-none focus:border-yellow-400 transition-all cursor-pointer">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchCloudData} disabled={isSyncing} className="flex-grow lg:flex-none bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-xl disabled:opacity-50">
            {isSyncing ? '...' : t.refresh}
          </button>
          <button onClick={() => setShowManager(true)} className="flex-grow lg:flex-none bg-white text-slate-900 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl">
            {t.structure}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">{t.performanceOverTime}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{t.avgSatisfaction}</p>
            </div>
          </div>
          <div className="flex-grow w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#facc15" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} dy={10} />
                <YAxis hide domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '10px'}}
                  cursor={{stroke: '#facc15', strokeWidth: 2}}
                />
                <Area type="monotone" dataKey="avgScore" stroke="#facc15" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">{t.metricLeaderboard}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'de' ? 'Metriken im Vergleich' : 'Score comparison'}</p>
          </div>
          <div className="flex-grow w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#64748b'}} width={100} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '10px'}}
                />
                <Bar dataKey="avg" radius={[0, 10, 10, 0]} barSize={20}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.avg > 75 ? '#10b981' : entry.avg > 45 ? '#facc15' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {activeQuestionsForDashboard.map((q) => {
          const card = getQuestionStats(q);
          return (
            <div key={q.id} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col min-h-[320px]">
              <div className="flex justify-between items-start mb-6">
                <div className="max-w-[70%]">
                  <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-tight line-clamp-2 mb-2">{q.text}</p>
                  <div className="flex gap-2">
                    <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-2 py-1 rounded uppercase border border-slate-100">{card.count} {t.responses}</span>
                  </div>
                </div>
                <div className="text-right">
                  {card.avg !== null ? (
                    <div className={`text-4xl font-black ${card.percent && card.percent > 75 ? 'text-emerald-500' : card.percent && card.percent > 45 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {card.avg}<span className="text-[10px] text-slate-300 ml-0.5">/{card.max}</span>
                    </div>
                  ) : <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">💬</div>}
                </div>
              </div>
              {card.avg !== null && (
                <div className="flex-grow space-y-6">
                  <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div className={`h-full transition-all duration-1000 ${card.percent && card.percent > 75 ? 'bg-emerald-500' : card.percent && card.percent > 45 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${card.percent}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                 <button onClick={() => startEdit(q)} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all px-3 py-1 bg-slate-50 rounded-lg">Edit</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 md:p-10">
        <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 mb-8 border-b-4 border-yellow-400 pb-2 inline-block">{t.fieldIntelligence}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recentFeedback.length === 0 ? <p className="text-xs font-bold text-slate-300 uppercase italic">{t.noActiveComments}</p> : recentFeedback.map((f, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group transition-all hover:bg-white hover:border-slate-300">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${f.email === 'Anonymous' || f.email === 'Anonym' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>{f.email}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">{f.period}</span>
              </div>
              <p className="text-xs font-bold text-slate-700 leading-relaxed italic">"{f.text}"</p>
            </div>
          ))}
        </div>
      </div>

      {showManager && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{t.metricInfra}</h3>
              <button onClick={() => { setShowManager(false); resetEditor(); }} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all">✕</button>
            </div>
            
            <div className="p-8 md:p-12 flex flex-col md:flex-row gap-10 overflow-y-auto custom-scrollbar">
              <div className="flex-1 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-4 border-yellow-400 pb-2 inline-block">{editingId ? t.modifyMetric : t.addMetric}</h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.questionText}</label>
                      <input type="text" value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} placeholder="..." className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 outline-none font-bold text-slate-700 focus:border-slate-900 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.metricType}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[QuestionType.SATISFACTION_SCALE, QuestionType.PERFORMANCE_RATING, QuestionType.TEXT_FEEDBACK].map(opt => (
                          <button key={opt} onClick={() => setNewQuestionType(opt)} className={`px-2 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest text-center transition-all border-2 ${newQuestionType === opt ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{opt.split('_')[0]}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t.scheduleType}</label>
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                          <button onClick={() => setNewIsRecurring(true)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${newIsRecurring ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>{t.recurring}</button>
                          <button onClick={() => setNewIsRecurring(false)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!newIsRecurring ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>{t.oneOff}</button>
                        </div>
                      </div>

                      {!newIsRecurring && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.activeYears}</label>
                            <div className="flex flex-wrap gap-2">
                              {YEARS.map(y => (
                                <button key={y} onClick={() => toggleSelection(y, newActiveYears, setNewActiveYears)} className={`px-4 py-2 rounded-lg text-[10px] font-black border-2 transition-all ${newActiveYears.includes(y) ? 'bg-yellow-400 border-yellow-400 text-slate-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>{y}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.activeMonths}</label>
                            <div className="grid grid-cols-4 gap-2">
                              {t.months.map((m: string) => (
                                <button key={m} onClick={() => toggleSelection(m, newActiveMonths, setNewActiveMonths)} className={`py-2 rounded-lg text-[8px] font-black uppercase border-2 transition-all text-center ${newActiveMonths.includes(m) ? 'bg-yellow-400 border-yellow-400 text-slate-900 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>{m.slice(0,3)}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 pt-4">
                    <button onClick={handleUpsertQuestion} disabled={isSyncing} className="w-full bg-slate-900 text-white py-6 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all disabled:opacity-50">{isSyncing ? '...' : editingId ? t.updateMetric : t.deployMetric}</button>
                    {editingId && <button onClick={() => toggleHideQuestion(editingId)} className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all border ${questions.find(q => q.id === editingId)?.hidden ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{questions.find(q => q.id === editingId)?.hidden ? t.unhideMetric : t.hideMetric}</button>}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-4 border-slate-900 pb-2 inline-block">{t.systemCatalog} ({questions.length})</h4>
                <div className="space-y-3">
                  {questions.map(q => (
                    <div key={q.id} className={`flex items-center justify-between p-5 bg-white rounded-2xl border transition-all ${editingId === q.id ? 'border-slate-900 ring-4 ring-slate-900/5' : 'border-slate-100 shadow-sm'} ${q.hidden ? 'opacity-50 grayscale' : ''}`}>
                      <div className="max-w-[70%]">
                        <p className="font-black text-slate-900 uppercase text-[10px] truncate mb-1">{q.text}</p>
                      </div>
                      <button onClick={() => startEdit(q)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all">✎</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-8 md:p-10 bg-slate-900 flex justify-end shrink-0">
              <button onClick={() => { setShowManager(false); resetEditor(); }} className="bg-white text-slate-900 px-12 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">{t.done}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CEODashboard;
