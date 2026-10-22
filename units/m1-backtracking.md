# נסיגה (Backtracking)
כשחיפשת מפתח שאיבדת, בדקת כל כיס, חזרת לחדר הקודם ובדקת שוב - זו בדיוק נסיגה: חיפוש שיטתי עם יכולת לחזור בו ולנסות מסלול אחר.

## מה תדע בסוף

תוכל לממש פתרון backtracking לכל בעיה מסוג "מצא את כל X" תוך שימוש בתבנית אחידה: make-choice, recurse, undo-choice. תדע להגדיר state, choices ו-base case לבעיות permutations, subsets ו-combinations; תבין למה שלב ה-undo חיוני ומה קורה כשמשכחים אותו.

## האינטואיציה

דמיין שאתה פותר מבוך עם עיפרון. כל פניה היא **בחירה**. כשמגיעים לסתום, מוחקים את הדרך חזרה לפניה האחרונה ומנסים כיוון אחר. כשמגיעים ליציאה, רושמים את המסלול.

**Backtracking, נסיגה** הוא אלגוריתם שבונה מועמדים לפתרון שלב-שלב. כשמגלים שהמועמד הנוכחי לא יכול לעבוד, "נסוגים" (undo) ומנסים בחירה אחרת.

ההבדל ממעבר DFS רגיל על גרף קיים: ב-DFS בודקים אם מסלול קיים; ב-backtracking אנחנו **בונים** את עץ ההחלטות תוך כדי חיפוש.

## הפורמליזם

כל בעיית backtracking מכילה שלושה רכיבים:

**State, מצב**: הבחירות שעשינו עד כה, נשמרות בדרך כלל ברשימה.

**Choices, מרחב בחירות**: האפשרויות הפתוחות מהמצב הנוכחי.

**Base case, תנאי עצירה**: מתי הגענו לפתרון שלם (או לכשל).

```python
def backtrack(state: list, choices: list, results: list) -> None:
    if is_base_case(state):           # base case reached
        if is_solution(state):
            results.append(state[:])  # deep copy: must not change later
        return
    for choice in choices:
        if is_valid(state, choice):   # pruning: skip invalid choices early
            state.append(choice)      # make choice
            backtrack(state, next_choices(state, choice), results)
            state.pop()               # undo choice (the critical step)
```

שלושת השלבים הפנימיים `make -> recurse -> undo` הם ליבת כל backtracking. ה-undo מחזיר את state בדיוק לפני הבחירה כדי שה-for loop ימשיך עם בחירה אחרת מנקודת פתיחה נקייה.

**Pruning, גיזום**: דחיית ענף לפני שחקרנו אותו עד הסוף. `is_valid` היא נקודת ה-pruning. ככל שנבדוק מוקדם יותר, כך נחסוך ענפים שלמים.

**מורכבות זמן**: במקרה הגרוע \(O(n!)\) לתמורות, \(O(2^n)\) לתת-קבוצות. Pruning אפקטיבי מפחית משמעותית.

```quiz
{"id":"u-m1-backtracking-q1","tree":"systems","skill":"python","q":"בתבנית backtracking הסטנדרטית, מה עושה state.pop() לאחר הרקורסיה?","options":["מסיר את כל הפתרונות שנמצאו עד כה","מחזיר את state למצב לפני הבחירה האחרונה כדי לאפשר ניסיון בחירה אחרת","בודק אם המצב הנוכחי תקין לפני כניסה לרקורסיה","מעתיק את state כך שהרקורסיה לא תשנה אותו"],"answer":1,"explain":"undo מחזיר את state בדיוק לרגע לפני שעשינו את הבחירה האחרונה. כך כל איטרציה של for choice in choices מקבלת אותה נקודת פתיחה ואפשר לנסות את כל הענפים מהמצב הנוכחי בנפרד."}
```

## דוגמה מחושבת

**בעיה**: כל התמורות (permutations) של `[1, 2, 3]`.

רכיבים:
- **State**: הרשימה שאנחנו בונים, לדוגמה `[1, 2]`
- **Choices**: המספרים שעוד לא בחרנו
- **Base case**: בחרנו את כולם (`not remaining`)

```python
def permutations(nums: list[int]) -> list[list[int]]:
    results = []

    def backtrack(state: list[int], remaining: list[int]) -> None:
        if not remaining:
            results.append(state[:])                          # copy the full permutation
            return
        for i, choice in enumerate(remaining):
            state.append(choice)                              # make choice
            backtrack(state, remaining[:i] + remaining[i+1:])  # recurse
            state.pop()                                       # undo choice

    backtrack([], nums)
    return results

# Output: [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
```

עקבו אחרי שני הענפים הראשונים:

```
[]  remaining=[1,2,3]
  pick 1 -> [1]  remaining=[2,3]
    pick 2 -> [1,2]  remaining=[3]
      pick 3 -> [1,2,3]  not remaining: append [1,2,3] copy
                pop 3 -> [1,2]
    pop 2 -> [1]
    pick 3 -> [1,3]  remaining=[2]
      pick 2 -> [1,3,2]  not remaining: append [1,3,2] copy
                pop 2 -> [1,3]
    pop 3 -> [1]
  pop 1 -> []
  pick 2 -> [2] ...
```

שש תמורות בסך הכל: \(3! = 6\). כל `pop()` מנקה בדיוק את הצעד האחרון, לא יותר.

