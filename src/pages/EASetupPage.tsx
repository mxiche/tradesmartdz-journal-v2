import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, Check, FolderOpen, RefreshCw, Settings, Globe, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

type Lang = 'ar' | 'fr' | 'en';

const content: Record<Lang, {
  title: string;
  subtitle: string;
  steps: { title: string; desc: string; note?: string }[];
  downloadBtn: string;
  copyBtn: string;
  copied: string;
  userIdLabel: string;
  accountIdLabel: string;
  noAccountId: string;
  allowedUrlNote: string;
}> = {
  ar: {
    title: 'إعداد TradeSmartDz EA',
    subtitle: 'اتبع هذه الخطوات لمزامنة صفقاتك تلقائياً من MT5',
    downloadBtn: 'تنزيل ملف EA',
    copyBtn: 'نسخ',
    copied: 'تم النسخ',
    userIdLabel: 'معرف المستخدم (User ID)',
    accountIdLabel: 'معرف الحساب (Account ID)',
    noAccountId: 'قم بربط حسابك أولاً من صفحة ربط الحساب',
    allowedUrlNote: 'أضف هذا الرابط إلى القائمة المسموح بها في MT5',
    steps: [
      {
        title: 'تنزيل ملف EA',
        desc: 'انقر على زر التنزيل أدناه للحصول على ملف TradeSmartDz.mq5',
      },
      {
        title: 'نسخ الملف إلى MT5',
        desc: 'افتح MT5 ← File ← Open Data Folder ← MQL5 ← Experts\nالصق ملف TradeSmartDz.mq5 في هذا المجلد',
        note: 'يجب أن يكون الملف في مجلد Experts وليس في مجلد آخر',
      },
      {
        title: 'إعادة تشغيل MT5 وإضافة EA للرسم البياني',
        desc: 'أعد تشغيل MT5 بعد نسخ الملف\nافتح لوحة Navigator ← Expert Advisors\nاسحب TradeSmartDz وأفلته على أي رسم بياني',
      },
      {
        title: 'إدخال معرفاتك في إعدادات EA',
        desc: 'عند ظهور نافذة إعدادات EA، أدخل User ID و Account ID الخاصين بك\nيمكنك نسخهما من المربع أدناه',
      },
      {
        title: 'السماح بطلبات الإنترنت في MT5',
        desc: 'اذهب إلى MT5 ← Tools ← Options ← Expert Advisors\nفعّل "Allow WebRequest for listed URL"\nأضف الرابط التالي:',
        note: 'بدون هذه الخطوة لن يتمكن EA من إرسال الصفقات',
      },
    ],
  },
  fr: {
    title: 'Configuration TradeSmartDz EA',
    subtitle: 'Suivez ces étapes pour synchroniser vos trades automatiquement depuis MT5',
    downloadBtn: "Télécharger l'EA",
    copyBtn: 'Copier',
    copied: 'Copié !',
    userIdLabel: 'User ID',
    accountIdLabel: 'Account ID',
    noAccountId: 'Connectez d\'abord un compte depuis la page Connecter le compte',
    allowedUrlNote: 'Ajoutez cette URL à la liste autorisée dans MT5',
    steps: [
      {
        title: "Télécharger l'EA",
        desc: 'Cliquez sur le bouton de téléchargement ci-dessous pour obtenir TradeSmartDz.mq5',
      },
      {
        title: 'Copier le fichier dans MT5',
        desc: 'Ouvrez MT5 ← File ← Open Data Folder ← MQL5 ← Experts\nCollez TradeSmartDz.mq5 dans ce dossier',
        note: 'Le fichier doit être dans le dossier Experts',
      },
      {
        title: 'Redémarrer MT5 et ajouter l\'EA',
        desc: 'Redémarrez MT5 après avoir copié le fichier\nOuvrez Navigator ← Expert Advisors\nGlissez TradeSmartDz sur n\'importe quel graphique',
      },
      {
        title: 'Entrer vos IDs dans les paramètres EA',
        desc: 'Dans la fenêtre de paramètres EA, entrez votre User ID et Account ID\nCopiez-les depuis le bloc ci-dessous',
      },
      {
        title: 'Autoriser les requêtes Web dans MT5',
        desc: 'Allez dans MT5 ← Tools ← Options ← Expert Advisors\nActivez "Allow WebRequest for listed URL"\nAjoutez l\'URL suivante :',
        note: 'Sans cette étape, l\'EA ne peut pas envoyer les trades',
      },
    ],
  },
  en: {
    title: 'TradeSmartDz EA Setup',
    subtitle: 'Follow these steps to automatically sync your trades from MT5',
    downloadBtn: 'Download EA File',
    copyBtn: 'Copy',
    copied: 'Copied!',
    userIdLabel: 'User ID',
    accountIdLabel: 'Account ID',
    noAccountId: 'Connect an account first from the Connect Account page',
    allowedUrlNote: 'Add this URL to the allowed list in MT5',
    steps: [
      {
        title: 'Download the EA File',
        desc: 'Click the download button below to get TradeSmartDz.mq5',
      },
      {
        title: 'Copy the File into MT5',
        desc: 'Open MT5 → File → Open Data Folder → MQL5 → Experts\nPaste TradeSmartDz.mq5 into that folder',
        note: 'The file must be in the Experts folder, not any subfolder',
      },
      {
        title: 'Restart MT5 and Add the EA to a Chart',
        desc: 'Restart MT5 after copying the file\nOpen the Navigator panel → Expert Advisors\nDrag and drop TradeSmartDz onto any chart',
      },
      {
        title: 'Paste Your IDs into EA Settings',
        desc: 'When the EA settings window appears, enter your User ID and Account ID\nCopy them from the box below',
      },
      {
        title: 'Allow WebRequests in MT5',
        desc: 'Go to MT5 → Tools → Options → Expert Advisors\nEnable "Allow WebRequest for listed URL"\nAdd the following URL:',
        note: 'Without this step the EA cannot send trades to TradeSmartDz',
      },
    ],
  },
};

