# תוחלת ושונות
כדי לאבחן אם מודל ML מתנהג כצפוי, צריך שפה מדויקת לתיאור אי-ודאות: תוחלת מספרת היכן הממוצע, ושונות מספרת עד כמה רחוק ממנו.

## מה תדע בסוף
תחשב \(E[X]\), \(\text{Var}(X)\) וסטיית תקן של משתנה מקרי בדיד, תוכיח שתוחלת לינארית אבל שונות לא, ותסביר מתי numpy.var צריך ddof=1.

## האינטואיציה
דמיין שאתה עובד בקזינו שמשלם לך לפי תוצאת קוביה, שוב ושוב, מיליוני פעמים. ה-Expected Value, **תוחלת**, הוא הרווח הממוצע שלך לכל הטלה אחרי מיליוני סיבובים. ה-Variance, **שונות**, מודדת עד כמה כל הטלה בודדת קופצת סביב הממוצע הזה.

קזינו עם תוחלת גבוהה ושונות נמוכה: מרוויח כל פעם כמעט אותו סכום. קזינו עם תוחלת גבוהה ושונות גבוהה: פעם ג'קפוט, פעם כמעט כלום. את האנלוגיה הזו שמור לכל פעם שאתה רואה bias-variance tradeoff בML.

## הפורמליזם

**Expected Value, תוחלת** \(E[X]\) של משתנה מקרי בדיד \(X\) עם ערכים \(\{x_i\}\):
\[E[X] = \sum_{i} x_i \cdot P(X = x_i)\]

ולמשתנה רציף עם פונקציית צפיפות \(f(x)\):
\[E[X] = \int_{-\infty}^{\infty} x \cdot f(x) \, dx\]

**Linearity of Expectation, לינאריות התוחלת** מתקיימת תמיד, גם אם \(X\) ו-\(Y\) מתואמים:
\[E[aX + bY + c] = a\,E[X] + b\,E[Y] + c\]

**Variance, שונות** \(\text{Var}(X)\) מוגדרת כציפייה של סטייה בריבוע מהממוצע:
\[\text{Var}(X) = E\!\left[(X - E[X])^2\right]\]

נוסחת קיצור שימושית יותר לחישוב:
\[\text{Var}(X) = E[X^2] - (E[X])^2\]

כלל הסקלה: הוצא קבוע מחוץ לשונות בריבוע:
\[\text{Var}(aX + c) = a^2\,\text{Var}(X)\]

שונות של סכום של שני משתנים **בלתי תלויים**:
\[\text{Var}(X + Y) = \text{Var}(X) + \text{Var}(Y)\]

כשיש **Covariance, קוואריאנס** \(\text{Cov}(X,Y) \ne 0\):
\[\text{Var}(X + Y) = \text{Var}(X) + \text{Var}(Y) + 2\,\text{Cov}(X,Y)\]

**Standard Deviation, סטיית תקן** \(\sigma(X) = \sqrt{\text{Var}(X)}\). יחידות זהות ל-\(X\), ולכן קריאה יותר לדיווח אנושי.

**Sample Variance, שונות מדגם**: כשיש לך \(n\) תצפיות ולא האוכלוסיה כולה, מחלקים ב-\(n-1\) ולא ב-\(n\) (תיקון Bessel) כדי לקבל unbiased estimator:
\[s^2 = \frac{1}{n-1} \sum_{i=1}^{n}(x_i - \bar{x})^2\]

## דוגמה מחושבת

קוביה הוגנת שש-פאות: \(X \in \{1,2,3,4,5,6\}\), כל תוצאה בהסתברות \(\tfrac{1}{6}\).

**תוחלת:**
\[E[X] = \frac{1+2+3+4+5+6}{6} = \frac{21}{6} = 3.5\]

**\(E[X^2]\):**
\[E[X^2] = \frac{1^2+2^2+3^2+4^2+5^2+6^2}{6} = \frac{91}{6} \approx 15.17\]

**שונות:**
\[\text{Var}(X) = E[X^2] - (E[X])^2 = \frac{91}{6} - (3.5)^2 = 15.17 - 12.25 \approx 2.92\]

**סטיית תקן:** \(\sigma \approx 1.71\)

**בפייתון:**

```python
import numpy as np

x = np.arange(1, 7)
p = np.full(6, 1/6)

mean = np.sum(x * p)                # 3.5
var  = np.sum(x**2 * p) - mean**2  # 2.916...
std  = np.sqrt(var)                 # 1.708...

# שונות אוכלוסיה vs. מדגם (ddof=0 vs. ddof=1)
samples = np.random.choice(x, size=1000, p=p)
print(np.var(samples))        # ~2.9, ddof=0 (ברירת מחדל, biased)
print(np.var(samples, ddof=1))# ~2.9, ddof=1 (unbiased)
```

## המקרה שמפיל את האינטואיציה

**לינאריות מתקיימת לתוחלת בלבד.** אם \(X\) ו-\(Y\) מתואמים לחלוטין (Correlated), למשל שתי features שעולות ביחד בגאות שוק, אז:
\[\text{Var}(X + Y) > \text{Var}(X) + \text{Var}(Y)\]

