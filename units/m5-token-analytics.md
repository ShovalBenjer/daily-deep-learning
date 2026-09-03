# תצפיתיות, ניתוח עקבות וטוקנים
כשמודל LLM מחזיר תשובה שגויה בפרודקשן, היכולת לענות "מה בדיוק קרה בקריאה הזו" תוך שתי דקות היא ההבדל בין שירות שאפשר לתחזק לבין קופסה שחורה.

## מה תדע בסוף
תוכל להסביר כיצד OpenTelemetry מייצר traces עבור קריאות LLM, היכן ה-traces נוחתים ב-Azure (Application Insights), ומה מספרים לך token metrics לגבי עלות, קיצוב ורגרסיות.

## האינטואיציה
דמיין שרשמת כל שיחת טלפון בחברה: מי דיבר, מתי, כמה זמן, עם מי. זה trace. כשאחד הלקוחות מתלונן, אתה מחפש את ה-trace של השיחה שלו ומוצא בדיוק כשה-line נפל. ב-LLM application, ה-"שיחות" הן קריאות למודל, ל-vector store, לכלי חיצוני. OpenTelemetry (OTel) הוא הפרוטוקול שמוודא שכל רכיב ב"חברה" מוסיף הקלטה לאותה רצועה.

Token analytics הוא השכבה הכלכלית: כמה מילים שלחת (prompt tokens), כמה מילים קיבלת חזרה (completion tokens). כפל ב-price per token ומקבל את העלות. בלי זה, אין דרך לדעת מדוע החשבונית ב-Azure עלתה.

## ההגדרות המדויקות

**OpenTelemetry (OTel)**, תקן פתוח לתצפיתיות, מגדיר שלושה סוגי אותות: traces, metrics ו-logs. עבור LLM apps, ה-traces הם הסוג המרכזי.

**Trace, עקבה** היא אוסף spans שמתארים בקשה מקצה לקצה. לכל trace יש trace ID שמאפשר למצוא את כל ה-spans שלו.

**Span, קטע** הוא פעולה בודדת עם שם, זמן התחלה, משך ותוצאה. קריאה ל-Azure AI מייצרת span עם attributes סטנדרטיים:
- `gen_ai.request.model` - שם המודל
- `gen_ai.usage.prompt_tokens` - כמה tokens בשאלה
- `gen_ai.usage.completion_tokens` - כמה tokens בתשובה
- `gen_ai.response.finish_reason` - `stop`, `length`, `content_filter` וכו'

**Azure AI Inference SDK** כולל `AIInferenceInstrumentor` שמוסיף OTel instrumentation אוטומטי לכל קריאת `chat_completions.complete()`. קריאה אחת ל-`AIInferenceInstrumentor().instrument()` בפתיחת האפליקציה מספיקה.

**Application Insights** הוא ה-backend שבו Azure שומר traces ו-metrics. כשמחברים Application Insights ל-Azure AI Project, Foundry מגדיר את ה-exporter אוטומטית דרך `APPLICATIONINSIGHTS_CONNECTION_STRING`.

**Token metrics, מדדי טוקנים** נצברים ב-Azure Monitor:
- `TokensConsumed` - סה"כ לפי deployment
- `PromptTokensConsumed` - כמה prompt tokens לאורך זמן
- `CompletionTokensConsumed` - כמה completion tokens לאורך זמן

ניתן לפלח כל אחד לפי `model_id`, `deployment`, ו-`is_streaming`.

```concepts
{"items":[{"id":"c-opentelemetry-trace","t":"OpenTelemetry Trace","he":"עקבה OTel","d":"אוסף spans עם trace ID משותף שמתאר בקשה אחת מקצה לקצה; תקן פתוח לתצפיתיות ב-LLM apps","rel":["c-otel-span","c-app-insights"],"node":"azure-core"},{"id":"c-otel-span","t":"OTel Span","he":"קטע OTel","d":"פעולה בודדת בתוך trace: שם, start time, משך ו-attributes כמו gen_ai.usage.prompt_tokens ו-gen_ai.request.model","rel":["c-opentelemetry-trace","c-app-insights"],"node":"azure-core"},{"id":"c-app-insights","t":"Application Insights","he":"Application Insights","d":"שירות Azure Monitor שמאחסן traces ו-metrics; backend לאוטומטי של Foundry OTel exporter","rel":["c-opentelemetry-trace","c-token-analytics-metric"],"node":"azure-core"},{"id":"c-token-analytics-metric","t":"Token Analytics Metric","he":"מדד ניתוח טוקנים","d":"Azure Monitor counters: TokensConsumed, PromptTokensConsumed, CompletionTokensConsumed; ניתנים לפילוח לפי model_id ו-deployment","rel":["c-app-insights","c-cost-attribution"],"node":"azure-core"}]}
```

## דוגמה מחושבת

אפליקציית RAG פשוטה עם Azure AI Inference SDK:

