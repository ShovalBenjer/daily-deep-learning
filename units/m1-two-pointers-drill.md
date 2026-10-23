# שני מצביעים: תרגול
שני צעדים בלבד מפרידים בין \(O(n^2)\) ל-\(O(n)\): למיין, ולשים מצביע בכל קצה.

## מה תדע בסוף
תפתור בביטחון שלוש משפחות בעיות: Container With Most Water, הסרת כפילויות in-place, ו-3Sum; תזהה מיידית שה-skip-duplicates ב-3Sum הוא דרישת נכונות; תסביר למה מזיזים את הצד הנמוך ב-Container.

## האינטואיציה

מנהל תחרות שחייה צריך להרכיב זוגות שסכום זמניהם בדיוק 210 שניות. השחיינים ממוינים: האיטי בקצה שמאל, המהיר בימין. במקום לנסות כל זוג, הוא עובד משני הקצוות פנימה: סכום גדול מדי, מוריד את המהיר; סכום קטן מדי, מקדם את האיטי. כל הזזה מבטלת תור שלם של זוגות.

בתרגילים שלהלן, אתה מנהל התחרות.

## ההגדרות המדויקות

שתי תבניות (ראה יחידת הבסיס m1-two-pointers):

**Converging Ends, קצות מתנגשים**: `i=0, j=n-1`; חוק הזזה נגזר ממונוטוניות; נדרש מיון.

**Fast/Slow, מהיר ואיטי**: `slow` מסמן גבול הקטע הנקי, `fast` סורק קדימה; לא נדרש מיון.

**שלושה מצביעים, Three Pointers**: בעיית 3Sum מרחיבה את הpattern ללולאה חיצונית \(O(n)\) ו-Converging Ends פנימית \(O(n)\); סה"כ \(O(n^2)\) במקום \(O(n^3)\) brutal force.

```python
def three_sum(nums):
    nums.sort()
    result = []
    for k in range(len(nums) - 2):
        if k > 0 and nums[k] == nums[k - 1]:   # skip-duplicates חיצוני
            continue
        i, j = k + 1, len(nums) - 1
        while i < j:
            s = nums[k] + nums[i] + nums[j]
            if s == 0:
                result.append([nums[k], nums[i], nums[j]])
                while i < j and nums[i] == nums[i + 1]:  # skip-duplicates פנימי
                    i += 1
                while i < j and nums[j] == nums[j - 1]:
                    j -= 1
                i += 1; j -= 1
            elif s < 0:
                i += 1
            else:
                j -= 1
    return result
```

## דוגמה מחושבת

### בעיה 1: Container With Most Water (Leetcode 11)

**קלט**: `height = [1, 8, 6, 2, 5, 4, 8, 3, 7]`

**רעיון**: שטח המים הוא `min(height[i], height[j]) * (j - i)`. מזיזים תמיד את הצד הנמוך: הזזת הגבוה מקטינה את הרוחב בלי סיכוי לשפר את ה-min.

| i | j | height[i] | height[j] | min | רוחב | שטח | פעולה |
|---|---|-----------|-----------|-----|------|-----|-------|
| 0 | 8 | 1 | 7 | 1 | 8 | 8 | i++ (1 < 7) |
| 1 | 8 | 8 | 7 | 7 | 7 | 49 | j-- (7 < 8) |
| 1 | 7 | 8 | 3 | 3 | 6 | 18 | j-- |
| 1 | 6 | 8 | 8 | 8 | 5 | 40 | i++ (שווה: נזיז כלשהו) |
| 2 | 6 | 6 | 8 | 6 | 4 | 24 | i++ |
| 3 | 6 | 2 | 8 | 2 | 3 | 6 | i++ |
| 4 | 6 | 5 | 8 | 5 | 2 | 10 | i++ |
| 5 | 6 | 4 | 8 | 4 | 1 | 4 | i++ |
| 6 | 6 | - | - | - | - | - | i >= j, עצירה |

מקסימום: **49** (i=1, j=8).

```python
def max_area(height):
    i, j = 0, len(height) - 1
    best = 0
    while i < j:
        area = min(height[i], height[j]) * (j - i)
        best = max(best, area)
        if height[i] < height[j]:
            i += 1
        else:
            j -= 1
    return best
```

**למה זה נכון?** כשמזיזים את הצד הנמוך, כל הזוגות שנפסלו (i עם j, j-1, ...) היו נותנים שטח קטן יותר: רוחב קטן, ו-min לא יכול לעלות מעל height[i] כי height[i] הוא המגביל.

