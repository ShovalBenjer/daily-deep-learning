# אפליקציות גנרטיביות ב-SDK

הקוד שמפעיל מודל AI ב-Azure יכול להיראות כמו קריאה ל-REST API גולמי או כמו שורה אחת בפייתון. ה-SDK הוא ההבדל.

## מה תדע בסוף

תדע להתחבר לפרויקט Foundry מקוד פייתון דרך `AIProjectClient`, לקרוא לפריסת מודל בשם שלה, לשלוח הודעות ולקבל תשובה. תכיר את שני החבילות שמרכיבות את שכבת ה-SDK, ואת ההבדל בין שם המודל לשם הפריסה.

## האינטואיציה

דמיין שבית המלון הוא **Project** ב-Foundry. כשאתה מתייצב בקבלה, תקבל כרטיס מפתח שמזהה אותך: זה `AIProjectClient`. עם הכרטיס בידך, אתה יכול לפתוח כל דלת מורשית בבניין, כולל המסעדה (מודל GPT), הכושר (embedding) ושירות החדרים (agent). בלי הכרטיס, כל דלת נעולה.

`DefaultAzureCredential` הוא מי שמקבל לך את הכרטיס באוטומטיקה: הוא בודק אם יש לך managed identity, ואם לא, הוא בודק משתני סביבה, Azure CLI, ועוד - מבלי שכתבת מפתח.

## ההגדרות המדויקות

**`azure-ai-projects`, SDK של Foundry** הוא חבילת פייתון שמעטפת את REST API של Azure AI Foundry. נקודת הכניסה היחידה היא `AIProjectClient`, שמקבל שני פרמטרים:

- `endpoint`: כתובת ה-Hub (כגון `https://my-hub.api.azureml.ms`)
- `credential`: אובייקט אימות, בדרך כלל `DefaultAzureCredential()`

**`azure-ai-inference`, SDK הסקה** הוא חבילת פייתון נפרדת שמספקת `ChatCompletionsClient`. ניתן לקבל אותה ישירות מ-`client.inference.get_chat_completions_client()`, מה שמבטיח שהיא מחוברת לאותו Project ואותן הרשאות.

**`SystemMessage` ו-`UserMessage`** הן מחלקות מ-`azure.ai.inference.models` שמייצגות את ה-turns של השיחה:

- `SystemMessage(content)`: ההוראות שמגדירות את אופי המודל, נשלחות פעם אחת בתחילת השיחה.
- `UserMessage(content)`: ההודעה מהמשתמש בכל turn.

**שם הפריסה, deployment name** הוא המזהה שנתת לפריסה כשיצרת אותה ב-Foundry, לא שם המשפחה של המודל. אם פרסת GPT-4o mini תחת השם `chat-prod`, הקריאה ב-SDK חייבת להשתמש ב-`"chat-prod"`, לא ב-`"gpt-4o-mini"`.

**`DefaultAzureCredential`, אישור ברירת מחדל** מ-`azure.identity` מנסה רצף של ספקי אישור: environment variables, Workload Identity, Managed Identity, Azure CLI, Azure PowerShell, ועוד. בסביבת פרוד עם managed identity, הוא מוצא אותה אוטומטית. בסביבת פיתוח, הוא ישתמש ב-Azure CLI שהתחברת אליו.

## דוגמה מחושבת

להלן מינימום עובד: שאלה אחת, תשובה אחת, ללא היסטוריית שיחה.

```python
from azure.ai.projects import AIProjectClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.identity import DefaultAzureCredential

# חיבור לפרויקט
client = AIProjectClient(
    endpoint="https://my-hub.api.azureml.ms",
    credential=DefaultAzureCredential(),
)

# קבלת לקוח הסקה מהפרויקט
chat = client.inference.get_chat_completions_client()

# שליחת הודעה
response = chat.complete(
    model="gpt-4o-mini",        # שם הפריסה ב-Foundry
    messages=[
        SystemMessage("אתה עוזר שעונה בעברית בלבד."),
        UserMessage("מה ההבדל בין list ל-tuple בפייתון?"),
    ],
    max_tokens=512,
)

print(response.choices[0].message.content)
```

פלט טיפוסי:

```
list היא רשימה שניתנת לשינוי (mutable), tuple היא רשימה שלא ניתנת לשינוי (immutable).
```

שני שדות חשובים בתגובה:
- `response.choices[0].message.content`: הטקסט עצמו.
- `response.usage.total_tokens`: כמה טוקנים נצרכו - חשוב לניטור עלות.

## המקרה שמפיל את האינטואיציה

אינטואיציה שגויה נפוצה: "אני יכול להעביר `model='gpt-4o-mini'` כי זה שם המודל האמיתי". בפועל, Foundry לא מכיר שם מודל, רק שם פריסה. אם יצרת פריסה בשם `chat-dev` שמריצה GPT-4o mini, חובה לכתוב `model="chat-dev"`. העברת `"gpt-4o-mini"` תחזיר שגיאה: `DeploymentNotFound` או `404`. השגיאה הזו מופיעה גם בסביבת פרוד כשמחליפים deployment name מ-staging ל-prod ושוכחים לעדכן בקוד.

