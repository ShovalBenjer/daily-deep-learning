# מבנה שרת MCP
כל כלי שמודל יכול להפעיל עוטף באותה מעטפת JSON, בין אם הוא שאילתת SQL, API חיצוני, או bash. שרת MCP הוא הקוד שחי מעבר למעטפת.

## מה תדע בסוף
תסביר מה עושה **MCP server, שרת MCP**, תבין את מבנה ה-JSON-RPC שמאחוריו, ותוכל לממש שרת מינימלי עם כלי אחד שמודל יכול להפעיל.

## האינטואיציה
חשוב על MCP server כמו מלצר בין ה-LLM למטבח. ה-LLM (ה-client) יודע רק לבקש: "הבא לי את רשימת הקבצים". המלצר (השרת) מתרגם את הבקשה לשפת המטבח (פקודת מערכת הפעלה, שאילתת בסיס נתונים, קריאת API), מחזיר את התוצאה בפורמט אחיד. ה-LLM לא יודע ולא צריך לדעת אם ה"מטבח" הוא Python, Rust, או SQL. מה שחשוב הוא שהמלצר תמיד מדבר באותה שפה משני הצדדים.

הפרדה זו היא הנקודה. לפני MCP, כל LLM framework המציא את פורמט ה-tool שלו. Claude, OpenAI, Gemini, LangChain, כל אחד בנה את המלצר שלו. MCP אמר: יש פרוטוקול אחד. כל מי שמממש אותו יכול לתקשר עם כל מי שמממש אותו.

## ההגדרות המדויקות

**MCP (Model Context Protocol, פרוטוקול הקשר מודל):** תקן פתוח שפרסמה Anthropic בנובמבר 2024. בבסיסו JSON-RPC 2.0 על גבי transport. מגדיר שלושה סוגי יכולות: **tools** (כלים שמודל יכול להפעיל), **resources** (מידע שמודל יכול לקרוא), **prompts** (תבניות שהמשתמש בוחר). הפרוטוקול עצמו על GitHub.

**MCP server:** תהליך (process) שמקבל בקשות JSON-RPC, מבצע אותן, ומחזיר תשובות. הוא מכריז בעת ה-handshake על מה הוא מציע (רשימת tools, resources, prompts). ה-client לא צריך לדעת מראש מה השרת מציע; הוא שואל.

**MCP client:** הצד שמנהל את חיבור השרת. ה-Claude agent SDK הוא client. Claude.app הוא client. IDEs הם clients. ה-client מחזיק רשימה של שרתים מחוברים ומייצג את כלליהם ל-LLM.

**Transport, שכבת ההובלה:** איך הודעות JSON-RPC נוסעות בין client ל-server. שתי אפשרויות סטנדרטיות:

- **stdio:** ה-client מפעיל את השרת כ-subprocess. הודעות עוברות דרך stdin/stdout. פשוט, יעיל, stateful לחיבור יחיד. טוב ל-localhost.
- **SSE (Server-Sent Events, אירועים שנשלחים מהשרת):** השרת רץ כשירות HTTP. ה-client מתחבר ומקבל אירועים. מתאים לשרתים משותפים ולדיפלויים בענן.

**Capability negotiation, משא ומתן על יכולות:** כשה-client מתחבר, שני הצדדים מחליפים הודעת `initialize` עם גרסת הפרוטוקול ורשימת היכולות. אם הגרסאות לא מסתדרות, החיבור נסגר. זה מה שמאפשר ל-clients וservers להתפתח בנפרד.

**Tool schema, סכמת כלי:** כל כלי מוגדר עם `name`, `description`, ו-`inputSchema` (JSON Schema). ה-description הוא מה ה-LLM קורא כדי להחליט מתי להפעיל את הכלי. ה-inputSchema הוא מה ה-LLM ממלא. השרת מקבל `tools/call` עם שם הכלי וה-arguments.

## דוגמה מחושבת

