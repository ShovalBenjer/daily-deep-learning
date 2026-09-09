# מערכים וגיבוב: תרגול
אפשר לדעת את התיאוריה ועדיין לכתוב `x in list` בטעות; השרירים מתחזקים רק בתרגול.

## מה תדע בסוף
תוכל לכתוב שלוש פונקציות קלאסיות של arrays-and-hashing מזיכרון: Contains Duplicate בעזרת seen set, Group Anagrams בעזרת מיון-כמפתח, ו-Valid Anagram בעזרת Counter. כל אחת מהן צריכה להתגלגל מהאצבעות בלי לחשוב.

## האינטואיציה

שלושת התרגילות כאן הן הביטויים הטהורים ביותר של שני patterns מהיחידה הקודמת.

**Pattern A: seen set** - "האם ראיתי את הערך הזה כבר?" - מחייב set ולא list.

**Pattern B: group by derived key** - "כנס יחד כל האיברים שחולקים תכונה משותפת" - מחייב dict שבו המפתח הוא התכונה המשותפת.

בראיון, ברגע שאתה שומע "כפילויות" חשוב "seen set". ברגע שאתה שומע "קבץ לפי X" חשוב "dict ממפה X לרשימה".

## ההגדרות המדויקות

### תרגיל 1: Contains Duplicate

**הבעיה**: נתון `nums: list[int]`, החזר `True` אם קיים ערך שמופיע לפחות פעמיים.

**Scaffold** - עיין, הבן, השלם את החלל:

```python
def contains_duplicate(nums: list[int]) -> bool:
    seen = set()
    for x in nums:
        if ___:          # <<< מה לבדוק?
            return True
        seen.add(x)
    return False
```

**פתרון מוסבר**:

```python
def contains_duplicate(nums: list[int]) -> bool:
    seen = set()
    for x in nums:
        if x in seen:    # O(1) ממוצע - לא O(n) כמו x in list
            return True
        seen.add(x)
    return False
```

בדוק ידנית: `nums = [1, 2, 3, 1]`.

| x | seen לפני | x in seen? | seen אחרי |
|---|---|---|---|
| 1 | `{}` | False | `{1}` |
| 2 | `{1}` | False | `{1, 2}` |
| 3 | `{1, 2}` | False | `{1, 2, 3}` |
| 1 | `{1, 2, 3}` | **True** | - |

מחזיר `True`. נכון.

**גרסה חלופית** (שורה אחת, אך פחות ניתנת לקריאה):

```python
def contains_duplicate(nums: list[int]) -> bool:
    return len(set(nums)) < len(nums)
```

נכון אך בונה set שלם קודם. זמן \(O(n)\), זיכרון \(O(n)\) - זהה. השתמש בלולאה בראיון כי היא מסבירה את האינטואיציה טוב יותר.

---

### תרגיל 2: Valid Anagram

**הבעיה**: נתונות שתי מחרוזות `s` ו-`t`. החזר `True` אם `t` היא anagram של `s` (אותן אותיות, סדר שונה).

**Scaffold**:

```python
from collections import Counter

def is_valid_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return ___          # <<< מה?
    return Counter(___) == Counter(___)   # <<< מה לספור?
```

**פתרון מוסבר**:

```python
from collections import Counter

def is_valid_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False        # אורכים שונים = לא anagram
    return Counter(s) == Counter(t)
```

בדוק ידנית: `s = "rat"`, `t = "car"`.

```
Counter("rat") = {"r": 1, "a": 1, "t": 1}
Counter("car") = {"c": 1, "a": 1, "r": 1}
```

שתי ה-Counter-ים **לא שוות** (`"t"` מול `"c"`). מחזיר `False`. נכון.

גרסה ידנית בלי Counter (למי שרוצה להבין מתחת למכסה):

```python
def is_valid_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    count = {}
    for c in s:
        count[c] = count.get(c, 0) + 1
    for c in t:
        count[c] = count.get(c, 0) - 1
        if count[c] < 0:
            return False
    return True
```

כל אות ב-`s` מגדילה את המונה; כל אות ב-`t` מקטינה. אם `t` מכילה אות שאינה ב-`s` - המונה ירד מתחת לאפס ונחזיר `False`.

---

### תרגיל 3: Group Anagrams

**הבעיה**: נתונה רשימה `strs: list[str]`. קבץ מחרוזות שהן anagram אחת של השנייה. הסדר בתוך כל קבוצה לא משנה.

```
קלט:  ["eat", "tea", "tan", "ate", "nat", "bat"]
פלט:  [["eat","tea","ate"], ["tan","nat"], ["bat"]]
```

**Scaffold**:

```python
from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = ___           # <<< איזה מפתח ישווה anagrams?
        groups[key].append(s)
    return list(groups.values())
```

