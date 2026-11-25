# לולאות וזרימות עבודה

שני קודים שעושים "AI" אינם אותו הדבר: אחד ימצא את הנתיב בזמן ריצה, השני יעבור אותו צעד אחר צעד בדיוק כפי שכתבת.

## מה תדע בסוף

תבחין בין workflow (נתיב קבוע, דטרמיניסטי) לבין agentic loop (נתיב שהמודל בוחר בזמן ריצה), תכתוב כל אחד עם Anthropic Python SDK, ותסביר מתי עדיף כל אחד ומדוע.

## האינטואיציה

נניח שאתה נוסע מתל אביב לירושלים. יש שתי גישות:

**GPS עם מסלול קבוע (workflow)**: טוען מפה, מחשב מסלול בדיוק לפי הכבישים, מורה "ימינה כאן, שמאלה שם". כל צעד ידוע מראש. אם יש פקק, המסלול מחושב מחדש בדרך קבועה.

**מדריך מקומי (agentic loop)**: בוחן את הדרך, שואל עוברי אורח, מחליט אם לעצור לשאלות נוספות, מגלה מסלול קיצור שלא היה במפה. בכל צומת הוא מחליט מחדש על הצעד הבא.

ב-code: workflow הוא רצף `if-else` ו-function calls שהתכנת כתב. Agentic loop הוא `while` שמאפשר למודל לבחור מה `tool` לקרוא הבא.

הבחנה זו, **דטרמיניזם לעומת אמרגנטיות**, היא התשובה לשאלה "מתי צריך סוכן אמיתי?" שאלות בראיונות עבודה על AI engineering כמעט תמיד חוזרות אליה.

## ההגדרות המדויקות

**Workflow, זרימת עבודה**: רצף שלבים שבו כל שלב ועוקבו מוגדרים בקוד. הנתיב ידוע מראש. LLM יכול להיות שלב אחד בזרימה, אך לא הוא שמחליט מה הצעד הבא.

ארבעה דפוסי workflow נפוצים:
- **Sequential, רצף**: שלב A מסיים לפני שלב B מתחיל.
- **Parallel, מקביל**: מספר שלבים רצים בו-זמנית, ומחכים לתוצאה משולבת.
- **Pipeline**: פלט של כל שלב הוא קלט השלב הבא, כמו `cmd1 | cmd2 | cmd3` ב-Unix.
- **Fan-out / Fan-in**: שלב אחד מחלק עבודה לרבים (fan-out), השלב הבא מאחד (fan-in).

**Agentic loop, לולאה סוכנית**: לולאת `while` שבה המודל מקבל את ה-context הנוכחי, מחליט על action הבא (tool call או סיום), הקוד מבצע, ומזריק את התוצאה חזרה. חוזר עד שהמודל פולט `end_turn` או שמגיע ל-iteration limit.

**Tool Runner**: רכיב SDK שמריץ את הלולאה הסוכנית בשבילנו. ה-Anthropic Python SDK מספק `client.beta.messages.tool_runner` שעוטף את לולאת ה-tool calls ומגדיר מה לעשות כשהמודל קורא לכלי.

**Iteration limit, מגבלת איטרציות**: מספר ה-turns המקסימלי בלולאה. ללא מגבלה, מודל עם tool call loop יכול לרוץ ולצבור עלות ללא שליטה.

**Stopping condition, תנאי עצירה**: הגדרה מפורשת של מתי הלולאה נגמרת: `end_turn` מהמודל, iteration limit, timeout, או flag ספציפי בתוצאת tool.

## דוגמה מחושבת

**משימה**: "סכם את קובץ ה-PDF ושמור ב-DB."

### גישה 1: Workflow

```python
import anthropic

client = anthropic.Anthropic()

def run_workflow(pdf_text: str, db) -> str:
    # שלב 1: Extract
    extracted = extract_key_points(pdf_text)   # פונקציה דטרמיניסטית

    # שלב 2: Summarize (LLM הוא שלב אחד בזרימה)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": f"סכם:\n{extracted}"}]
    )
    summary = response.content[0].text

    # שלב 3: Save
    db.save(summary)
    return summary
```

