# חילוץ ישויות וסנטימנט
שאלת ה-AI-103 "מה הישות, מה ההרגשה, מה המפתח?" כולה מתמחה בקריאת API אחת לשירות Azure AI Language.

## מה תדע בסוף
תבחר את ה-feature הנכון מארבעה (NER, sentiment, key phrases, JSON extraction), תכתוב קריאת SDK בסיסית ב-Python, ותפרש את התגובה כולל confidence scores.

## האינטואיציה
דמיין מנתח שפה שיושב מאחורי URI קבוע: שולחים לו טקסט, הוא מחזיר דו"ח. הדו"ח מכיל שורות כמו "Microsoft → Organization (0.99)" ו-"מצוין, אבל האספקה הייתה איומה → mixed (0.48 positive / 0.51 negative)". לא צריך לבנות מודל, לא לאמן, לא לנהל משקלים. רק לשלוח HTTP POST ולקרוא JSON.

כל ה-features האלה חיים תחת **Azure AI Language**, שם השירות עבור שפה טבעית ב-Azure (לשעבר Cognitive Services Text Analytics). מוצר אחד, endpoint אחד, ארבעה modes שונים.

## ההגדרות המדויקות

**Named Entity Recognition (NER), זיהוי ישויות בשם**: מאתר spans של טקסט ומסווג אותם לקטגוריות מובנות. הקטגוריות הסטנדרטיות: Person, Organization, Location, DateTime, URL, Email, Quantity, Address. כל ישות מגיעה עם:
- `text` - הטקסט שזוהה
- `category` / `subcategory` - הסיווג
- `offset` / `length` - מיקום בתוך המחרוזת
- `confidence_score` - מספר בין 0 ל-1

**Key Phrase Extraction, חילוץ ביטויים מפתח**: מחלץ את ה-phrases הסליאנטיים (salient phrases) - המונחים שהכי מאפיינים את הטקסט. מחזיר רשימה שטוחה של מחרוזות: `["monthly report", "server crash", "QA team"]`. אין ציון, אין מיקום.

**Sentiment Analysis, ניתוח סנטימנט**: מחזיר תווית אחת לכל מסמך: `positive`, `negative`, `neutral`, `mixed`. לצד confidence scores לכל תווית. **Opinion Mining, כרייה של דעות** הוא תוסף שמחבר sentiment לישות ספציפית בטקסט - זה **Aspect-Based Sentiment Analysis** בשם Azure. מופעל עם `show_opinion_mining=True`.

**Structured/JSON Extraction, חילוץ JSON**: שימוש ב-Azure OpenAI עם `response_format` ו-Pydantic לחילוץ שדות טיפוסיים מטקסט חופשי. לא REST ל-Azure AI Language אלא Azure OpenAI עם structured output. שני גישות:
- `chat.completions.create(..., response_format={"type": "json_schema", ...})`
- `beta.chat.completions.parse(...)` עם Pydantic model

**Custom NER, זיהוי ישויות מותאם**: כשהקטגוריות הסטנדרטיות לא מספיקות (כמו "מספר פוליסה" או "שם תרופה"), מאמנים מודל ב-Azure AI Language Studio עם לפחות 30 מסמכי אימון מתויגים.

**אימות - שתי שיטות**:
- **API key**: `AzureKeyCredential("<key>")` - פשוט, מתאים לפיתוח.
- **Managed Identity, זהות מנוהלת** (מומלץ בייצור): `DefaultAzureCredential()` - ללא מפתחות בקוד.

## דוגמה מחושבת

```python
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential

endpoint = "https://myresource.cognitiveservices.azure.com/"
client = TextAnalyticsClient(endpoint=endpoint,
                             credential=AzureKeyCredential("<key>"))

docs = ["Order #12345 from Microsoft arrived late, but John was very helpful."]

# --- NER ---
ner_result = client.recognize_entities(docs)[0]
for e in ner_result.entities:
    print(f"{e.text!r:20s} {e.category:15s} {e.confidence_score:.2f}")
# '#12345'             Quantity        0.89
# 'Microsoft'          Organization    0.99
# 'John'               Person          0.94

# --- Sentiment + Opinion Mining ---
sent_result = client.analyze_sentiment(docs, show_opinion_mining=True)[0]
print(sent_result.sentiment)                          # mixed
print(sent_result.confidence_scores)                  # positive=0.48, negative=0.51
for sentence in sent_result.sentences:
    for opinion in sentence.mined_opinions:
        print(opinion.target.text, opinion.target.sentiment)
        # 'delivery' negative
        for assessment in opinion.assessments:
            print("  assessment:", assessment.text, assessment.sentiment)
            # 'late' negative

# --- Key Phrases ---
kp_result = client.extract_key_phrases(docs)[0]
print(kp_result.key_phrases)  # ['Order #12345', 'Microsoft', 'John']
```

JSON extraction עם Azure OpenAI:

```python
from openai import AzureOpenAI
from pydantic import BaseModel

class Order(BaseModel):
    order_id: str
    vendor: str
    sentiment: str

oai = AzureOpenAI(azure_endpoint=endpoint, api_key=api_key, api_version="2024-08-01-preview")
completion = oai.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[{"role": "user",
               "content": "Extract from: 'Order #12345 from Microsoft arrived late'"}],
    response_format=Order
)
order = completion.choices[0].message.parsed
print(order.order_id, order.vendor)  # 12345  Microsoft
```

## המקרה שמפיל את האינטואיציה

