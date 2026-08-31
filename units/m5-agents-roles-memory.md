# סוכנים: תפקידים, כלים, זיכרון

מודל שיחה רגיל לא זוכר דבר בין קריאה לקריאה. סוכן זוכר, יודע לקרוא לכלים חיצוניים, ומשחק תפקיד עקבי לאורך כל השיחה.

## מה תדע בסוף

תדע לתאר את שלושת המרכיבים של **Azure AI Agent Service**: הוראות (תפקיד), כלים, ושרשור שיחה. תבין כיצד Thread מממש זיכרון שרשורי ומה קורה ב-Run. תוכל לזהות את שלושת סוגי הכלים המובנים ולבחור ביניהם.

## האינטואיציה

דמיין פקיד ייעוץ בסניף בנק. לפקיד יש:

**תיאור תפקיד** (הוראות, instructions): "אתה יועץ משכנתאות, עונה בנימוס, לא מדבר על תיקים שלא שייכים ללקוח הנוכחי."

**כלים** (tools): גישה לתוכנת חישוב משכנתאות, ליומן, ולקורא מסמכים.

**פנקס בקשות** (thread): כל מה שהלקוח אמר היום, מהברכה הראשונה ועד לשאלה הנוכחית.

כשהלקוח שואל שאלה חדשה, הפקיד לא מתחיל מאפס. הוא פותח את הפנקס (thread), קורא את מה שנאמר, ואז מחליט אם לחשב בעצמו או להפעיל אחד מהכלים. זו בדיוק מבנה הסוכן.

## ההגדרות המדויקות

**Agent (סוכן)** הוא LLM שהוגדר עם הוראות ורשימת כלים. ב-Azure AI Agent Service נוצר בקריאה אחת:

```python
agent = project_client.agents.create_agent(
    model="gpt-4o",
    name="mortgage-advisor",
    instructions="אתה יועץ משכנתאות. עונה בעברית. ...",
    tools=toolset.definitions,
)
```

**Instructions (הוראות)** הן ה-system prompt הקבוע שמגדיר את תפקיד הסוכן ואת מגבלותיו. ניתן לשנות אותן בעת יצירת הסוכן, לא במהלך run.

**Tool (כלי)** הוא הצהרת יכולת שהסוכן רשאי לקרוא לה. שלושה סוגים מובנים ב-Azure AI Agent Service:

- **`function`**: פונקציה שהמפתח כותב ומריץ בצד הלקוח. הסוכן פולט קריאה; הקוד שלך מריץ אותה ומחזיר תוצאה.
- **`code_interpreter`, מפרש קוד**: הסוכן כותב ומריץ Python בתוך sandbox מנוהל. מתאים לחישובים, גרפים, עיבוד קבצים.
- **`file_search`, חיפוש בקבצים**: הסוכן מחפש ב-vector store שהוזן מראש. זה מנגנון ה-RAG המובנה.

**Thread (שרשור)** הוא אובייקט שמחזיק את היסטוריית השיחה. נוצר פעם אחת ומשמש שוב ושוב:

```python
thread = project_client.agents.create_thread()
```

Thread הוא הזיכרון של הסוכן. כל הודעה שמתווספת אליו נשמרת בצד השרת ועוברת לסוכן בכל run.

**Message (הודעה)** היא turn אחד בשרשור. תמיד עם `role="user"` (לקוח) או `role="assistant"` (סוכן):

```python
project_client.agents.create_message(
    thread_id=thread.id,
    role="user",
    content="מה ההחזר החודשי על הלוואה של מיליון שקל לעשרים שנה?",
)
```

**Run (ריצה)** הוא בקשה חד-פעמית לסוכן לעבד את ה-thread ולהגיב. הוא אסינכרוני; חייבים לסקור (poll) את הסטטוס שלו עד שהוא `"completed"` (הושלם), `"failed"` (נכשל) או `"requires_action"` (דורש פעולה מהלקוח, כלומר function call):

```python
run = project_client.agents.create_run(
    thread_id=thread.id,
    assistant_id=agent.id,
)
# polling
while run.status in ("queued", "in_progress"):
    time.sleep(0.5)
    run = project_client.agents.get_run(thread_id=thread.id, run_id=run.id)
```

**File Search ו-Vector Store (חנות וקטורים)**: כדי לתת לסוכן "זיכרון ארוך" על מסמכים, מעלים קבצים ל-Vector Store ומצמידים אותו ל-thread. הסוכן ישתמש ב-`file_search` tool לאחזור אוטומטי.

