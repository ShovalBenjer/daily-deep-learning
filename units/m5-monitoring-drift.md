# ניטור: סחיפה, בטיחות, עיגון
מודל שעבד מצוין בסטג'ינג יכול להתחיל לפשל בפרודקשן בלי שאיש שינה שורת קוד אחת.

## מה תדע בסוף
תוכל להגדיר מהן שלוש הגדרות הניטור של Azure AI Foundry (data drift, safety metrics, groundedness trend), לתאר מה כל אחת מודדת ומתי היא אמורה להדליק התראה, ולהצביע על הנקודה שבה ניטור רגיל של זמני תגובה לא רואה בעיה שניטור AI רואה.

## האינטואיציה
דמיין שפתחת בית קפה. בשבוע הראשון הכנת לאטה לאנשים שמזמינים "קפה גדול". בחודש השלישי הלקוחות שמזמינים "קפה גדול" רוצים בעצם קפה קר, כי הקיץ הגיע. המתכון לא השתנה, הציוד לא השתנה, אבל המשמעות של "קפה גדול" השתנתה. זה data drift: הפצת הקלטים זזה. Concept drift זה גרוע יותר: גם ה"תשובה הנכונה" זזה. מה שהיה תשובה טובה בינואר עשוי להיות שגוי ביוני.

Groundedness drift שונה: הוא לא על המשתמשים אלא על המסמכים שהמודל מבסס עליהם את תשובותיו. אם ספריית המסמכים שלך נהייתה מיושנת, שיעור ה-hallucinations עולה בלי שהמודל עצמו השתנה.

## ההגדרות המדויקות
**Data drift, סחיפת נתונים** מתייחס לשינוי בהתפלגות הקלטים של המודל לאורך זמן. ב-Azure AI Foundry אפשר לאסוף logs של הקלטים ולהריץ evaluator שמחשב סטטיסטיקות של אורך הקלט, שפה, סוג שאלה, ולהשוות לחלון ייחוס (baseline).

**Concept drift, סחיפת קונספט** מתייחס לשינוי בקשר בין הקלט לבין התשובה הנכונה. לדוגמה, כלי AI שמייעץ על מחירי נדל"ן בוודאי צריך ריספלינג אחרי שינוי ריבית חד. ב-Azure AI Foundry ניטור כזה דורש ground truth: תוויות אנושיות או evaluator אוטומטי שמשמש כ-proxy.

**Safety metric trend, מגמת מדד בטיחות** הוא מעקב לאורך זמן אחר שיעור ההפעלה של content filter. אם אחוז הבקשות שנחסמות עולה פתאום, זה אות שאוכלוסיית המשתמשים השתנתה, שיש ניסיון תיאום של jailbreak, או שה-RAI policy יצרה חסימת יתר. Azure Monitor מציג metric זה כ-`ContentFilteredPrompt` ו-`ContentFilteredCompletion`.

**Groundedness trend, מגמת עיגון** הוא מעקב אחר שיעור ה-ungrounded responses לאורך זמן. ב-RAG, אם הספריה לא מתעדכנת אבל המשתמשים שואלים על אירועים חדשים, ה-groundedness score יורד. Azure AI Foundry תומך ב-scheduled evaluation run שמריץ את ה-groundedness evaluator על sample של השיחות שנשמרו.

**Evaluation cadence, תדירות הערכה** היא ההחלטה כמה פעמים ובאיזו צורה מריצים evaluation. שתי גישות עיקריות: triggered (כשיש deploy חדש) ו-scheduled (כל לילה על sample מהיום הקודם). הגישה הנכונה בפרודקשן היא שתיהן: triggered לוודא שלא שברת כלום, scheduled לזהות drift.

```widget
{"type":"decay","title":"Drift Monitor: צפה כיצד Groundedness Score יורד לאורך זמן ללא עדכון ספריה"}
```

```concepts
{"items":[{"id":"data-drift","t":"Data Drift","he":"סחיפת נתונים","d":"שינוי בהתפלגות קלטי המודל לאורך זמן; זוהה על ידי השוואה לחלון ייחוס בסיסי.","rel":["concept-drift","groundedness-trend"],"node":"azure-core"},{"id":"concept-drift","t":"Concept Drift","he":"סחיפת קונספט","d":"שינוי בקשר בין הקלט לבין התשובה הנכונה; דורש ground truth או evaluator proxy.","rel":["data-drift"],"node":"azure-core"},{"id":"safety-metric-trend","t":"Safety Metric Trend","he":"מגמת מדד בטיחות","d":"מעקב אחר שיעור הפעלת content filter לאורך זמן; עלייה פתאומית מאותתת על שינוי אוכלוסיה או תיאום jailbreak.","rel":["content-filter","data-drift"],"node":"azure-core"},{"id":"groundedness-trend","t":"Groundedness Trend","he":"מגמת עיגון","d":"ריצת groundedness evaluator מתוזמנת על sample מהתנועה; יורדת כשהספריה מתיישנת.","rel":["data-drift","rai-evaluator"],"node":"azure-core"},{"id":"evaluation-cadence","t":"Evaluation Cadence","he":"תדירות הערכה","d":"שילוב של triggered evaluation על deploy חדש ו-scheduled evaluation לילי לזיהוי drift.","rel":["groundedness-trend","safety-metric-trend"],"node":"azure-core"}]}
```

