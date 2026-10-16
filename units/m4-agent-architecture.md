# ארכיטקטורת סוכן

כשמודל שפה מחליט לבד מה הצעד הבא, מבצע פעולה, ועוצר לבדוק שהוא צדק, יש לפנינו סוכן.

## מה תדע בסוף

תצייר את לולאת הסוכן מהזיכרון, תזהה איפה tool call נכנס ואיפה human-in-the-loop נחוץ, ותסביר מדוע "סוכן" הוא לולאת קוד סביב LLM ולא יכולת מיוחדת בתוכו.

## האינטואיציה

חשוב על בלש. הוא מגיע לזירה, מחליט מה לבדוק הבא, שואל עד, מצלם ראיות, מחפש ברשומות, ואז חוזר לרשימת הרמזים עם התוצאות. הוא לא פותר את התיק בהברה אחת. הוא לא יודע מראש כמה שלבים יצטרך.

מודל שפה לא יכול לפעול ככה מהקופסא. הוא פולט טוקן אחרי טוקן עד שמסיים. כדי שהוא "יחשוב בכמה שלבים", מישהו צריך לתפוס את ה-output, לבצע את הפעולות שהמודל ביקש, ולדחוף את התוצאות חזרה כ-input. זה כל מה שארכיטקטורת סוכן עושה. הלולאה היא בקוד שלנו, לא בתוך המודל.

## ההגדרות המדויקות

**Agent, סוכן**: LLM בתוך לולאת קוד שמריצה כלים ומזינה תוצאות חזרה להקשר, עד שהמודל פולט אות עצירה.

**Tool, כלי**: פונקציה שהקוד שלנו חושף למודל. המודל לא קורא לה בעצמו. הוא פולט JSON שמתאר קריאה, והסוכן מריץ את הפונקציה ומחזיר את התוצאה.

**Tool call**: אירוע שבו המודל פולט בלוק מסוג `tool_use`. ה-Anthropic API מחזיר:

```json
{"type": "tool_use", "name": "web_search", "input": {"query": "..."}}
```

הקוד מריץ את `web_search`, אוסף את התוצאה, ומחזיר:

```json
{"type": "tool_result", "tool_use_id": "...", "content": "..."}
```

**Planning, תכנון**: החלטת המודל על רצף הפעולות. שתי גישות נפוצות: **ReAct** (reason, act, observe, הסיבה, הפעולה, התצפית) שבה המודל כותב את מחשבתו לפני כל tool call; ו-**CoT, שרשרת מחשבה** (Chain-of-Thought) פשוטה שבה המודל מסביר לעצמו לפני שפועל.

**Memory, זיכרון**: מידע שהסוכן יכול להשתמש בו. שני סוגים עיקריים:

- **Short-term memory, זיכרון קצר טווח**: חלון ההקשר עצמו. כל מה שב-`messages` array שנשלח למודל. מוגבל בטוקנים.
- **Long-term memory, זיכרון ארוך טווח**: מאגר חיצוני (vector store, KV store, relational DB) שממנו הסוכן שולף מידע לפי צורך עם tool קריאה מפורשת.

**MCP, Model Context Protocol**: פרוטוקול פתוח (Anthropic, 2024) שמאחד את הדרך שבה LLMs מתקשרים עם כלים. MCP server חושף tools, resources ו-prompts. MCP client שולח `tools/call`. הפרוטוקול מגדיר JSON-RPC 2.0 כשכבה תחתית, מה שאומר שכל כלי שעומד בתקן זה עובד עם כל client תואם, ללא שינוי.

**Human-in-the-loop, אדם בלולאה**: נקודה בלולאת הסוכן שבה הקוד עוצר, מציג תוכנית למשתמש, ומחכה לאישור לפני שממשיך. חיוני בפעולות בלתי-הפיכות: שליחת email, מחיקת נתונים, deploy לסביבת production.

הלולאה הפורמלית:

\[
s_{t+1} = \mathrm{Env}(s_t,\; a_t), \quad a_t = \pi_\theta(o_t)
\]

