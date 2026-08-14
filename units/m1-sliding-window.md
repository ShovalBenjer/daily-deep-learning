# חלון מחליק
כשהשאלה היא "מה הסכום המקסימלי של k איברים רצופים?", הטעות הנפוצה היא לחשב כל חלון מחדש; חלון מחליק מוסיף איבר אחד ומסיר אחד ומסיים ב-\(O(n)\) במקום \(O(n \cdot k)\).

## מה תדע בסוף
תדע לזהות מתי בעיה מציגה את טביעת האצבע של Sliding Window; תכיר שני variants: **חלון קבוע** (גודל k בדיוק) ו**חלון גמיש** (מתרחב ומתכווץ לפי תנאי); תוכל לכתוב פתרון \(O(n)\) ולנמק למה הוא לא מחשב שוב כל חלון.

## האינטואיציה

דמיין שמש המחממת k תריסים ברצף. כשהחלון מוזז תריס אחד ימינה, לא מחשבים מחדש את כל החום: מוסיפים את התריס החדש בקצה ימין ומסירים את הישן בקצה שמאל. כל תריס נוגע בשמש פעם אחת ויוצא מצלה פעם אחת.

**Sliding Window, חלון מחליק**: שני מצביעים `left` ו-`right` המגדירים חלון. `right` מתרחב ימינה בכל צעד; לפי תנאי, `left` מתכווץ ימינה. כל אינדקס נכנס בדיוק פעם אחת ויוצא לכל היותר פעם אחת, כך שסה"כ \(2n\) פעולות = \(O(n)\).

הקשר ל-Two Pointers (m1-two-pointers): fast/slow pointers הוא המקרה הפשוט שבו החלון קבוע למדי ומשתמשים בו בעיקר ב-in-place. Sliding Window הוא ההרחבה לחלונות שה-state שלהם (סכום, תדרים, ערכים ייחודיים) משתנה.

## ההגדרות המדויקות

### Pattern 1: חלון קבוע (Fixed Window)

**מתי**: הבעיה דורשת subarray בגודל k בדיוק - "maximum sum", "average", "product".

```python
def max_sum_window(arr: list[int], k: int) -> int:
    if len(arr) < k:
        return 0
    window_sum = sum(arr[:k])      # חלון ראשון: O(k)
    best = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i]       # הוסף קצה ימין
        window_sum -= arr[i - k]   # הסר קצה שמאל
        best = max(best, window_sum)
    return best
```

**מה קורה כאן**: חלון הראשון מחושב פעם אחת (O(k)). כל צעד לאחר מכן = עדכון O(1). סה"כ O(n).

**ללא Sliding Window**: `sum(arr[i:i+k])` לכל i = O(k) לכל צעד = O(n k) סה"כ. עם n=100,000 ו-k=1,000 זה הבדל של פקטור אלף.

### Pattern 2: חלון גמיש (Variable Window)

**מתי**: הבעיה מבקשת "הארוך ביותר" או "הקצר ביותר" subarray/substring שמקיים תנאי.

**Template כללי**:

```python
left = 0
state = {}          # מעקב אחרי מה יש בחלון

for right in range(len(s)):
    # שלב 1: הרחב - הוסף s[right] ל-state
    state[s[right]] = state.get(s[right], 0) + 1

    # שלב 2: כווץ - כל עוד התנאי נשבר, הסר s[left]
    while <condition_violated(state)>:
        state[s[left]] -= 1
        if state[s[left]] == 0:
            del state[s[left]]
        left += 1

    # שלב 3: עדכן תשובה (רק אחרי שהחלון תקין)
    best = max(best, right - left + 1)
```

**טביעת האצבע** של בעיות variable window:
- "longest substring without repeating characters"
- "minimum window substring"
- "longest subarray with sum at most k"
- "fruit into baskets" (at most 2 distinct)
- "permutation in string"

### מורכבות

| Variant | זמן | זיכרון |
|---------|-----|--------|
| Fixed window | \(O(n)\) | \(O(1)\) |
| Variable window | \(O(n)\) | \(O(\text{alphabet})\) |

**הוכחת** \(O(n)\) עבור variable window: `right` זזמ-0 ל-n-1, כל צעד O(1) (להוסיף איבר). `left` זזמ-0 ל-n-1 לכל היותר, כל צעד O(1) (להסיר איבר). סה"כ: \(2n\) פעולות.

## דוגמה מחושבת

### בעיה 1: Maximum Sum Subarray of Size k

`arr = [2, 1, 5, 1, 3, 2]`, `k = 3`.

חלון ראשון: `sum([2,1,5]) = 8`. `best = 8`.

| i (right) | arr[i] נוסף | arr[i-k] הוסר | window_sum | best |
|-----------|-------------|----------------|------------|------|
| 3 | 1 | arr[0]=2 | 8+1-2=7 | 8 |
| 4 | 3 | arr[1]=1 | 7+3-1=9 | 9 |
| 5 | 2 | arr[2]=5 | 9+2-5=6 | 9 |

