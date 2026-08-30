# זרימות רב-שלביות עם כלים

כשמודל שפה יכול לקרוא לפונקציות חיצוניות ולשלב את תוצאותיהן בחשיבה שלו, הוא עובר מלהיות מנוע טקסט לסוכן שפועל.

## מה תדע בסוף

תדע להגדיר כלי כ-JSON schema, לזהות `finish_reason: "tool_calls"` ולטפל בו בלולאה, להחזיר תוצאות לפי `tool_call_id`, ולהסביר מדוע צריך לצרף את הודעת המודל לפני הוספת תוצאות הכלים.

## האינטואיציה

דמיין בלש (המודל) עם צוות עוזרים (הכלים). הבלש לא יודע הכל בעצמו, אך יודע למי לשאול. כשמשתמש שואל "כמה שווה 200 שקל בדולרים?", הבלש לא מנחש: הוא מסמן פתק לעוזר "שערי חליפין" וממתין לתשובה. כשהתשובה מגיעה, הוא מנסח את מה שקיבל לתגובה מלאה.

אם השאלה מורכבת יותר, הבלש יכול לשלוח פתקים לכמה עוזרים בבת אחת. המודל מנהל את המחשבה; הכלים מספקים את הנתונים.

## ההגדרות המדויקות

**Function calling, קריאת פונקציה** היא המנגנון שמאפשר למודל לבקש הפעלה של כלי חיצוני במקום להחזיר תשובת טקסט ישירה. המודל לא מפעיל את הפונקציה בעצמו: הוא מחזיר מבנה JSON שמתאר מה לקרוא ועם אילו ארגומנטים, והקוד שלך מפעיל אותה ומחזיר את התוצאה.

**Tool schema, סכמת כלי** היא אובייקט JSON שמתאר כלי בשלושה שדות:

- `name`: שם הפונקציה, כפי שהמודל יכנה אותה בקריאה
- `description`: מה היא עושה; המודל משתמש בטקסט הזה כדי להחליט מתי לקרוא לה
- `parameters`: JSON Schema של הארגומנטים שהפונקציה מקבלת

**`finish_reason`, סיבת סיום** של completion יכולה להיות:

- `"stop"`: המודל החזיר תשובה סופית, הלולאה נגמרת
- `"tool_calls"`: המודל רוצה לקרוא לכלים, הלולאה ממשיכה

**Tool call ID, מזהה קריאת כלי** הוא מחרוזת ייחודית שהמודל מייצר לכל קריאת כלי. כשמחזירים תוצאה, מצרפים את אותו `tool_call_id` כדי שהמודל ידע לאיזו קריאה היא מתייחסת.

**Tool result message, הודעת תוצאת כלי** היא הודעה עם `role: "tool"` שמכילה את הפלט של הפונקציה ואת ה-`tool_call_id` התואם. היא חייבת להופיע אחרי הודעת המודל שביקשה את הכלי, לא לפניה.

**Parallel tool calls, קריאות כלים מקביליות** מתרחשות כשהמודל מחזיר כמה קריאות כלים בתגובה אחת. כולן חייבות להתבצע ולהוחזר לפני שמחזירים שוב למודל.

## דוגמה מחושבת

**שאלת המשתמש**: "כמה שווה 200 שקל בדולרים?"

**שלב 0: הגדרת הכלי**

```python
import json
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    endpoint="https://my-hub.api.azureml.ms",
    credential=DefaultAzureCredential(),
)
chat = client.inference.get_chat_completions_client()

tools = [{
    "type": "function",
    "function": {
        "name": "get_exchange_rate",
        "description": "שערת חליפין נוכחית בין שתי מטבעות",
        "parameters": {
            "type": "object",
            "properties": {
                "from_currency": {"type": "string"},
                "to_currency": {"type": "string"}
            },
            "required": ["from_currency", "to_currency"]
        }
    }
}]
```

**שלב 1: קריאה ראשונה**

