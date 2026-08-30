# חיפוש בינארי וגרסאותיו
כשמחפשים שם בספר טלפונים, לא מתחילים מעמוד 1; בכל פתיחה שמים אצבע באמצע ומחליטים לאיזה חצי לרדת - וזו בדיוק האינטואיציה של חיפוש בינארי.

## מה תדע בסוף
תדע לממש חיפוש בינארי לשלוש מטרות: מציאת ערך מדויק (exact match), מציאת הגבול השמאלי (leftmost bound), ומציאת הגבול הימני (rightmost bound); תבין למה כותבים `mid = left + (right - left) // 2` ולא `(left + right) // 2`; תוכל להשתמש ב-`bisect` של Python; תזהה "טביעת האצבע" של חיפוש בינארי גם כשאין מערך מפורש.

## האינטואיציה

פתח ספר טלפונים עם מיליון עמודים ומחפש "כהן". פותח לעמוד 500,000: "שמיר" - מדי גבוה. פותח לעמוד 250,000: "כרמי" - קצת גבוה. פותח לעמוד 125,000: "גפן" - מדי נמוך. ממשיך.

בכל שלב חוצים את מרחב החיפוש לחצי. אחרי לכל היותר \(\lceil \log_2 n \rceil\) שלבים מגיעים לתשובה או מוכיחים שהיא לא קיימת. עבור n = 1,000,000 זה לכל היותר 20 פתיחות - במקום מיליון.

**Binary Search, חיפוש בינארי**: חיפוש \(O(\log n)\) ב**Sorted Array, מערך ממוין**. בכל שלב נחצה ה**Search Space, מרחב החיפוש** לחצי לפי תנאי מונוטוני.

## הפורמליזם

### גרסה בסיסית: exact match

```python
def binary_search(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

**Loop Invariant, אינווריאנט הלולאה**: בכניסה לכל איטרציה, אם `target` קיים ב-`arr` הוא נמצא ב-`arr[left..right]`. כשהלולאה מסתיימת עם `left > right`, המרחב ריק ו-`target` לא קיים.

**למה** `left + (right - left) // 2` **ולא** `(left + right) // 2`?

בשפות עם overflow (C, Java), כשהשניים גדולים `left + right` גולש מ-32 bits. ב-Python integers שרירותיים ואין overflow, אבל הנוסחה הבטוחה היא מוסכמה ראיונית שחשוב להכיר.

**מורכבות**: זמן \(O(\log n)\), זיכרון \(O(1)\) (iterative). גרסת recursion מוסיפה \(O(\log n)\) stack frames.

### גרסת leftmost: הפוזיציה הראשונה

כשיש כפילויות, exact match מוצא אחת מהן - לא בהכרח השמאלית. leftmost תמיד מחזיר את הפוזיציה הראשונה (או נקודת ההוספה אם לא קיים):

```python
def leftmost(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] < target:
            left = mid + 1
        else:               # arr[mid] >= target: ממשיכים שמאלה גם כשמצאנו
            right = mid - 1
    # left = insertion point; בדוק אם קיים
    return left if left < len(arr) and arr[left] == target else -1
```

השינוי המהותי: ב-exact match, כשמצאנו עוצרים. ב-leftmost, כש-`arr[mid] >= target` מזיזים `right = mid - 1` ומשתיקים את ה-match - ממשיכים לחפש שמאלה. `left` בסוף הוא הפוזיציה הראשונה.

### גרסת rightmost: הפוזיציה האחרונה

```python
def rightmost(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] <= target:  # ממשיכים ימינה גם כשמצאנו
            left = mid + 1
        else:
            right = mid - 1
    return right if right >= 0 and arr[right] == target else -1
```

### Python bisect

הספרייה הסטנדרטית מספקת את שלוש הגרסאות מוכנות:

```python
import bisect

arr = [1, 3, 5, 7, 7, 9]
bisect.bisect_left(arr, 7)    # 3 - leftmost insertion point
bisect.bisect_right(arr, 7)   # 5 - rightmost insertion point
bisect.bisect(arr, 7)         # 5 - שם ל-bisect_right

# בדיקת קיום
i = bisect.bisect_left(arr, 7)
found = (i < len(arr) and arr[i] == 7)    # True

# הוספה תוך שמירת מיון:
bisect.insort(arr, 6)    # arr -> [1, 3, 5, 6, 7, 7, 9]
```