```python
import os
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.tracing import AIInferenceInstrumentor
from azure.monitor.opentelemetry import configure_azure_monitor
from azure.identity import DefaultAzureCredential

# 1. חיבור Application Insights
configure_azure_monitor()
# 2. הפעלת instrumentation לפני יצירת ה-client
AIInferenceInstrumentor().instrument()

client = ChatCompletionsClient(
    endpoint=os.environ["AZURE_AI_ENDPOINT"],
    credential=DefaultAzureCredential()
)

response = client.complete(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "מה ההבדל בין RBAC ל-ABAC?"}]
)

print(response.choices[0].message.content)
print(response.usage)
# CompletionUsage(prompt_tokens=22, completion_tokens=141, total_tokens=163)
```

מה קורה מאחורי הקלעים:
1. `AIInferenceInstrumentor` עוטף את `complete()` ומייצר span עם trace ID.
2. ה-span כולל `prompt_tokens=22`, `completion_tokens=141`, `model=gpt-4o-mini`.
3. ה-span נשלח ל-Application Insights בסיום הקריאה.
4. Azure Monitor מצרף את ה-tokens ל-counter `TokensConsumed` לפי deployment.

לאחר שעה ניתן לשלוח KQL ב-Application Insights:
```
dependencies
| where type == "LLM"
| project timestamp, name, duration,
          tolong(customDimensions.prompt_tokens),
          tolong(customDimensions.completion_tokens)
| order by timestamp desc
```

```quiz
{"id":"u-m5-token-analytics-q1","tree":"ops","skill":"azure-foundry","q":"Which call enables automatic OpenTelemetry span generation for Azure AI Inference SDK requests?","options":["configure_azure_monitor()","AIInferenceInstrumentor().instrument()","DefaultAzureCredential()","ChatCompletionsClient(endpoint, credential)"],"answer":1,"explain":"configure_azure_monitor() wires the OTLP exporter to Application Insights, but it does not auto-instrument LLM calls. AIInferenceInstrumentor().instrument() is the call that wraps chat_completions.complete() with span generation. It must run before the client is created."}
```

## המקרה שמפיל את האינטואיציה

token count גבוה לאו דווקא אומר עלות גבוהה. gpt-4o-mini עולה פחות מ-10% ממחיר gpt-4o. אם ה-Dashboard מציג `TokensConsumed` ללא פילוח לפי `model_id`, המספר לא אומר כלום לגבי החשבון. שתי deployment שמייצרות 10,000 tokens כל אחת - אחת עם 4o ואחת עם 4o-mini - עשויות לייצר הפרש עלות של פקטור 10. הדרך הנכונה: Cost Estimate ב-Azure AI Foundry portal שממפה tokens ל-dollars לפי מחיר המודל, או KQL שמשקלל לפי `model_id`.

## טעויות נפוצות

**קוראים ל-`instrument()` אחרי יצירת ה-client.** ה-instrumentor חייב לרוץ לפני שה-client נוצר; client שנוצר לפניו לא יוקלט. המקום הנכון: ממש לאחר `configure_azure_monitor()` בהתחלת ה-process.

**שולחים את תוכן ה-prompt ל-Application Insights.** ב-default, ה-OTel instrumentation כולל את תוכן ההודעות ב-span attributes. בנתונים רגישים, יש להגדיר `AZURE_TRACING_GEN_AI_CONTENT_RECORDING_ENABLED=false` כדי להסיר תוכן ולשמור רק metadata.

**מסתמכים רק על `response.usage` לניהול עלות.** `response.usage` נותן את ה-tokens של קריאה אחת. כדי לצבור לאורך זמן ולהגדיר budget alerts, יש להשתמש ב-Azure Monitor metrics - לא בלוגים של האפליקציה.

**מגדירים alert על `TokensConsumed` ממוצע יומי בלבד.** spike חד בשעת לילה נבלע בממוצע. אלרטים אפקטיביים עובדים על חלון זמן קצר (5-15 דקות) ועל percentile, לא על average יומי.

## מתי זה לא משנה

ב-prototype מקומי ללא production traffic, OTel exporter הוא overhead מיותר. מספיק להסתכל על `response.usage` ב-stdout.

כשהמודל מוקצב ב-PTU (provisioned throughput), רוחב הפס מגיע בחבילה קבועה. Token count משפיע הרבה פחות על עלות אמיתית. עדיין כדאי לנטר לצרכי throttling (האם מגיעים ל-capacity limit), אבל לא לצרכי עלות.

## חיבור
יחידה זו ממשיכה מ-`m5-monitoring-drift` (ניטור איכותי: groundedness ו-safety לאורך זמן) ומאפשרת לראות ברמת בקשה בודדת מה קרה, לא רק ברמת אגרגט. היחידה הבאה הטבעית היא `m5-content-understanding` שמכסה ניתוח תמונה ומסמך, שם token analytics קריטי במיוחד: vision tokens יקרים יותר מ-text tokens ויש לנטרם בנפרד.

<!-- audited -->