```python
messages = [{"role": "user", "content": "כמה שווה 200 שקל בדולרים?"}]
resp = chat.complete(model="chat-prod", messages=messages, tools=tools)
```

המודל מחזיר `finish_reason == "tool_calls"`:

```json
{
  "finish_reason": "tool_calls",
  "message": {
    "tool_calls": [{
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_exchange_rate",
        "arguments": "{\"from_currency\": \"ILS\", \"to_currency\": \"USD\"}"
      }
    }]
  }
}
```

**שלב 2: לולאת הביצוע**

```python
def get_exchange_rate(from_currency, to_currency):
    # בפועל: קריאה ל-API של שערות
    return 0.27

while resp.choices[0].finish_reason == "tool_calls":
    # חובה: צרף את הודעת המודל לפני התוצאות
    messages.append(resp.choices[0].message)

    for tc in resp.choices[0].message.tool_calls:
        args = json.loads(tc.function.arguments)
        result = get_exchange_rate(**args)      # מחזיר 0.27
        messages.append({
            "role": "tool",
            "tool_call_id": tc.id,
            "content": str(result)
        })

    resp = chat.complete(model="chat-prod", messages=messages, tools=tools)

print(resp.choices[0].message.content)
# "200 שקלים שווים כ-54 דולר לפי שער של 0.27."
```

שתי הקריאות ל-`chat.complete` הן יחד זרימה רב-שלבית. קריאה 1 מסתיימת עם `"tool_calls"`, קריאה 2 מסתיימת עם `"stop"`.

## המקרה שמפיל את האינטואיציה

**אינטואיציה שגויה**: "אפעיל רק את `tool_calls[0]` כי בדרך כלל יש קריאה אחת."

המודל יכול להחזיר כמה קריאות כלים בתגובה אחת. אם המשתמש שואל "מה מזג האוויר בתל-אביב ובניו-יורק?", המודל עשוי להחזיר `get_weather(city="Tel Aviv")` ו-`get_weather(city="New York")` באותה תגובה. אם הקוד מעבד רק את `tool_calls[0]`, ה-API מחזיר שגיאה: `"Missing tool result for tool_call_id call_xyz456"`.

הלולאה הנכונה מעבירה על כל `tc in resp.choices[0].message.tool_calls`, לא רק על הראשון.

## טעויות נפוצות

**אי-צירוף הודעת המודל לפני תוצאות הכלים**. הרצף ב-`messages` חייב להיות: הודעת `user`, הודעת `assistant` עם `tool_calls`, הודעות `tool`. אם מדלגים על `messages.append(resp.choices[0].message)`, ה-API מחזיר שגיאה: `"tool result message must be preceded by assistant tool_calls message"`.

**הכנסת תוצאת הכלי בתפקיד `"user"`**. תוצאות כלים חייבות להיות ב-`role: "tool"` עם `tool_call_id` תואם. הכנסה כ-user message גורמת למודל לפרש אותה כהודעה מהמשתמש ולא כתגובת כלי, ועלולה לשבש את המשך הזרימה.

**הורדת רשימת ה-`tools` בקריאה השנייה**. חובה להעביר את `tools` בכל קריאה בלולאה. אם נשמט בקריאה השנייה, המודל לא ידע שהכלים קיימים ועלול להחזיר תשובה חלקית שמבוססת על זיכרון האימון בלבד.

**ציפייה שהמודל תמיד יקרא לכלי**. עם `tool_choice="auto"` (ברירת מחדל), המודל מחליט בעצמו אם לקרוא לכלי. לשאלה פשוטה מספיק הוא יענה ישירות. כדי להכריח קריאה, משתמשים ב-`tool_choice={"type": "function", "function": {"name": "get_exchange_rate"}}`.

## מתי זה לא משנה

לשאלות שאינן דורשות נתונים חיצוניים בזמן אמת (תרגום, סיכום, סיווג, ניתוח קוד) tool calling מוסיף latency ומורכבות בלי ערך. `chat.complete()` רגיל מספיק.