שרת MCP מינימלי ב-Python עם ה-SDK הרשמי:

```python
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import mcp.types as types

server = Server("file-reader")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="read_file",
            description="קרא קובץ טקסט ממערכת הקבצים",
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "נתיב הקובץ"}
                },
                "required": ["path"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "read_file":
        path = arguments["path"]
        with open(path) as f:
            content = f.read()
        return [TextContent(type="text", text=content)]
    raise ValueError(f"כלי לא מוכר: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream, write_stream,
            InitializationOptions(server_name="file-reader", server_version="0.1.0")
        )

import asyncio
asyncio.run(main())
```

מה שקורה בעת הפעלה:

1. ה-client מפעיל את הקובץ כ-subprocess.
2. ה-client שולח `{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{}}}`.
3. השרת מחזיר `{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"file-reader"}}}`.
4. ה-client שולח `tools/list`; השרת מחזיר את רשימת הכלים עם ה-schema.
5. כשה-LLM מחליט להפעיל `read_file`, ה-client שולח `tools/call` עם `{"name":"read_file","arguments":{"path":"/tmp/notes.txt"}}`.
6. השרת מחזיר `[{"type":"text","text":"...תוכן הקובץ..."}]`.
7. ה-client מחזיר את זה ל-LLM כ-tool result.

כל השלבים הם JSON-RPC תקני. אפשר לראות בדיוק מה עובר עם `--mcp-debug` ב-Claude CLI.

```concepts
{"items":[{"id":"c-mcp-server","t":"MCP Server","he":"שרת MCP","d":"תהליך שמממש את MCP protocol בצד השרת: רושם tools, resources ו-prompts, מקבל JSON-RPC ומחזיר תוצאות","rel":["c-mcp-protocol","c-tool-call"],"node":"agents-loop"},{"id":"c-mcp-transport","t":"MCP Transport","he":"הובלת MCP","d":"שכבת ההובלה של הודעות MCP: stdio (subprocess, localhost) או SSE (HTTP, shared server)","rel":["c-mcp-server","c-mcp-protocol"],"node":"agents-loop"},{"id":"c-mcp-capability-neg","t":"MCP Capability Negotiation","he":"משא ומתן על יכולות MCP","d":"חילופי initialize בחיבור MCP: גרסת פרוטוקול, capabilities של client ו-server; מאפשר גרסאות שונות","rel":["c-mcp-server","c-mcp-transport"],"node":"agents-loop"}]}
```

## המקרה שמפיל את האינטואיציה

ה-intuition אומר שהשרת הוא stateless כמו HTTP API. זה נכון רק חלקית.

עם stdio transport, כל הפעלת client יוצרת subprocess חדש. ה-session הוא stateful: אפשר לשמור state בין קריאות כלים באותה session. ה-server יכול לזכור שפתחנו חיבור למסד נתונים בקריאת כלי אחת ולהשתמש בו בקריאה הבאה. ה-connection נסגר כשה-subprocess מת.

עם SSE transport, שרת אחד משרת clients רבים במקביל. State per-session אפשרי אך מסוכן: צריך לעקוב לפי session ID, שהוא פרמטר שה-client שולח ב-URL. בלי זה, state מדולף בין sessions.

הבעיה מופיעה כשמנסים להעביר שרת שפותח ל-stdio לדיפלוי SSE בענן: ה-state שעבד מקומית נשבר כי מספר instances מריצים בו זמנית.

```quiz
{"id":"u-m4-mcp-server-q1","tree":"craft","skill":"mcp","q":"כשה-client שולח `tools/list` לשרת MCP, מה השרת מחזיר?","options":["תוצאת הרצת כל הכלים","רשימה עם name, description ו-inputSchema לכל כלי","JSON Schema של הפרוטוקול","כתובות ה-endpoint של כל כלי"],"answer":1,"explain":"בתגובה ל-tools/list, השרת מחזיר רשימת הגדרות כלים. כל הגדרה כוללת name, description (שה-LLM קורא להחליט מתי להפעיל) ו-inputSchema (שה-LLM ממלא). השרת לא מריץ כלים ב-list; הוא רק מכריז עליהם."}
```

