import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { CircleHelp, X, ChevronRight, ChevronLeft, Rocket, LayoutDashboard } from 'lucide-react';

type LangKey = 'ar' | 'fr' | 'en';

const helpCategories = [
  {
    id: 'getting-started',
    icon: 'Rocket',
    label: { ar: 'البداية', fr: 'Démarrer', en: 'Getting Started' },
    items: [
      {
        id: 'add-account',
        question: {
          ar: 'كيف أضيف حساب تداول؟',
          fr: 'Comment ajouter un compte de trading ?',
          en: 'How do I add a trading account?',
        },
        answer: {
          ar: 'اذهب إلى صفحة "إدارة الحسابات" من القائمة الجانبية، ثم اضغط زر "+ إضافة حساب" في أعلى الصفحة. ستمر بـ 5 خطوات: نوع الحساب، اسم الشركة، حجم الحساب، قواعد الشركة، وأخيراً التأكيد.',
          fr: 'Allez dans "Gestionnaire de comptes" depuis le menu, puis cliquez sur "+ Ajouter un compte" en haut. Vous passerez par 5 étapes : type de compte, nom de la firme, taille du compte, règles de la firme, et confirmation.',
          en: 'Go to "Account Manager" from the sidebar, then click "+ Add Account" at the top. You will go through 5 steps: account type, firm name, account size, firm rules, and confirmation.',
        },
      },
      {
        id: 'import-mt5',
        question: {
          ar: 'كيف أستورد صفقاتي من MT5؟',
          fr: 'Comment importer mes trades depuis MT5 ?',
          en: 'How do I import my trades from MT5?',
        },
        answer: {
          ar: '1. افتح MT5 على جهازك\n2. اذهب إلى View → Terminal → History\n3. اضغط كليك يمين → Save as Report (HTML)\n4. في التطبيق اذهب إلى "صفقاتي"\n5. اضغط "استيراد MT5" وارفع الملف\n6. راجع الصفقات ثم اضغط استيراد الكل',
          fr: '1. Ouvrez MT5 sur votre PC\n2. Allez dans View → Terminal → History\n3. Clic droit → Save as Report (HTML)\n4. Dans l\'app allez dans "Mes Trades"\n5. Cliquez "Importer MT5" et uploadez le fichier\n6. Vérifiez les trades puis cliquez Importer tout',
          en: '1. Open MT5 on your PC\n2. Go to View → Terminal → History\n3. Right-click → Save as Report (HTML)\n4. In the app go to "My Trades"\n5. Click "Import MT5" and upload the file\n6. Review the trades then click Import All',
        },
      },
      {
        id: 'add-trade-manual',
        question: {
          ar: 'كيف أضيف صفقة يدوياً؟',
          fr: 'Comment ajouter un trade manuellement ?',
          en: 'How do I add a trade manually?',
        },
        answer: {
          ar: 'اذهب إلى صفحة "صفقاتي" ثم اضغط زر "+ إضافة صفقة" باللون الأخضر. املأ تفاصيل الصفقة: الرمز، الاتجاه، نقاط الدخول والخروج، الربح، والجلسة. ثم اضغط حفظ.',
          fr: 'Allez dans "Mes Trades" puis cliquez le bouton vert "+ Ajouter un trade". Remplissez les détails : symbole, direction, entrée/sortie, profit, et session. Puis cliquez Enregistrer.',
          en: 'Go to "My Trades" then click the green "+ Add Trade" button. Fill in the trade details: symbol, direction, entry/exit, profit, and session. Then click Save.',
        },
      },
      {
        id: 'connect-telegram',
        question: {
          ar: 'كيف أربط التيليغرام؟',
          fr: 'Comment connecter Telegram ?',
          en: 'How do I connect Telegram?',
        },
        answer: {
          ar: 'اذهب إلى الإعدادات من القائمة الجانبية، ثم اختر تبويب "الإشعارات". اضغط زر "ربط التيليغرام"، سيفتح البوت تلقائياً. اضغط Start في التيليغرام وانتظر التأكيد في التطبيق.',
          fr: 'Allez dans Paramètres depuis le menu, puis choisissez l\'onglet "Notifications". Cliquez "Connecter Telegram", le bot s\'ouvrira automatiquement. Appuyez Start dans Telegram et attendez la confirmation.',
          en: 'Go to Settings from the sidebar, then choose the "Notifications" tab. Click "Connect Telegram", the bot will open automatically. Press Start in Telegram and wait for confirmation in the app.',
        },
      },
    ],
  },
  {
    id: 'using-app',
    icon: 'LayoutDashboard',
    label: { ar: 'استخدام التطبيق', fr: "Utiliser l'app", en: 'Using the App' },
    items: [
      {
        id: 'dashboard',
        question: {
          ar: 'ماذا يعني لوح التحكم؟',
          fr: 'Que signifie le tableau de bord ?',
          en: 'What does the Dashboard show me?',
        },
        answer: {
          ar: 'لوح التحكم يعرض ملخص أدائك: إجمالي الربح والخسارة، نسبة الفوز، منحنى الأرصدة، تقدم هدفك الأسبوعي، وتحليلات ذكية من صفقاتك. كل شيء يتحدث تلقائياً عند إضافة صفقات جديدة.',
          fr: 'Le tableau de bord affiche un résumé de vos performances : P&L total, taux de réussite, courbe des soldes, progression de l\'objectif hebdomadaire, et insights intelligents de vos trades.',
          en: 'The Dashboard shows a summary of your performance: total P&L, win rate, equity curve, weekly goal progress, and smart insights from your trades. Everything updates automatically when you add new trades.',
        },
      },
      {
        id: 'analytics',
        question: {
          ar: 'كيف أقرأ صفحة التحليلات؟',
          fr: 'Comment lire la page Analytics ?',
          en: 'How do I read the Analytics page?',
        },
        answer: {
          ar: 'صفحة التحليلات تقسّم أداءك حسب: الرمز، الجلسة، اليوم، والنفسية. ابحث عن الأقسام باللون الأحمر — هذا ضعفك. وابحث عن الأخضر — هذا قوتك. قسم النفسية يحلل مشاعرك وانضباطك.',
          fr: 'La page Analytics divise vos performances par : symbole, session, jour, et psychologie. Cherchez les sections en rouge — c\'est votre faiblesse. Et le vert — c\'est votre force. La section psychologie analyse vos émotions.',
          en: 'The Analytics page breaks down your performance by: symbol, session, day, and psychology. Look for red sections — that is your weakness. Green — that is your strength. The psychology section analyzes your emotions and discipline.',
        },
      },
      {
        id: 'ai-coach',
        question: {
          ar: 'كيف أستخدم المدرب الذكي؟',
          fr: "Comment utiliser l'AI Coach ?",
          en: 'How do I use the AI Coach?',
        },
        answer: {
          ar: 'اذهب إلى صفحة "المدرب الذكي" من القائمة. اضغط "تحليل" للحصول على تقرير شامل عن أدائك مرة واحدة يومياً. يمكنك أيضاً استخدام الشات لطرح أسئلة محددة — حتى 4 رسائل يومياً. ميزة Pro فقط.',
          fr: 'Allez dans "AI Coach" depuis le menu. Cliquez "Analyser" pour obtenir un rapport complet sur vos performances une fois par jour. Vous pouvez aussi utiliser le chat pour des questions spécifiques — jusqu\'à 4 messages par jour. Fonctionnalité Pro uniquement.',
          en: 'Go to "AI Coach" from the sidebar. Click "Analyze" to get a full performance report once per day. You can also use the chat to ask specific questions — up to 4 messages per day. Pro feature only.',
        },
      },
      {
        id: 'upgrade-pro',
        question: {
          ar: 'كيف أشترك في Pro؟',
          fr: "Comment s'abonner à Pro ?",
          en: 'How do I upgrade to Pro?',
        },
        answer: {
          ar: 'اذهب إلى الإعدادات ثم تبويب "الاشتراك". اضغط "ترقية إلى Pro" واختر طريقة الدفع: BaridiMob (2,200 دج) أو USDT (9 دولار). أرسل الدفع وارفع صورة الإيصال. سيتم التفعيل خلال 24 ساعة.',
          fr: 'Allez dans Paramètres puis l\'onglet "Abonnement". Cliquez "Passer à Pro" et choisissez le mode de paiement : BaridiMob (2 200 DA) ou USDT (9$). Envoyez le paiement et uploadez la preuve. Activation sous 24h.',
          en: 'Go to Settings then the "Subscription" tab. Click "Upgrade to Pro" and choose payment method: BaridiMob (2,200 DA) or USDT ($9). Send the payment and upload the proof screenshot. Activation within 24 hours.',
        },
      },
    ],
  },
] as const;

