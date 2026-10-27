# תכנון דינמי חד-ממדי
כשנראה שיש אינסוף אפשרויות, לרוב הבעיה מסתירה מבנה חוזר; ברגע שמזהים אותו, \(2^n\) מתכווץ ל-\(n\).

## מה תדע בסוף

תזהה בעיות 1D DP לפי שני הסימנים: **Overlapping Subproblems, תת-בעיות חופפות** ואופטימום או ספירה. תממש **Memoization, שינון** (top-down) ו-**Tabulation, טבלאות** (bottom-up). תחשב מורכות זמן וזיכרון ותזהה מתי אפשר לדחוס ל-\(O(1)\) זיכרון. תכיר שלוש תבניות: "מהקודם", "מכל הקודמים", "מ-k האחרונים".

## האינטואיציה

דמיין שאתה פותר שורה ארוכה של תרגילים. מישהו שואל: "כמה דרכים לעלות 5 מדרגות, צעד אחד או שניים בכל פעם?" כבר חישבת "4 מדרגות" ו-"3 מדרגות" לפני רגע. במקום לחשב מחדש, מציץ במחברת: 4 מדרגות = 5 דרכים, 3 מדרגות = 3 דרכים. כיוון שמגיעים ל-5 מדרגות מ-4 (עוד צעד) או מ-3 (עוד שניים): 5 + 3 = 8 דרכים.

זהו הרעיון המרכזי: הבעיה הגדולה מורכבת מתת-בעיות קטנות שחוזרות (**Overlapping Subproblems**), ובמקום לפתור כל אחת מחדש, שומרים את התוצאה.

שני תנאים לזיהוי DP:
1. **Optimal Substructure, מבנה אופטימלי**: הפתרון האופטימלי לבעיה הגדולה נגזר מפתרונות אופטימליים לתת-בעיות.
2. **Overlapping Subproblems**: אותן תת-בעיות נפתרות שוב ושוב בגישה נאיבית.

כשמחשבים Fibonacci רקורסיבית עם `fib(n) = fib(n-1) + fib(n-2)` ללא cache, `fib(3)` נחשב פעמים רבות. עם cache: כל תת-בעיה נפתרת בדיוק פעם אחת, ו-\(O(2^n)\) מתכווץ ל-\(O(n)\).

## הפורמליזם

### Memoization (top-down)

מתחילים מהבעיה הגדולה, קוראים רקורסיבית לתת-בעיות, שומרים כל תוצאה ב-cache:

```python
def climb_stairs(n: int) -> int:
    memo: dict[int, int] = {}
    def dp(i: int) -> int:
        if i <= 1:
            return 1
        if i in memo:
            return memo[i]
        memo[i] = dp(i - 1) + dp(i - 2)
        return memo[i]
    return dp(n)
```

מורכות: זמן \(O(n)\) (כל תת-בעיה נפתרת פעם אחת), זיכרון \(O(n)\) (memo + recursion stack).

### Tabulation (bottom-up)

מתחילים מהבסיס ובונים את הטבלה מעלה, ללא רקורסיה:

```python
def climb_stairs(n: int) -> int:
    if n <= 1:
        return 1
    dp = [0] * (n + 1)
    dp[0] = 1   # דרך אחת לעמוד על "מדרגה 0"
    dp[1] = 1   # דרך אחת לעלות מדרגה אחת
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
```

מורכות: זמן \(O(n)\), זיכרון \(O(n)\).

### אופטימיזציית זיכרון: O(1) space

כשה-recurrence תלוי רק ב-k הקודמים, שומרים רק אותם:

```python
def climb_stairs(n: int) -> int:
    if n <= 1:
        return 1
    a, b = 1, 1       # dp[i-2], dp[i-1]
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

מורכות: זמן \(O(n)\), זיכרון \(O(1)\). הפיפוי `a, b = b, a + b` מחשב את שניהם יחד, בלי צורך במשתנה עזר.

### House Robber: תבנית "מהקודם"

**House Robber**: שורת בתים עם סכומים, אסור לשדוד שני בתים שכנים. מקסם את הסכום.

**ה-recurrence**: \(\text{dp}[i] = \max(\text{dp}[i-1],\; \text{dp}[i-2] + \text{nums}[i])\)

- `dp[i-1]`: לא שודדים בית i, לוקחים את המיטב עד i-1.
- `dp[i-2] + nums[i]`: שודדים בית i ולכן לא i-1.

```python
def rob(nums: list[int]) -> int:
    prev2, prev1 = 0, 0
    for num in nums:
        curr = max(prev1, prev2 + num)
        prev2, prev1 = prev1, curr
    return prev1