Tool calling שווה את התקורה כש: המידע משתנה בזמן אמת (שערות, מזג אוויר, מסד נתונים חי), הפעולה דורשת כתיבה למערכת חיצונית (דואל, CRM, קבצים), או כשמשימה אחת מורכבת ממספר שלבים עם תוצאות בינוניות שהמודל צריך לפרש.

ה-Azure AI Foundry SDK תומך ב-tool calling דרך אותו `chat.complete()` שבו השתמשת ב-m5-foundry-sdk-apps. לא צריך SDK נוסף.

## חיבור

יחידה זו בנויה על m5-foundry-sdk-apps (בסיס ה-SDK ולולאת `chat.complete`) ועל m5-rag-on-azure (שבה retrieval הוא כלי שעוטף חיפוש וקטורי). היא פותחת את m5-agents-roles-memory, שבה הלולאה הזו עוטפת agent מנוהל עם memory וזיכרון הרשאות, ואת m5-eval-fabrication, שבה תוצאות כלים הן מקור פוטנציאלי לבדיית עובדות.

```quiz
{"id":"u-m5-tool-augmented-flows-q1","tree":"ops","skill":"azure-foundry","q":"מה המשמעות של finish_reason='tool_calls' בתשובת completion?","options":["המודל החזיר תשובה סופית, הלולאה נגמרת","המודל מבקש הפעלת כלים לפני שיוכל להמשיך","הפרויקט הגיע למגבלת קריאות ל-API","הכלי שנקרא החזיר שגיאה"],"answer":1,"explain":"finish_reason='tool_calls' אומר שהמודל לא סיים: הוא רוצה לקרוא לכלים חיצוניים. הקוד חייב לבצע את הקריאות, לצרף את התוצאות כהודעות tool, ולקרוא ל-chat.complete() שוב. רק finish_reason='stop' מסמן תשובה סופית."}
```

```quiz
{"id":"u-m5-tool-augmented-flows-q2","tree":"ops","skill":"azure-foundry","q":"מה חייב לקדום להודעת role='tool' ברשימת ה-messages?","options":["הודעת user המקורית","הודעת assistant שמכילה את tool_calls המבוקשת","הודעת system עם הגדרת הכלי","אין דרישה לסדר מסוים"],"answer":1,"explain":"הרצף המחויב הוא: assistant message עם tool_calls, ואחריה הודעות tool עם tool_call_id תואם. ה-API מחזיר שגיאה אם מנסים לשלוח הודעת tool ללא הודעת assistant מקדימה שביקשה את אותה קריאה."}
```

```widget
{"type":"algviz","algo":"tool-loop","title":"Agent Loop: צפה כיצד המודל קורא לכלים בלולאה עד finish_reason=stop"}
```

```concepts
{"items":[{"id":"function-calling","t":"Function calling","he":"קריאת פונקציה","d":"מנגנון המאפשר למודל שפה לבקש הפעלה של כלי חיצוני: המודל מחזיר JSON עם שם ופרמטרים, הקוד מפעיל ומחזיר את התוצאה.","rel":["tool-call","tool-result","foundry-sdk"],"node":"azure-core"},{"id":"tool-call","t":"Tool call","he":"קריאת כלי","d":"בקשה בודדת שמודל מחזיר ב-tool_calls; מכילה id ייחודי, שם פונקציה וארגומנטים ב-JSON.","rel":["function-calling","tool-result"],"node":"azure-core"},{"id":"tool-result","t":"Tool result","he":"תוצאת כלי","d":"הודעה עם role='tool' ו-tool_call_id תואם שמחזירה את פלט הפונקציה למודל.","rel":["tool-call","function-calling"],"node":"azure-core"},{"id":"parallel-tool-calls","t":"Parallel tool calls","he":"קריאות כלים מקביליות","d":"כשמודל מחזיר כמה tool_calls בתגובה אחת; כולן חייבות להתבצע ולהוחזר לפני הקריאה הבאה.","rel":["tool-call","function-calling"],"node":"azure-core"}]}
```
