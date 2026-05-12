    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'

    export default defineConfig({
      plugins: [react()],
      base: './', // لضمان عمل الروابط بشكل صحيح على GitHub Pages
    })
    ```

### 2. تصحيح ترتيب استيراد الـ CSS
ذكرت أن هناك ترتيباً خاطئاً لـ `@import` داخل `src/index.css`. في Vite، يجب أن تظهر جميع تصريحات الاستيراد في أعلى الملف.
*   **الإجراء:** افتح `src/index.css` وانقل أي `@import` (مثل خطوط Google أو Tailwind) لتكون في أول السطور:
    
```css
    /* يجب أن يكون في البداية */
    @import 'tailwindcss/base';
    @import 'tailwindcss/components';
    @import 'tailwindcss/utilities';

    /* باقي التنسيقات تأتي لاحقاً */
    body { ... }
    ```

### 3. معالجة المسارات المفقودة (Broken Imports)
هذه هي النقطة الأهم لنجاح البناء. بما أن النظام يعمل على بيئة Linux (داخل GitHub Actions)، فإن أي اختلاف في حالة الأحرف (مثلاً `App.tsx` مقابل `app.tsx`) سيؤدي لفشل البناء.
*   **ملف Firebase و Sync Service:** تأكد من وجود هذه الملفات في المسارات المحددة في الكود. إذا كانت المسارات تشير إلى `src/services/firebase.ts` بينما الملف في `src/Firebase.ts`، يجب توحيد التسمية.
*   **مكونات UI:** راجع ملف `docs/PROJECT_BUILD_BLOCKERS_AR.md` لتحديد المكونات المفقودة بالضبط وقم بتعديل مساراتها لتطابق الهيكل الفعلي للمجلدات.

### 4. تهيئة بيئة الأندرويد (Gradle)
بما أنك قمت باستبدال `android/app/build.gradle` و `android/keystore.properties.example`:
*   قم بإنشاء نسخة من الملف الأخير باسم `android/keystore.properties` (بدون كلمة example).
*   تأكد من أن `build.gradle` يشير إلى متغيرات البيئة التي سنستخدمها في GitHub Actions لكي لا يتوقف البناء عند البحث عن مفاتيح التوقيع المفقودة محلياً.

### الخطوة القادمة (تنفيذ الإصلاح):
هل يمكنك تزويدي بمحتوى ملف `src/index.css` الحالي أو قائمة بالمسارات التي تعطي خطأ "File not found"؟ سأقوم فوراً بإعطائك الكود المصحح لكل ملف على حدة لتقوم برفعه إلى المستودع.
