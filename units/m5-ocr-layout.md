# OCR, Layout ומסמכים: Document Intelligence

כשה-PDF לא נפתח בחיפוש טקסט, Document Intelligence הוא הדרך להוציא ממנו מבנה שמחשב יכול לעבוד איתו.

## מה תדע בסוף

תדע להבחין בין prebuilt-read, prebuilt-layout והמודלים ה-prebuilt הדומייניים של Azure AI Document Intelligence, לכתוב קריאת SDK שמחלצת טקסט וטבלאות מ-PDF, ולזהות מתי custom model נדרש.

## האינטואיציה

דמיין PDF כסרט צילום שמכיל שלוש שכבות:

1. **פיקסלים בלבד** - מה שסורק מייצר. אין טקסט כלל.
2. **טקסט גולמי** - מה ש-prebuilt-read מחזיר: מילים, שורות, פסקאות עם תיבות גבול.
3. **מבנה** - מה ש-prebuilt-layout מוסיף: טבלאות עם שורות ועמודות, תיבות סימון (checkboxes), זוגות מפתח-ערך כמו `"Total": "$42.00"`.
4. **פרשנות** - מה שמודל כמו prebuilt-invoice עושה: יודע שה-"Total" בחשבונית הוא שדה `invoiceTotal`, לא רק טקסט.

כל שכבה מכילה את הקודמת. prebuilt-layout כולל את כל מה ש-prebuilt-read מחזיר, בנוסף למבנה.

## ההגדרות המדויקות

**Azure AI Document Intelligence, בינת מסמכים** (קודם Form Recognizer) הוא שירות Azure שמנתח תמונות ו-PDFs ומחזיר תוצאה מובנית ב-JSON. הקריאה מחזירה `AnalyzeResult` שמכיל:

| שדה | תוכן |
|---|---|
| `pages` | עמוד עם words, lines, selectionMarks |
| `paragraphs` | רצפים לוגיים של שורות |
| `tables` | תאים עם rowIndex, columnIndex, content |
| `keyValuePairs` | זוגות מפתח-ערך שנמצאו בטופס |
| `documents` | שדות דומייניים (רק במודלי prebuilt ו-custom) |

**prebuilt-read** מחלץ טקסט בלבד: מודפס וכתב יד, עם זיהוי שפה. מתאים כשצריך רק את המילים. מחזיר `pages` ו-`paragraphs`, אבל לא `tables` ולא `keyValuePairs`.

**prebuilt-layout** מחלץ טקסט + מבנה: טבלאות, selection marks, ו-key-value pairs. לא מזהה שדות דומייניים (אין `documents`). זה המודל שצריך לאינדוקס ב-AI Search skillset.

**מודלי prebuilt דומייניים** מאמנים מראש לסוגי מסמכים ספציפיים:

| Model ID | שימוש |
|---|---|
| `prebuilt-invoice` | חשבוניות: vendor, total, line items |
| `prebuilt-receipt` | קבלות: merchant, tax, items |
| `prebuilt-id-document` | תעודות זהות, דרכונים |
| `prebuilt-business-card` | כרטיסי ביקור |
| `prebuilt-tax.us.w2` | טפסי מס אמריקאיים W-2 |

**Custom models, מודלים מותאמים** נבנים על מסמכים שלך:

- **Template model, מודל תבנית**: למסמכים בפריסה קבועה (טפסי HR, אישורים). מהיר לאמן, דורש 5-15 מסמכים לכל layout.
- **Neural model, מודל עצבי**: למסמכים בפריסה משתנה (חשבוניות מספקים שונים). פחות תלוי במיקום, דורש 50 מסמכים לפחות.
- **Composed model, מודל מורכב**: מנתב בין כמה custom models לפי סוג המסמך.

**BoundingRegion, אזור גבול** מתאר את מיקום הרכיב בעמוד: `{"pageNumber": 1, "polygon": [x1,y1, x2,y2, x3,y3, x4,y4]}` (נקודות בסדר עם כיוון השעון).

**Selection mark, סימן בחירה** מייצג checkbox או radio button. `state` הוא `"selected"` או `"unselected"`. לא True/False.

## דוגמה מחושבת

חילוץ טבלה ראשונה מ-PDF עם prebuilt-layout:

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.identity import DefaultAzureCredential

ENDPOINT = "https://my-doc-intel.cognitiveservices.azure.com/"
client = DocumentIntelligenceClient(endpoint=ENDPOINT,
                                    credential=DefaultAzureCredential())