הנתיב: Extract, Summarize, Save. תמיד בסדר הזה, תמיד שלושה שלבים. אם השלב "Save" נכשל, אנחנו יודעים בדיוק איפה.

### גישה 2: Agentic loop

```python
import anthropic

client = anthropic.Anthropic()

tools = [
    {"name": "extract_pdf", "description": "חולץ טקסט מ-PDF", ...},
    {"name": "summarize",    "description": "מסכם טקסט ארוך",   ...},
    {"name": "save_to_db",   "description": "שומר סיכום ב-DB",   ...},
]

messages = [{"role": "user", "content": "סכם את הקובץ ושמור."}]

for _ in range(10):                        # iteration limit
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        tools=tools,
        messages=messages,
    )
    if response.stop_reason == "end_turn":
        break
    tool_use = next(b for b in response.content if b.type == "tool_use")
    result    = dispatch_tool(tool_use.name, tool_use.input)
    messages += [
        {"role": "assistant", "content": response.content},
        {"role": "user",      "content": [
            {"type": "tool_result", "tool_use_id": tool_use.id, "content": result}
        ]}
    ]
```

כאן המודל מחליט: "אסחת את הקובץ קודם, אחר כך אסכם, אחר כך אשמור". הנתיב זהה לעיתים קרובות, אבל אם המודל מגלה שה-PDF כבר מסוכם, הוא עשוי לדלג על שלב.

**ההבדל הפרקטי**: בגישה 1 שגיאה בשלב 2 ברורה לאיפה לחפש. בגישה 2 שגיאה דורשת ניתוח ה-messages trace. Workflow מקל debug; loop מאפשר גמישות.

```quiz
{"id":"u-m8-loops-workflows-q1","tree":"craft","skill":"agents-orch","q":"מה ההבדל המרכזי בין workflow לבין agentic loop?","options":["workflow: הנתיב קבוע בקוד; agentic loop: המודל בוחר את הפעולה הבאה בזמן ריצה","workflow: מהיר יותר תמיד; agentic loop: מדויק יותר תמיד","workflow: מתאים ל-LLM גדולים; agentic loop: מתאים ל-LLM קטנים","workflow: צריך GPU; agentic loop: רץ על CPU"],"answer":0,"explain":"ב-workflow הנתיב והשלבים מוגדרים בקוד מראש, LLM הוא שלב אחד בלבד. ב-agentic loop יש לולאת while שבה המודל מחליט בכל iteration מה הצעד הבא, על ידי בחירת tool call או סיום."}
```

## המקרה שמפיל את האינטואיציה

**"אנחנו בונים סוכן AI" לא אומר שצריך agentic loop.**

קח דוגמה: ניתוח רגשות על אלף ציוצים. "הסוכן" יקרא כל ציוץ ויחליט אם הרגש חיובי, שלילי, או ניטרלי. זו לא לולאה סוכנית, זו `map` על רשימה עם LLM call בכל איבר:

```python
results = [classify_sentiment(tweet) for tweet in tweets]
```

אין כאן הכרעה דינמית. אין tool calls. הנתיב ידוע לחלוטין. לעטוף את זה ב-agentic loop יוסיף overhead, יסבך debug, ויחשוף לאפשרות של iteration limit שגוי.

**כלל האגודל**: שאל "האם ייתכן שה-LLM יגלה בזמן ריצה שהוא צריך לשנות את הנתיב?" אם התשובה היא לא, זה workflow.

## טעויות נפוצות

**1. Loop ללא iteration limit.** לולאה שמגיעה ל-50+ turns עם כלי חיפוש בזול יכולה לעלות עשרות דולרים ב-API calls. מגבלה של 10 עד 15 iterations היא נקודת פתיחה סבירה. עדכן לפי מדידה.

