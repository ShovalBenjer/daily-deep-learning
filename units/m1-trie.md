# עץ תחיליות (Trie)
כשאתה מקליד אות אחת בשדה החיפוש, כבר יש מיליון מילים שנשלות מהמרוץ.

## מה תדע בסוף
תוכל לממש Trie מאפס, להסביר מתי הוא מנצח hashset בשאלות prefix, ולזהות בראיון מתי השאלה דורשת אחד.

## האינטואיציה
דמיין מדריך טלפון ממוין לפי הא-ב. כשאתה פותח ב-"ש", כבר עברת מחצית הדרך ל-"שו", ומשם ל-"שוו" בצעד נוסף. Trie בונה בדיוק את המבנה הזה בזיכרון: כל תחילית משותפת נשמרת פעם אחת בלבד, וכל צעד במורד העץ עולה השוואת תו אחד, לא השוואת מחרוזת שלמה.

זה ה-API שאתה תממש:

```
insert("cat")   → שמור "cat"
insert("car")   → שמור "car"; "ca" כבר שם
insert("card")  → שמור "card"; "car" כבר שם
search("car")   → True   (מילה מלאה)
search("ca")    → False  (רק תחילית, לא מילה)
startsWith("ca")→ True   (קיים צומת עם כל תווי "ca")
```

## ההגדרות המדויקות

**Trie, עץ תחיליות**: עץ שבו כל קשת מסומנת בתו אחד, וכל צומת מציין אופציונלית את סוף מילה מאוחסנת.

**TrieNode, צומת תחיליות**: הבלוק הבסיסי. מחזיק שני שדות:
- `children`: מיפוי `{תו → TrieNode}` לכל המשך אפשרי.
- `is_end`: `True` אם ומסלול השורש עד לצומת הזה מהווה מילה מלאה.

**עומק**: מילה באורך \(L\) מוחדרת בנתיב של \(L\) קשתות. גישה לה עולה \(O(L)\) בזמן, ללא תלות בכמות המילים הכוללת.

**שאילתת תחילית (prefix query)**: לרד לאורך הצמתים כל עוד התחילית מוביל קדימה. כל העץ מתחת לצומת הסופי שייך למילים שחולקות את אותה תחילית.

```python
class TrieNode:
    def __init__(self):
        self.children = {}  # dict: char → TrieNode
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
        node.is_end = True

    def search(self, word: str) -> bool:
        node = self.root
        for ch in word:
            if ch not in node.children:
                return False
            node = node.children[ch]
        return node.is_end  # חובה לבדוק is_end, לא רק שהצומת קיים

    def startsWith(self, prefix: str) -> bool:
        node = self.root
        for ch in prefix:
            if ch not in node.children:
                return False
            node = node.children[ch]
        return True  # מספיק שהנתיב קיים
```

`setdefault(key, default)` מחזיר את הערך הקיים אם המפתח שם, אחרת כותב את ה-default ומחזיר אותו. זה דרך פייתונית להימנע מ-`if ch not in node.children: node.children[ch] = TrieNode()`.

## דוגמה מחושבת

נחדיר "cat", "car", "card" לפי הסדר:

```
שלב 1: insert("cat")
root → c → a → t   [is_end=True]

שלב 2: insert("car")
root → c → a → t   [is_end=True]
              └─ r  [is_end=True]

שלב 3: insert("card")
root → c → a → t   [is_end=True]
              └─ r  [is_end=True]
                   └─ d  [is_end=True]
```

כעת נפעיל:

| שאילתה | נתיב | תוצאה | הסבר |
|--------|------|--------|------|
| `search("car")` | root→c→a→r | `True` | `is_end=True` בצומת r |
| `search("ca")` | root→c→a | `False` | `is_end=False` בצומת a |
| `startsWith("ca")` | root→c→a | `True` | הצומת קיים, לא נבדק is_end |
| `search("cab")` | root→c→a, אין 'b' | `False` | נשבר בלולאה |

## המקרה שמפיל את האינטואיציה

**חיפוש עם wildcard** (LeetCode 211: Design Add and Search Words Data Structure). אם `'.'` מתאים לכל תו, בכל צומת שמגיעים אליו עם `'.'` חייבים לרדת לכל הילדים בו-זמנית. במילון גדול עם שאילתת `"..."` הזמן הופך ל-\(O(26^L \cdot L)\) במקרה הגרוע.

```python
def search_wildcard(self, word: str) -> bool:
    def dfs(node, i):
        if i == len(word):
            return node.is_end
        ch = word[i]
        if ch == '.':
            return any(dfs(child, i + 1) for child in node.children.values())
        if ch not in node.children:
            return False
        return dfs(node.children[ch], i + 1)
    return dfs(self.root, 0)
```

הפתרון עובד, אך אין ניצחון ברור על brute-force כשה-wildcard שולטת. לחיפוש מרובה-דפוסים (Aho-Corasick) או NFA הביצועים טובים יותר.

**Unicode**: אם אתה כותב `children = [None] * 26` ומאנדקס לפי `ord(ch) - ord('a')`, כל אות מחוץ ל-a-z גורמת ל-IndexError. dict מטפל בכל גודל alphabet בלי שינוי קוד.

## טעויות נפוצות