בראיון, `bisect` מהיר לכתיבה ומדויק. אבל אם מבקשים "ממש אותו ידנית" - דע לכתוב את הלולאה מהזיכרון.

## דוגמה מחושבת

`arr = [1, 3, 5, 7, 9, 11, 13]`, `target = 11`.

| שלב | left | right | mid | arr[mid] | פעולה |
|-----|------|-------|-----|----------|-------|
| 1 | 0 | 6 | 3 | 7 | 7 < 11, left = 4 |
| 2 | 4 | 6 | 5 | 11 | נמצא. החזר 5 |

כעת `target = 6` (לא קיים):

| שלב | left | right | mid | arr[mid] | פעולה |
|-----|------|-------|-----|----------|-------|
| 1 | 0 | 6 | 3 | 7 | 7 > 6, right = 2 |
| 2 | 0 | 2 | 1 | 3 | 3 < 6, left = 2 |
| 3 | 2 | 2 | 2 | 5 | 5 < 6, left = 3 |
| 4 | left=3 > right=2 | | | | לולאה נגמרת, החזר -1 |

7 איברים, 3 שלבים. \(\lceil \log_2 7 \rceil = 3\). תואם.

כעת leftmost על `arr = [2, 4, 4, 4, 6, 8]`, `target = 4`:

| שלב | left | right | mid | arr[mid] | פעולה |
|-----|------|-------|-----|----------|-------|
| 1 | 0 | 5 | 2 | 4 | 4 >= 4, right = 1 |
| 2 | 0 | 1 | 0 | 2 | 2 < 4, left = 1 |
| 3 | 1 | 1 | 1 | 4 | 4 >= 4, right = 0 |
| 4 | left=1 > right=0 | | | | עוצרים, left=1 |

`arr[1] == 4`, מחזיר 1. הפוזיציה השמאלית של 4.

## המקרה שמפיל את האינטואיציה

### Binary Search על התשובה

הבעיה: "מצא את גודל הערימה המינימלי k כך שיהיה ניתן לחלק n גפרורים ל-m ערימות, כל ערימה לכל היותר בגודל k."

אין מערך ממוין נתון. אבל הפונקציה `can_split(k)` - "האם ניתן לחלק כשגודל מקסימלי הוא k?" - **מונוטונית**: אם k מספיק, גם k+1 מספיק; אם k לא מספיק, גם k-1 לא. כך ה-search space הוא `[1, max(piles)]` ו-binary search מוצא את המינימום:

```python
def min_capacity(piles: list[int], m: int) -> int:
    left, right = 1, max(piles)
    while left < right:
        mid = left + (right - left) // 2
        if sum((p + mid - 1) // mid for p in piles) <= m:
            right = mid       # mid מספיק, אולי אפשר פחות
        else:
            left = mid + 1    # mid לא מספיק
    return left
```

שים לב: כאן `while left < right` (לא `<= right`) כי חיפוש הגבול מבטיח left == right בסיום.

זהו "Binary Search on Answer" - הגרסה שלא רואים בשלב הינטואיציה הראשוני. טביעת האצבע: "מצא את המינימום שעבורו תנאי X מתקיים".

## טעויות נפוצות

**1. `while left < right` ב-exact search**

כש-`left == right` יש עוד איבר אחד לבדוק. `left < right` מפסיד אותו ומחזיר `-1` שגוי:

```python
arr = [5], target = 5
# left=0, right=0. left < right שקרי - לא נכנסים. מחזיר -1. שגוי.
```

**2. `right = mid` במקום `right = mid - 1` ב-leftmost**

כשכותבים `right = mid` (ולא `mid - 1`) כש-`arr[mid] >= target` עם תנאי `left <= right`, מגיעים לסיטואציה שבה `left == right == mid` ו-`arr[mid] >= target`, כך `right = mid` - לולאה אינסופית.

**3. גישה ל-`arr[left]` בלי לבדוק גבולות**

בגרסת leftmost, `left` עלול להיות `len(arr)` אם כל האיברים קטנים מ-`target`. תמיד: `if left < len(arr) and arr[left] == target`.

**4. הנחת מיון בלי לשאול**

