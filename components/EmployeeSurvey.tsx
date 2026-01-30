
import React, { useState, useEffect, useMemo } from 'react';
import { Question, QuestionType, SurveyResponse, Answer, Language } from '../types';
import { translations } from '../translations';

const YEARS = ['2026', '2027', '2028', '2029', '2030'];

interface EmployeeSurveyProps {
  lang: Language;
}

const EmployeeSurvey: React.FC<EmployeeSurveyProps> = ({ lang }) => {
  const t = translations[lang];
  const [questions, setQuestions] = useState<Question[]>([]);
  const [email, setEmail] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [month, setMonth] = useState(t.months[0]);
  const [year, setYear] = useState('2026');
  const [isStarted, setIsStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { value: string | number }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Re-set month if language changes to match translated list
    setMonth(t.months[0]);
  }, [lang]);

  useEffect(() => {
    const rawSaved = localStorage.getItem('survey_questions');
    if (rawSaved === null) {
      const defaults: Question[] = t.defaultQuestions.map((txt: string, i: number) => ({
        id: `q-roof-${i + 1}`,
        text: txt,
        type: i === 4 ? QuestionType.TEXT_FEEDBACK : (i % 2 === 0 ? QuestionType.SATISFACTION_SCALE : QuestionType.PERFORMANCE_RATING),
        hidden: false,
        isRecurring: true,
        activeYears: [],
        activeMonths: []
      }));
      setQuestions(defaults);
      localStorage.setItem('survey_questions', JSON.stringify(defaults));
    } else {
      setQuestions(JSON.parse(rawSaved));
    }
  }, [lang]); // Re-init defaults on lang change if none saved

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'survey_questions' && e.newValue) setQuestions(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const activeQuestions = useMemo(() => {
    return questions.filter(q => {
      if (q.hidden) return false;
      if (q.isRecurring) return true;
      const yearMatch = q.activeYears.includes(year);
      const monthMatch = q.activeMonths.includes(month);
      return yearMatch && monthMatch;
    });
  }, [questions, month, year]);

  useEffect(() => {
    const initialAnswers: Record<string, { value: string | number }> = {};
    activeQuestions.forEach(q => {
      initialAnswers[q.id] = { value: '' };
    });
    setAnswers(initialAnswers);
  }, [activeQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);

    const payload: SurveyResponse = {
      id: Math.random().toString(36).substr(2, 9),
      employeeEmail: isAnonymous ? (lang === 'de' ? 'Anonym' : 'Anonymous') : email,
      month,
      year,
      timestamp: new Date().toISOString(),
      answers: (Object.entries(answers) as [string, { value: string | number }][])
        .filter(([qid]) => activeQuestions.some(aq => aq.id === qid))
        .map(([qid, data]): Answer => ({
          questionId: qid,
          value: data.value,
          discloseName: !isAnonymous
        }))
    };
    
    const existing = JSON.parse(localStorage.getItem('survey_responses') || '[]');
    localStorage.setItem('survey_responses', JSON.stringify([...existing, payload]));

    const syncUrl = localStorage.getItem('sync_url');
    if (syncUrl) {
      try {
        await fetch(syncUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ action: 'submit_response', payload: payload })
        });
      } catch (err) { console.error("Cloud Sync Error", err); }
    }

    setIsSyncing(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-white p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl text-center max-w-2xl mx-auto border-t-[12px] border-emerald-500 animate-in fade-in zoom-in duration-300">
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 text-5xl mx-auto mb-8">✓</div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 uppercase tracking-tighter leading-none">{t.loggedSuccess}</h2>
        <p className="text-slate-500 font-bold mb-10 text-sm md:text-base">{t.successMsg}</p>
        <button onClick={() => { setSubmitted(false); setIsStarted(false); setEmail(''); setIsAnonymous(false); }} className="w-full bg-slate-900 text-white px-10 py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all">{t.newCheckin}</button>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="bg-white p-8 md:p-14 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl max-w-lg mx-auto border-t-[12px] border-yellow-400">
        <h2 className="text-4xl font-black mb-2 text-slate-900 uppercase tracking-tighter leading-none">{t.title}</h2>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mb-12">{t.survey} v2.0</p>
        
        <form onSubmit={(e) => { e.preventDefault(); setIsStarted(true); }} className="space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t.workerIdent}</label>
              <div className="flex items-center gap-2">
                 <input type="checkbox" id="anonymous-toggle" checked={isAnonymous} onChange={() => setIsAnonymous(!isAnonymous)} className="w-4 h-4 accent-slate-900 cursor-pointer" />
                 <label htmlFor="anonymous-toggle" className="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">{t.anonymousMode}</label>
              </div>
            </div>
            <input type="email" required={!isAnonymous} disabled={isAnonymous} value={isAnonymous ? '' : email} onChange={(e) => setEmail(e.target.value)} placeholder={isAnonymous ? t.identityProtected : "beispiel@firma.de"} className={`w-full px-6 py-5 rounded-2xl border-2 outline-none font-bold transition-all ${isAnonymous ? 'bg-slate-50 border-slate-100 text-slate-300' : 'border-slate-100 focus:border-yellow-400 text-slate-700'}`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.period}</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none cursor-pointer">
                {t.months.map((m: string) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2 pt-6">
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-6 py-5 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none cursor-pointer">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl transition-all text-lg">{t.openCheckin}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4 md:px-0">
      <div className="flex justify-between items-center bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border-2 border-slate-100 border-b-[16px] border-b-yellow-400 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{t.roofingAudit}</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3">{month} {year} • <span className={isAnonymous ? 'text-blue-500 font-black italic uppercase' : ''}>{isAnonymous ? t.identityProtected : email}</span></p>
        </div>
        <button onClick={() => setIsStarted(false)} className="relative z-10 text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-all">{t.cancelEntry}</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {activeQuestions.length === 0 ? (
          <div className="bg-white p-24 rounded-[4rem] text-center border-2 border-dashed border-slate-200">
            <div className="text-6xl mb-8 opacity-20 grayscale">🏗️</div>
            <p className="text-slate-400 font-black uppercase tracking-[0.3em]">{t.noActiveMetrics}</p>
            <p className="text-[10px] text-slate-300 font-bold mt-4 uppercase">{t.infraUpdate}</p>
          </div>
        ) : (
          activeQuestions.map((q) => (
            <div key={q.id} className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-sm border-2 border-slate-100 group transition-all hover:border-slate-300">
              <div className="mb-10">
                <label className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight block">{q.text}</label>
                <div className="h-2 w-20 bg-yellow-400 mt-4 rounded-full"></div>
              </div>
              {q.type === QuestionType.SATISFACTION_SCALE && (
                <div className="flex flex-wrap justify-between gap-3">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button key={num} type="button" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], value: num } }))} className={`flex-1 min-w-[60px] py-8 md:py-12 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-3xl md:text-5xl border-[6px] transition-all ${answers[q.id]?.value === num ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-2xl' : 'bg-white text-slate-100 border-slate-50 hover:border-yellow-400 hover:text-slate-400'}`}>{num}</button>
                  ))}
                </div>
              )}
              {q.type === QuestionType.PERFORMANCE_RATING && (
                <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button key={num} type="button" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], value: num } }))} className={`aspect-square rounded-[1rem] md:rounded-[2rem] font-black text-xl md:text-2xl border-[4px] transition-all flex items-center justify-center ${answers[q.id]?.value === num ? 'bg-slate-900 text-white border-slate-900 scale-110 shadow-2xl' : 'bg-white text-slate-100 border-slate-50 hover:border-yellow-400 hover:text-slate-400'}`}>{num}</button>
                  ))}
                </div>
              )}
              {q.type === QuestionType.TEXT_FEEDBACK && (
                <textarea required rows={6} value={answers[q.id]?.value as string || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], value: e.target.value } }))} placeholder={lang === 'de' ? "Notieren Sie Mängel, Gefahren oder baustellenspezifische Anliegen..." : "Note any defects, hazards, or site-specific roofing concerns..."} className="w-full px-8 py-8 rounded-[2rem] md:rounded-[3rem] border-4 border-slate-50 focus:border-yellow-400 outline-none font-bold text-slate-700 bg-slate-50/10 text-xl transition-all shadow-inner" />
              )}
            </div>
          ))
        )}
        {activeQuestions.length > 0 && (
          <div className="pt-8">
            <button type="submit" disabled={isSyncing} className="w-full bg-slate-900 text-white py-12 rounded-[3rem] md:rounded-[4rem] font-black text-2xl md:text-3xl uppercase tracking-[0.2em] hover:bg-slate-800 shadow-2xl disabled:opacity-50 flex items-center justify-center gap-8 transition-all">
              {isSyncing ? t.transmitting : t.submitEntry}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default EmployeeSurvey;
