# תזמור ואוטונומיה עם אישור
כשסוכן אחד מנהל סוכנים אחרים, שאלת האמון היא בדיוק כמו ניהול צוות אנשים.

## מה תדע בסוף
תוכל להסביר את ההבדל בין Orchestrator אוטונומי מלא לאוטונומי-עם-אישור, לפרוס ארכיטקטורת multi-agent ב-Azure AI Foundry שבה Connected Agents פועלים תחת Orchestrator, ולהחליט היכן בדיוק approval gate נדרש ואיך לממשו בקוד.

## האינטואיציה
חשוב על מנהל פרויקט בנייה. הוא מנחה קבלני משנה רבים, חשמלאי, אינסטלטור, צבע, וכל אחד מבצע את עבודתו באופן עצמאי. אבל כשמגיע הצורך להרוס קיר, המנהל לא פועל מיידית: הוא שולח בקשה לאדריכל ומחכה לאישור. זו האינטואיציה של autonomous-with-approval, אוטונומיה עם אישור: רוב העבודה מתרחשת ללא התערבות אנושית, אבל פעולות בלתי הפיכות עוצרות לבדיקה.

ב-Azure AI Agent Service, המנהל הוא **Orchestrator Agent, סוכן מתאם**: הוא מקבל מטלה, מפרק אותה ומפנה חלקים ל-**Connected Agents, סוכנים מחוברים**. ה"שיחה לאדריכל" היא **Human Approval Gate, שער אישור אנושי**, נקודת עצירה מוגדרת מראש בקוד שבה הריצה מחכה ל-signal אנושי.

## ההגדרות המדויקות

**Orchestrator Agent, סוכן מתאם**: סוכן שתפקידו לפרק מטלה לתתי-מטלות ולהקצות אותן ל-Connected Agents. הוא אינו קורא ישירות לכלים כמו Bing Search או SQL, אלא קורא לסוכנים שעושים זאת. מבחינת ה-SDK, כל Connected Agent נראה ל-Orchestrator כ-`AgentTool`.

**Connected Agent, סוכן מחובר**: סוכן שנרשם כ"כלי" אצל ה-Orchestrator. הוא רץ כ-thread עצמאי ב-Azure AI Agent Service עם הגדרות, כלים ו-system prompt משלו. Connected Agents שונים יכולים לרוץ במקביל.

**Autonomous, אוטונומי**: ה-Orchestrator מריץ את כל שרשרת הסוכנים בלי עצירה. מתאים לפעולות הפיכות כמו search, classify ו-summarize.

**Autonomous-with-approval, אוטונומי-עם-אישור**: לפני פעולה בלתי הפיכה, שליחת מייל, מחיקת רשומה, ביצוע רכישה, הקוד עוצר ומציג פרטים לאדם. רק אחרי קבלת human turn, הלולאה ממשיכה.

**Human-on-the-Loop, אדם על הלולאה** (מושג מוכר): האדם מקבל דוח ויכול להתערב. Autonomous-with-approval הוא מימוש ספציפי שעוצר את הלולאה ב-gate מוגדר מראש.

ב-Foundry, ה-Orchestrator מקבל את ה-`agent_id` של כל Connected Agent ומחויב בהרשאת RBAC לקרוא אליו. ה-Connected Agent מחזיק RBAC נפרד עבור הכלים שלו עצמו.

```quiz
{"id":"u-m5-agent-approval-q1","tree":"ops","skill":"azure-foundry","q":"מתי יש להגדיר Human Approval Gate ב-Orchestrator Agent?","options":["רק לפני פעולות בלתי הפיכות כמו שליחת מייל או מחיקת רשומה","לפני כל קריאה ל-Connected Agent, כדי לאשר שהסוכן פועל כנדרש","כשה-Orchestrator חורג מה-context window המקסימלי","כשה-Connected Agent משתמש ב-Blob Storage בלבד"],"answer":0,"explain":"Approval gate נועד לפעולות שאין להן undo. פעולות הפיכות כמו search ו-summarize לא מצדיקות את העיכוב ועלות ההמתנה. הכלל: בחר gate לפי blast radius של הפעולה, לא לפי כל קריאה."}
```

## דוגמה מחושבת

תרחיש: Orchestrator שמחקר פידבק לקוחות ואז שולח סיכום לצוות.