בML: אם שני features קורלציה ביניהם גבוהה, שימוש בשניהם לא מכפיל מידע; הוא מגדיל את שונות ה-estimator ללא תועלת. בדיוק לכן PCA שימושי: הוא ממפה לכיוונים שהשונות שלהם כן אדיטיבית (עצמאיים).

**ציפיית האינטואיציה:** "סכום שתי קוביות = שתי קוביות בלתי תלויות" נכון. "סכום שני features מתואמים = הכפלת מידע" שגוי.

## טעויות נפוצות

1. **\(E[X^2] = (E[X])^2\)**: שגוי בדרך כלל. ההפרש ביניהם הוא בדיוק \(\text{Var}(X)\). הם שווים רק כש-\(\text{Var}(X) = 0\) (משתנה דטרמיניסטי).

2. **קבוע יוצא בלי ריבוע**: \(\text{Var}(2X) = 4\,\text{Var}(X)\), לא \(2\,\text{Var}(X)\). הקבוע יוצא בריבוע. חיבור קבוע לא משנה שונות כלל: \(\text{Var}(X + 5) = \text{Var}(X)\).

3. **numpy.var() עם N במקום N-1**: numpy.var() מחשב ברירת מחדל ddof=0 (שונות אוכלוסיה). לשונות מדגם (unbiased) צריך numpy.var(arr, ddof=1). sklearn משתמש ב-ddof=0 כברירת מחדל בScaler; pandas.DataFrame.var() משתמש ב-ddof=1. בדוק תמיד את ברירת המחדל.

4. **בלבול בין שונות לסטיית תקן**: שונות ביחידות בריבוע; סטיית תקן באותן יחידות כמו X. לדיווח אנושי: תמיד סטיית תקן.

## מתי זה לא משנה

כשהתפלגות ידועה ופרמטרית (למשל Normal מדויק עם \(\mu, \sigma\) ידועים), עובדים ישירות עם הפרמטרים ולא מחשבים מחדש. ב-time series קצרות, Variance לא מלכד תלות טמפורלית; שם autocorrelation יותר אינפורמטיבית.

ב-interview: כשמראיין שואל "מה variance?", הוא בוחן שתי דברים: האם אתה יודע את הנוסחה \(\text{Var}(X) = E[X^2] - (E[X])^2\), ואם אתה יודע למה ddof=1. תן שתיהן.

## חיבור

יחידה זו שייכת לבלוק M6, ענף **Probability and Statistics** (prob-stats) בעץ systems. תוחלת ושונות הן הבסיס לכל שאר הסטטיסטיקה בקורס: Confidence Intervals (m6-confidence-intervals) מכמתות את אי-הוודאות סביב תוחלת; Hypothesis Testing (m6-hypothesis-testing) שואלת אם ההפרש בין שתי תוחלות הוא מקרי; ו-Bias-Variance Tradeoff (m6-bias-variance) בונה מעל הנוסחאות האלה ישירות ומסביר מה מונע ממודל ML להיות מדויק.

```concepts
{"items":[{"id":"expectation","t":"Expected Value","he":"תוחלת","d":"ממוצע משוקלל של ערכי משתנה מקרי לפי הסתברויות: E[X] = sum x·P(X=x).","rel":["variance","linearity-of-expectation"],"node":"prob-stats"},{"id":"linearity-of-expectation","t":"Linearity of Expectation","he":"לינאריות התוחלת","d":"E[aX + bY + c] = aE[X] + bE[Y] + c, מתקיים גם כשX,Y מתואמים.","rel":["expectation"],"node":"prob-stats"},{"id":"standard-deviation","t":"Standard Deviation","he":"סטיית תקן","d":"שורש השונות: sigma = sqrt(Var(X)); יחידות זהות למשתנה, מתאים לדיווח.","rel":["variance","expectation"],"node":"prob-stats"},{"id":"sample-variance","t":"Sample Variance","he":"שונות מדגם","d":"s² = sum(xi - x-bar)² / (n-1); חלוקה ב-n-1 (תיקון Bessel) נותן unbiased estimator.","rel":["variance","expectation"],"node":"prob-stats"}]}
```

```quiz
{"id":"u-m6-expectation-variance-q1","tree":"systems","skill":"ml-classic","q":"ל-X יש E[X]=3 ו-Var(X)=4. יהי Y=2X+1. מה E[Y] ו-Var(Y)?","options":["E[Y]=7, Var(Y)=9","E[Y]=7, Var(Y)=16","E[Y]=7, Var(Y)=4","E[Y]=9, Var(Y)=16"],"answer":1,"explain":"E[2X+1] = 2·E[X]+1 = 7 (לינאריות). Var(2X+1) = 2²·Var(X) = 4·4 = 16; קבוע מחוץ לשונות יוצא בריבוע. Var(Y)=9 שגוי (2·4), Var(Y)=4 שגוי (התעלמות מסקלה)."}
```

```quiz
{"id":"u-m6-expectation-variance-q2","tree":"systems","skill":"ml-classic","q":"X מקבל ערכים 0 ו-2 בהסתברות שווה. מה Var(X)?","options":["0.5","1","2","4"],"answer":1,"explain":"E[X]=(0+2)/2=1. E[X²]=(0²+2²)/2=2. Var(X)=E[X²]-(E[X])²=2-1=1. לא 0.5 ולא 2; השגיאה הנפוצה היא לחשב E[X²] בלי לחסר (E[X])²."}
```