**רמז**: שתי מחרוזות הן anagram אחת של השנייה אם ורק אם המיון שלהן זהה. `sorted("eat") == sorted("tea") == ['a', 'e', 't']`.

**פתרון מוסבר**:

```python
from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))   # "eat" -> ('a','e','t')
        groups[key].append(s)
    return list(groups.values())
```

בדוק ידנית על `["eat", "tea", "bat"]`:

| s | key (sorted tuple) | groups אחרי |
|---|---|---|
| "eat" | `('a','e','t')` | `{('a','e','t'): ["eat"]}` |
| "tea" | `('a','e','t')` | `{('a','e','t'): ["eat","tea"]}` |
| "bat" | `('a','b','t')` | `{('a','e','t'): ["eat","tea"], ('a','b','t'): ["bat"]}` |

מחזיר `[["eat","tea"], ["bat"]]`. נכון.

**מדוע tuple ולא list כמפתח?**

```python
key = sorted(s)    # מחזיר list
groups[key]        # TypeError: unhashable type: 'list'
```

רק immutable יכול להיות מפתח dict. `tuple(sorted(s))` הוא immutable.

## דוגמה מחושבת

**בעיה**: `group_anagrams(["abc", "bca", "xyz", "zyx", "ab"])`.

**צעד 1**: מחשב key לכל מחרוזת.

| מחרוזת | sorted | key (tuple) |
|---|---|---|
| "abc" | ['a','b','c'] | `('a','b','c')` |
| "bca" | ['a','b','c'] | `('a','b','c')` |
| "xyz" | ['x','y','z'] | `('x','y','z')` |
| "zyx" | ['x','y','z'] | `('x','y','z')` |
| "ab" | ['a','b'] | `('a','b')` |

**צעד 2**: בונה dict.

```
{
  ('a','b','c'): ["abc", "bca"],
  ('x','y','z'): ["xyz", "zyx"],
  ('a','b'):     ["ab"]
}
```

**צעד 3**: מחזיר `list(groups.values())`.

```python
[["abc", "bca"], ["xyz", "zyx"], ["ab"]]
```

**סיבוכיות**: \(n\) מחרוזות, כל מחרוזת באורך \(k\) לכל היותר. מיון מחרוזת: \(O(k \log k)\). סה"כ: \(O(n \cdot k \log k)\) זמן, \(O(n \cdot k)\) זיכרון.

## המקרה שמפיל את האינטואיציה

### Contains Duplicate: רשימה ריקה או איבר יחיד

```python
contains_duplicate([])    # False - אין כפילויות
contains_duplicate([5])   # False - אין שני אותו ערך
```

שתיהן עובדות כי הלולאה לא מוצאת `x in seen`, ומחזירות `False`. נכון.

### Valid Anagram: אותיות גדולות/קטנות

```python
is_valid_anagram("Listen", "Silent")  # False!
```

`Counter("Listen")` יכלול `'L'` ו-`Counter("Silent")` יכלול `'S'`. אם הבעיה מצפה ל-`True`, צריך `s.lower()` ו-`t.lower()` לפני.

### Group Anagrams: מחרוזת ריקה

```python
group_anagrams(["", ""])
```

`sorted("") = []`, `tuple([]) = ()`. שתי המחרוזות הריקות מקבלות key `()` ונכנסות לאותה קבוצה: `[[""", ""]]`. נכון.

### Group Anagrams: תוים שאינם ASCII

`sorted("שלום")` ממיין לפי Unicode codepoint. שתי מחרוזות הן anagram אחת של השנייה אם ורק אם הן מכילות בדיוק אותם Unicode codepoints באותן כמויות. `tuple(sorted(...))` עובד גם כאן.

## טעויות נפוצות

**1. `x in list` במקום `x in set`**

```python
# אסור - O(n) בכל בדיקה
seen = []
if x in seen: ...

# נכון - O(1) ממוצע
seen = set()
if x in seen: ...
```

**2. מפתח dict שהוא list**

```python
key = sorted(s)        # list - לא ניתן לגיבוב
groups[key].append(s)  # TypeError
```

תמיד המר ל-`tuple`: `key = tuple(sorted(s))`.

**3. len check מוקדם מדי (Valid Anagram)**

```python
# שגוי: Counter לא דורש len check מראש
def is_valid_anagram(s, t):
    return Counter(s) == Counter(t)  # עובד גם בלעדיו
```

Counter עם אורכים שונים אף פעם לא יהיה שווה כי ספירות לא יסתדרו. ה-`len` check הוא אופטימיזציה (חוסך בניית Counter), לא תיקון שגיאה.

**4. `defaultdict(list)` לעומת `{}`**

```python
# עם dict רגיל - צריך לאתחל ידנית:
groups = {}
groups.setdefault(key, []).append(s)

# עם defaultdict - פשוט יותר:
groups = defaultdict(list)
groups[key].append(s)
```