# שלח URL ציבורי (או bytes אם המסמך פרטי)
poller = client.begin_analyze_document(
    "prebuilt-layout",
    AnalyzeDocumentRequest(url_source="https://example.com/invoice.pdf"),
)
result = poller.result()

# הדפס את הטבלה הראשונה
if result.tables:
    table = result.tables[0]
    print(f"טבלה עם {table.row_count} שורות ו-{table.column_count} עמודות")
    for cell in table.cells:
        print(f"  [{cell.row_index},{cell.column_index}] = {cell.content!r}")
```

פלט טיפוסי לחשבונית עם טבלת פריטים:

```
טבלה עם 4 שורות ו-3 עמודות
  [0,0] = 'פריט'
  [0,1] = 'כמות'
  [0,2] = 'מחיר'
  [1,0] = 'API calls'
  [1,1] = '10000'
  [1,2] = '$5.00'
  [2,0] = 'Storage'
  [2,1] = '50 GB'
  [2,2] = '$2.50'
  [3,0] = 'Total'
  [3,1] = ''
  [3,2] = '$7.50'
```

עם prebuilt-invoice, השדה `invoiceTotal` יחלץ ישירות:

```python
poller = client.begin_analyze_document("prebuilt-invoice",
    AnalyzeDocumentRequest(url_source="..."))
result = poller.result()
doc = result.documents[0]
total = doc.fields.get("InvoiceTotal")
if total:
    print(f"Total: {total.content}")   # "$7.50"