\(o_t\) הוא ה-observation (מה נכנס למודל), \(a_t\) הוא ה-action (tool call או תשובה סופית), \(\mathrm{Env}\) הוא הסביבה (הכלים, ה-DB, הרשת), \(\pi_\theta\) הוא המודל. הלולאה ממשיכה עד שהמודל פולט `end_turn` או שמגיע ל-iteration limit.

## דוגמה מחושבת

נבנה סוכן פשוט עם Claude ו-Anthropic Python SDK, עם כלי אחד: `get_weather`.

```python
import anthropic

client = anthropic.Anthropic()

tools = [{
    "name": "get_weather",
    "description": "מחזיר טמפרטורה נוכחית לפי עיר",
    "input_schema": {
        "type": "object",
        "properties": {"city": {"type": "string"}},
        "required": ["city"]
    }
}]

def get_weather(city: str) -> str:
    return f"22 מעלות צלזיוס, מעונן חלקית"

messages = [{"role": "user", "content": "מה מזג האוויר בתל אביב?"}]

while True:
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        tools=tools,
        messages=messages,
    )
    if response.stop_reason == "end_turn":
        print(response.content[0].text)
        break
    tool_use = next(b for b in response.content if b.type == "tool_use")
    result = get_weather(**tool_use.input)
    messages += [
        {"role": "assistant", "content": response.content},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": tool_use.id, "content": result}
        ]}
    ]
```

שלב אחר שלב:

1. שולחים את שאלת המשתמש. המודל מחזיר `stop_reason="tool_use"` עם בלוק `tool_use`.
2. הקוד קורא ל-`get_weather("תל אביב")`, מקבל `"22 מעלות..."`.
3. מחזירים את התוצאה כ-`tool_result` ב-messages.
4. שולחים שוב. המודל רואה את התוצאה ופולט `stop_reason="end_turn"` עם תשובה בטקסט.

הלולאה ריצה שני iterations. עם כלי חיפוש אמיתי, מסמכים ארוכים, ושאלות מורכבות יותר, אותו skeleton מריץ עשרה, עשרים iterations. הקוד לא השתנה.

```quiz
{"id":"u-m4-agent-architecture-q1","tree":"craft","skill":"agents-orch","q":"מה הקוד של הסוכן מבצע אחרי שהמודל פולט tool_use?","options":["מריץ את הכלי ומחזיר את התוצאה כ-tool_result ב-messages","שולח את ה-response ישירות למשתמש","שומר את ה-tool call ב-long-term memory","מפעיל מחדש את המודל מאפס עם prompt חדש"],"answer":0,"explain":"הסוכן קורא לפונקציה המקומית, אוסף את התוצאה, ומכניס אותה ל-messages array כ-tool_result. זה מה שנכנס למודל ב-iteration הבא. המודל עצמו לא ראה את הביצוע, רק את התוצאה."}
```

## המקרה שמפיל את האינטואיציה

**הסוכן stateless בין קריאות.** כל call למודל מתחיל מאפס מבחינת מצב פנימי. "הזיכרון" הוא רק מה שנכנס ב-messages array. אם לא שמרת תוצאה קודמת ב-context, המודל לא יודע שהיא קרתה.

מכאן: סוכן שצריך לזכור 50 שלבים קודמים נתקע בחלון ההקשר. הפתרון האמיתי הוא לא להגדיל את החלון אלא לתכנן **summarization** מפורש: כל N צעדים הסוכן כותב סיכום קצר ל-long-term memory ומוחק חלק מה-history הישן.

## טעויות נפוצות

**1. "כל משימה מורכבת צריכה agent."** לא. אם אפשר לתאר את הנתיב כרצף שלבים ידוע, workflow דטרמיניסטי מהיר, זול ומוגן יותר. Agent מתאים כשהנתיב לא ידוע מראש.

**2. Tool schema עמום.** המודל נסמך על ה-`description` של כל כלי כדי להחליט מתי לקרוא לו. תיאור עמום מוביל לקריאות מיותרות. תיאור שגוי מוביל לכך שהמודל מוותר ומנחש מה לעשות.

**3. אין human-in-the-loop בפעולות הרסניות.** מחיקת קבצים, שליחת email ללקוחות, deploy ל-production: אם הסוכן יכול לבצע את אלו ישירות, טעות אחת של המודל גורמת נזק אמיתי.

