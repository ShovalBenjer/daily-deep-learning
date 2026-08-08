# מערכים וגיבוב
כשהתשובה ל-"האם ראיתי את המספר הזה כבר?" מגיעה תוך צעד אחד ולא תוך סריקה מחדש, כנראה מסתתר שם hash table.

## מה תדע בסוף
תדע לפתור בעיות "האם X קיים בקבוצה?" ו-"כמה פעמים ראיתי X?" בזמן ממוצע \(O(1)\) באמצעות Python dict ו-set; תכיר שני patterns קלאסיים: ספירת תדרים ו-complement lookup; תוכל להסביר מתי array מנצח ומתי hash table מנצח.

## האינטואיציה

דמיין ספרייה עם מיליון ספרים. לחפש ספר לפי שם בלי סדר זה \(O(n)\): אתה עובר על כל מדף. לחפש לפי מספר קטלוגי במגירת הכרטיסיות זה \(O(1)\): אתה פותח את המגירה המתאימה ישר.

**Array, מערך**: אוסף של ערכים ממוקמים ברצף בזיכרון. כל גישה לפי אינדקס היא \(O(1)\) כי הכתובת מחושבת: `base + i * element_size`. Python list הוא מערך דינמי שמכפיל את עצמו כשהוא מתמלא.

**Hash table, טבלת גיבוב**: מבנה שממפה מפתח לערך באמצעות **hash function, פונקציית גיבוב** שממירה את המפתח לאינדקס. Python dict ו-set מממשים אותה. כששתי מפתחות מגיעות לאותו אינדקס קוראים לזה **collision, התנגשות**; Python מטפל בהן בצורה פנימית.

המגירה היא פונקציית הגיבוב: היא לוקחת את שם הספר, מחשבת מספר, ומוציאה אותך ישר לתא הנכון.

## ההגדרות המדויקות

### זמני ריצה

| פעולה | Array / list | Hash table / dict,set |
|---|---|---|
| גישה לפי אינדקס | \(O(1)\) | לא ישים |
| חיפוש ערך | \(O(n)\) | \(O(1)\) ממוצע |
| הוספה לסוף | \(O(1)\) מופחת | \(O(1)\) ממוצע |
| מחיקה מאמצע | \(O(n)\) | \(O(1)\) ממוצע |
| בדיקת שייכות | \(O(n)\) | \(O(1)\) ממוצע |

**Amortized \(O(1)\), מופחת**: הוספה לסוף ב-list בדרך כלל \(O(1)\), אך לעתים רחוקות מופעל copy שעולה \(O(n)\). בממוצע על פני סדרה ארוכה של הוספות, עלות כל הוספה היא \(O(1)\).

### Python dict

```python
freq = {}
freq["apple"] = freq.get("apple", 0) + 1
# או בקיצור:
from collections import defaultdict
freq = defaultdict(int)
freq["apple"] += 1
```

`Counter` מקבוצת `collections` עושה את זה בשורה אחת:

```python
from collections import Counter
freq = Counter(["apple", "banana", "apple"])
# Counter({"apple": 2, "banana": 1})
```

### Python set

```python
seen = set()
seen.add(5)
5 in seen   # True, בזמן O(1)
seen.discard(5)
```

### שני patterns ראיוניים

**Pattern 1: ספירת תדרים (frequency count)**

מתי: "מצא אנגרמות", "כמה פעמים מופיע כל ערך", "אחד מהיסודות חסר".

```python
from collections import Counter
def is_anagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
```

**Pattern 2: Complement lookup**

מתי: "Two Sum", "כל זוגות שסכומם K".

רעיון: לכל `x` שאתה רואה, בדוק אם `target - x` כבר נראה.

```python
def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, x in enumerate(nums):
        complement = target - x
        if complement in seen:
            return [seen[complement], i]
        seen[x] = i
    return []
```

זמן: \(O(n)\). זיכרון: \(O(n)\).

## דוגמה מחושבת

**בעיה**: נתונה רשימה `nums = [2, 7, 11, 15]` ו-`target = 9`. מצא אינדקסים של שני מספרים שסכומם `target`.

