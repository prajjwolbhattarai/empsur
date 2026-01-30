
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface HeaderProps {
  currentView: 'employee' | 'ceo';
  setView: (view: 'employee' | 'ceo') => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, lang, setLang }) => {
  const t = translations[lang];
  
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('employee')}>
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">MZS</div>
          <h1 className="text-xl font-black bg-slate-900 bg-clip-text text-transparent uppercase tracking-tighter">
            {t.title}
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setView('employee')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                currentView === 'employee' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.survey}
            </button>
            <button
              onClick={() => setView('ceo')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                currentView === 'ceo' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.dashboard}
            </button>
          </nav>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setLang('de')}
              className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all ${lang === 'de' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
              DE
            </button>
            <button 
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all ${lang === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
