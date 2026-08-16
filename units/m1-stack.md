# מחסנית
כשהמחשב בודק שכל `{` נסגר לפני ה-`}` שלו, הוא שומר רשימה של פתוחים שגדלה ומתכווצת מאותו קצה -- בדיוק כמו ערמת צלחות.

## מה תדע בסוף
תדע לבנות stack ב-Python עם list, לפתור בעיות "סגירה תואמת" ו"הערך הגדול הבא" בזמן \(O(n)\), ולזהות מתי LIFO הוא הכלי הנכון בראיון.

## האינטואיציה

ערמת צלחות: הצלחת שהנחת אחרונה היא הראשונה שתרים. אי אפשר להוציא את הצלחת התחתונה בלי להפיל את כולן מעליה.

זה בדיוק מה שמחסנית עושה: **LIFO -- Last In, First Out, אחרון נכנס ראשון יוצא**. יש לה שתי פעולות בלבד:
- **push**: הנח צלחת בראש.
- **pop**: הרם ממש מהראש.

ה-analogy מחזיקה בכל הבעיות: תמיד שאל "מה האחרון שנפתח ועדיין לא נסגר?". אם שאלה מנוסחת כך -- כנראה צריך stack.

## ההגדרות המדויקות

**Stack, מחסנית**: מבנה נתונים שמאפשר גישה רק לקצה אחד, הנקרא **top, ראש**. ב-Python מממשים אותה עם list רגיל:

```python
stack = []          # ריקה
stack.append(3)     # push -> [3]
stack.append(7)     # push -> [3, 7]
stack.append(2)     # push -> [3, 7, 2]
x = stack.pop()     # pop  -> x=2, stack=[3, 7]
top = stack[-1]     # peek -> top=7, stack=[3, 7]  (לא מסיר)
```

| פעולה | Python | זמן ריצה |
|---|---|---|
| push | `stack.append(x)` | \(O(1)\) מופחת |
| pop | `stack.pop()` | \(O(1)\) |
| peek (הצצה) | `stack[-1]` | \(O(1)\) |
| בדיקה ריקה | `not stack` | \(O(1)\) |
| חיפוש ערך | לא מומלץ | \(O(n)\) |

**Amortized \(O(1)\), מופחת**: list של Python מכפיל את גודלו כשהוא מתמלא. הוספה בודדת עשויה לעלות \(O(n)\) כשקוראים resize, אך בממוצע על פני הרבה הוספות העלות היא \(O(1)\) לפעולה.

**Peek, הצצה**: `stack[-1]` מחזיר את הפריט בראש בלי להסירו. תמיד בדוק שה-stack לא ריק לפני peek.

```python
if stack:
    top = stack[-1]   # בטוח
```

### מתי list ומתי deque

`collections.deque` מאפשרת push ו-pop בשני קצוות ב-\(O(1)\) מובטח (לא מופחת). לצורכי stack, list מספיקה לגמרי. deque נדרשת כשצריך גם תור (queue) באותו מבנה.

## דוגמה מחושבת

### בדיקת סוגריים מאוזנות (Valid Parentheses)

קבל מחרוזת כגון `"([{}])"`. החזר `True` אם כל סוגר פותח מוצמד לסוגר סוגר תואם בסדר הנכון.

```python
def is_valid(s: str) -> bool:
    stack = []
    match = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)          # push הפותח
        elif ch in ')]}':
            if not stack or stack[-1] != match[ch]:
                return False          # אין פותח, או לא תואם
            stack.pop()               # הזוג הושלם
    return len(stack) == 0            # כל הפותחים נסגרו
```

עקוב אחרי `"([{}])"` צעד אחר צעד:

| תו | פעולה | stack אחרי |
|---|---|---|
| `(` | push | `['(']` |
| `[` | push | `['(', '[']` |
| `{` | push | `['(', '[', '{']` |
| `}` | top=`{`, match=`{` ✓, pop | `['(', '[']` |
| `]` | top=`[`, match=`[` ✓, pop | `['(']` |
| `)` | top=`(`, match=`(` ✓, pop | `[]` |
| סוף | stack ריק | `True` |

זמן: \(O(n)\) -- כל תו נכנס ויוצא מה-stack לכל היותר פעם אחת.
מרחב: \(O(n)\) -- במקרה הגרוע כל התווים פותחים ואין סגירות.

### ערך גדול הבא (Next Greater Element)

עבור כל אינדקס, מצא את הערך הראשון גדול ממנו מימין. קלט: `[2, 1, 2, 4, 3]`, פלט: `[4, 2, 4, -1, -1]`.