שניהם נכונים; `defaultdict` קריא יותר לדפוס הזה.

**5. שכחת `return list(groups.values())`**

```python
return groups.values()  # מחזיר dict_values object, לא list
```

בראיון, המראיין מצפה ל-`list[list[str]]`. עטוף ב-`list(...)`.

## מתי זה לא משנה

**כשה-n קטן מאוד** (פחות מ-30): `x in [...]` ו-`x in set(...)` אינדיסטינגווישבל בפועל. אל תייצר set בלי סיבה.

**Contains Duplicate עם מערך ממוין**: אם הקלט ממוין כבר, `any(nums[i] == nums[i+1] for i in range(len(nums)-1))` עובד ב-\(O(n)\) ובלי זיכרון נוסף.

**Group Anagrams עם אלפבית קבוע**: אפשר להשתמש ב-tuple של 26 ספירות (אחת לכל אות א'-ת' בAscii) כמפתח במקום `tuple(sorted(s))`. זמן \(O(k)\) לעומת \(O(k \log k)\), אך קוד ארוך יותר. בראיון: ציין את שתי הגישות ובחר את הפשוטה.

## חיבור

שלושת הפונקציות שכתבת כאן מהוות את היסוד של ה-NeetCode 150: Contains Duplicate (Easy #1), Valid Anagram (Easy #2), Group Anagrams (Medium #1). כל ראיון DSA שמתחיל מ-arrays/hashing פוגש לפחות אחת מהן.

היחידה הבאה: **m1-two-pointers** - כשאין hash table אבל יש סדרה ממוינת, שני מצביעים מגיעים ל-\(O(n)\) בלי זיכרון נוסף.

```quiz
{"id":"u-m1-arrays-hashing-drill-q1","tree":"systems","skill":"python","q":"בפונקציית contains_duplicate, מדוע משתמשים ב-set ולא ב-list עבור המשתנה seen?","options":["כי set מהיר יותר בהוספה","כי בדיקת שייכות ב-set היא O(1) ממוצע ואילו ב-list היא O(n)","כי list לא יכול להחזיק מספרים שלמים","כי set ממוין אוטומטית"],"answer":1,"explain":"x in list סורק מהתחלה ועד הסוף: O(n) בכל בדיקה. בלולאה על n איברים זה O(n²) כולל. x in set מגיע לתא הנכון דרך hash function: O(1) ממוצע, ולכן הפתרון השלם הוא O(n)."}
```

```quiz
{"id":"u-m1-arrays-hashing-drill-q2","tree":"systems","skill":"python","q":"מה הסיבה ל-TypeError כשמנסים `d[sorted('eat')] = 1`?","options":["sorted מחזיר None","sorted מחזיר list שאינו hashable ולא יכול לשמש מפתח dict","dict לא מקבל מפתחות מסוג str","sorted לא עובד על מחרוזות"],"answer":1,"explain":"dict מפתחות חייבים להיות hashable (immutable). sorted מחזיר list שהוא mutable, לכן לא ניתן לגיבוב. הפתרון: tuple(sorted('eat')) שמחזיר ('a','e','t') שהוא immutable."}
```

```fillin
{"id":"u-m1-arrays-hashing-drill-f1","tree":"systems","skill":"python","prompt":"הרץ בפייתון: `from collections import Counter; print(Counter('anagram') == Counter('nagaram'))`. מה ההדפסה?","answer":"True","alt":["true","TRUE"],"explain":"שתי המחרוזות מכילות בדיוק אותן אותיות באותן כמויות: a×3, n×1, g×1, r×1, m×1. Counter שווה Counter, לכן True."}
```

```fillin
{"id":"u-m1-arrays-hashing-drill-f2","tree":"systems","skill":"python","prompt":"הרץ: `print(tuple(sorted('bat')))`. מה הפלט?","answer":"('a', 'b', 't')","alt":["('a','b','t')","(a, b, t)","a b t"],"explain":"sorted('bat') ממיין את האותיות לפי ASCII: ['a','b','t']. tuple(...) הופך ל-('a','b','t') שמשמש כמפתח dict ב-group_anagrams."}
```

```concepts
{"items":[{"id":"seen-set","t":"Seen Set","he":"קבוצת ביקורים","d":"Pattern של שימוש ב-set לזכירת ערכים שנראו; בדיקת כפילויות ב-O(1) ממוצע.","rel":["hash-table","frequency-count"],"node":"dsa"},{"id":"sorted-key-grouping","t":"Sorted-Key Grouping","he":"קיבוץ לפי מפתח ממוין","d":"Pattern שממפה כל איבר למפתח tuple(sorted(x)) כדי לקבץ anagrams; מחייב tuple כי list לא hashable.","rel":["hash-table","hash-function"],"node":"dsa"}]}
```

<!-- audited -->
