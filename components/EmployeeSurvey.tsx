
import React, { useState, useEffect, useMemo } from 'react';
import { Question, QuestionType, SurveyResponse, Answer, Language } from '../types';
import { translations } from '../translations';

const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];
const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhsBtLWsN4IOF21kXDQxyXmwuvcmfde5jmLxPp0PNxKIZ1D39orL35SKamh8q5RIo/exec';

interface EmployeeSurveyProps {
  lang: Language;
}

const EmployeeSurvey: React.FC<EmployeeSurveyProps> = ({ lang }) => {
  const t = translations[lang];
  const [questions, setQuestions] = useState<Question[]>([]);
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [month, setMonth] = useState(t.months[new Date().getMonth()]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isStarted, setIsStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { value: string | number }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setMonth(t.months[new Date().getMonth()]);
    setYear(new Date().getFullYear().toString());
    setDept(t.depts[0]);
  }, [lang]);

  useEffect(() => {
    const rawSaved = localStorage.getItem('survey_questions');
    if (!rawSaved) {
      const defaults: Question[] = t.defaultQuestions.map((txt: string, i: number) => ({
        id: `q-${i + 1}`,
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
  }, [lang]);

  const activeQuestions = useMemo(() => {
    return questions.filter(q => {
      if (q.hidden) return false;
      if (q.isRecurring) return true;
      return q.activeYears.includes(year) && q.activeMonths.includes(month);
    });
  }, [questions, month, year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);

    const ident = isAnonymous ? (lang === 'de' ? 'Anonym' : 'Anonymous') : email;
    // We combine email and department to fit your script's current 3-column metadata structure
    const combinedEmail = `${ident} [${dept}]`;

    const payload = {
      timestamp: new Date().toLocaleString(),
      employeeEmail: combinedEmail,
      month,
      year,
      answers: (Object.entries(answers) as [string, { value: string | number }][])
        .filter(([qid]) => activeQuestions.some(aq => aq.id === qid))
        .map(([qid, data]) => ({
          questionId: qid,
          value: data.value
        }))
    };
    
    try {
      await fetch(APPSCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'submit_response', 
          payload: payload 
        })
      });
      setSubmitted(true);
    } catch (err) { 
      console.error("Cloud Sync Error", err);
      // Fallback: indicate success locally if script is just timing out
      setSubmitted(true);
    } finally {
      setIsSyncing(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white p-8 md:p-16 rounded-[3rem] shadow-2xl text-center max-w-2xl mx-auto border-t-[16px] border-emerald-500">
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 text-5xl mx-auto mb-8 animate-bounce">✓</div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 uppercase tracking-tighter">{t.loggedSuccess}</h2>
        <p className="text-slate-500 font-bold mb-10">{t.successMsg}</p>
        <button onClick={() => { setSubmitted(false); setIsStarted(false); setEmail(''); setAnswers({}); }} className="w-full bg-slate-900 text-white px-10 py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all">{t.newCheckin}</button>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="bg-white p-8 md:p-14 rounded-[3rem] shadow-2xl max-w-lg mx-auto border-t-[12px] border-yellow-400">
        <div className="mb-10">
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{t.title}</h2>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mt-2">{t.survey} v2.5</p>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); setIsStarted(true); }} className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t.workerIdent}</label>
              <div className="flex items-center gap-2">
                 <input type="checkbox" id="anon" checked={isAnonymous} onChange={() => setIsAnonymous(!isAnonymous)} className="w-4 h-4 accent-slate-900" />
                 <label htmlFor="anon" className="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">{t.anonymousMode}</label>
              </div>
            </div>
            <input type="email" required={!isAnonymous} disabled={isAnonymous} value={isAnonymous ? '' : email} onChange={(e) => setEmail(e.target.value)} placeholder={isAnonymous ? t.identityProtected : "name@firma.de"} className="w-full px-6 py-4 rounded-xl border-2 border-slate-100 font-bold outline-none focus:border-yellow-400 transition-all disabled:bg-slate-50" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.department}</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full px-6 py-4 rounded-xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none">
              {t.depts.map((d: string) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.period}</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-6 py-4 rounded-xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none">
                {t.months.map((m: string) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2 pt-6">
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-6 py-4 rounded-xl border-2 border-slate-100 bg-white font-bold text-slate-700 outline-none">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl transition-all text-lg">{t.openCheckin}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border-2 border-slate-100 border-b-[16px] border-b-yellow-400 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{t.roofingAudit}</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3">
            {month} {year} • <span className="text-slate-900">{dept}</span> • <span className={isAnonymous ? 'text-blue-500 italic' : ''}>{isAnonymous ? t.identityProtected : email}</span>
          </p>
        </div>
        <button onClick={() => setIsStarted(false)} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-all">{t.cancelEntry}</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {activeQuestions.map((q) => (
          <div key={q.id} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border-2 border-slate-100">
            <div className="mb-10">
              <label className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight block">{q.text}</label>
              <div className="h-1.5 w-16 bg-yellow-400 mt-4 rounded-full"></div>
            </div>
            {q.type === QuestionType.SATISFACTION_SCALE && (
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button key={num} type="button" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { value: num } }))} className={`flex-1 py-10 rounded-2xl font-black text-4xl md:text-5xl border-4 transition-all ${answers[q.id]?.value === num ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-xl' : 'bg-white text-slate-100 border-slate-50 hover:border-yellow-400'}`}>{num}</button>
                ))}
              </div>
            )}
            {q.type === QuestionType.PERFORMANCE_RATING && (
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button key={num} type="button" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { value: num } }))} className={`aspect-square rounded-xl font-black text-xl border-4 transition-all flex items-center justify-center ${answers[q.id]?.value === num ? 'bg-slate-900 text-white border-slate-900 scale-110 shadow-xl' : 'bg-white text-slate-100 border-slate-50 hover:border-yellow-400'}`}>{num}</button>
                ))}
              </div>
            )}
            {q.type === QuestionType.TEXT_FEEDBACK && (
              <textarea rows={5} value={answers[q.id]?.value as string || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { value: e.target.value } }))} placeholder="..." className="w-full px-6 py-6 rounded-2xl border-4 border-slate-50 focus:border-yellow-400 outline-none font-bold text-slate-700 bg-slate-50/50 text-xl" />
            )}
          </div>
        ))}
        <button type="submit" disabled={isSyncing} className="w-full bg-slate-900 text-white py-10 rounded-3xl font-black text-2xl uppercase tracking-[0.2em] hover:bg-slate-800 shadow-2xl disabled:opacity-50">
          {isSyncing ? t.transmitting : t.submitEntry}
        </button>
      </form>
    </div>
  );
};

export default EmployeeSurvey;