```python
from azure.ai.projects import AIProjectClient
from azure.ai.agents.models import AgentTool

research_tool = AgentTool(agent_id=research_agent_id)
email_tool    = AgentTool(agent_id=email_agent_id)

orchestrator = project_client.agents.create_agent(
    model="gpt-4o",
    instructions="Research customer feedback and propose an email summary.",
    tools=[research_tool, email_tool],
)

thread = project_client.agents.threads.create()
project_client.agents.messages.create(
    thread_id=thread.id, role="user",
    content="Analyze this week's feedback.",
)

run = project_client.agents.runs.create_and_process(
    thread_id=thread.id, agent_id=orchestrator.id
)

if run.status == "requires_action":
    pending = run.required_action.submit_tool_outputs.tool_calls
    # הצג לאדם את הצעת המייל וקבל אישור
    approval = input(f"Approve sending?\n{pending[0].function.arguments}\n[y/n]: ")
    if approval == "y":
        project_client.agents.runs.submit_tool_outputs(
            thread_id=thread.id, run_id=run.id,
            tool_outputs=[{"tool_call_id": pending[0].id, "output": "approved"}]
        )
```

כשה-Orchestrator קורא ל-research_tool, הריצה ממשיכה ללא עצירה. כשהוא מגיע ל-email_tool שסומן לאישור, `run.status` הופך ל-`requires_action`. הקוד מציג את הנוסח המוצע, מחכה לאדם ומחדש רק אחרי אישורו. בלי ה-submit, הריצה תפוג בתוך 10 דקות.

## המקרה שמפיל את האינטואיציה

האינטואיציה: "approval ב-Orchestrator מגן על כל הפעולות בשרשרת". בפועל, Connected Agent יכול להפעיל Connected Agent נוסף משלו. אם Agent 2 קורא ל-Agent 3 שמבצע פעולה בלתי הפיכה, ה-Orchestrator הראשי אינו יודע על כך ואין gate שם. במבנה multi-level orchestration, כל שכבה שמאפשרת פעולה בלתי הפיכה צריכה gate משלה, לא רק השכבה העליונה.

## טעויות נפוצות

**טעות 1: להעניק ל-Orchestrator את כל הרשאות ה-RBAC של Connected Agents שלו.** ה-Orchestrator צריך רק `Azure AI Agent Service Caller` על Connected Agent. אם ל-Connected Agent יש גישה ל-Blob Storage, ה-Orchestrator אינו יורש אותה אוטומטית, ולהיפך.

**טעות 2: לצפות להרצה מקבילה של Connected Agents כברירת מחדל.** ה-SDK מחכה לתשובה מסוכן אחד לפני שקורא לבא בתור, אלא אם האפליקציה מנהלת threading מפורשות. ניה על מקביליות שלא מקודדת היא טעות.

**טעות 3: לסמן approval רק בתיעוד ולא בקוד.** אם לא כתבת בדיקה על `run.status == "requires_action"`, ה-agent ממשיך אוטונומית גם לפעולות שהגדרת כ"דורשות אישור".

## מתי זה לא משנה

כשהמטלה הפיכה לחלוטין, search, summarize, classify, אין יתרון ב-approval gate. עלות ההמתנה לאדם עולה על הסיכון. Single agent מספיק כשהמטלה מצריכה כמה כלים בלבד והקשר שלה מתאים לחלון context אחד. Multi-agent מוצדק כשהמטלה מתפרקת למומחויות נפרדות, כשה-context windows גדולים מדי לסוכן אחד, או כשנדרש approval בנקודה ספציפית בשרשרת.

לראיון: כשישאלו "מתי תשתמש ב-multi-agent לעומת single agent?", השב: single agent מספיק כשהמטלה מצריכה כלים ספורים וה-context קטן. Multi-agent מוצדק כשיש הפרדה טבעית בין מומחויות, context windows גדולים, או approval שדורש הפרדת אחריות.

## חיבור

יחידה זו שייכת ל-M5, Azure AI Foundry. כבר למדת על managed identity, deployment types ו-content filtering. אישור אנושי הוא שכבה שמשלימה את content filtering: content filtering עוצר פלטים מזיקים, approval gate עוצר פעולות מסוכנות לפני ביצוען. ביחידה הבאה תלמד על token analytics, שם תראה כיצד לחשב את עלות שיחות הסוכנים הנוספות שמבנה multi-agent מייצר.

```concepts
{"items":[{"id":"orchestrator-agent","t":"Orchestrator Agent","he":"סוכן מתאם","d":"סוכן שמפרק מטלה לתתי-מטלות ומקצה אותן ל-Connected Agents; רואה כל subagent כ-AgentTool","rel":["connected-agent","human-approval-gate"],"node":"azure-core"},{"id":"connected-agent","t":"Connected Agent","he":"סוכן מחובר","d":"סוכן שנרשם כ-AgentTool אצל Orchestrator, רץ כ-thread עצמאי עם כלים ו-system prompt משלו","rel":["orchestrator-agent"],"node":"azure-core"},{"id":"human-approval-gate","t":"Human Approval Gate","he":"שער אישור אנושי","d":"נקודת עצירה בקוד לפני פעולה בלתי הפיכה; run.status=requires_action עד שהאדם מאשר","rel":["human-on-the-loop","connected-agent"],"node":"azure-core"}]}
```

<!-- audited -->