תשובה: 9 (החלון [5, 1, 3] באינדקסים 2-4).

**אימות**: `2+1+5=8`, `1+5+1=7`, `5+1+3=9`, `1+3+2=6`. נכון.

### בעיה 2: Longest Substring Without Repeating Characters (Leetcode 3)

`s = "abcabca"`.

```python
left = 0
seen = {}   # char → last right index שבו ראינו אותו
best = 0

for right, c in enumerate(s):
    if c in seen and seen[c] >= left:
        # c כבר בחלון; קפוץ שמאל מעבר להופעה הקודמת
        left = seen[c] + 1
    seen[c] = right
    best = max(best, right - left + 1)
```

מהלך:

| right | c | seen[c] לפני | left (לפני) | left (אחרי) | חלון | best |
|-------|---|--------------|-------------|-------------|------|------|
| 0 | a | -- | 0 | 0 | "a" | 1 |
| 1 | b | -- | 0 | 0 | "ab" | 2 |
| 2 | c | -- | 0 | 0 | "abc" | 3 |
| 3 | a | 0 | 0 | 1 | "bca" | 3 |
| 4 | b | 1 | 1 | 2 | "cab" | 3 |
| 5 | c | 2 | 2 | 3 | "abc" | 3 |
| 6 | a | 3 | 3 | 4 | "bca" | 3 |

תשובה: 3.

**הסבר צעד 3 (right=3, c='a')**: 'a' נראתה ב-seen[a]=0, ו-0 >= left=0, כלומר 'a' עדיין בחלון. לכן left קופץ ל-1 (מיד אחרי ההופעה הקודמת של 'a').

## המקרה שמפיל את האינטואיציה

**Sliding Window לא עובד כשה-state לא מונוטוני**:

שקול: "longest subarray with sum **exactly** k" עם ערכים שליליים.

`arr = [1, -1, 1, 1]`, `k = 1`. ניסיון naive: מרחיב כשsum < k, מכווץ כשsum > k.

```
right=0: sum=1=k → best=1
right=1: sum=0<k → ממשיך להרחיב
right=2: sum=1=k → best=3   (חלון [1,-1,1])
right=3: sum=2>k → left++ → sum=1=k → best=3
```

נראה נכון - אבל נסה `arr = [2, -1, 2]`, `k = 3`:

```
right=0: sum=2<3, right=1: sum=1<3, right=2: sum=3=k → best=3  (נכון)
```

ועכשיו `arr = [2, -1, 2, -2, 3]`, `k = 3`:

```
right=0..2: sum=3=k, best=3
right=3: sum=1<3, המשך הרחבה
right=4: sum=4>3 → left++: sum=2<3 → עצירה
```

החלון [2,-2,3] (indices 2-4) שסכומו 3 לא נמצא! בגלל שהכיווץ הסיר arr[0]=2 ולא arr[2]=2.

**הפתרון הנכון**: prefix sum + hash table. \(O(n)\) זמן, \(O(n)\) זיכרון.

**הלקח**: Sliding Window מבטיח \(O(n)\) רק כשיש **מונוטוניות**: הוספת איבר לחלון רק מגדילה (או רק מקטינה) את ה-state. עם ערכים שליליים ותנאי exactly, האחריות הזאת מתפרקת.

## טעויות נפוצות

**1. `if` במקום `while` בשלב הכיווץ**

```python
# שגוי: מכווץ רק פעם אחת, גם אם חוק עדיין נשבר
if len(state) > k:
    state[s[left]] -= 1
    left += 1

# נכון
while len(state) > k:
    state[s[left]] -= 1
    if state[s[left]] == 0:
        del state[s[left]]
    left += 1
```

כשיש שלוש אותיות כפולות ברצף, `if` יכווץ רק אחת ויעזוב חלון לא תקין.

**2. אורך החלון: `right - left` במקום `right - left + 1`**

אם right=4 ו-left=2, החלון כולל אינדקסים 2, 3, 4 - שלושה איברים. `right - left = 2` שגוי. `right - left + 1 = 3` נכון. שגיאת off-by-one קלאסית.

**3. Fixed window: `arr[left]` ולא `arr[i - k]`**

```python
# שגוי כשלא מנהלים left ידנית
window_sum -= arr[left]   # left לא זזכלל בגרסה הקצרה

# נכון (גרסה קצרה)
window_sum -= arr[i - k]

# נכון (גרסה עם left מפורש)
left += 1
window_sum -= arr[left - 1]
```

**4. עדכון `best` לפני שלב הכיווץ**

```python
# שגוי: best עשוי לכלול חלון לא-תקין
best = max(best, right - left + 1)
while condition_violated:
    ...

# נכון: best רק לאחר שהחלון תקין
while condition_violated:
    ...
best = max(best, right - left + 1)
```

**5. שכחת לאתחל חלון ריק כשאין תוצאה**

