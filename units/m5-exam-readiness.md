# מוכנות למבחן
מבחן AI-103 לא נכשלים עליו מחוסר ידע, נכשלים עליו מחוסר מיפוי: לא ידעת מה לא ידעת.

## מה תדע בסוף
תוציא מפגש אחד עם ה-exam sandbox כ-gap list עם שמות נושאים ומשקלות, ותסיים אותו עם תאריך ישיבה ביומן.

## האינטואיציה

דמיין טייס לפני המראה. לטייס יש checklist לא כי הוא חושש שישכח לדלק, אלא כי ה-checklist הוא הכלי שחושף את ה-delta בין "אני חושב שאני מוכן" לבין "המטוס מוכן לעוף". ה-exam readiness הוא אותו checklist: הוא לא בוחן את הידע שלך, הוא מודד את המרחק שנשאר לסגור.

כשרואים שאלה ב-exam sandbox ועונים לא נכון, זה לא כישלון, זו נקודת נתון. כשאוספים עשרים נקודות כאלה ורואים שתשע מתוכן הן על RAG ו-grounding ורק אחת על identity, מקבלים מפה, ומפה עושה סדר.

## ההגדרות המדויקות

**Exam sandbox, סביבת המבחן**, הוא הכלי הרשמי של Microsoft בכתובת `aka.ms/examdemo`. הוא מדמה את ממשק הבחינה האמיתי: question format, drag-and-drop, hotspot, scenario-based. כניסה חינמית עם חשבון Microsoft. השאלות אינן זהות למבחן האמיתי אך מייצגות את הסגנון והרמה.

**Gap list, רשימת פערים**, היא טבלה שבונים מיד אחרי כל גלישה ב-sandbox: עמודות של נושא, משקל האזור במבחן, ורמת הביטחון שלך. נושאים עם ביטחון נמוך ומשקל גבוה עולים לראש.

**Scoring, ניקוד**: ציון עובר הוא 700 מתוך 1000. המבחן שוקל כל question לפי קושי ולא כל תשובה נכונה שווה אותו הדבר. זה אומר שעל השאלות בדומיינים הכבדים (Plan and manage: 25-30%, Generative AI and agentic: 30-35%) כל שגיאה כואבת יותר.

**Domain weights, משקלות הדומיינים** (לפי Study Guide הרשמי):
- Plan and manage an AI solution: 25-30%
- Implement generative AI solutions: 30-35%
- Implement agentic AI solutions: 15-20%
- Implement non-generative AI solutions: 20-25%

```concepts
{"items":[{"id":"exam-readiness","t":"Exam Readiness","he":"מוכנות למבחן","d":"שלב שלפני ישיבה: sandbox, gap list, תאריך. לא תחרות על ידע, בדיקת delta.","rel":["c-foundry","c-content-filter","c-groundedness"],"node":"azure-core"}]}
```

## דוגמה מחושבת

**פגישת sandbox בת 45 דקות:**

1. כנס ל-`aka.ms/examdemo` עם חשבון Microsoft.
2. בחר AI-103. עבור על 20 שאלות.
3. אחרי כל שאלה, לפני שרואים explanation, כתוב לעצמך: בטוח / לא בטוח.
4. בסוף, צור טבלה:

| נושא | שאלות שראיתי | טעויות | ביטחון |
|------|-------------|--------|--------|
| Managed Identity | 3 | 1 | גבוה |
| RAG grounding | 4 | 3 | נמוך |
| Content filters | 2 | 0 | גבוה |
| Agent tool-calling | 3 | 2 | בינוני |

5. כעת עדיפות ברורה: RAG grounding קודם, לפני Agent tool-calling.
6. קבע תאריך ישיבה. כתוב אותו בלוח שנה עכשיו.

זהו. חצי שעה הפכה את "אני צריך לחזור על הכל" ל-"אני צריך לחזור על שני נושאים ספציפיים".

## המקרה שמפיל את האינטואיציה

