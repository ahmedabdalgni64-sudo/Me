import React from 'react';
import { BookOpen, Activity, BarChart2, TrendingUp, Layers, Sliders, ShieldCheck } from 'lucide-react';

export const EducationalGuide: React.FC = () => {
  const indicators = [
    {
      title: 'مؤشر القوة النسبية (RSI 14)',
      icon: Activity,
      color: 'indigo',
      formula: 'RSI = 100 - (100 / (1 + RS))',
      rules: [
        'أقل من 30: تشبع بيعي حاد (Oversold) يرجح فرصة ارتداد شرائي.',
        'أكثر من 70: تشبع شرائي مفرط (Overbought) يرجح جني أرباح أو تصحيح.',
        'بين 30 و 70: منطقة استقرار وتوازن بين المشترين والبائعين.',
      ],
      tip: 'في الاتجاه الصاعد القوي قد يستمر RSI فوق 70 لفترة طويلة دون هبوط، لذا استخدمه دائماً بالتوافق مع الاتجاه.',
    },
    {
      title: 'مؤشر الماكد (MACD 12, 26, 9)',
      icon: BarChart2,
      color: 'cyan',
      formula: 'MACD = EMA(12) - EMA(26) | Signal = EMA(9)',
      rules: [
        'تقاطع خط الماكد أعلى خط الإشارة: إشارة شراء وزخم إيجابي متزايد.',
        'تقاطع خط الماكد أسفل خط الإشارة: إشارة بيع وضعف في الزخم.',
        'الهيستوغرام: يوضح الفارق بين الخطين، وتغير لونه ينبئ بانعكاس مبكر.',
      ],
      tip: 'التقاطعات التي تحدث تحت خط الصفر في مناطق عميقة غالباً ما تكون أكثر موثوقية للشراء.',
    },
    {
      title: 'المتوسطات المتحركة الأسية (EMA 20 & EMA 50)',
      icon: TrendingUp,
      color: 'amber',
      formula: 'EMA = (Close - EMA_prev) * Multiplier + EMA_prev',
      rules: [
        'السعر فوق EMA20 وEMA20 فوق EMA50: اتجاه صاعد قوي (إشارة شراء).',
        'السعر تحت EMA20 وEMA20 تحت EMA50: اتجاه هابط مستمر (إشارة بيع).',
        'تداخل المتوسطات مع السعر: حركة عرضية وتذبذب بدون اتجاه واضح.',
      ],
      tip: 'يعمل EMA20 كدعم ديناميكي في الصعود السريع، بينما يمثل EMA50 الاتجاه متوسط المدى.',
    },
    {
      title: 'أشرطة بولينجر (Bollinger Bands 20, 2)',
      icon: Layers,
      color: 'teal',
      formula: 'Middle = SMA(20) | Upper/Lower = Middle ± 2 * StdDev',
      rules: [
        'السعر عند أو تحت الحد السفلي: انضغاط بيعي مرشح للارتداد نحو المتوسط.',
        'السعر عند أو فوق الحد العلوي: وصول السعر لأقصى التوسع الإحصائي.',
        'انضغاط الشريطين معاً: ينبئ بانفجار سعري قادم.',
      ],
      tip: 'لمس الشريط الخارجي ليس دائماً إشارة بيع فورية، بل قياس للتطرف الإحصائي.',
    },
    {
      title: 'مؤشر ستوكاستيك (Stochastic 14, 3, 3)',
      icon: Sliders,
      color: 'purple',
      formula: '%K = ((Close - Low14) / (High14 - Low14)) * 100',
      rules: [
        'أقل من 20: تشبع بيعي عميق في نطاق آخر 14 شمعة.',
        'أكثر من 80: تشبع شرائي بالقرب من قمة النطاق الأخير.',
        'تقاطع %K فوق %D في المنطقة السفلية: تأكيد إضافي للشراء.',
      ],
      tip: 'مؤشر ممتاز في الأسواق العرضية لاصطياد الارتدادات من القيعان.',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">الدليل التعليمي لقواعد المؤشرات الفنية</h2>
          <p className="text-xs text-slate-400">
            شرح مبسط وواضح لكيفية حساب وتفسير كل مؤشر داخل تطبيق رادار العملات (Coin Radar)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {indicators.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-slate-850 text-amber-400 border border-slate-700">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                      {item.title}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      {item.formula}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 my-3">
                  <span className="text-xs font-semibold text-slate-300 block">
                    قواعد الإشارة المطبقة:
                  </span>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    {item.rules.map((rule, rIdx) => (
                      <li key={rIdx} className="leading-relaxed">
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-amber-300/90 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/20 leading-relaxed">
                <strong>نصيحة احترافية:</strong> {item.tip}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