```

מורכות: זמן \(O(n)\), זיכרון \(O(1)\) עם שני משתנים בלבד.

### Coin Change: תבנית "מכל הקודמים"

**Coin Change**: מטבעות בערכים שונים, כמה מטבעות מינימום נדרשים לסכום amount?

**ה-recurrence**: \(\text{dp}[i] = \min_{c \in \text{coins},\; c \le i}(\text{dp}[i - c] + 1)\)

```python
def coin_change(coins: list[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0    # 0 מטבעות לסכום 0
    for i in range(1, amount + 1):
        for coin in coins:
            if coin <= i:
                dp[i] = min(dp[i], dp[i - coin] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1
```

כאן הלולאה הפנימית עוברת על כל המטבעות, לא רק על הקודם הישיר. תבנית "מכל הקודמים" נפוצה גם ב-Unbounded Knapsack, **Longest Increasing Subsequence, תת-סדרה עולה ארוכה ביותר** (LIS), ו-Word Break.

## דוגמה מחושבת

### Climbing Stairs, n=4

```
dp[0] = 1    (דרך אחת לעמוד ב-0 מדרגות)
dp[1] = 1    (עלה 1)
dp[2] = dp[1] + dp[0] = 1 + 1 = 2    (1+1 או 2)
dp[3] = dp[2] + dp[1] = 2 + 1 = 3    (1+1+1, 1+2, 2+1)
dp[4] = dp[3] + dp[2] = 3 + 2 = 5    (1+1+1+1, 1+1+2, 1+2+1, 2+1+1, 2+2)
```

חמש דרכים.

### Coin Change, coins=[1,2,5], amount=6

```
dp[0]=0
dp[1]=min(dp[0]+1) = 1          (מטבע 1)
dp[2]=min(dp[1]+1, dp[0]+1) = 1  (מטבע 2)
dp[3]=min(dp[2]+1, dp[1]+1) = 2  (1+2)
dp[4]=min(dp[3]+1, dp[2]+1) = 2  (2+2)
dp[5]=min(dp[4]+1, dp[3]+1, dp[0]+1) = 1  (מטבע 5)
dp[6]=min(dp[5]+1, dp[4]+1, dp[1]+1) = 2  (1+5)
```

תשובה: 2 מטבעות (1+5).

## המקרה שמפיל את האינטואיציה

### הסדר בין הלולאות קובע מה נספר

ב-Coin Change, כל מטבע אפשר לבחור פעמים רבות (Unbounded Knapsack). שינוי סדר הלולאות משנה לחלוטין את מה שנספר:

```python
# סדר נכון ל-Unbounded Knapsack (שימוש חוזר מותר):
for i in range(1, amount + 1):        # חיצוני: סכום
    for coin in coins:                 # פנימי: מטבעות

# מחליפים ל-0-1 Knapsack (כל מטבע פעם אחת):
for coin in coins:                     # חיצוני: מטבעות
    for i in range(coin, amount + 1):  # פנימי: סכום
```

בשאלת "כמה דרכים להגיע ל-amount בסדרים שונים": הסדר הראשון נותן 8 דרכים ל-amount=4 עם coins=[1,2]. הסדר השני נותן 3. הבדל שנובע ממיקום הלולאות, לא מהלוגיקה.

### Greedy נכשל כשלא מתקיים Greedy Choice Property

Greedy עם תמיד "בחר המטבע הגדול ביותר" עובד על [1,5,10,25] אבל נכשל על coins=[1,3,4], amount=6: Greedy בוחר 4+1+1=3 מטבעות, DP מוצא 3+3=2 מטבעות.

## טעויות נפוצות

**1. Base Case חסר**

ב-Coin Change, `dp[0] = 0` הוא הבסיס. בלעדיו `dp[0] = inf` ולכן `dp[amount] = inf` תמיד.

**2. גבול חסר בלולאה**

`if coin <= i` חובה לפני `dp[i - coin]`. בלי הגבול: אינדקס שלילי.

**3. כיוון הלולאה שגוי**

bottom-up מחשב מ-0 ל-amount כי `dp[i]` תלוי ב-`dp[i - coin]` שכבר חושב. היפוך הסדר יקרא לערכים שעדיין `inf`.

**4. Greedy כשצריך DP**

כשרואים "minimum" או "maximum" עם constraint על מבנה, Greedy לא מספיק ואין תחליף לחשיבה על ה-recurrence.

**5. O(n) זיכרון כשאפשר O(1)**

כשה-recurrence תלוי רק ב-dp[i-1] ו-dp[i-2], מחזיקים שני משתנים בלבד. שכחה גורמת לבזבוז זיכרון שמכשיל בשאלות עם n גדול.

## מתי זה לא משנה

**כשn קטן**: BFS ישיר פותר Climbing Stairs עם n=8 תוך מיליות שניות. DP מתחיל לנצח בn של עשרות ומעלה.

**כשיש proof ל-Greedy**: Activity Selection, Huffman Coding, Dijkstra (על גרפים ללא משקלים שליליים) פועלים עם Greedy. אין צורך ב-DP.

**כשתת-הבעיות disjoint**: Merge Sort, Quick Sort לא חולקים תת-בעיות ולכן Divide-and-Conquer מספיק.

**בראיון**: DP מתאים כשרואים "maximum", "minimum", "number of ways", "can you reach" על sequence עם constraint. מילות מפתח: "subsequence", "subarray", "consecutive", "at most k". כשרואים "greedy proof", לרוב לא צריך DP.

## חיבור

יחידה זו שייכת ל-M1 (DS&A, node `dsa`). 1D DP הוא הבסיס ל-2D DP (m1-dp-2d), שם ה-state מוגדר על שני ממדים כגון `(i, j)` למחרוזות.

**מה זה מאפשר**:
- **m1-dp-1d-drill**: תרגול ובניית אוטומציה על Climbing Stairs, House Robber ו-Coin Change
- **m1-dp-2d**: Longest Common Subsequence, Edit Distance, ומטריצות
- **m1-greedy**: הבנת מתי Greedy מספיק ומתי צריך DP

```quiz
{"id":"u-m1-dp-1d-q1","tree":"systems","skill":"python","q":"Climbing Stairs: n=4 מדרגות, עולים 1 או 2 בכל פעם. כמה דרכים שונות יש?","options":["3","4","5","8"],"answer":2,"explain":"dp[0]=1, dp[1]=1, dp[2]=2, dp[3]=3, dp[4]=5. חמש הדרכים: 1+1+1+1, 1+1+2, 1+2+1, 2+1+1, 2+2. כל dp[i]=dp[i-1]+dp[i-2]."}
```

```quiz
{"id":"u-m1-dp-1d-q2","tree":"systems","skill":"python","q":"House Robber: nums=[2,7,9,3,1]. מה המקסימום שאפשר להרוויח?","options":["10","11","12","13"],"answer":2,"explain":"שודדים בתים באינדקסים 0,2,4: 2+9+1=12. לחלופין 1,3: 7+3=10. מקסימום 12. dp[i]=max(dp[i-1], dp[i-2]+nums[i])."}
```

```concepts
{"items":[{"id":"dp-1d","t":"1D Dynamic Programming","he":"תכנון דינמי חד-ממדי","d":"פירוק בעיה לתת-בעיות חופפות ושמירת תוצאותיהן. State סקלר i; recurrence קובע dp[i] מתוך dp[j] לj<i. זמן O(n), זיכרון O(n) או O(k).","rel":["memoization","tabulation","overlapping-subproblems"],"node":"dsa"},{"id":"memoization","t":"Memoization","he":"שינון","d":"top-down DP: רקורסיה עם cache. פותרים בעיה גדולה, קוראים רקורסיבית לתת-בעיות, שומרים תוצאה בפעם הראשונה.","rel":["dp-1d","tabulation"],"node":"dsa"},{"id":"tabulation","t":"Tabulation","he":"טבלאות","d":"bottom-up DP: מילוי מערך dp מהבסיס למעלה ללא רקורסיה. זמן O(n), זיכרון O(n) או O(k) אם מחזיקים רק k ערכים קודמים.","rel":["dp-1d","memoization"],"node":"dsa"},{"id":"overlapping-subproblems","t":"Overlapping Subproblems","he":"תת-בעיות חופפות","d":"אותן תת-בעיות נפתרות שוב ושוב בגישה נאיבית. תנאי הכרחי ל-DP; Divide and Conquer פותר תת-בעיות disjoint.","rel":["dp-1d","optimal-substructure"],"node":"dsa"},{"id":"optimal-substructure","t":"Optimal Substructure","he":"מבנה אופטימלי","d":"הפתרון האופטימלי לבעיה נגזר מפתרונות אופטימליים לתת-בעיות. תנאי הכרחי ל-DP ול-Greedy.","rel":["dp-1d","overlapping-subproblems"],"node":"dsa"}]}
```