## טעויות נפוצות

**התקנת `openai` במקום `azure-ai-inference`**. שתי החבילות עם API דומה, אך `openai.AzureOpenAI` לא מדבר עם Foundry Project. אפשר להשתמש בה ישירות מול Azure OpenAI resource בלי Foundry, אך אז אין evals, agents ומטא-נתוני project.

**שימוש ב-connection string במקום ב-endpoint + credential**. גרסאות ישנות של הדוקומנטציה הראו `AIProjectClient.from_connection_string(...)`. הפונקציה הזו הוצאה משימוש; ה-API הנוכחי דורש `endpoint` בלבד.

**אי-שחרור של `client`**. `AIProjectClient` פותח connections ל-Azure. שימוש ב-context manager (`with AIProjectClient(...) as client:`) מבטיח סגירה מסודרת, במיוחד בפונקציות Azure serverless עם מגבלת connections.

**הנחה שהתגובה תמיד מגיעה ב-`choices[0]`**. אם שלחת `n=2` כפרמטר, יהיו שני choices. ב-n=1 ברירת המחדל - yes, `choices[0]` תמיד קיים, אבל `choices[0].finish_reason` יכול להיות `"length"` ולא `"stop"`, מה שמסמן שהתגובה נחתכה.

## מתי זה לא משנה

אם הפרויקט קורא לפריסה אחת בלבד, לא משתמש ב-evals, ב-agents ולא ב-prompt flows, ניתן לעבוד ישירות עם `openai.AzureOpenAI`:

```python
from openai import AzureOpenAI
client = AzureOpenAI(azure_endpoint="...", azure_deployment="chat-prod", api_key="...")
```

זה פחות קוד ופחות תלויות. `azure-ai-projects` שווה את התקורה כשצריך ניהול deployments מרובים, ניטור unified, content filters מרכזיים, evals, או agents שמוגדרים ב-Foundry.

## חיבור

יחידה זו בנויה על m5-foundry-model-selection (Hub, Project, deployment types) ועל m5-identity-rbac (Managed Identity, RBAC). היא פותחת את m5-rag-on-azure שם אותו `client` מקבל גם embedding client לחיפוש וקטורי, ואת m5-tool-augmented-flows שם `chat.complete()` מקבל פרמטר `tools` שמרחיב את יכולות המודל.

```quiz
{"id":"u-m5-foundry-sdk-apps-q1","tree":"ops","skill":"azure-foundry","q":"מה הפרמטר model= ב-chat.complete() מייצג ב-Azure AI Foundry SDK?","options":["שם משפחת המודל (כגון gpt-4o-mini)","שם הפריסה שנוצרה ב-Foundry Project","מזהה המודל ב-Hugging Face","גרסת ה-API של Azure OpenAI"],"answer":1,"explain":"ב-Foundry SDK, model= מקבל את שם הפריסה כפי שהוגדר ב-Project, לא שם המשפחה. אם הפריסה נקראת 'chat-prod', חובה לכתוב model='chat-prod' גם אם היא מריצה GPT-4o mini."}
```

```quiz
{"id":"u-m5-foundry-sdk-apps-q2","tree":"ops","skill":"azure-foundry","q":"מהי הדרך הנכונה לקבל ChatCompletionsClient מתוך AIProjectClient?","options":["from azure.ai.inference import ChatCompletionsClient; ChatCompletionsClient(endpoint=...)","client.inference.get_chat_completions_client()","AIProjectClient.chat()","openai.AzureOpenAI(azure_deployment=...)"],"answer":1,"explain":"client.inference.get_chat_completions_client() מחזיר לקוח inference שמחובר לאותו Project ואותן הרשאות. זה מבטיח שהקריאות מנותבות דרך הפרויקט הנכון ולא ישירות."}
```

```concepts
{"items":[{"id":"foundry-sdk","t":"azure-ai-projects SDK","he":"SDK של Foundry","d":"חבילת פייתון שמעטפת את Azure AI Foundry REST API; AIProjectClient הוא נקודת הכניסה לפריסות, evals ו-agents.","rel":["foundry-project","azure-ai-inference-sdk"],"node":"azure-core"},{"id":"azure-ai-inference-sdk","t":"azure-ai-inference SDK","he":"SDK הסקה","d":"חבילת פייתון שמספקת ChatCompletionsClient; מתקבלת מ-AIProjectClient.inference.get_chat_completions_client() לחיבור אוטומטי לפרויקט.","rel":["foundry-sdk","foundry-project"],"node":"azure-core"},{"id":"ai-project-client","t":"AIProjectClient","he":"לקוח פרויקט","d":"מחלקת ה-Python שמחברת קוד לפרויקט Foundry; מקבלת endpoint ו-DefaultAzureCredential ומספקת גישה לכל משאבי הפרויקט.","rel":["foundry-sdk","foundry-project"],"node":"azure-core"}]}
```

<!-- audited -->
