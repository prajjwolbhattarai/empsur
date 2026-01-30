
import React, { useState, useEffect } from 'react';
import EmployeeSurvey from './components/EmployeeSurvey';
import CEODashboard from './components/CEODashboard';
import Header from './components/Header';
import { Language } from './types';
import { translations } from './translations';

const App: React.FC = () => {
  const [view, setView] = useState<'employee' | 'ceo'>('employee');
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved as Language) || 'de';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = translations[lang];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header currentView={view} setView={setView} lang={lang} setLang={setLang} />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {view === 'employee' ? (
            <EmployeeSurvey lang={lang} />
          ) : (
            <CEODashboard lang={lang} />
          )}
        </div>
      </main>

      <footer className="bg-white border-t py-6 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
        <p dangerouslySetInnerHTML={{ __html: t.footer }} />
      </footer>
    </div>
  );
};

export default App;
