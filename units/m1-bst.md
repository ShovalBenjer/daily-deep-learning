# עץ חיפוש בינארי
כשמחפשים ערך במילון שתומך גם בהוספה ומחיקה, כל שאלה חוצה את מרחב החיפוש לחצי - וזו בדיוק ההבטחה של עץ חיפוש בינארי.

## מה תדע בסוף
תדע לממש **Binary Search Tree, עץ חיפוש בינארי** עם search, insert ו-delete בפייתון; תבין מדוע inorder traversal על BST מחזיר ערכים ממוינים; תכיר את מקרה הגרוע ביותר של BST - העץ המנוון - ומתי לבחור dict במקומו.

## האינטואיציה

דמיין קלסר עם מגירות. בכל מגירה יש תווית: "קטן מ-X - לך שמאלה; גדול מ-X - לך ימינה". כדי לחפש ערך, פותחים את מגירת השורש ומחליטים: שמאל או ימין? ממשיכים בכל שלב לאחת מגירה, עד שמוצאים את הערך או מגיעים למגירה ריקה.

האינטואיציה הזו היא **Binary Search, חיפוש בינארי** - רק שבמקום מערך ממוין, שמים את אותו עיקרון על עץ. היתרון: עץ תומך בהוספה ומחיקה בלי להזיז את כל שאר האיברים. המחיר: אם העץ נהיה לא מאוזן, ההבטחה של \(O(\log n)\) נשברת.

**TreeNode, צומת עץ**: צומת בעץ עם שדה `val` וסניפין: `left` ו-`right`.

**BST Property, תכונת BST**: לכל צומת n בעץ, כל ערך בתת-עץ השמאלי קטן מ-n.val וכל ערך בתת-עץ הימני גדול ממנו. כפילויות בדרך כלל לא מותרות (אלא אם מגדירים מוסכמה ברורה).

## הפורמליזם

### הגדרה

```
   5
  / \
 3   7
/ \ / \
1 4 6  8
```

כאן: `1 < 3 < 4 < 5 < 6 < 7 < 8`. לכל צומת, תת-עץ שמאלי כולו קטן ממנו, ותת-עץ ימני כולו גדול.

**Inorder Traversal, מעבר אינסדר**: שמאל - שורש - ימין. על BST, inorder traversal מחזיר את הערכים **ממוינים בסדר עולה**. זו תוצאה ישירה מה-BST property.

### מימוש

```python
class TreeNode:
    def __init__(self, val=0):
        self.val = val
        self.left = None
        self.right = None


def bst_search(root: TreeNode | None, target: int) -> TreeNode | None:
    if root is None or root.val == target:
        return root
    if target < root.val:
        return bst_search(root.left, target)
    return bst_search(root.right, target)


def bst_insert(root: TreeNode | None, val: int) -> TreeNode:
    if root is None:
        return TreeNode(val)
    if val < root.val:
        root.left = bst_insert(root.left, val)
    elif val > root.val:
        root.right = bst_insert(root.right, val)
    return root


def bst_delete(root: TreeNode | None, val: int) -> TreeNode | None:
    if root is None:
        return None
    if val < root.val:
        root.left = bst_delete(root.left, val)
    elif val > root.val:
        root.right = bst_delete(root.right, val)
    else:
        # מצאנו את הצומת למחיקה
        if root.left is None:
            return root.right
        if root.right is None:
            return root.left
        # שני ילדים: מחפשים את Inorder Successor
        successor = root.right
        while successor.left:
            successor = successor.left
        root.val = successor.val
        root.right = bst_delete(root.right, successor.val)
    return root


def inorder(root: TreeNode | None) -> list[int]:
    if root is None:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)
```

### מורכזות זמן

| פעולה | ממוצע | גרוע |
|-------|-------|------|
| search | \(O(\log n)\) | \(O(n)\) |
| insert | \(O(\log n)\) | \(O(n)\) |
| delete | \(O(\log n)\) | \(O(n)\) |
| inorder | \(O(n)\) | \(O(n)\) |

המורכזות הממוצעת מניחה **Balanced Tree, עץ מאוזן** עם גובה \(h = O(\log n)\). הגרוע מתרחש כשהעץ מתנוון (ראה סעיף הבא).

**Inorder Successor, ממשיך אינסדר**: הצומת הקטן ביותר שגדול מהצומת הנוכחי. תמיד נמצא בעלה השמאלי ביותר של תת-העץ הימני. בלוגיקת המחיקה, כשלצומת יש שני ילדים, מחליפים בו את ה-successor ואז מוחקים אותו מהמקום המקורי.