```concepts
{"items":[{"id":"c-azure-agent","t":"Azure AI Agent","he":"סוכן Azure AI","d":"LLM מוגדר עם הוראות וכלים ב-Azure AI Agent Service, עם thread מנוהל בצד השרת","rel":["c-azure-thread","c-azure-run"]},{"id":"c-azure-thread","t":"Thread","he":"שרשור שיחה","d":"אובייקט שמחזיק את היסטוריית השיחה ומנוהל בצד השרת; הזיכרון האמיתי של הסוכן","rel":["c-azure-agent","c-azure-run"]},{"id":"c-azure-run","t":"Run","he":"ריצת סוכן","d":"הפעלה אחת של סוכן על thread; אסינכרונית, חייבת polling עד status=completed","rel":["c-azure-thread","c-azure-agent-tool"]},{"id":"c-azure-agent-tool","t":"Agent Tool","he":"כלי סוכן","d":"הצהרת יכולת: function, code_interpreter או file_search; הסוכן פולט קריאה, הקוד מריץ","rel":["c-azure-agent","c-azure-file-search"]},{"id":"c-azure-file-search","t":"File Search","he":"חיפוש בקבצים","d":"כלי מובנה שמחפש ב-Vector Store מנוהל; מנגנון ה-RAG של Azure AI Agent Service","rel":["c-azure-agent-tool"]}]}
```

## דוגמה מחושבת

מטרה: סוכן שמחשב ריבית פשוטה בעזרת `code_interpreter`. כל שלב מוסבר.

```python
import time
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import CodeInterpreterTool
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    endpoint="https://my-hub.api.azureml.ms",
    credential=DefaultAzureCredential(),
)

# 1. יצירת סוכן עם code_interpreter
agent = client.agents.create_agent(
    model="gpt-4o-mini",
    name="interest-calc",
    instructions="אתה מחשבון פיננסי. חשב תמיד עם Python, הצג תוצאות בעברית.",
    tools=CodeInterpreterTool().definitions,
)

# 2. פתיחת thread חדש
thread = client.agents.create_thread()

# 3. הוספת הודעת משתמש
client.agents.create_message(
    thread_id=thread.id,
    role="user",
    content="חשב ריבית פשוטה: קרן 10000, ריבית שנתית 5%, מספר שנים 3",
)

# 4. הפעלת run
run = client.agents.create_run(
    thread_id=thread.id,
    assistant_id=agent.id,
)

# 5. המתנה עד סיום
while run.status in ("queued", "in_progress"):
    time.sleep(0.5)
    run = client.agents.get_run(thread_id=thread.id, run_id=run.id)

# 6. קריאת תשובת הסוכן
messages = client.agents.list_messages(thread_id=thread.id)
last = messages.data[0]          # ההודעה האחרונה (assistant)
print(last.content[0].text.value)
```

פלט טיפוסי:

```
ריבית פשוטה = קרן × ריבית × שנים = 10000 × 0.05 × 3 = 1500 ש"ח
הסכום הכולל לאחר 3 שנים: 11500 ש"ח
```

הסוכן הריץ קוד Python בפנים ואחזר את התוצאה בפורמט קריא. הלקוח לא ראה את הקוד, רק את הפלט.

```quiz
{"id":"u-m5-agents-roles-memory-q1","tree":"ops","skill":"azure-foundry","q":"מה מייצג thread ב-Azure AI Agent Service?","options":["מודל ה-LLM שרץ מאחורי הסוכן","קובץ הגדרות כלים של הסוכן","אובייקט שמחזיק את היסטוריית השיחה בצד השרת","הרשאות ה-RBAC של הסוכן"],"answer":2,"explain":"Thread הוא הזיכרון השרשורי של הסוכן: כל ההודעות (user ו-assistant) מאוחסנות בו בצד השרת ועוברות לסוכן בכל run. הוא אינו קשור למודל, לכלים או להרשאות."}
```

```fillin
{"id":"u-m5-agents-roles-memory-f1","tree":"ops","skill":"azure-foundry","prompt":"ב-Azure AI Agent Service, הפעלה אחת של הסוכן על שרשור קיים נקראת ___. היא אסינכרונית ודורשת polling עד שהסטטוס שלה הוא 'completed'.","answer":"run","alt":["ריצה","Run","run()"],"explain":"run (ריצה) הוא הפעלה אחת של הסוכן על thread. הוא אסינכרוני: create_run מחזיר מיד, אך הסוכן ממשיך לעבד. חייבים לסקור את get_run עד שהסטטוס עובר מ-queued/in_progress ל-completed."}
```