```python
def next_greater(nums: list[int]) -> list[int]:
    result = [-1] * len(nums)
    stack = []          # אינדקסים של ערכים שעדיין "ממתינים"
    for i, val in enumerate(nums):
        while stack and nums[stack[-1]] < val:
            idx = stack.pop()
            result[idx] = val   # val הוא הגדול הבא של idx
        stack.append(i)
    return result
```

כאן ה-stack שומר אינדקסים בסדר ש-nums שלהם יורד (או שווה). כשמגיע ערך גדול יותר, הוא "פותר" את כל הממתינים שהוא גדול מהם. זוהי **Monotonic stack, מחסנית מונוטונית** -- pattern שחוזר רבות.

## המקרה שמפיל את האינטואיציה

**`"]("` נראה "שני סוגרים" אבל אינו תקין.** הסוגר הסוגר `]` מגיע לפני כל פתיחה. כשהוא מגיע, ה-stack ריק -- מחזירים `False` מיד. ה-stack בודק **סדר**, לא רק קיום.

**ה-call stack של Python הוא stack מחסנית ממש.** כל קריאה ל-function מבצעת push של **stack frame, מסגרת קריאה** (מקומיים, כתובת חזרה). כשה-function מסתיים, ה-frame עושה pop. רקורסיה עמוקה מדי מוציאה `RecursionError: maximum recursion depth exceeded` -- הגדרת ברירת המחדל של Python היא 1000 frames. שינוי: `sys.setrecursionlimit(5000)`. ה-stack הפנימי הוא בדיוק המבנה שלמדנו, רק שהמערכת מנהלת אותו.

## טעויות נפוצות

**pop על stack ריק.** `[].pop()` זורק `IndexError`. תמיד בדוק: `if not stack: return False` (או טיפול מתאים) לפני pop.

**push לראש בשיטה הלא נכונה.** `stack.insert(0, x)` מוסיף לתחילת ה-list -- זה \(O(n)\), לא \(O(1)\). `append` מוסיף לסוף, שהוא ה-top של stack.

**שכחה לנקות stack בסוף.** ב-Valid Parentheses, לולאה שסיימה בלי שגיאה אבל ה-stack לא ריק -- יש פותחים בלי סגירות. `"((("` עובר את הלולאה בלי `False` אבל `len(stack) == 0` הוא `False`. תמיד return את הבדיקה הזו.

**שימוש ב-deque כ-stack כאשר list מספיקה.** deque תקינה, אך `stack.appendleft` ו-`stack.popleft` יוצרים תור, לא מחסנית. עם deque כמחסנית, השתמש ב-`append` ו-`pop` (אותם כמו list).

**ניסיון לחפש בתוך stack.** stack אינה מבנה חיפוש. `x in stack` עובד ב-Python (O(n)) אבל הוא אות לשימוש שגוי במבנה -- אם צריך חיפוש מהיר, הוסף set מקביל.

## מתי זה לא משנה

אם צריך לגשת לפריט שרירותי לפי אינדקס -- list ישירה עדיפה.

אם סדר העיבוד צריך להיות **FIFO -- First In First Out, ראשון נכנס ראשון יוצא** (כמו תור בראיון BFS) -- השתמש ב-**queue, תור**: `from collections import deque; q = deque(); q.append(x); q.popleft()`.

בראיונות, stack מוצג בדרך כלל דרך בעיות שבהן כל תשובה מתגלה "לאחור": ביטויים חשבוניים, תיק מניות (stock span), היסטוריית דפדפן. אם ה-pattern לא ברור -- נסה לצייר כמה צעדים; אם תמיד מסתכל רק לאחור, כנראה stack.

```quiz
{"id":"u-m1-stack-q1","tree":"systems","skill":"python","q":"מה תחזיר `stack.pop()` על רצף push של 1, 2, 3 לפי הסדר?","options":["1","2","3","IndexError"],"answer":2,"explain":"Stack הוא LIFO -- האחרון שנוסף (3) הוא הראשון שיוצא. pop() מחזיר 3."}
```

```concepts
{"items":[{"id":"c-stack","t":"Stack","he":"מחסנית","d":"מבנה LIFO: push ו-pop מהראש בלבד, O(1) לשתי הפעולות","rel":["c-lifo","c-monotonic-stack"],"node":"dsa"},{"id":"c-lifo","t":"LIFO","he":"אחרון נכנס ראשון יוצא","d":"תכונת מחסנית: האחרון שנוסף הוא הראשון שיוסר","rel":["c-stack"],"node":"dsa"},{"id":"c-monotonic-stack","t":"Monotonic stack","he":"מחסנית מונוטונית","d":"stack שמשמר סדר ערכים עולה/יורד; פותר בעיות next-greater ב-O(n)","rel":["c-stack"],"node":"dsa"}]}
```