## דוגמה מחושבת

**בנייה**: מכניסים `[5, 3, 7, 1, 4, 6, 8]` לעץ ריק.

1. `5` - שורש.
2. `3 < 5` - ילד שמאל של 5.
3. `7 > 5` - ילד ימין של 5.
4. `1 < 5` - שמאל; `1 < 3` - ילד שמאל של 3.
5. `4 < 5` - שמאל; `4 > 3` - ילד ימין של 3.
6. `6 > 5` - ימין; `6 < 7` - ילד שמאל של 7.
7. `8 > 5` - ימין; `8 > 7` - ילד ימין של 7.

```
   5
  / \
 3   7
/ \ / \
1 4 6  8
```

`inorder([5,3,7,1,4,6,8])` מחזיר `[1,3,4,5,6,7,8]` - ממוין.

**חיפוש** `target=4`: `4 < 5` (שמאל); `4 > 3` (ימין); `4 == 4` - נמצא. 3 שלבים.

**מחיקה** `val=3` (שני ילדים - 1 ו-4):
- Inorder successor של 3 הוא 4 (הקטן ביותר בתת-עץ הימני של 3).
- מחליפים `3` ב-`4`.
- מוחקים `4` מהמקום המקורי (ילד ימין של 3 הנוכחי, שהפך ל-4).

```
   5
  / \
 4   7
/   / \
1  6   8
```

`inorder` אחרי המחיקה: `[1,4,5,6,7,8]`. נכון.

## המקרה שמפיל את האינטואיציה

**עץ מנוון, Degenerate Tree**: כשמכניסים ערכים **כבר ממוינים** - `1, 2, 3, 4, 5` - כל ערך חדש הולך לתת-עץ ימין של הקודם. התוצאה היא רשימה מקושרת ולא עץ:

```
1
 \
  2
   \
    3
     \
      4
       \
        5
```

גובה העץ = n. חיפוש, הוספה ומחיקה דורשים \(O(n)\) - **אין שיפור על רשימה מקושרת רגילה**.

בסדנה, כשמכניסים פעולות מ-DB ממוין לפי זמן ישר ל-BST, זה בדיוק מה שקורה. הפתרון הוא עצים מאוזנים עצמאית: **AVL Tree** או **Red-Black Tree** - שניהם מבטיחים \(O(\log n)\) בגרוע, על ידי סיבובים אוטומטיים לאחר הכנסה ומחיקה. בפייתון, `sortedcontainers.SortedList` מספק מימוש מוכן.

## טעויות נפוצות

**1. לא לשמור את ערך ההחזרה של insert/delete**

`bst_insert(root, 5)` מחזיר את השורש (החדש). אם לא שומרים: `root = bst_insert(root, 5)`, העץ לא מתעדכן בחלק מהמקרים.

**2. להניח שהעץ מאוזן**

BST רגיל אין לו ערובה לאיזון. n הכנסות יכולות ליצור עץ בגובה n. בראיון: "מה המורכזות של BST?" - התשובה הנכונה היא \(O(\log n)\) **בממוצע על כניסות אקראיות**, \(O(n)\) **בגרוע**.

**3. לשכוח לטפל בשני ילדים במחיקה**

מחיקת עלה (אין ילדים) ומחיקת צומת עם ילד אחד פשוטות. כשיש שני ילדים, יש לבחור inorder successor (או predecessor) ולבצע החלפה - לא להסיר ישירות.

**4. BST property רק על הילד הישיר**

מספיק לוודא שהילד השמאלי קטן מהשורש ושהילד הימני גדול? לא. הדרישה היא על **כל** הצמתים בתת-עץ. הדרך הנכונה לבדיקה: העבר min/max לכל קריאה רקורסיבית.

```python
def is_valid_bst(root, min_val=float('-inf'), max_val=float('inf')):
    if root is None:
        return True
    if not (min_val < root.val < max_val):
        return False
    return (is_valid_bst(root.left, min_val, root.val) and
            is_valid_bst(root.right, root.val, max_val))
```

## מתי זה לא משנה

**כשאין צורך בסדר**: dict של פייתון (hash table) נותן search/insert/delete ב-\(O(1)\) ממוצע - מהיר בהרבה מ-BST. BST נחוץ **רק** כשצריך שאילתות שמבוססות על סדר: מינימום, מקסימום, k-th largest, range queries, successor/predecessor.

