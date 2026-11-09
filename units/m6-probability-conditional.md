# הסתברות והסתברות מותנית
כשמודל ML מדרג מועמדים לעבודה, הוא שואל שאלה אחת: כמה סביר זה, בהינתן מה שאני יודע?

## מה תדע בסוף
תחשב הסתברות מותנית ביד ותיישם את משפט בייס, ותזהה מתי base rate נמוך הופך תוצאה חיובית לפחות מאיים ממה שנראה.

## האינטואיציה
דמיין דלי עם 100 כדורים. עשרה מהם אדומים, ועשרה כחולים מנוקדים. P(אדום) = 10/100 = 0.1. עכשיו מישהו שולף כדור, מכסה אותו ביד ואומר: "הוא מנוקד". ה-universe של האפשרויות מצטמצם לעשרת הכדורים המנוקדים בלבד. P(אדום | מנוקד) כבר לא עוסק ב-100 כדורים אלא ב-10 בלבד. זו הסתברות מותנית (conditional probability): עדכון של ה-universe כשמידע חדש מגיע.

## ההגדרות המדויקות

**מרחב מדגם (sample space)**, Ω, הוא קבוצת כל התוצאות האפשריות. למטבע: Ω = {עץ, פלי}.

**אירוע (event)**, A, הוא תת-קבוצה של Ω.

**הסתברות שולית (marginal probability)**: \(P(A)\), הסיכוי ש-A מתרחש בלי תנאי נוסף.

**הסתברות משותפת (joint probability)**: \(P(A \cap B)\), הסיכוי שגם A וגם B מתרחשים.

**הסתברות מותנית (conditional probability)**:
\[P(A \mid B) = \frac{P(A \cap B)}{P(B)}, \quad P(B) > 0\]
קרא: "הסיכוי ל-A בהינתן ש-B ידוע."

**חוק הכפל (product rule)**:
\[P(A \cap B) = P(A \mid B) \cdot P(B)\]

**עצמאות (independence)**: A ו-B עצמאיים אם \(P(A \cap B) = P(A) \cdot P(B)\), שקול ל-\(P(A \mid B) = P(A)\). ידיעה על B לא שינתה כלום לגבי A.

