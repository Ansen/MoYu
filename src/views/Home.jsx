import React, { useState, useEffect } from 'react';
import { Languages, Library } from 'lucide-react';
import { useI18n } from '../i18n/index';
import FeatureCard from '../components/common/FeatureCard';
import RecentFileItem from '../components/common/RecentFileItem';

export default function HomeView({ setView, recentFiles, openFileProgrammatically }) {
  const { t, langSetting } = useI18n();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting(t('greeting.earlyMorning'));
    else if (hour < 12) setGreeting(t('greeting.morning'));
    else if (hour < 14) setGreeting(t('greeting.noon'));
    else if (hour < 18) setGreeting(t('greeting.afternoon'));
    else setGreeting(t('greeting.evening'));
  }, [t, langSetting]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-[#1a1a1a] p-8 md:p-12 custom-scrollbar select-none text-slate-800 dark:text-slate-200">
      <div className="w-full space-y-12">
        
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {greeting}, {t('home.welcome')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeatureCard 
            icon={Languages}
            title={t('home.translator.title')}
            desc={t('home.translator.desc')}
            onClick={() => setView('translator')}
            colorClass="indigo"
          />
          <FeatureCard 
            icon={Library}
            title={t('home.player.title')}
            desc={t('home.player.desc')}
            onClick={() => setView('library')}
            colorClass="emerald"
          />
        </div>

        {/* Recent Files */}
        {recentFiles && recentFiles.length > 0 && (
          <div className="pt-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">{t('home.recent')}</h3>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {recentFiles.slice(0, 6).map((item, idx) => (
                <RecentFileItem
                  key={idx}
                  item={item}
                  onClick={() => {
                    setView('library');
                    openFileProgrammatically(item.path, item.name, item.type === 'folder');
                  }}
                  styleVariant="home"
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