בעיית "minimum window substring" - אם אין חלון תקין בכלל, מחזירים `""`. זכרו להתחיל עם `best = float("inf")` ולחזור `""` אם לא עדכנתם.

## מתי זה לא משנה

**כשה-state לא מונוטוני**: סכום עם ערכים שליליים + תנאי exact - השתמש ב-prefix sum עם dict.

**כשצריך מינימום/מקסימום בתוך כל חלון** (לא רק סכום): Sliding Window טהור לא מספיק; צריך **monotonic deque** (deque דו-כיווני ממוין) להחזקת min/max ב-\(O(1)\). בעיה: Sliding Window Maximum (Leetcode 239).

**כשהבעיה דורשת ספירת כל תתי-המחרוזות שמקיימות תנאי**: לפעמים Sliding Window מחשב "הארוך ביותר" אבל לא "כמה יש" - לכן בדוק אם השאלה מבקשת count, לא רק length.

**בראיון**: אם המראיין נותן מערך עם ערכים שליליים ושואל על "exactly k", שאל "האם הסכום מונוטוני עם הרחבה?" לפני שמתחיל. זה מראה הבנה ולא שינון.

## חיבור

יחידה זו שייכת ל-M1 (DS&A, node `dsa`). Sliding Window מרחיב את Two Pointers (m1-two-pointers) מעבר לזוגות לחלונות עם state פנימי.

**מה זה מאפשר**:
- **Binary Search (m1-binary-search)**: כשצריך לחפש ב-prefix sums הממוינים, binary search פועל לצד prefix sum.
- **Stack (m1-stack)**: monotonic stack הוא הכלי ל-sliding window maximum, בעיה שאי אפשר לפתור עם Sliding Window לבד.
- **SQL Window Functions (m2-window-functions)**: אותה אינטואיציה של "חישוב מצטבר על חלון שורות" - שם ב-SQL, כאן ב-Python.

יחידת התרגול הבאה: **m1-sliding-window-drill**.

```quiz
{"id":"u-m1-sliding-window-q1","tree":"systems","skill":"python","q":"arr=[2,1,5,1,3,2], k=3. מה הסכום המקסימלי של תת-מערך בגודל k?","options":["8","7","9","6"],"answer":2,"explain":"החלונות: [2,1,5]=8, [1,5,1]=7, [5,1,3]=9, [1,3,2]=6. המקסימום הוא 9 (החלון [5,1,3] באינדקסים 2-4)."}
```

```quiz
{"id":"u-m1-sliding-window-q2","tree":"systems","skill":"python","q":"בפתרון Variable Sliding Window, מדוע המורכבות O(n) ולא O(n²) למרות שיש while פנימי?","options":["כי המערך ממוין","כי right לעולם לא חוזר אחורה, ו-left לעולם לא חוזר אחורה - כל אינדקס נגע ב-right פעם אחת וב-left לכל היותר פעם אחת","כי השתמשנו ב-hash table לחישוב מהיר","כי ה-while מתבצע לכל היותר k פעמים"],"answer":1,"explain":"right עולה מ-0 ל-n-1 ולא חוזר: n פעולות. left עולה מ-0 ל-n-1 לכל היותר ולא חוזר: עוד n פעולות. סה\"כ 2n = O(n), ללא תלות בכמה פעמים ה-while רץ בסה\"כ."}
```

```fillin
{"id":"u-m1-sliding-window-f1","tree":"systems","skill":"python","prompt":"Fixed window, arr=[2,1,5,1,3,2], k=3. חלון ראשון sum=8. כשi=4 (arr[4]=3): מה מוסיפים, מה מסירים, ומה window_sum החדש?","answer":"מוסיפים 3, מסירים arr[1]=1, window_sum=9","alt":["add 3 remove 1 result 9","9","מוסיפים arr[4]=3, מסירים arr[1]=1, 9"],"explain":"i=4, i-k=4-3=1. window_sum = קודם(7) + arr[4] - arr[1] = 7 + 3 - 1 = 9. החלון כעת [5,1,3]."}
```

```concepts
{"items":[{"id":"fixed-window","t":"Fixed Window","he":"חלון קבוע","d":"Sliding Window בגודל k קבוע; בכל צעד מוסיפים איבר ימני ומסירים שמאלי. O(n).","rel":["sliding-window","variable-window"],"node":"dsa"},{"id":"variable-window","t":"Variable Window","he":"חלון גמיש","d":"Sliding Window שמתרחב עם right ומתכווץ עם left לפי תנאי; O(n) כשה-state מונוטוני.","rel":["sliding-window","fixed-window","two-pointers"],"node":"dsa"},{"id":"window-invariant","t":"Window Invariant","he":"אינווריאנט החלון","d":"התכונה שהחלון מקיים בין כל צעד לצעד. פגיעה בה מפעילה את הכיווץ (left++).","rel":["sliding-window","variable-window"],"node":"dsa"}]}
```