```

## המקרה שמפיל את האינטואיציה

**prebuilt-read משתמש בטבלה כטקסט גולמי.** כשמריצים prebuilt-read על דוח עם טבלה, החזרה מכילה רק את המילים בסדר קריאה. טקסט כמו "פריט כמות מחיר API calls 10000 5.00" יגיע כשורה אחת ארוכה. `result.tables` יהיה ריק.

זה מפיל צינורות RAG שמנדקסים מסמכים עם prebuilt-read ואז מנסים לשאול שאילתות על נתוני הטבלה. השאילתה "מה המחיר של Storage?" לא תעבוד כי הקשר rows-to-columns אבד. הפתרון: להחליף ל-prebuilt-layout בסקינסט ב-AI Search.

## טעויות נפוצות

**שימוש ב-SDK הישן `azure-ai-formrecognizer`**. Azure שינה את שם ה-SDK ל-`azure-ai-documentintelligence` ב-2024. הספרייה הישנה עדיין עובדת אבל לא תקבל מודלים חדשים ולא תומכת ב-API version 2024-11-30 שנדרש לחלק מהתכונות.

**שליחת URL פרטי ב-`url_source`**. אם ה-PDF ב-Blob Storage שאינו ציבורי, URL ב-url_source ייכשל כי השירות מנסה לאחזר אותו בעצמו. הפתרון: שלח SAS token עם הרשאת read, או שלח את ה-bytes עם `bytes_source`.

**בלבול בין selection mark state ל-bool Python**. `cell.state == "selected"` נכון; `cell.state == True` תמיד False כי state הוא string.

**שימוש בטמפלייט כשה-layout משתנה**. custom template model מניח שהשדות במיקומים קבועים. אם אתה מנתח חשבוניות מכמה ספקים שכל אחד מהם מסדר את הטבלאות אחרת, template model ייכשל על מסמכים שלא אומנו עליהם. custom neural model מתאים יותר.

## מתי זה לא משנה

כשה-PDF הוא text-based (לא סרוק), אפשר לחלץ את הטקסט ישירות עם `pypdf` ב-Python בלי OCR. Document Intelligence מוסיף עלות ו-latency שאינם נחוצים כשהמסמך כבר מכיל שכבת טקסט.

כשצריך רק OCR פשוט על תמונה, Azure AI Vision Read API (ב-Computer Vision) זול יותר. Document Intelligence משתלם כשצריך מבנה (טבלאות, KV, domain fields).

לראיון: "מה ההבדל בין Form Recognizer ל-Document Intelligence?" - אותו שירות, Azure שינה את השם ב-2023. "מה prebuilt-layout נותן שprebuilt-read לא?" - table structure, selection marks, key-value pairs.

## חיבור

יחידה זו מחברת ל-m5-ai-search: ה-OCR skill ב-AI Search skillset משתמש ב-Document Intelligence תחת הכסות כדי לחלץ טקסט ממסמכים לפני האינדוקס. היא ממשיכה את m5-content-understanding שמכסה Content Understanding API למסמכים מולטימודאליים מורכבים יותר. מי שיבנה custom model מלא יזדקק גם ל-m5-foundry-model-selection כדי להבין את ה-deployment ו-endpoint patterns שזהים בכל שירותי Azure AI Cognitive.

```quiz
{"id":"u-m5-ocr-layout-q1","tree":"ops","skill":"azure-foundry","q":"מה ההבדל בין prebuilt-read ל-prebuilt-layout ב-Azure AI Document Intelligence?","options":["prebuilt-read מחלץ טקסט ומבנה; prebuilt-layout מחלץ רק טקסט","prebuilt-layout מחלץ גם טבלאות, selection marks וזוגות מפתח-ערך; prebuilt-read מחלץ רק טקסט","prebuilt-layout מהיר יותר כי הוא לא מנתח מבנה","שניהם זהים, prebuilt-read הוא כינוי ל-prebuilt-layout"],"answer":1,"explain":"prebuilt-read מחזיר pages, lines ו-paragraphs (טקסט בלבד). prebuilt-layout מוסיף tables עם rowIndex/columnIndex, selection marks עם state, ו-keyValuePairs. result.tables יהיה ריק עם prebuilt-read."}
```

```quiz
{"id":"u-m5-ocr-layout-q2","tree":"ops","skill":"azure-foundry","q":"מה הסיבה לכשל כשמשתמשים ב-url_source עם PDF ב-Azure Blob Storage ללא גישה ציבורית?","options":["Document Intelligence אינו תומך ב-PDF, רק בתמונות","השירות מנסה לאחזר את ה-URL בעצמו ולא יכול לגשת לאחסון הפרטי","url_source מוגבל ל-10MB בלבד","צריך להפעיל Managed Identity ב-Document Intelligence לפני כל קריאה"],"answer":1,"explain":"כשמשתמשים ב-url_source, שירות Document Intelligence עצמו מנסה לאחזר את הקובץ באמצעות HTTP GET. לאחסון פרטי צריך SAS token עם הרשאת read, או לשלוח את ה-bytes ישירות עם bytes_source."}
```

```fillin
{"id":"u-m5-ocr-layout-f1","tree":"ops","skill":"azure-foundry","prompt":"ב-Azure AI Document Intelligence, selection mark מחזיר שדה `state` שערכו הוא _____ או _____.","answer":"selected, unselected","alt":["\"selected\", \"unselected\"","selected או unselected"],"explain":"state הוא string עם הערכים \"selected\" או \"unselected\". לא bool ולא True/False. הבדל חשוב כשכותבים `if mark.state == 'selected':` במקום `if mark.state:`."}
```

```concepts
{"items":[{"id":"doc-intel-read","t":"prebuilt-read","he":"מודל קריאת טקסט","d":"מודל Azure AI Document Intelligence המחלץ טקסט בלבד (words, lines, paragraphs) עם תיבות גבול; אינו מחזיר tables, selection marks או keyValuePairs.","rel":["doc-intel-layout","doc-intel-prebuilt"],"node":"azure-core"},{"id":"doc-intel-layout","t":"prebuilt-layout","he":"מודל מבנה מסמך","d":"מודל Azure AI Document Intelligence המחלץ טקסט, tables (עם rowIndex/columnIndex), selection marks (state: selected/unselected) ו-keyValuePairs; בסיס לשירות ה-OCR skill ב-AI Search.","rel":["doc-intel-read","doc-intel-prebuilt","ai-search-index"],"node":"azure-core"},{"id":"doc-intel-prebuilt","t":"Prebuilt domain models","he":"מודלי דומיין מובנים","d":"מודלי Document Intelligence שאומנו לסוגי מסמכים ספציפיים (prebuilt-invoice, prebuilt-receipt, prebuilt-id-document, prebuilt-tax.us.w2). מחזירים שדות דומייניים ב-result.documents[].fields.","rel":["doc-intel-layout","doc-intel-custom"],"node":"azure-core"},{"id":"doc-intel-custom","t":"Custom model","he":"מודל מותאם","d":"מודל Document Intelligence שאומן על מסמכים שלך. Template model לפריסה קבועה (5-15 דוגמאות). Neural model לפריסה משתנה (50+ דוגמאות). Composed model מנתב בין כמה מודלים.","rel":["doc-intel-prebuilt"],"node":"azure-core"}]}
```
