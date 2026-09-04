# 🌐 OmniSearch AI (أومني سيرش)
منظومة البحث الشامل واستقصاء النماذج المتعددة المدعومة بالذكاء الاصطناعي (Google Gemini, GPT-4o, Claude 3.5).

---

## 🚀 دليل الرفع والتشغيل على Google و GitHub

إذا قمت برفع المشروع من GitHub وظهرت لك نتائج بحث عامة أو غير واقعية، فهذا يعود لأحد سببين:
1. **تم رفع الموقع كصفحة ثابتة (Static Page) بدون تشغيل خادم Node.js الخلفي.**
2. **لم يتم إدخال مفتاح `GEMINI_API_KEY` في إعدادات الاستضافة.**

إليك كيفية حل المشكلة وتشغيل الموقع بكامل طاقته ومجاناً:

### الخيار 1: التشغيل الفوري المباشر عبر المتصفح (بدون خادم - مجاناً 100%)
إذا كنت تستخدم استضافة ثابتة مثل **GitHub Pages**, **Firebase Hosting**, أو **Vercel**:
1. افتح الموقع واضغط على أيقونة **الإعدادات ⚙️** في الزاوية العلوية.
2. احصل على مفتاح مجاني بضغطة زر من: [Google AI Studio](https://aistudio.google.com/app/apikey).
3. ضع المفتاح في خانة **Google Gemini API Key** واضغط **حفظ المفتاح**.
4. سيعمل البحث الآن فورياً ومباشراً من متصفحك مع Google Gemini بنتائج واقعية وحية 100%!

*(بدلاً من ذلك، يمكنك إضافة المتغير `VITE_GEMINI_API_KEY=AIzaSy...` في ملف `.env` قبل بناء المشروع بأمر `npm run build`)*.

---

### الخيار 2: الرفع كخادم كامل على Google Cloud Run (Full-Stack)
إذا أردت تشغيل الموقع مع خادم Node.js Express الخلفي:

1. **إعداد متغير البيئة في Google Cloud Run**:
   - توجه إلى لوحة تحكم Google Cloud Console -> **Cloud Run**.
   - اختر الخدمة أو أنشئ خدمة جديدة.
   - في قسم **Variables & Secrets** أضف المتغير:
     - الاسم: `GEMINI_API_KEY`
     - القيمة: مفتاح الـ API الخاص بك من Google AI Studio.

2. **أوامر التشغيل**:
   ```bash
   # تثبيت الحزم
   npm install

   # بناء المشروع وخادم السيرفر
   npm run build

   # بدء تشغيل السيرفر
   npm start
   ```

3. **باستخدام Docker**:
   يحتوي المشروع على ملف `Dockerfile` جاهز للعمل مباشرة مع Google Cloud Run و Artifact Registry.

---

## 🛠️ التقنيات المستخدمة
- **الواجهة الأمامية**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
- **الخادم الخلفي**: Express, tsx, esbuild
- **محركات الذكاء الاصطناعي**: Google Gemini 3.1 Flash Lite, Google Gemini 3.6 Flash, OpenRouter
