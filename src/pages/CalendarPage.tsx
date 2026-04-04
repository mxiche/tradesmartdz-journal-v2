import { useLanguage } from '@/contexts/LanguageContext';
import { ForexCalendar } from '@/components/ForexCalendar';

const CalendarPage = () => {
  const { language } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">
        {lang === 'ar' ? 'التقويم الاقتصادي' : lang === 'fr' ? 'Calendrier économique' : 'Economic Calendar'}
      </h1>
      <ForexCalendar lang={lang} fullPage />
    </div>
  );
};

export default CalendarPage;