type CategoryId = typeof helpCategories[number]['id'];
type ItemId = typeof helpCategories[number]['items'][number]['id'];

export default function HelpWidget() {
  const { language } = useLanguage();
  const lang = language as LangKey;
  const isRtl = lang === 'ar';

  const l = (obj: Record<LangKey, string>) => obj[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);
  const [search, setSearch] = useState('');
  const [feedbackShown, setFeedbackShown] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset navigation state after close animation completes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setSelectedCategory(null);
        setSelectedItem(null);
        setSearch('');
        setFeedbackShown(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleFeedback = () => {
    setFeedbackShown(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedbackShown(false), 2000);
  };

  const FwdChevron = isRtl ? ChevronLeft : ChevronRight;
  const BkChevron = isRtl ? ChevronRight : ChevronLeft;

  // Search across all categories
  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? helpCategories.flatMap(cat =>
        cat.items.filter(item =>
          item.question[lang].toLowerCase().includes(searchQuery) ||
          item.answer[lang].toLowerCase().includes(searchQuery)
        ).map(item => ({ ...item, categoryId: cat.id }))
      )
    : [];

  const currentCategory = helpCategories.find(c => c.id === selectedCategory) ?? null;
  const currentItem = currentCategory?.items.find(i => i.id === selectedItem) ?? null;

  const getCategoryIcon = (iconName: string) => {
    if (iconName === 'Rocket') return <Rocket className="w-5 h-5 text-teal-600" />;
    if (iconName === 'LayoutDashboard') return <LayoutDashboard className="w-5 h-5 text-teal-600" />;
    return null;
  };

  const renderAnswer = (text: string) =>
    text.split('\n').map((line, i) => {
      const match = line.match(/^(\d+)\.\s(.+)/);
      if (match) {
        return (
          <div key={i} className="flex gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
              {match[1]}
            </span>
            <span className="text-sm text-gray-700 leading-relaxed">{match[2]}</span>
          </div>
        );
      }
      return (
        <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{line}</p>
      );
    });

  const panelContent = (
    <>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <CircleHelp className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">
              {l({ ar: 'مركز المساعدة', fr: "Centre d'aide", en: 'Help Center' })}
            </p>
            <p className="text-xs text-gray-400">
              {l({ ar: 'كيف يمكنني مساعدتك؟', fr: 'Comment puis-je vous aider ?', en: 'How can I help you?' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* ── VIEW 1: Category list (+ search) ── */}
        {!selectedCategory && (
          <div className="py-3">
            <div className="mx-4 mb-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={l({
                  ar: 'ابحث عن سؤال...',
                  fr: 'Rechercher une question...',
                  en: 'Search a question...',
                })}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 placeholder:text-gray-400"
              />
            </div>

            {search.trim() ? (
              searchResults.length > 0 ? (
                searchResults.map(item => (
                  <div
                    key={item.id}
                    className="mx-4 mb-2 rounded-2xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50 p-4 cursor-pointer transition-all duration-150"
                    onClick={() => {
                      setSelectedCategory(item.categoryId as CategoryId);
                      setSelectedItem(item.id as ItemId);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-800 flex-1">{item.question[lang]}</p>
                      <FwdChevron className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="mx-4 py-8 text-center">
                  <p className="text-sm text-gray-400">
                    {l({ ar: 'لا توجد نتائج', fr: 'Aucun résultat', en: 'No results found' })}
                  </p>
                </div>
              )
            ) : (
              helpCategories.map(cat => (
                <div
                  key={cat.id}
                  className="mx-4 mb-3 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-teal-50 hover:border-teal-200 p-4 cursor-pointer transition-all duration-150"
                  onClick={() => setSelectedCategory(cat.id as CategoryId)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(cat.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900">{l(cat.label)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lang === 'ar' ? `${cat.items.length} أسئلة` : `${cat.items.length} questions`}
                      </p>
                    </div>
                    <FwdChevron className="w-4 h-4 text-gray-400 ms-auto flex-shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── VIEW 2: Question list ── */}
        {selectedCategory && !selectedItem && currentCategory && (
          <div className="py-2">
            <button
              className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 font-semibold hover:text-teal-700 cursor-pointer"
              onClick={() => setSelectedCategory(null)}
            >
              <BkChevron className="w-4 h-4" />
              {l({ ar: 'رجوع', fr: 'Retour', en: 'Back' })}
            </button>
            <p className="px-4 pb-3 font-black text-gray-900">{l(currentCategory.label)}</p>
            {currentCategory.items.map(item => (
              <div
                key={item.id}
                className="mx-4 mb-2 rounded-2xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50 p-4 cursor-pointer transition-all duration-150"
                onClick={() => setSelectedItem(item.id as ItemId)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800 flex-1">{l(item.question)}</p>
                  <FwdChevron className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VIEW 3: Answer view ── */}
        {selectedItem && currentItem && (
          <div className="py-2">
            <button
              className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 font-semibold hover:text-teal-700 cursor-pointer"
              onClick={() => setSelectedItem(null)}
            >
              <BkChevron className="w-4 h-4" />
              {l({ ar: 'رجوع', fr: 'Retour', en: 'Back' })}
            </button>
            <p className="px-4 pb-3 font-black text-gray-900 text-base">{l(currentItem.question)}</p>
            <div className="px-4">
              {renderAnswer(l(currentItem.answer))}
            </div>
            {/* Was this helpful? */}
            <div className="mx-4 mt-6 mb-4 p-4 rounded-2xl bg-gray-50 flex items-center justify-between">
              {feedbackShown ? (
                <p className="text-xs text-teal-600 font-semibold">
                  {l({ ar: 'شكراً على ملاحظتك', fr: 'Merci pour votre retour', en: 'Thanks for your feedback' })}
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 font-semibold">
                    {l({ ar: 'هل كان هذا مفيداً؟', fr: 'Était-ce utile ?', en: 'Was this helpful?' })}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={handleFeedback}
                      className="w-9 h-9 rounded-xl hover:bg-teal-100 flex items-center justify-center text-lg transition-colors"
                    >
                      👍
                    </button>
                    <button
                      onClick={handleFeedback}
                      className="w-9 h-9 rounded-xl hover:bg-red-100 flex items-center justify-center text-lg transition-colors"
                    >
                      👎
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );

  return (
    <>
      {/* ── Floating button ── */}
      <div className="fixed z-50 bottom-36 end-4 md:bottom-24 md:end-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 rounded-2xl bg-white border-2 border-teal-500 shadow-lg hover:shadow-xl hover:bg-teal-50 flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <CircleHelp className="w-5 h-5 text-teal-600" />
        </button>
      </div>

      {/* ── MOBILE: iOS-style bottom sheet ── */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-50 h-[80vh] bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        {panelContent}
      </div>

      {/* ── DESKTOP: slide-in panel (left of buttons) ── */}
      <div className={`hidden md:flex fixed bottom-8 end-24 z-40 w-96 max-h-[560px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex-col transition-all duration-300 ease-out ${
        isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {panelContent}
      </div>
    </>
  );
}