1. **לשכוח לבדוק `is_end` ב-`search`**: הנתיב "ca" קיים בכל trie שמכיל "cat" או "car". ללא הבדיקה, `search("ca")` מחזיר `True` בטעות.

2. **להשתמש ב-`children[ch]` בלי בדיקת קיום**: `search` ו-`startsWith` חייבות להחזיר `False` כשהתו לא בילדים. `KeyError` בראיון שובר את הפתרון.

3. **לבלבל `search` עם `startsWith`**: בשאלות כמו Word Search II (LeetCode 212) צריך `startsWith` לגיזום מוקדם, לא `search`. שימוש ב-`search` לשם גיזום מחמיץ מילים שהן עצמן קצרות יותר מהנתיב שנבדק.

4. **מחיקה ידנית של `is_end` כ"מחיקת מילה"**: אם "card" נמחק ורוצים להשאיר "car", מספיק לאפס `is_end` ב-'d'. אבל אם מוחקים "car" ומשאירים "card", לא ניתן פשוט לאפס `is_end` ב-'r' כי הצומת עדיין נחוץ כמעבר ל-'d'. מחיקה מלאה דורשת בדיקה רקורסיבית אחורה.

5. **לאנדקס ב-`ord(ch) - ord('a')`**: עובד רק לאותיות קטנות באנגלית. dict הוא הברירת מחדל הבטוחה.

## מתי זה לא משנה

אם השאלה שואלת רק "האם המילה קיימת?" ואין prefix queries בכלל, Python `set` עושה את העבודה ב-O(L) עם קוד אפסי:

```python
words = {"cat", "car", "card"}
"car" in words   # True, O(L) average
```

אם הבודק מקבל זאת, אל תמהר לכתוב Trie. ציין את ה-tradeoff:

| | Trie | set |
|---|---|---|
| Insert | O(L) | O(L) avg |
| Exact search | O(L) | O(L) avg |
| Prefix search | O(P) | O(N·L) naïve |
| Memory | גבוה (dict per node) | ממוצע |

הגבול הוא prefix. כשהשאלה לא זקוקה לפרפיקס, set מנצח בפשטות. כשיש prefix חיוני (autocomplete, word suggestion, IP routing), Trie מנצח בביצועים.

בראיון: ציין תחילה את הפתרון הפשוט (hashset/set of prefixes), אמד אם הוא מספיק, ועבור ל-Trie רק אם הבוחן דוחף לאופטימיזציה.

## חיבור

Trie הוא ה-binary search של עולם המחרוזות: במקום לחצות מערך ממוין לפי שווי, אתה יורד עץ לפי תו. זה הבסיס ל:

- **Word Search II** (LeetCode 212): DFS על לוח + גיזום לפי Trie.
- **Backtracking עם Trie**: במקום לנסות כל שילוב מילים, עוצרים ברגע ש-`startsWith` מחזיר `False`.
- **Aho-Corasick**: Trie עם "קפיצות כישלון" לחיפוש מרובה-דפוסים ב-\(O(N + M + Z)\).

```quiz
{"id":"u-m1-trie-q1","tree":"systems","skill":"python","q":"Trie מכיל רק את המילה 'card'. מה מחזירה הקריאה trie.search('car')?","options":["True, כי 'car' הוא תחילית של 'card'","False, כי אף מילה מלאה לא עוצרת ב-'r'","True, כי הנתיב root→c→a→r קיים","KeyError, כי 'car' לא הוחדר"],"answer":1,"explain":"search() בודק is_end בצומת הסופי. הצומת 'r' קיים אך is_end=False שם, כי הוכנסה 'card' ולא 'car'. לכן False."}
```

```quiz
{"id":"u-m1-trie-q2","tree":"systems","skill":"python","q":"מה הסיבה להשתמש ב-dict במקום ב-list של 26 תאים עבור children?","options":["dict מהיר יותר מ-list עבור גישה ב-O(1)","dict מתמודד עם כל alphabet ולא רק a-z אנגלית קטנה","list גדול מדי בזיכרון עבור פחות מ-26 ילדים","list לא תומך ב-setdefault"],"answer":1,"explain":"list ב-26 מניח ש-ord(ch)-ord('a') בטווח 0-25. תו מחוץ לטווח גורם IndexError. dict עובד עם כל unicode character ולא דורש שינוי קוד."}
```

```widget
{"type":"algviz","algo":"trie-insert","title":"Trie Insert: צפה כיצד מילים נבנות תו-אחר-תו בעץ התחיליות"}
```

```concepts
{"items":[{"id":"c-trie","t":"Trie","he":"עץ תחיליות","d":"עץ שבו כל קשת היא תו ואורח שורש-לעלה מאיית מילה מאוחסנת","rel":["c-trie-node","c-trie-prefix"],"node":"dsa"},{"id":"c-trie-node","t":"TrieNode","he":"צומת תחיליות","d":"הבלוק הבסיסי של Trie: children dict ו-is_end flag","rel":["c-trie"],"node":"dsa"},{"id":"c-trie-prefix","t":"prefix query","he":"שאילתת תחילית","d":"הליכה במורד ה-Trie לאורך תווי תחילית; הצומת הסופי עוגן לכל המילים שחולקות אותה","rel":["c-trie","c-binary-search"],"node":"dsa"}]}
```

<!-- audited -->