```fillin
{"id":"u-m1-backtracking-f1","tree":"systems","skill":"python","prompt":"בפתרון permutations([1,2,3]): אחרי שמצאנו ו-append את [1,2,3], מה השלב הבא לפני שבוחרים [1,3,2]?","answer":"state.pop()","alt":["pop","undo","נסיגה","מסירת האיבר האחרון"],"explain":"אחרי append, הרקורסיה חוזרת לרמה הקודמת ועושה state.pop() שמוציא 3. state חוזר ל-[1,2]. pop נוסף מוציא 2 ו-state חוזר ל-[1], ואז בוחרים 3 במקומו."}
```

## המקרה שמפיל את האינטואיציה

**Backtracking = Brute Force?** לא בהכרח. ב-N-Queens (מציאת כל דרכי הסידור של 8 מלכות על לוח 8x8 ללא התנגשות):

ללא pruning: \(8^8 = 16{,}777{,}216\) מצבים לבדיקה.

עם pruning (בדיקת עמודה, שורה ואלכסון בכל שלב): כ-15,720 צמתים בלבד לכל 92 הפתרונות.

**הנקודה**: יעילות backtracking נקבעת לגמרי לפי כמה מוקדם וכמה אגרסיבי ה-pruning. Backtracking ללא pruning הוא brute force. Backtracking עם pruning אגרסיבי הוא לעיתים קרובות האלגוריתם הפרקטי היחיד לבעיות חיפוש שיטתיות.

Pruning עובד רק כי ניתן לשלול ענפים שלמים מוקדם לפני שסיימנו לחקור אותם. אם לא ניתן לבדוק תקינות מוקדמת, אין יתרון על פני brute force.

## טעויות נפוצות

**1. שכחת ה-undo:**
```python
# שגוי
for choice in remaining:
    state.append(choice)
    backtrack(state, ...)
    # חסר: state.pop()
```
state יגדל ויצבור בחירות מכל הענפים ולא יחזור לאף מצב קודם.

**2. append(state) במקום append(state[:]):**
```python
# שגוי
results.append(state)   # state הוא מצביע לאותה רשימה
state.pop()             # גם ישנה את results[-1] !
```
כל הרשומות ב-results יהיו זהות - הרשימה הריקה האחרונה שנשארת אחרי כל ה-pops.

**3. pruning מאוחר מדי:**
בדיקת תקינות רק ב-base case (אחרי שבנינו מועמד שלם) זהה ל-brute force. יש לבדוק `is_valid` בכל שלב ולדחות מוקדם.

**4. deep copy לא נחוצה למספרים:**
```python
import copy
results.append(copy.deepcopy(state))  # slow, unnecessary for ints
results.append(state[:])              # sufficient for flat list of ints
```
`state[:]` (shallow copy) מספיק כאשר state מכיל אובייקטים בלתי-הפיכים (מספרים, מחרוזות). לרשימות פנימיות צריך `deepcopy`.

## מתי זה לא משנה

**Dynamic Programming עדיף** כשלאותה תת-בעיה מגיעים מכמה מסלולים שונים. דוגמה: "כמה דרכים לעלות n מדרגות ב-1 או 2 כל פעם". Backtracking יחשב `f(n-1)` ו-`f(n-2)` שוב ושוב; DP מחשב כל תת-בעיה פעם אחת, \(O(n)\) במקום \(O(2^n)\).

**Greedy עדיף** כשניתן לבחור מקומית ללא השלכה עתידית. Activity selection, Huffman coding, minimum spanning tree.

**BFS עדיף** לחיפוש **מסלול קצר ביותר**. Backtracking/DFS מוצא מסלול כלשהו, לא בהכרח הקצר.

**כלל ראיון**: שאלה מסוג "מצא את כל ה-X" או "כל ה-combinations/permutations/subsets" - backtracking. שאלה מסוג "מצא את ה-X האופטימלי" - חשבו על DP או Greedy קודם.

## חיבור

Backtracking שייך לבלוק M1 ובנוי על DFS מ-tree traversal. שלושה נושאים נפתחים ישירות:

- **Graph traversal**: אותה דפוסת DFS אך על גרף כללי עם `visited` set כדי למנוע מעגלים.
- **Dynamic programming**: כשbacktracking חוזר על אותן תת-בעיות, memoization הופך אותו ל-DP.
- **Greedy**: כשניתן לבחור מקומית ולהוכיח נכונות, greedy מחליף backtracking בלי לוותר על נכונות.

```concepts
{"items":[{"id":"c-backtracking","t":"Backtracking","he":"נסיגה","d":"חיפוש DFS שיטתי: make-choose-recurse-undo. בונה מועמדים שלב-שלב, נסוג כשהמסלול לא יכול להוביל לפתרון","rel":["c-pruning","c-state-space","c-tree-dfs-stack"],"node":"dsa"},{"id":"c-pruning","t":"Pruning","he":"גיזום","d":"דחיית ענף ב-backtracking לפני שנחקרו כל המועמדים בו; מפחית זמן ריצה ללא פגיעה בנכונות","rel":["c-backtracking","c-state-space"],"node":"dsa"},{"id":"c-state-space","t":"State Space","he":"מרחב מצבים","d":"קבוצת כל המצבים האפשריים בחיפוש; ב-backtracking נחקרת כ-DFS עם pruning כדי לצמצמה","rel":["c-backtracking","c-pruning"],"node":"dsa"},{"id":"c-decision-tree-bt","t":"Decision Tree (search)","he":"עץ החלטות (חיפוש)","d":"ייצוג עץ של מרחב הבחירות: כל צומת בחירה אחת, כל נתיב שלם מועמד לפתרון","rel":["c-backtracking","c-state-space"],"node":"dsa"}]}
```

<!-- audited -->