`sentiment: "mixed"` לא אומר שהטקסט מבולבל. "הפיצה הייתה מעולה אבל השירות היה גרוע" מקבל `mixed` ברמת המסמך - כי שני הרגשות שם בו-זמנית. בלי Opinion Mining רואים רק `mixed` ולא יודעים **מה** גרוע ו**מה** מצוין. עם `show_opinion_mining=True` מקבלים שני targets: `pizza → positive`, `service → negative`.

ישות עם confidence score 0.55 **יכולה להיות נכונה**. הסכור לא אומר "בטוח/לא בטוח" - הוא אמידה של ה-model עבור הקטגוריה שנבחרה. קבעו threshold לפי use case: בזיהוי PII בבריאות, אולי 0.8+; בניתוח reviews, 0.5 מספיק.

## טעויות נפוצות

1. **שימוש ב-NER סטנדרטי לישויות עסקיות ייחודיות** - NER מכיר Person/Location/Organization, לא "מספר חוזה" שלך. Custom NER נדרש.
2. **שכחת `show_opinion_mining=True`** - בלי הפרמטר, `mined_opinions` מוחזר ריק. אין שגיאה, רק תוצאה חסרה.
3. **טקסט ארוך מ-5,120 תווים לבקשה** - Azure AI Language תחתוך או תחזיר שגיאה. חלקו מסמכים ארוכים לפני הקריאה.
4. **בלבול בין Key Phrase ל-NER** - Key Phrase מחזיר phrases ללא category ובלי confidence. NER מחזיר ישויות עם סיווג. לניתוח "מה הנושאים?" - key phrases; "מי מוזכר?" - NER.

## מתי זה לא משנה

כשהישויות ניתנות לתיאור ב-regex בלי שגיאות, Azure AI Language יקר ואיטי יותר מ-`re.findall`. עבור שדה "מספר טלפון בישראל" - regex מספיק.

כשיש לך Azure OpenAI בלאו הכי ב-stack, JSON extraction עם Pydantic model מחליף NER קלאסי ומחזיר שדות בדיוק כפי שהגדרת - ללא אימון ב-Language Studio.

בראיון - שאלות NLP שואלות על **Precision vs Recall**: בזיהוי PII (Privacy) מעדיפים Recall גבוה (לא לפספס). בפילטר ספאם מעדיפים Precision גבוה (לא לפסול אי-מייל לגיטימי).

## חיבור

יחד עם חילוץ מסמכים ו-OCR (m5-ocr-layout) ותרגום ודיבור (m5-translation-speech), מרכיבים את שכבת ה-text analytics ב-Azure AI. ה-AI Search (m5-ai-search) מרחיב עם vector search ו-semantic ranking על גבי אותם מסמכים שחולצו כאן.

```quiz
{"id":"u-m5-extraction-q1","tree":"ops","skill":"azure-foundry","q":"Which Azure AI Language feature returns entities such as 'Microsoft → Organization (0.99)'?","options":["Key Phrase Extraction","Sentiment Analysis","Named Entity Recognition","Custom Text Classification"],"answer":2,"explain":"Named Entity Recognition (NER) identifies and categorizes named spans of text into types such as Person, Organization, Location and DateTime, each with a confidence score. Key Phrase Extraction returns salient phrases without category labels; Sentiment Analysis scores the overall tone; Custom Text Classification categorizes whole documents into user-defined labels."}
```

```quiz
{"id":"u-m5-extraction-q2","tree":"ops","skill":"azure-foundry","q":"To get per-aspect sentiment ('pizza positive, delivery negative') from the Python SDK, which parameter is required?","options":["enable_opinion_mining=True","aspect_based=True","show_opinion_mining=True","mined_opinions=True"],"answer":2,"explain":"analyze_sentiment() accepts show_opinion_mining=True to activate Opinion Mining (aspect-based sentiment). Without it, mined_opinions on each sentence is empty even though the call succeeds."}
```

```fillin
{"id":"u-m5-extraction-f1","tree":"ops","skill":"azure-foundry","prompt":"Python SDK call for Named Entity Recognition:\n`result = client._____(documents)[0]`","answer":"recognize_entities","alt":["recognize_entities()"],"explain":"The TextAnalyticsClient method for NER is recognize_entities(). It takes a list of strings or TextDocumentInput objects and returns a list of RecognizeEntitiesResult objects, each with an entities property."}
```

```concepts
{"items":[{"id":"c-azure-ner","t":"Named Entity Recognition (NER)","he":"זיהוי ישויות בשם","d":"Identifies and categorizes entity spans (Person, Organization, Location, DateTime…) with confidence scores","rel":["c-azure-sentiment","c-azure-key-phrase"]},{"id":"c-azure-sentiment","t":"Sentiment Analysis","he":"ניתוח סנטימנט","d":"Returns positive/negative/neutral/mixed label with confidence scores; opinion mining adds per-target assessments","rel":["c-azure-ner","c-opinion-mining"]},{"id":"c-azure-key-phrase","t":"Key Phrase Extraction","he":"חילוץ ביטויים מפתח","d":"Returns a flat list of salient phrases that capture the main topics of a document","rel":["c-azure-ner"]},{"id":"c-opinion-mining","t":"Opinion Mining","he":"כרייה של דעות","d":"Extension of sentiment analysis linking sentiment to specific target spans; activated with show_opinion_mining=True","rel":["c-azure-sentiment"]},{"id":"c-azure-json-extract","t":"Structured JSON Extraction","he":"חילוץ JSON","d":"Using Azure OpenAI response_format or Pydantic parse() to extract typed fields from free-form text","rel":["c-azure-ner"]}]}
```