**פתרון בעזרת complement lookup**:

| i | x | complement (9-x) | seen לפני הצעד | פעולה |
|---|---|---|---|---|
| 0 | 2 | 7 | `{}` | 7 לא ב-seen; מוסיף `{2: 0}` |
| 1 | 7 | 2 | `{2: 0}` | 2 ב-seen! תשובה: `[0, 1]` |

**מה היה קורה בלי hash table?**

Loop כפול:
```python
for i in range(len(nums)):
    for j in range(i+1, len(nums)):
        if nums[i] + nums[j] == target:
            return [i, j]
```
זמן: \(O(n^2)\). עם `n = 10{,}000` זה 100 מיליון פעולות לעומת 10,000.

**בעיה 2: ספירת אנגרמות**

`s = "anagram"`, `t = "nagaram"`.

```python
Counter("anagram")  # {'a': 3, 'n': 1, 'g': 1, 'r': 1, 'm': 1}
Counter("nagaram")  # {'a': 3, 'n': 1, 'g': 1, 'r': 1, 'm': 1}
# שווים => True
```

פתרון ידני:

```python
count = [0] * 26
for c in s:
    count[ord(c) - ord('a')] += 1
for c in t:
    count[ord(c) - ord('a')] -= 1
return all(x == 0 for x in count)
```

כאן array של 26 תאים מהיר יותר מ-dict כי המפתחות הם תמיד אותיות א'-ת' (ASCII קבוע).

## המקרה שמפיל את האינטואיציה

**כשהאינטואיציה אומרת "hash table" אבל צריך array**:

Python list יכול לשמש כ-"hash table" כשהמפתחות הם מספרים שלמים קטנים וידועים מראש. לספירת תדרים על אותיות `a-z`, array של 26 תאים מהיר יותר מ-dict כי אין אוברהד של hash function וכוח פיזורי.

**כשהתנגשויות פוגעות**:

Python dict בנוי על open addressing. בתרחיש קיצוני כל המפתחות מגיעות לאותו bucket; גישה הופכת ל-\(O(n)\). זה נדיר בפועל אך אפשרי עם מפתחות שנרצו במיוחד. לראיון: הדגש "ממוצע" ו-"worst case O(n)".

**כשצריך סדר**:

Hash table לא שומר סדר לוגי. אם צריך "מצא אינדקסים בסדר עולה" או "מה האיבר הקטן ביותר שראיתי", hash table לא עוזר לבד; צריך array ממוין או heap.

הערה: Python dict מ-3.7 ואילך שומר **insertion order** (סדר הכנסה), לא סדר מיון. זה לא אותו דבר.

## טעויות נפוצות

**1. `x in list` במקום `x in set`**

```python
# O(n) - אסור ב-loop
seen = []
for x in nums:
    if x in seen:      # O(n) בכל איטרציה!
        return True
    seen.append(x)

# O(1) ממוצע - נכון
seen = set()
for x in nums:
    if x in seen:
        return True
    seen.add(x)
```

**2. שינוי dict תוך כדי איטרציה**

```python
d = {"a": 1, "b": 2}
for k in d:
    if d[k] == 1:
        del d[k]       # RuntimeError: dictionary changed size during iteration
```

פתרון: `for k in list(d):` או בנה dict חדש.

**3. ניחוש "hash table תמיד מהיר יותר"**

עבור `n < 20` array פשוט לרוב מהיר יותר בפועל כי אין אוברהד של hash function. בראיון: ציין את ה-trade-off.

**4. שימוש ב-list כמפתח dict**

```python
d[[1, 2]] = "hello"   # TypeError: unhashable type: 'list'
```

רק אובייקטים immutable יכולים להיות מפתחות. השתמש ב-tuple: `d[(1, 2)] = "hello"`.

**5. בלבול בין `dict.get` ל-`dict[key]`**

`d[key]` זורק `KeyError` אם המפתח לא קיים. `d.get(key, default)` מחזיר `default` במקום. בלולאת ספירה, תמיד `d.get(k, 0) + 1`.

## מתי זה לא משנה