const SUPABASE_URL = 'https://vikqwycjqqoobteslbxp.supabase.co';

const stepIcons = [Download, FolderOpen, RefreshCw, Copy, Globe];

export default function EASetupPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const lang = (language as Lang) in content ? (language as Lang) : 'en';
  const c = content[lang];

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('mt5_accounts')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAccountId(data?.id ?? null));
  }, [user]);

  const copy = (value: string, field: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyBtn = ({ value, field }: { value: string; field: string }) => (
    <button
      onClick={() => copy(value, field)}
      disabled={!value}
      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
    >
      {copiedField === field
        ? <Check className="h-4 w-4 text-profit" />
        : <Copy className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{c.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      {/* Download button */}
      <a href="/TradeSmartDz.mq5" download="TradeSmartDz.mq5">
        <Button className="gradient-primary text-primary-foreground min-h-[44px] gap-2">
          <Download className="h-4 w-4" />
          {c.downloadBtn}
        </Button>
      </a>

      {/* Your IDs box */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-primary" />
            {lang === 'ar' ? 'معرفاتك — انسخها إلى إعدادات EA' : lang === 'fr' ? 'Vos IDs — à coller dans EA' : 'Your IDs — paste these into EA settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* User ID */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{c.userIdLabel}</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <code className="flex-1 truncate text-xs">{user?.id ?? '—'}</code>
              <CopyBtn value={user?.id ?? ''} field="userId" />
            </div>
          </div>
          {/* Account ID */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{c.accountIdLabel}</p>
            {accountId ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                <code className="flex-1 truncate text-xs">{accountId}</code>
                <CopyBtn value={accountId} field="accountId" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">{c.noAccountId}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        {c.steps.map((step, i) => {
          const Icon = stepIcons[i];
          return (
            <Card key={i} className="border-border bg-card">
              <CardContent className="flex gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{i + 1}</Badge>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="whitespace-pre-line text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                  {/* Show URL for step 5 */}
                  {i === 4 && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <code className="flex-1 truncate text-xs">{SUPABASE_URL}</code>
                      <CopyBtn value={SUPABASE_URL} field="supabaseUrl" />
                    </div>
                  )}
                  {step.note && (
                    <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
                      ⚠ {step.note}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
