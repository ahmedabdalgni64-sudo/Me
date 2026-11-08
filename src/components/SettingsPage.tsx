import React, { useState } from 'react';
import { audioAlert } from '../utils/audioAlert.js';
import {
  Settings,
  Volume2,
  VolumeX,
  Bell,
  Sliders,
  Shield,
  Key,
  RotateCcw,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SettingsPageProps {
  onResetPaper?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onResetPaper }) => {
  const [defaultTf, setDefaultTf] = useState<string>('1h');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [browserNotifs, setBrowserNotifs] = useState<boolean>(false);
  const [defaultRisk, setDefaultRisk] = useState<number>(2);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    audioAlert.setSoundEnabled(enabled);
    if (enabled) {
      audioAlert.playBuyChime();
    }
  };

  const handleRequestNotifs = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setBrowserNotifs(true);
        setSavedMessage('تم تفعيل إشعارات المتصفح بنجاح!');
      } else {
        setSavedMessage('تم رفض إذن الإشعارات من المتصفح.');
      }
    } else {
      setSavedMessage('المتصفح لا يدعم إشعارات سطح المكتب.');
    }
  };

  const handleSave = () => {
    setSavedMessage('تم حفظ تفضيلات المستخدم بنجاح.');
    setTimeout(() => setSavedMessage(null), 3000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">إعدادات وتفضيلات التطبيق</h2>
          <p className="text-xs text-slate-400">
            تخصيص الأطر الزمنية الافتراضية، التنبيهات الصوتية، وإدارة بيئة التداول
          </p>
        </div>
      </div>

      {savedMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{savedMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Timeframe & Display */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            تفضيلات العرض والتحليل
          </h3>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              الإطار الزمني الافتراضي عند فتح الأصل
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['15m', '1h', '4h', '1d'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setDefaultTf(tf)}
                  className={`py-2 rounded-xl font-mono font-bold border transition ${
                    defaultTf === tf
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              نسبة المخاطرة الافتراضية في حاسبة الصفقات: {defaultRisk}%
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={defaultRisk}
              onChange={(e) => setDefaultRisk(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* Audio & Alerts */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            الأصوات والتنبيهات
          </h3>

          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">التنبيهات الصوتية الحية</span>
              <span className="text-[11px] text-slate-400">
                تشغيل نغمة صوتية عند ظهور إشارات شراء قوي أو تنفيذ صفقات
              </span>
            </div>
            <button
              onClick={() => handleToggleSound(!soundEnabled)}
              className={`p-2 rounded-xl transition ${
                soundEnabled ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">إشعارات سطح المكتب / المتصفح</span>
              <span className="text-[11px] text-slate-400">
                إرسال إشعار فوري عند تحقق الشروط في الخلفية
              </span>
            </div>
            <button
              onClick={handleRequestNotifs}
              className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                browserNotifs
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {browserNotifs ? 'مفعل' : 'تفعيل الإذن'}
            </button>
          </div>
        </div>
      </div>

      {/* API Keys & Environment Security */}
      <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-3 text-xs">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-400" />
          إدارة بيئة التداول ومفاتيح Binance API
        </h3>
        <p className="text-slate-400 leading-relaxed font-sans">
          لحماية بياناتك، يتم ضبط مفاتيح التداول المباشرة الخاصة بحسابك على منصة بينانس من خلال متغيرات البيئة الآمنة بالخادم في ملف <code>.env</code> (متغير <code>BINANCE_API_KEY</code> و <code>BINANCE_API_SECRET</code>) بصلاحيات القراءة والتداول فقط (بدون صلاحيات سحب).
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={onResetPaper}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة تعيين رصيد المحفظة التجريبية (10,000 USDT)</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20"
        >
          حفظ التغييرات
        </button>
      </div>
    </div>
  );
};