## המקרה שמפיל את האינטואיציה

האינטואיציה אומרת: "Thread לא מוגבל, הסוכן זוכר הכל." בפועל, Thread ב-Azure AI Agent Service תומך בכמות messages בלתי מוגבלת, אבל ה-LLM מוגבל בגודל ה-context window שלו. כשה-thread ארוך מדי, השירות מחיל truncation אוטומטי: הוא מוריד הודעות ישנות כדי להכניס את החדשות. ההיסטוריה שמורה בשרת, אבל הסוכן לא בהכרח רואה אותה כולה.

לטווח ארוך, הפתרון הנכון הוא file_search על סיכומי שיחה קודמים, לא thread אחד אינסופי.

```quiz
{"id":"u-m5-agents-roles-memory-q2","tree":"ops","skill":"azure-foundry","q":"סוכן מוגדר עם tool מסוג function. המשתמש שואל שאלה שמצריכה קריאה לפונקציה. מה קורה לאחר שהסוכן מחליט לקרוא לה?","options":["הסוכן מריץ את הפונקציה בעצמו ב-sandbox","ה-run עובר לסטטוס requires_action וממתין שקוד הלקוח ירוץ ויחזיר תוצאה","ה-run נכשל כי function tools לא נתמכות","הסוכן מדלג על הכלי ועונה מהידע הפנימי שלו"],"answer":1,"explain":"עם tool מסוג function, הסוכן אינו מריץ קוד בעצמו. הוא פולט tool_call ו-run עובר ל-requires_action. קוד הלקוח חייב לאתר את ה-tool_call, לרוץ, ולהחזיר תוצאה דרך submit_tool_outputs. רק אז ממשיך ה-run."}
```

## טעויות נפוצות

**קריאה ל-`create_run` לפני `create_message`**. Thread ריק גורם לסוכן לקבל שאלה ריקה. הוא עלול לענות בברכה כללית, בשגיאה, או להשתמש בידע הפנימי בלבד. תמיד הוסף לפחות הודעת user אחת לפני create_run.

**לא סוקרים את הסטטוס של run**. create_run מחזיר מיד. אם תנסה לקרוא את ה-messages מיד לאחר מכן, תקבל רק את הודעות ה-user; הסוכן עדיין לא סיים. חייבים polling עד `status == "completed"`.

**מניחים ש-Thread לא יפוג**. Thread אינו פג, אבל אם יצרת thread בסשן אחד ולא שמרת את ה-id, אתה לא יכול לחזור אליו. שמור תמיד את thread.id בצד הלקוח אם אתה צריך המשכיות.

**מגדירים function tool אבל לא מטפלים ב-requires_action**. run נתקע בסטטוס requires_action ולא מתקדם. יש צורך ב-loop שבודק את הסטטוס ומגיש תוצאות כלי כשנדרש.

**בלבול בין code_interpreter ל-function**. code_interpreter רץ בצד השרת ב-sandbox מנוהל. function רץ בקוד שלך. אם צריך גישה לנתונים פנימיים או ל-APIs ארגוניים, code_interpreter אינו מתאים; השתמש ב-function.

## מתי זה לא משנה

כשהמשימה חד-פעמית ואין היסטוריית שיחה, chat completion רגיל זול יותר ופשוט יותר. סוכן עם thread מוסיף overhead: ניהול thread, polling על run, וקריאות API נוספות. עבור summarization, translation, או קלסיפיקציה ללא מצב, הישאר ב-`ChatCompletionsClient` מה-SDK הסקה.

לחישובים פשוטים שניתן לבצע בצד הלקוח, שקול לכלול את הלוגיקה ישירות בקוד ולא להסתמך על code_interpreter: תחסוך latency ותשלוט בתוצאה.

## חיבור

יחידה זו היא הבסיס לשני שלבים קדימה: `m5-agent-approval` עוסק בתרחישים שבהם אדם חייב לאשר את פעולת הסוכן לפני ביצוע (human-in-the-loop), ו-`m8-loops-workflows` מרחיב לתזמורת של מספר סוכנים. אם הגעת מ-`m5-foundry-sdk-apps`, ההבדל המרכזי הוא שה-SDK של agents שומר state בשרת, בעוד שה-SDK ההסקה ב-`AIProjectClient` הוא stateless.

<!-- audited -->