הנה הטעות הנפוצה ביותר: לומד עובר על כל 18 יחידות הלימוד ב-M5, מרגיש שהוא מכסה הכל, ואז מגיע ל-sandbox ומגלה שהוא יודע לקרוא את הסימנטיקה של Azure AI Foundry SDK אבל לא מצליח לענות על שאלות scenario-based שמשאירות אותו עם שתי אפשרויות ל-45 שניות.

זה הגבול של קריאה: reading comprehension אינה exam performance. ה-sandbox חושף את ה-delta הזה, וקריאה בלי sandbox לא חושפת אותו.

## טעויות נפוצות

**"אני אגש כשאסיים ללמוד"**: לא קיים מצב של "סיימתי ללמוד". קובעים תאריך ישיבה תחילה, ואז לומדים לעבר התאריך.

**דילוג על sandbox כי "אני יודע את החומר"**: ה-sandbox לא בודק אם אתה יודע. הוא בודק אם אתה מצליח לענות בפורמט ובזמן של מבחן אמיתי. זה שונה.

**בניית gap list בלי משקלות**: טעות שרמת ביטחון נמוכה ב-non-generative AI (20-25%) מעולה פחות מרמת ביטחון נמוכה ב-generative AI (30-35%). לא כל פער שווה.

**כניסה עם ציפייה לציון מושלם**: ציון עובר הוא 700, לא 1000. מי שמקדיש שבוע לחידוד עד לציון 850 על חשבון ישיבה, מפסיד את ה-ROI הנכון.

## מתי זה לא משנה

אם אתה ב-learning mode ועוד לא כיסית את הדומיינים הגדולים (generative AI, agentic), exam readiness יחזיר gap list כה ארוכה שתגרום לתסכול ולא לתוכנית. הגיוני לבצע את ה-readiness pass רק אחרי שלפחות 70% מיחידות M5 נסגרו.

**לעומת מה**: לחלופין אפשר להשתמש ב-Measure Up ו-WhizLabs לבחינות תרגול. הם מספקים שאלות יותר ממוקדות לנושאים ספציפיים, אבל ה-exam sandbox הרשמי הוא הכלי היחיד שמדמה את הפורמט האמיתי.

## חיבור

יחידה זו היא ה-capstone של בלוק M5. כל יחידה שלפניה, מ-Foundry model selection עד Agent approval, היא חומר גלם שמכניסים ל-sandbox ומקבלים gap list. אחרי ישיבת ה-sandbox יש לך מפה לשבוע האחרון לפני הבחינה.

מה שמגיע אחרי: הבחינה עצמה, ואחריה, בלוק M3 (system design) שפותח את ה-node sysdesign בעץ systems.

```quiz
{"id":"u-m5-exam-readiness-q1","tree":"ops","skill":"azure-foundry","q":"מה הציון המינימלי לעמוד במבחן AI-103?","options":["600 מתוך 1000","700 מתוך 1000","750 מתוך 1000","800 מתוך 1000"],"answer":1,"explain":"ציון עובר הוא 700 מתוך 1000. ציון זה מוגדר בעמוד הרשמי של ההסמכה ואינו תלוי בגרסת המבחן."}
```

```quiz
{"id":"u-m5-exam-readiness-q2","tree":"ops","skill":"azure-foundry","q":"איזה דומיין במבחן AI-103 נושא את המשקל הגבוה ביותר?","options":["Plan and manage an AI solution (25-30%)","Implement generative AI solutions (30-35%)","Implement agentic AI solutions (15-20%)","Implement non-generative AI solutions (20-25%)"],"answer":1,"explain":"'Implement generative AI solutions' הוא הדומיין עם המשקל הגבוה ביותר: 30-35%. לכן שגיאות שם כואבות יותר. לפי ה-Study Guide הרשמי של Microsoft."}
```

```quiz
{"id":"u-m5-exam-readiness-q3","tree":"ops","skill":"azure-foundry","q":"מה הכתובת הרשמית של ה-exam sandbox של Microsoft ל-AI-103?","options":["aka.ms/ai103demo","aka.ms/examdemo","learn.microsoft.com/exam-sandbox","portal.azure.com/exam"],"answer":1,"explain":"הכתובת הרשמית היא aka.ms/examdemo. היא חינמית ומדמה את פורמט הבחינה האמיתי."}
```

<!-- audited -->