**4. Context window שגדל ללא גבול.** כל tool result נכנס ל-messages. ב-100 iterations זה עשרות אלפי טוקנים ועלות בלתי-נשלטת.

**5. לסמוך על accuracy כ-100%.** LLMs טועים. pipeline agent שלא מוודא תוצאות ביניים מצטבר שגיאות.

## מתי זה לא משנה

כשיש רצף שלבים ידוע מראש: ודא schema, קרא ל-API, שמור ב-DB, שלח notification. זה workflow, לא agent. מהיר, חסכוני, דטרמיניסטי.

כשהמשימה היא שאלה-תשובה בודדת עם ידע פנימי: single-shot inference ללא לולאה.

כשהמשימה דורשת precision גבוהה מאוד (חישוב פיננסי, אבחנה רפואית): שקול workflow עם LLM בתוך שלב ספציפי, לא agent פתוח.

```quiz
{"id":"u-m4-agent-architecture-q2","tree":"craft","skill":"agents-orch","q":"מה ההבדל בין short-term memory לבין long-term memory בסוכן?","options":["short-term הוא messages array בחלון הקשר; long-term הוא מאגר חיצוני שהסוכן שולף ממנו","short-term הוא ב-RAM; long-term הוא ב-SSD","short-term הוא תשובות נכונות; long-term הוא תשובות ישנות","short-term הוא לסוכן קטן; long-term הוא לסוכן גדול"],"answer":0,"explain":"short-term memory הוא חלון ההקשר: מוגבל בגודל, נמחק בין sessions. long-term memory הוא מאגר חיצוני (vector store, KV) שהסוכן שולף ממנו ידע רלבנטי לפי צורך עם tool call מפורש."}
```

```concepts
{"items":[{"id":"c-agent-loop","t":"Agent Loop","he":"לולאת סוכן","d":"observe, plan, act בלולאת קוד סביב LLM; כל iteration: tool call, execute, inject result","rel":["c-tool-call","c-agent-memory"],"node":"agents-loop"},{"id":"c-tool-call","t":"Tool Call","he":"קריאת כלי","d":"JSON שהמודל פולט שמתאר פונקציה לביצוע; הקוד מריץ ומחזיר tool_result","rel":["c-agent-loop","c-agent-architecture"],"node":"agents-loop"},{"id":"c-agent-memory","t":"Agent Memory","he":"זיכרון סוכן","d":"short-term: messages array; long-term: vector/KV store חיצוני לשליפה לפי צורך","rel":["c-agent-loop"],"node":"agents-loop"},{"id":"c-human-in-the-loop","t":"Human-in-the-loop","he":"אדם בלולאה","d":"checkpoint בלולאת הסוכן שמחכה לאישור אנושי לפני פעולה בלתי-הפיכה","rel":["c-agent-loop"],"node":"agents-loop"},{"id":"c-agent-architecture","t":"Agent Architecture","he":"ארכיטקטורת סוכן","d":"LLM בלולאת קוד עם tools, memory ו-human-in-the-loop; הלולאה בקוד, לא במודל","rel":["c-agent-loop","c-mcp-protocol"],"node":"agents-loop"},{"id":"c-mcp-protocol","t":"Model Context Protocol","he":"פרוטוקול הקשר מודל","d":"תקן JSON-RPC פתוח (Anthropic 2024) לתקשורת בין LLM client לבין tool server","rel":["c-agent-architecture","c-tool-call"],"node":"agents-loop"}]}
```

## חיבור

יחידה זו פותחת את בלוק M4. הלולאה הבסיסית שלמדנו היא הבסיס ל:

- **m4-tool-schema-design**: לכתוב tool schemas שמנחים את המודל בצורה מדויקת.
- **m4-mcp-server**: לחשוף כלים כ-MCP server סטנדרטי שכל client תואם יכול להשתמש בו.
- **m4-agent-orchestration**: לחבר כמה סוכנים בארכיטקטורת supervisor / swarm.

הקשר ל-**m4-eval-design**: כדי לדעת שהסוכן עובד, צריך evals על התנהגות הלולאה בפועל, ולא רק על תשובות בודדות.