## דוגמה מחושבת
**סצנריו:** מערכת שאלות ותשובות פנימית מבוססת RAG שפרסנו בינואר. ספריית המסמכים לא עודכנה מאז.

1. ב-1 באוגוסט מריצים scheduled evaluation על 200 שיחות מהשבוע האחרון.
2. Groundedness evaluator מחזיר mean score של 0.61, ירידה מ-0.84 בינואר.
3. בודקים את השאלות שקיבלו `ungrounded: true`: רובן שואלות על אירועים אחרי ינואר.
4. מסקנה: הספריה לא מכסה תוכן חדש. המודל לא השתנה, העולם השתנה.
5. תיקון: מריצים ingestion pipeline מחדש, מכניסים מסמכים חדשים, מריצים שוב evaluation.
6. Groundedness עולה בחזרה ל-0.81.

שים לב: latency ו-error rate לא הראו שום בעיה לאורך כל התקופה. רק groundedness trend חשף את הבעיה.

```quiz
{"id":"u-m5-monitoring-drift-q1","tree":"ops","skill":"azure-foundry","q":"A RAG application's latency and error rate are normal, but users report that answers are becoming less accurate. Which monitoring signal is most likely to surface this problem?","options":["Token usage metrics in Azure Monitor","Content filter hit rate trend","Groundedness evaluator score trend","HTTP status code distribution"],"answer":2,"explain":"Latency and error-rate metrics are blind to factual accuracy. The groundedness evaluator compares model claims to source documents, so a downward trend in groundedness score directly signals that answers are drifting away from grounded content — exactly the hallucination problem described here."}
```

## המקרה שמפיל את האינטואיציה
Safety metric trend יכול ליפול גם כשהמוצר טוב יותר. אם שדרגת את ה-RAI policy להיות מחמירה יותר לפני release, שיעור החסימות עולה, ואלרט אוטומטי יפוצץ. הניטור חייב לעקוב גם אחרי baseline: האם העלייה מעבר לשינוי שביצעת בכוונה? הדרך לזהות הבדל היא לשמור snapshot של ה-policy עם כל שינוי ולסמן אותו בציר הזמן של ה-metrics.

## טעויות נפוצות
**מנטרים רק latency ו-error rate.** אלה המדדים שבנייה רגילה עוקבת אחריהם, אבל LLM יכול להיות "זמין" ו"מהיר" בזמן שהוא מייצר hallucinations. ניטור AI דורש AI evaluators, לא רק infra metrics.

**מריצים evaluation רק על deploy.** זה לוכד regression שנגרם מקוד חדש, אבל לא לוכד drift שנגרם מהעולם המשתנה. triggered + scheduled הם הצמד הנכון.

**שומרים logs בלי structure.** אם הקלטים ופלטים נשמרים כ-blob טקסט, לא ניתן להריץ evaluator אוטומטי עליהם בקלות. Foundry תומך ב-inference data collection שמשמר `input`, `output`, `context`, `metadata` כ-JSON מובנה, ממש מהקופסה.

**מגדירים אלרט אחד על average.** ממוצע כולל מסתיר clusters. אם 5% מהמשתמשים חווים ungrounded responses ו-95% חווים תשובות מצוינות, הממוצע עשוי להישאר גבוה. יש להגדיר אלרטים גם על percentile (P95 groundedness score) ולא רק על mean.

## מתי זה לא משנה
עבור prototype פנימי שרץ על data set סגור שאינו משתנה, scheduled monitoring הוא overhead מיותר. הגדרה של evaluation baseline ו-triggered evaluation על כל deploy מספיקה.

ב-MVP שאין לו עדיין מספיק תנועה (פחות מ-100 שיחות ביום), scheduled run על sample ייתן תוצאות רועשות. עדיף לצבור 2-3 שבועות של logs לפני שמגדירים threshold של אלרטים.

## חיבור
יחידה זו ממשיכה מ-`m5-responsible-ai` (שלוש שכבות ה-safety הפועלות בזמן אמת) ומ-`m5-foundry-model-selection` (בחירת deployment). הניטור הוא מה שמחזיק את ה-safety לאורך זמן אחרי שהפרסת. היחידה הבאה הטבעית היא `m5-audit-provenance` שמכסה את שכבת ה-governance: מי שינה מה ומתי, ומי צריך לאשר שינויים לפני שהם עוברים לפרודקשן.