חיפוש בינארי על מערך לא ממוין מחזיר תשובה שגויה בלי שגיאה. בראיון: "האם המערך ממוין?" הוא שאלת הבהרה שחובה לשאול לפני שמתחילים.

**5. `(left + right) // 2` בלי לחשוב על שפה**

ב-Python ספציפית אין overflow, אבל רישום `left + (right - left) // 2` מראה מודעות לנושא ונראה טוב בראיון.

## מתי זה לא משנה

**כשn קטן (n < 20)**: לולאה לינארית קריאה יותר, overhead של חיפוש בינארי זניח.

**כשמחפשים פעם אחת ב-unsorted**: `sort + binary_search` עולה \(O(n \log n)\), בעוד סריקה לינארית עולה \(O(n)\). אם מחפשים פעמים רבות, שווה למיין פעם אחת ולהשתמש בחיפוש בינארי לכל שאילתה.

**כשצריך את כל ה-occurrences**: Binary search מוצא אחד. לאסוף את כולם: מצא leftmost וימני, הוצא `arr[left:right+1]`. עדיין \(O(\log n + k)\) כש-k הוא מספר ה-occurrences.

**בראיון**: חיפוש בינארי קורה כשרואים: "sorted array", "find minimum k that satisfies...", "find threshold where condition flips". כשהמראיין אומר "O(n) פשוט מדי" על מערך ממוין - כנראה רוצה \(O(\log n)\).

## חיבור

יחידה זו שייכת ל-M1 (DS&A, node `dsa`). Binary Search משתמש באותה תנועת מצביעים כמו Two Pointers (m1-two-pointers) אבל מכוון להתכנסות על נקודה אחת, לא על זוג. Sliding Window (m1-sliding-window) ו-Binary Search משתלבים כשמחפשים בתוך prefix sums ממוינים.

**מה זה מאפשר**:
- **m1-binary-search-drill**: תרגול ובניית אוטומציה עם `bisect`
- **m1-tree-traversal**: BST search הוא binary search על עץ
- **m1-stack**: monotonic stack + binary search פותרים בעיות range query

```quiz
{"id":"u-m1-binary-search-q1","tree":"systems","skill":"python","q":"arr=[1,3,5,7,9,11,13,15] (8 איברים). כמה שלבים לכל היותר ידרש חיפוש בינארי?","options":["2","3","4","8"],"answer":1,"explain":"log₂(8) = 3. בכל שלב נחצה המרחב לחצי: 8->4->2->1. לכל היותר 3 שלבים. 8 שלבים הוא חיפוש לינארי."}
```

```quiz
{"id":"u-m1-binary-search-q2","tree":"systems","skill":"python","q":"leftmost binary search על arr=[2,4,4,4,6,8], target=4. מה מחזיר הפונקציה?","options":["0","1","2","3"],"answer":1,"explain":"הפוזיציה הראשונה של 4 היא אינדקס 1. leftmost ממשיך שמאלה גם לאחר שמצא match (right = mid-1 כשarr[mid] >= target), עד שleft=1 בסיום."}
```

```widget
{"type":"algviz","algo":"binary-search","title":"Binary Search: צפה כיצד lo, mid, hi מתכנסים על היעד"}
```

```concepts
{"items":[{"id":"binary-search","t":"Binary Search","he":"חיפוש בינארי","d":"חיפוש O(log n) בסדרה ממוינת. בכל שלב נחצה מרחב החיפוש לחצי לפי Loop Invariant.","rel":["loop-invariant","bisect","search-space"],"node":"dsa"},{"id":"loop-invariant","t":"Loop Invariant","he":"אינווריאנט הלולאה","d":"טענה שנכונה לפני ואחרי כל איטרציה. בחיפוש בינארי: target נמצא ב-arr[left..right] אם קיים.","rel":["binary-search"],"node":"dsa"},{"id":"search-space","t":"Search Space","he":"מרחב החיפוש","d":"קבוצת הפתרונות האפשריים שטרם נשללו. חיפוש בינארי חוצה אותה לחצי בכל שלב.","rel":["binary-search"],"node":"dsa"},{"id":"bisect","t":"bisect","he":"מודול bisect","d":"מודול Python לחיפוש בינארי: bisect_left מחזיר insertion point שמאלי, bisect_right ימני. O(log n).","rel":["binary-search"],"node":"dsa"}]}
```

<!-- audited -->
