import React from 'react';
import { Shield, Lock, EyeOff, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">سياسة الخصوصية والأمان والتنبيه القانوني</h2>
          <p className="text-xs text-slate-400">
            التزام كامل بالشفافية وحماية بيانات المستخدم وعدم طلب أو تخزين أي مفاتيح سرية
          </p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-sans">
        {/* Core Security Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center gap-2">
            <Lock className="w-6 h-6 text-emerald-400" />
            <h4 className="font-bold text-slate-100 text-xs">بدون مفاتيح API تداول</h4>
            <p className="text-[11px] text-slate-400">
              التطبيق لا يطلب ولا يخزن أي مفاتيح API خاصة بحسابك الشخصي على أي منصة إطلاقاً.
            </p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center gap-2">
            <EyeOff className="w-6 h-6 text-cyan-400" />
            <h4 className="font-bold text-slate-100 text-xs">قراءة وتحليل فقط</h4>
            <p className="text-[11px] text-slate-400">
              الواجهة مبنية للتحليل وقراءة الشموع الفنية فقط، ولا يمكنها تنفيذ أو توقيع أي صفقات بيع وشراء.
            </p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-amber-400" />
            <h4 className="font-bold text-slate-100 text-xs">بيانات عامة مباشرة</h4>
            <p className="text-[11px] text-slate-400">
              جميع الأسعار والشموع مستمدة مباشرة من الخوادم العامة الرسمية لمنصة بينانس (Public API).
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 space-y-2">
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            1. طبيعة البيانات والخدمة
          </h3>
          <p className="text-xs text-slate-400">
            يقدم تطبيق "الاسم_الجديد" خدمات قراءة حركة السوق وتحليل المؤشرات الفنية (RSI, MACD, EMA, Bollinger, Stochastic) لأسواق العملات الرقمية الفورية (Spot). يتم جلب الشموع والأسعار اللحظية من واجهات بينانس العامة من خلال الخادم الخلفي للتطبيق بهدف تخزين مؤقت آمن يمنع تجاوز حدود الاستخدام (Rate Limiting).
          </p>
        </section>

        {/* Section 2 */}
        <section className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 space-y-2">
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            2. خصوصية المستخدم
          </h3>
          <p className="text-xs text-slate-400">
            نحن لا نجمع أي بيانات تعريفية شخصية، ولا نقوم بتتبع عنوان IP الخاص بك لأي أغراض إعلانية، ولا نتشارك بياناتك مع أي طرف خارجي. إعداداتك ومفضلاتك تظل محفوظة محلياً في متصفحك.
          </p>
        </section>

        {/* Section 3: Financial Disclaimer */}
        <section className="bg-amber-950/20 border border-amber-800/50 p-5 rounded-2xl space-y-2">
          <h3 className="font-bold text-amber-300 text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            3. إخلاء المسؤولية والتنبيه المالي (Financial Disclaimer)
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            التحليل الفني، الإشارات الرقمية، وقراءات الصفقات المعروضة في التطبيق هي لأغراض تعليمية ومعلوماتية فقط وليست نصيحة مالية أو استثمارية أو توصية بشراء أو بيع أي أصل رقمي.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            أسواق العملات الرقمية تنطوي على مخاطر عالية وتقلبات سعرية حادة قد تؤدي إلى خسارة جزء أو كل رأس مالك المستثمر. يجب على كل متداول إجراء بحثه ودراسته المستقلة واستشارة مستشار مالي مرخص قبل اتخاذ أي قرارات تداول.
          </p>
        </section>
      </div>
    </div>
  );
};
