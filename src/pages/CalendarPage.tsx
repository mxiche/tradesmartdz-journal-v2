import { useLanguage } from '@/contexts/LanguageContext';
import { ForexCalendar } from '@/components/ForexCalendar';

type Lang = 'ar' | 'fr' | 'en';

const CalendarPage = () => {
  const { language } = useLanguage();
  const lang = language as Lang;

  return (
    <div className="animate-fade-in space-y-5">
      <h1 className="text-2xl font-bold text-foreground">
        {lang === 'ar' ? 'التقويم الاقتصادي' : lang === 'fr' ? 'Calendrier économique' : 'Economic Calendar'}
      </h1>
      <ForexCalendar lang={lang} fullPage />
    </div>
  );
};

export default CalendarPage;