**כשמספר הכנסות גדול ולא אקראי**: שימוש ב-`sortedcontainers.SortedList` (Skip List מתחת למכסה) מבטיח \(O(\log n)\) בגרוע בלי לממש AVL.

**בראיון**: שאלות שמבקשות BST לרוב כוללות מילות מפתח כמו "כנסה/מחק/חפש ב-sorted structure", "kth smallest", "validate BST", "range of values". אם אין צורך בסדר - dict הוא הפתרון.

## חיבור

יחידה זו שייכת ל-M1 (DS&A, node `dsa`). BST מרחיב את **m1-tree-traversal**: אותן פעולות DFS/BFS, אבל עם תכונת הסדר. **m1-binary-search** הוא BST על מערך - תכונת ה-BST property מקורה בדיוק ב-invariant של חיפוש בינארי.

**מה זה מאפשר**:
- **m1-bst-drill**: תרגול מעשי: כתיבת פונקציות BST ואימות inorder
- **m1-heap-topk**: Heap הוא עץ בינארי עם תכונה שונה (הורה >= ילדים) - ניגוד מכוון ל-BST

```quiz
{"id":"u-m1-bst-q1","tree":"systems","skill":"python","q":"מכניסים 5, 2, 8, 1, 3 לעץ BST ריק. איזו רשימה מחזיר inorder traversal?","options":["[5,2,8,1,3]","[1,2,3,5,8]","[1,3,2,8,5]","[5,8,2,3,1]"],"answer":1,"explain":"Inorder traversal על BST תמיד מחזיר את הערכים ממוינים בסדר עולה. BST property מבטיחה שמעבר שמאל-שורש-ימין מניב את כל הערכים בסדר."}
```

```quiz
{"id":"u-m1-bst-q2","tree":"systems","skill":"python","q":"מה מורכזות החיפוש בעץ BST שנבנה על ידי הכנסה ממוינת של 1, 2, 3, 4, 5, 6, 7?","options":["O(1)","O(log n)","O(n)","O(n log n)"],"answer":2,"explain":"הכנסה ממוינת יוצרת עץ מנוון שגובהו n - כל צומת הוא ילד ימין של הקודם. חיפוש חייב לרדת את כל הדרך, כלומר O(n). זה הגרוע של BST לא מאוזן."}
```

```fillin
{"id":"u-m1-bst-f1","tree":"systems","skill":"python","prompt":"בפונקציית bst_delete, כשלצומת יש שני ילדים, מחפשים את ה-Inorder Successor. היכן הוא נמצא תמיד?","answer":"הצומת השמאלי ביותר בתת-העץ הימני","alt":["leftmost node in right subtree","הכי שמאל בתת עץ ימין"],"explain":"Inorder successor הוא הערך הקטן ביותר שגדול מהצומת הנוכחי. הוא נמצא תמיד בעלה השמאלי ביותר של תת-העץ הימני."}
```

```widget
{"type":"algviz","algo":"bst-search","title":"BST Search: צפה כיצד החיפוש יורד בעץ שמאלה או ימינה"}
```

```concepts
{"items":[{"id":"c-bst","t":"Binary Search Tree","he":"עץ חיפוש בינארי","d":"עץ בינארי שבו לכל צומת, כל ערך בתת-עץ שמאלי קטן ממנו וכל ערך בתת-עץ ימני גדול ממנו.","rel":["c-binary-tree-node","c-bst-inorder","c-degenerate-tree"],"node":"dsa"},{"id":"c-bst-inorder","t":"BST Inorder Property","he":"תכונת אינסדר של BST","d":"Inorder traversal (שמאל-שורש-ימין) על BST מחזיר את הערכים ממוינים בסדר עולה.","rel":["c-bst","c-tree-dfs-stack"],"node":"dsa"},{"id":"c-degenerate-tree","t":"Degenerate Tree","he":"עץ מנוון","d":"BST שנוצר מהכנסה ממוינת; מתנוון לרשימה מקושרת עם גובה n, כל הפעולות O(n).","rel":["c-bst"],"node":"dsa"},{"id":"c-inorder-successor","t":"Inorder Successor","he":"ממשיך אינסדר","d":"הצומת הקטן ביותר שגדול מצומת נתון; נמצא בעלה השמאלי ביותר של תת-העץ הימני.","rel":["c-bst","c-bst-inorder"],"node":"dsa"}]}
```