### בעיה 2: 3Sum (Leetcode 15)

**קלט**: `nums = [-1, 0, 1, 2, -1, -4]`

לאחר מיון: `[-4, -1, -1, 0, 1, 2]`

**k=0** (nums[k]=-4): i=1, j=5. פנימי: -1+2=1<4 i++; -1+2=1<4 i++; 0+2=2<4 i++; 1+2=3<4 i++; i=5=j עצירה. אין שלשה.

**k=1** (nums[k]=-1): i=2, j=5. פנימי: nums[2]+nums[5]=-1+2=1>0 j--; nums[2]+nums[4]=-1+1=0 נמצא! מוסיפים [-1,-1,2]. skip: nums[2]=nums[3]? -1==0? לא. nums[4]=nums[3]? 1==0? לא. i=3, j=3: עצירה.

**k=2** (nums[k]=-1): nums[2]==nums[1]=-1 → skip.

**k=3** (nums[k]=0): i=4, j=5. 1+2=3>0 j--; i=4=j עצירה.

**תוצאה**: `[[-1, -1, 2], [-1, 0, 1]]`.

### בעיה 3: Move Zeroes (Leetcode 283)

**קלט**: `nums = [0, 1, 0, 3, 12]`

```python
slow = 0
for fast in range(len(nums)):
    if nums[fast] != 0:
        nums[slow], nums[fast] = nums[fast], nums[slow]
        slow += 1
```

| fast | slow | nums[fast] | פעולה |
|------|------|------------|-------|
| 0 | 0 | 0 | אפס, דלג |
| 1 | 0 | 1 | swap(0,1): [1,0,0,3,12], slow=1 |
| 2 | 1 | 0 | אפס, דלג |
| 3 | 1 | 3 | swap(1,3): [1,3,0,0,12], slow=2 |
| 4 | 2 | 12 | swap(2,4): [1,3,12,0,0], slow=3 |

**תוצאה**: `[1, 3, 12, 0, 0]`.

## המקרה שמפיל את האינטואיציה

**3Sum: שכחת skip-duplicates**

`nums = [-2, 0, 0, 2, 2]`

ללא skip, כשמוצאים [-2,0,2] ב-k=0, i=1, j=4:
- נוסיף [-2, 0, 2].
- i++, j--: i=2, j=3. nums[2]=0, nums[3]=2. סכום=-2+0+2=0.
- נוסיף שוב [-2, 0, 2]. כפילות!

עם skip-duplicates פנימי אחרי append:

```python
while i < j and nums[i] == nums[i + 1]:
    i += 1
while i < j and nums[j] == nums[j - 1]:
    j -= 1
i += 1; j -= 1
```

כשמוצאים [-2,0,2]: nums[1]==nums[2]? 0==0 → i=2. nums[4]==nums[3]? 2==2 → j=3. i++: i=3, j--: j=2. i>j, עצירה. שלשה יחידה.

**הכלל**: skip-duplicates ב-Leetcode 15 הוא לא אופטימיזציה, הוא דרישת נכונות.

## טעויות נפוצות

**1. שכחת מיון לפני Two Pointers**

Two Pointers Converging נשבר על מערך לא ממוין. תמיד `nums.sort()` ראשון, גם אם זה עולה \(O(n \log n)\).

**2. skip-duplicates חלקי ב-3Sum**

כותבים skip ל-k (לולאה חיצונית) אבל שוכחים את ה-skip הפנימי אחרי הappend. תוצאה: שלשות כפולות ב-output.

**3. Container With Most Water: הזזת הצד הגבוה**

```python
# שגוי
if height[i] > height[j]:
    i += 1
```

הזזת הצד הגבוה עלולה לפספס את ה-maximum: ה-min מוגבל על ידי הנמוך, ורוחב רק קטן.

**4. תנאי `i < j` vs `i <= j` ב-3Sum**

בלולאה הפנימית, `i == j` פירושו שניהם על אותו איבר. התנאי הנכון הוא `i < j`.

**5. Move Zeroes: `nums[fast]=0` לפני swap**

כששני המצביעים על אפס ומחליפים, האפס עובר בחזרה. הסדר חשוב; הפתרון הנכון מחליף רק כשnums[fast] != 0.

## מתי זה לא משנה