**2. Tool results גדולים שנשארים ב-context.** אם כלי מחזיר 10,000 tokens בכל קריאה, ולאחר 5 iterations ה-context עמוס ב-50,000 tokens, הקריאה הבאה יקרה ואיטית. טרנספורם tool results לתמציות לפני שמכניסים ל-messages.

**3. לעצב workflow כ-loop כי זה "נשמע יותר סוכן".** זה לא מוסיף ערך, זה מוסיף מורכבות וסיכון.

**4. אין logging לאיטרציות.** ב-agentic loop כל turn הוא החלטה. ללא log של אילו tools נקראו ובאיזה סדר, debug של תקלה הוא ניחוש.

**5. לשכוח לסגור tool connections.** כלים שפותחים connections (DB, HTTP client) בתוך loop יכולים לצבור connection leaks אם הלולאה נקטעת בחריגה.

## מתי זה לא משנה

**למשימות פשוטות עם תשובה אחת**: שאל, קבל תשובה. אין loop, אין workflow. Single-shot inference.

**כשהזמן הוא הגורם הקריטי**: workflow sequential הוא לרוב מהיר מ-loop כי אין overhead של tool-call parsing בכל iteration.

**בחיי המוצר**: הבחירה בין workflow ל-loop היא החלטת design ולא החלטה טכנית. אם ה-PM אומר "הסוכן צריך להחליט איך לפתור כל מקרה", זה loop. אם אומר "הסוכן עובר שלבים קבועים", זה workflow.

```fillin
{"id":"u-m8-loops-workflows-f1","tree":"craft","skill":"agents-orch","prompt":"בלולאה סוכנית, כשהמודל מחזיר stop_reason == \"end_turn\" אנחנו צריכים ל_______ את הלולאה.","answer":"עצור","alt":["לסיים","לצאת","לשבור","break"],"explain":"end_turn הוא האות של המודל שסיים. הקוד צריך לצאת מהלולאה ולחזיר את התוצאה. המשך הלולאה אחרי end_turn יצור קריאות API מיותרות."}
```

## חיבור

יחידה זו פותחת את בלוק M8. שתי הגישות שלמדנו, workflow ו-loop, הן הבסיס ל:

- **m8-context-memory**: ניהול ה-messages array כדי שהלולאה לא תפוצץ את חלון ההקשר.
- **m8-tools-mcp-skills**: עיצוב הכלים שהמודל בוחר מהם בכל iteration.
- **m8-orchestration**: שילוב כמה loops ו-workflows בארכיטקטורת רב-סוכנים.

הקשר מ-M4: **m4-agent-architecture** הציגה את לולאת ה-tool call הבסיסית. ב-M8 אנחנו עוברים מ"זה עובד" ל"זה נכון לתרחיש הזה": מתי loop, מתי workflow, ואיך לבנות כל אחד בצורה שתחזיק בproduction.

```concepts
{"items":[{"id":"c-workflow-pattern","t":"Workflow Pattern","he":"דפוס זרימת עבודה","d":"רצף שלבים דטרמיניסטי שבו הנתיב ועוקב כל שלב מוגדרים בקוד; LLM יכול להיות שלב אחד","rel":["c-agent-loop","c-agentic-loop-term"],"node":"agents-loop"},{"id":"c-agentic-loop-term","t":"Agentic Loop","he":"לולאה סוכנית","d":"לולאת while שבה המודל בוחר את הפעולה הבאה על ידי tool call עד ל-end_turn או iteration limit","rel":["c-workflow-pattern","c-agent-loop","c-loop-termination"],"node":"agents-loop"},{"id":"c-loop-termination","t":"Loop Termination","he":"תנאי עצירת לולאה","d":"תנאי עצירה מפורש: end_turn מהמודל, iteration limit, timeout, או flag; ללא תנאי הלולאה יכולה לרוץ ללא שליטה","rel":["c-agentic-loop-term","c-agent-loop"],"node":"agents-loop"}]}
```