## טעויות נפוצות

**1. סודות ב-tool description.** ה-description עובר ל-LLM. לעולם אל תכתוב "כלי זה משתמש במפתח API XXXX". ה-LLM עלול לשים את הסוד בפלט. סודות שייכים לסביבת השרת בלבד.

**2. ולידציה רק בצד ה-client.** ה-client שולח arguments על פי ה-inputSchema. אבל LLM יכול לסטות מה-schema (במיוחד בגרסאות ישנות יותר). השרת חייב לוודא עצמאית שה-arguments תקינים לפני ביצוע. פקודת bash עם path שעברה path traversal תרוץ אם לא תבדוק.

**3. stdio בדיפלוי ענן.** stdio מניח subprocess אחד לחיבור. בסביבת ענן שמריצה containers מרובים, כל container מריץ instance שונה של השרת. חיבור client יגיע ל-instance שרירותי. SSE transport או HTTP streamable (הגרסה החדשה יותר) מתאים לענן.

**4. שרת שמשיב איטי בלי timeout.** ה-client ינעל וינתק אחרי timeout ברירת מחדל. כלי שעושה I/O ארוך (fetch, DB query) צריך streaming או timeout מפורש.

**5. חזרת errors כ-errors, לא כ-text.** כשכלי נכשל, מחזירים `isError: true` עם תיאור. LLM יכול להגיב לזה ולנסות גישה אחרת. זריקת exception שמוביל ל-JSON-RPC error חריף יקרוס את הלולאה.

```fillin
{"id":"u-m4-mcp-server-f1","tree":"craft","skill":"mcp","prompt":"כשמממשים שרת MCP ב-stdio, ה-client מפעיל את השרת כ-_______ (מילה אחת).","answer":"subprocess","alt":["תת-תהליך","process"],"explain":"stdio transport מבוסס על כך שה-client מפעיל את השרת כ-subprocess ומתקשר אתו דרך stdin ו-stdout. זו האבחנה מ-SSE, שבו השרת הוא שירות HTTP נפרד."}
```

## מתי זה לא משנה

אם הפרויקט שלך לא מתכוון לחלוק כלים עם LLMs אחרים, ו-Claude agent SDK הוא הכל, אין סיבה לממש MCP server. פשוט רשום tool functions ב-SDK ישירות:

```python
@claude.tool
def read_file(path: str) -> str:
    return open(path).read()
```

זה מהיר יותר לכתיבה, אין overhead של JSON-RPC, ואין צורך לנהל subprocess. MCP מתחיל לשלם כשרוצים לחלוק כלים בין frameworks שונים (Claude, OpenAI Agents SDK, VS Code Copilot, Cursor) או כשרוצים לדיפלוי כלי כשירות עצמאי.

אם המערכת שלך מחברת LLM client ו-tool server מאחורי HTTP ממילא, SSE transport נותן פחות מ-HTTP REST לא מנוהל. REST פשוט יותר לדיבוג, מוכר לכל מפתח.

## חיבור

יחידה זו עוסקת בצד השרת בלבד. הצד המשלים הוא **m4-mcp-client**: כיצד ה-client מנהל חיבורים לשרתים מרובים, ממזג את רשימות הכלים, ומעביר tool calls לשרת הנכון.

היחידה **m4-mcp-transport** מרחיבה על ה-stdio לעומת SSE בפירוט: framing, reconnection, security model.

**agents-loop** הוא ה-node שבו יחידות אלו חיות. לאחר שרת+client+transport, ה-node הבא הוא **m4-trust-tiering**: אין לסמוך על arguments שמגיעים מ-LLM בלי ולידציה, וכיצד דורגים trust של כלים שונים.