**כשה-array קטן**: מתחת ל-100 איברים, \(O(n^2)\) ברור יותר ובלי סיכון לבאג skip-duplicates.

**כשצריך k-Sum עם k גדול**: k=4 עדיין \(O(n^3)\). מעל k=3, hash table או DP לרוב עדיפים.

**בראיון**: "find a triplet that sums to zero, O(n²) time" ← Two Pointers + sort. "O(n) time" ← אין אלגוריתם ידוע.

## חיבור

יחידה זו מסיימת את ה-Two Pointers drill ב-M1 (node `dsa`, tree `systems`). הpattern מרחיב ישירות ל-**Sliding Window** (m1-sliding-window): חלון בין i לj הוא הבסיס. גם **Binary Search** (m1-binary-search) נוגע באינטואיציית מונוטוניות, אבל לחיפוש ולא ל-pair-finding.

```quiz
{"id":"u-m1-two-pointers-drill-q1","tree":"systems","skill":"python","q":"Container With Most Water: בכל צעד מזיזים את הצד הנמוך ולא הגבוה. למה?","options":["הזזת הנמוך יכולה לגלות קיר גבוה יותר ולשפר את ה-min","הזזת הגבוה מקטינה את הרוחב בלי סיכוי לשפר את ה-min","שני הכיוונים שווים; זו מוסכמה","כדי לשמור על i < j תמיד"],"answer":1,"explain":"ה-min בשלב הנוכחי נקבע על ידי הצד הנמוך. אם נזיז את הגבוה פנימה, ה-min לא יכול לעלות (עדיין מוגבל על ידי הנמוך), אבל הרוחב קטן. שטח לא יכול לגדול. הזזת הנמוך עשויה למצוא קיר גבוה יותר."}
```

```quiz
{"id":"u-m1-two-pointers-drill-q2","tree":"systems","skill":"python","q":"ב-3Sum, ללא skip-duplicates פנימי, על [-2,0,0,2,2] נקבל:","options":["[-2,0,2] פעמיים","[-2,0,2] פעם אחת","[-2,0,0] ו-[-2,2,2]","שגיאת runtime"],"answer":0,"explain":"כשמוצאים [-2,0,2] (i=1,j=4), ואחר כך i++,j--: i=2,j=3 ← nums[2]+nums[3]=0+2=0-2=-2+0+2=0. מוסיפים שוב [-2,0,2]. skip-duplicates פנימי מונע זאת על ידי דילוג על כל ה-0 הנוספים וכל ה-2 הנוספים."}
```

```fillin
{"id":"u-m1-two-pointers-drill-f1","tree":"systems","skill":"python","prompt":"Move Zeroes: nums=[2,0,5,0,7]. אחרי הרצת slow/fast swap, מה הarray הסופי?","answer":"[2,5,7,0,0]","alt":["2 5 7 0 0","[2, 5, 7, 0, 0]"],"explain":"fast=0(2): swap(0,0), slow=1. fast=1(0): דלג. fast=2(5): swap(1,2)→[2,5,0,0,7], slow=2. fast=3(0): דלג. fast=4(7): swap(2,4)→[2,5,7,0,0], slow=3."}
```

```fillin
{"id":"u-m1-two-pointers-drill-f2","tree":"systems","skill":"python","prompt":"Container With Most Water: height=[1,3,5,2,4]. מה שטח המים הגדול ביותר?","answer":"9","alt":["9 יחידות","שטח 9"],"explain":"i=0(1),j=4(4): min*4=4, i++. i=1(3),j=4(4): min*3=9, i++. i=2(5),j=4(4): min*2=8, j--. i=2(5),j=3(2): min*1=2, j--. עצירה. מקסימום: 9."}
```

```concepts
{"items":[{"id":"three-pointers","t":"Three Pointers","he":"שלושה מצביעים","d":"הרחבה של Two Pointers ל-3Sum: לולאה חיצונית O(n) ו-Converging Ends פנימית O(n); סה\"כ O(n²). מחייב skip-duplicates בשתי הרמות.","rel":["two-pointers","converging-pointers"],"node":"dsa"},{"id":"skip-duplicates","t":"Skip Duplicates","he":"דילוג על כפילויות","d":"בבעיות k-Sum: לאחר מציאת פתרון, מקדימים/מאחרים את המצביע מעל ערכים זהים כדי למנוע שלשות כפולות ב-output.","rel":["three-pointers","converging-pointers"],"node":"dsa"}]}
```