**משפט בייס (Bayes' theorem)**:
\[P(A \mid B) = \frac{P(B \mid A) \cdot P(A)}{P(B)}\]

שמות הצדדים: \(P(A)\) הוא ה-prior (מה שידעתי לפני), \(P(B \mid A)\) הוא ה-likelihood (כמה סביר לראות B אם A נכון), ו-\(P(A \mid B)\) הוא ה-posterior (מה שאני יודע אחרי). את המכנה \(P(B)\) מחשבים לפי חוק ההסתברות הכוללת (law of total probability):
\[P(B) = P(B \mid A)\,P(A) + P(B \mid \overline{A})\,P(\overline{A})\]

## דוגמה מחושבת

**בדיקה רפואית**. מחלה נדירה: \(P(\text{מחלה}) = 0.01\). לבדיקה יש sensitivity = 0.9, כלומר \(P(\text{חיובי} \mid \text{חולה}) = 0.9\), ו-false positive rate של 5%, כלומר \(P(\text{חיובי} \mid \text{בריא}) = 0.05\). קיבלנו תוצאה חיובית. מה הסיכוי שאנחנו חולים?

**שלב 1**: חשב \(P(\text{חיובי})\):
\[P(+) = 0.9 \times 0.01 + 0.05 \times 0.99 = 0.009 + 0.0495 = 0.0585\]

**שלב 2**: הפעל בייס:
\[P(\text{מחלה} \mid +) = \frac{0.9 \times 0.01}{0.0585} \approx 0.154\]

רק **15%**. הבדיקה חיובית, אבל 85% מהנבדקים החיוביים בריאים. ה-prior הנמוך (0.01) מושך את ה-posterior למטה. זהו base rate neglect: כשמחלה נדירה, גם בדיקה טובה מייצרת בעיקר false positives.

## המקרה שמפיל את האינטואיציה

**prosecutor's fallacy**: P(חיובי|חולה) = 0.9 אינו P(חולה|חיובי) = 0.15. הצדדים הפוכים ולא שווים. מודל ML שמדרג לפי score גבוה עשוי לספק recall מצוין (sensitivity) אבל precision נמוך כשהמחלקה המיעוטית נדירה. ה-prior חייב להיכנס לחישוב כדי לדעת כמה לסמוך על כל positive prediction.

## טעויות נפוצות

1. **היפוך \(P(A \mid B)\) ו-\(P(B \mid A)\)**. "הבדיקה חיובית ב-90% מהחולים" אינו "90% מהחיוביים חולים". הפעל בייס לפני כל מסקנה.
2. **הנחת עצמאות ללא בדיקה**. Naive Bayes מניח שמאפיינים עצמאיים בהינתן המחלקה. בנתונים אמיתיים מאפיינים כמו גיל ו-BMI קורלטיביים. המודל לעיתים עובד בפועל, אבל ה-probability output אינו מכוּיל.
3. **שכחה לנרמל**. בחישוב posterior דרך בייס חייבים לחשב את \(P(B)\) כסכום על כל ההשערות. מי שמשמיט את הנרמליזציה מקבל ערכים מעל 1.

## מתי זה לא משנה

כשכל ה-priors שווים (uniform prior), משפט בייס נותן אותה תוצאה כמו maximum likelihood estimation. בסיווג עם balanced classes אפשר לעיתים להתעלם מ-priors לחלוטין. אבל עם class imbalance של 10:1 או יותר ה-prior מכתיב את ה-precision, ומי שמתעלם ממנו יתפלא למה ה-false positive rate שלו גבוה כל-כך.

## חיבור

יחידה זו פותחת את בלוק M6, **הסתברות וסטטיסטיקה** (node: prob-stats, עץ systems). ה-conditional probability הוא הבסיס ל-distributions בשיעור הבא (M6-distributions), ל-expectation ו-variance, ולבסוף ל-A/B test design. Naive Bayes classifier מיישם ישירות את הפורמולה שחישבנו. בלוק M5 בנה intuition שמודל הוא פונקציית scoring; כאן הבנת למה ה-score הוא הסתברות ואיך לכייל אותה.

```quiz
{"id":"u-m6-probability-conditional-q1","tree":"systems","skill":"ml-classic","q":"בדיקה רפואית: P(חיובי|חולה)=0.9, P(חיובי|בריא)=0.05, P(חולה)=0.01. מה בערך P(חולה|חיובי)?","options":["0.90","כ-0.15","0.50","0.01"],"answer":1,"explain":"משפט בייס: P(חולה|חיובי)=P(חיובי|חולה)·P(חולה)/P(חיובי). P(חיובי)=0.9×0.01+0.05×0.99≈0.0585. לכן P(חולה|חיובי)≈0.009/0.0585≈0.154. ה-prior הנמוך מושך את ה-posterior למטה. 0.90 היא ה-sensitivity, לא ה-posterior."}
```

```concepts
{"items":[{"id":"c-conditional-probability","t":"Conditional Probability","he":"הסתברות מותנית","d":"P(A|B)=P(A∩B)/P(B): הסיכוי ל-A בהינתן שידוע ש-B התרחש; מצמצם את ה-universe לאירועים שבהם B נכון","rel":["c-bayes-theorem","c-joint-probability"],"node":"prob-stats"},{"id":"c-bayes-theorem","t":"Bayes' Theorem","he":"משפט בייס","d":"P(A|B)=P(B|A)P(A)/P(B): הופך likelihood ו-prior ל-posterior; מאפשר עדכון אמונה לאחר ראיה","rel":["c-conditional-probability","c-marginal-probability"],"node":"prob-stats"},{"id":"c-marginal-probability","t":"Marginal Probability","he":"הסתברות שולית","d":"P(A) ללא תנאי; מתקבלת מסכום P(A,B) על כל ערכי B (marginalization)","rel":["c-joint-probability"],"node":"prob-stats"},{"id":"c-joint-probability","t":"Joint Probability","he":"הסתברות משותפת","d":"P(A∩B): הסיכוי שגם A וגם B מתרחשים; P(A∩B)=P(A|B)P(B)","rel":["c-conditional-probability","c-statistical-independence"],"node":"prob-stats"},{"id":"c-statistical-independence","t":"Statistical Independence","he":"עצמאות סטטיסטית","d":"A,B עצמאיים אם P(A∩B)=P(A)P(B); ידיעה על B לא שינתה את P(A)","rel":["c-conditional-probability"],"node":"prob-stats"}]}
```

<!-- audited -->