**כשה-n קטן**: עבור מערכות קטנות (מאות איברים), \(O(n)\) לינארי מהיר מספיק ו-hash table מוסיף מורכבות.

**כשצריך סדר**: אם הבעיה דורשת את האיבר הקטן/גדול ביותר, טווח שאילתות (range query), או סדר ממוין, hash table לא מספיקה. צריך sorted array + binary search או heap.

**בראיון**: אם המראיין שואל "האם אפשר O(n log n)?", כנראה הם מצפים ל-sort. אם שואלים "O(n)?", כנראה hash table.

**שחלופות נפוצות**: sorted + two pointers לסדרה ממוינת, binary search לחיפוש בסדרה ממוינת, sliding window לחלון רציף.

## חיבור

יחידה זו שייכת ל-M1 (מבני נתונים ואלגוריתמים). Hash table הוא הבסיס של חמישה patterns לפחות מתוך NeetCode 150: Two Sum, Group Anagrams, Top K Frequent Elements, Longest Consecutive Sequence, Valid Anagram.

היחידה הבאה בסדר רגיל: **m1-arrays-hashing-drill** לתרגול מעשי. לאחר מכן: **m1-two-pointers** שמשלב לרוב עם מערכים ממוינים ומגיע לתוצאות O(n) בלי hash table.

```quiz
{"id":"u-m1-arrays-hashing-q1","tree":"systems","skill":"python","q":"מה המורכבות הממוצעת של בדיקת שייכות (`x in s`) כשהמשתנה `s` הוא Python set?","options":["O(1)","O(log n)","O(n)","O(n²)"],"answer":0,"explain":"Python set מממש hash table; בדיקת שייכות היא O(1) ממוצע. O(n) היה קורה אם s היה list."}
```

```quiz
{"id":"u-m1-arrays-hashing-q2","tree":"systems","skill":"python","q":"בפתרון Two Sum עם complement lookup, מה שומרים ב-dict?","options":["הסכום הנוכחי","את הערך ואינדקסו: {value: index}","את האינדקסים בלבד","את המשלים (target - x) של כל ערך"],"answer":1,"explain":"שומרים {value: index} כדי שכשנמצא complement, נוכל להחזיר את שני האינדקסים. המשלים אינו מה ששומרים אלא מה שמחפשים."}
```

```concepts
{"items":[{"id":"dynamic-array","t":"Dynamic Array","he":"מערך דינמי","d":"מערך שמכפיל את גודלו כשמתמלא; הוספה לסוף היא O(1) מופחת. Python list.","rel":["hash-table","amortized-cost"]},{"id":"hash-table","t":"Hash Table","he":"טבלת גיבוב","d":"מבנה שממפה מפתח לערך בזמן O(1) ממוצע דרך פונקציית גיבוב. Python dict ו-set.","rel":["dynamic-array","hash-function","collision"]},{"id":"hash-function","t":"Hash Function","he":"פונקציית גיבוב","d":"פונקציה שממירה מפתח שרירותי לאינדקס שלם. חייבת להיות עקבית: אותו קלט תמיד אותה תוצאה.","rel":["hash-table","collision"]},{"id":"collision","t":"Collision","he":"התנגשות","d":"מצב שבו שתי מפתחות שונות ממופות לאותו bucket. Python מטפל בזה פנימית.","rel":["hash-table","hash-function"]},{"id":"amortized-cost","t":"Amortized Cost","he":"עלות מופחתת","d":"עלות ממוצעת לפעולה על פני סדרה ארוכה; הוספה ל-list היא O(1) מופחת למרות resizes נדירים.","rel":["dynamic-array"]},{"id":"frequency-count","t":"Frequency Count","he":"ספירת תדרים","d":"Pattern שבונה Counter/dict כדי לספור כמה פעמים מופיע כל ערך. בסיס של אנגרמות ו-top-k.","rel":["hash-table"]},{"id":"complement-lookup","t":"Complement Lookup","he":"חיפוש משלים","d":"Pattern שלכל x בודק אם target-x כבר ב-dict. בסיס של Two Sum ומשפחתו.","rel":["hash-table"]}]}
```
