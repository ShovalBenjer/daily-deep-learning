# תרגום ודיבור
שלושה שירותים מכסים את כל שאלות ה-AI-103 על שפה: Translator ל-100+ שפות בקריאת REST אחת, Speech לתמלול ולסינתזה, ו-OpenAI כשנדרשת פינה של הקשר.

## מה תדע בסוף
תבחר את השירות הנכון בין Azure Translator, Azure Speech ו-Azure OpenAI לפי הדרישה; תכתוב קריאת תרגום ו-STT בסיסית ב-Python SDK ותפרש את התגובה; תזהה מתי LLM עדיף ומתי Translator זול פי עשרה.

## האינטואיציה
דמיין מרכז תרגום בינלאומי עם שלושה חדרים.

חדר **Translator** פתוח 24/7 במחיר קבוע לאות. כל הניירות עוברים שם: 100+ שפות, נפח בלתי מוגבל, תגובה במאית שנייה. אתה שולח טקסט ומקבל טקסט, בלי שאלות.

חדר **OpenAI** הוא המומחה. הוא מבין הקשר, שומר על טון, מתרגם ז'רגון מקצועי. עולה פי עשרה, אבל כשהמשפט מכיל אירוניה, משחק מילים, או הוראות מסוימות על סגנון - רק הוא יעשה את זה נכון.

חדר **Speech** הוא חדר הקול: חלון אחד מקבל אודיו ומחזיר טקסט (STT), חלון שני מקבל טקסט ומחזיר אודיו (TTS). הוא לא מתרגם בכלל. Pipeline לתרגום שיחה: Speech + Translator + Speech.

## ההגדרות המדויקות

### Azure AI Translator

**Azure AI Translator, שירות התרגום** הוא cognitive service לתרגום מכונה נוירוני (Neural Machine Translation). Endpoint גלובלי: `https://api.cognitive.microsofttranslator.com`. שלוש routes עיקריות לבחינה:

| Route | פעולה |
|---|---|
| `/translate` | תרגום טקסט לשפה אחת או יותר |
| `/detect` | זיהוי שפת הקלט בלבד |
| `/dictionary/lookup` | חלופות וסינונים |

הקריאה היא POST עם JSON ושלושה headers:

```
Ocp-Apim-Subscription-Key: <key>
Ocp-Apim-Subscription-Region: <region>   # חובה ל-global endpoint
Content-Type: application/json; charset=UTF-8
```

כל element בגוף הוא `{"Text": "..."}`. Query string: `api-version=3.0&to=he&to=fr`.

**Document Translation, תרגום מסמכים**: תרגום קבצים שלמים (DOCX, PDF, HTML) בשירות async. הקלט והפלט הם Blob Storage containers. מתאים לנפח גדול.

**Custom Translator, מתרגם מותאם**: מאמנים מודל ב-customtranslator.microsoft.com על corpus מקביל (זוגות משפטי מקור+יעד) כדי לשפר את המינוח התחומי. צריך לפחות אלפי זוגות כדי לראות שיפור מעל המודל הבסיסי.

### Azure AI Speech

**Azure AI Speech, שירות הדיבור** מכיל שני כיוונים:

**Speech to Text (STT), דיבור לטקסט**: ממיר אודיו לטקסט. שני מצבים:
- **Real-time transcription, תמלול בזמן-אמת**: stream של אודיו, תוצאות מגיעות ברצף.
- **Batch transcription, תמלול בהקבצה**: קבצים ב-Blob Storage, async, לאוספים גדולים.

**Text to Speech (TTS), טקסט לדיבור**: ממיר טקסט לאודיו. שני סוגי קולות:
- **Standard voices**: סינתזה קלאסית, איכות בינונית.
- **Neural voices, קולות נוירוניים**: מבוססי deep learning, נשמעים טבעיים; הכל ב-Azure מוצג ממשפחת הנוירוניים.

**SSML, Speech Synthesis Markup Language** הוא XML לשליטה ב-TTS: קצב, גובה קול, הדגשות, הפסקות:

```xml
<speak version='1.0' xml:lang='he-IL'>
  <voice name='he-IL-HilaNeural'>
    <prosody rate='slow' pitch='low'>
      ברוכים הבאים לסדנה.
    </prosody>
  </voice>
</speak>
```

**Custom Speech, דיבור מותאם**: מאמנים מודל STT על corpus דיבור תחומי (מינוח רפואי, מספרי טיסה) כדי להוריד **Word Error Rate (WER), שיעור שגיאות מילים**.

### LLM Translation

**תרגום ב-LLM** = Azure OpenAI עם system prompt שמציין שפה, סגנון והקשר:

```python
completion = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system",
         "content": "Translate to formal German, preserving legal terminology."},
        {"role": "user", "content": "The plaintiff waived all further claims."}
    ]
)
```

אין route ייעודי לתרגום. הכל prompt design.

## דוגמה מחושבת

### תרגום עם Python SDK

```python
from azure.ai.translation.text import TextTranslationClient
from azure.ai.translation.text.models import InputTextItem
from azure.core.credentials import AzureKeyCredential

client = TextTranslationClient(
    endpoint="https://api.cognitive.microsofttranslator.com",
    credential=AzureKeyCredential("<key>"),
    region="eastus"
)

items = [
    InputTextItem(text="Hello, how are you?"),
    InputTextItem(text="See you tomorrow.")
]

response = client.translate(body=items, to_language=["he", "fr"])

for result in response:
    for t in result.translations:
        print(f"[{t.to}] {t.text}")

# פלט:
# [he] שלום, מה שלומך?
# [fr] Bonjour, comment allez-vous ?
# [he] להתראות מחר.
# [fr] À demain.
```

תרגמנו שני משפטים לשתי שפות בבקשת POST אחת. `to_language` הוא רשימה.

### STT: תמלול קובץ WAV

```python
import azure.cognitiveservices.speech as speechsdk

speech_config = speechsdk.SpeechConfig(subscription="<key>", region="eastus")
speech_config.speech_recognition_language = "he-IL"

audio_config = speechsdk.audio.AudioConfig(filename="record.wav")
recognizer = speechsdk.SpeechRecognizer(speech_config, audio_config)

result = recognizer.recognize_once()

if result.reason == speechsdk.ResultReason.RecognizedSpeech:
    print("תמלול:", result.text)
elif result.reason == speechsdk.ResultReason.NoMatch:
    print("לא זוהה דיבור")
```

### TTS: קריאה ב-SSML

```python
synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)
ssml = """<speak version='1.0' xml:lang='he-IL'>
  <voice name='he-IL-HilaNeural'>ברוכים הבאים לסדנה.</voice>
</speak>"""
result = synthesizer.speak_ssml_async(ssml).get()
```

## המקרה שמפיל את האינטואיציה

**Translator לא מחזיר תעתיק (romanization) אלא אם מבקשים.** שליחת טקסט עברי עם `to=en` תחזיר תרגום לאנגלית בלבד. אם צריך גם תעתיק של הקלט העברי לאותיות לטיניות, יש להוסיף `fromScript=Hebr&toScript=Latn` ולקרוא ל-`/transliterate` route נפרד. ה-`transliteration` field בתגובת `/translate` יישאר null בלי בקשה מפורשת.

**Speech לא מתרגם.** `SpeechRecognizer` עם שפת קלט עברית יחזיר עברית בלבד. Pipeline לתרגום שיחה שלם:
```
אודיו → STT (שפת דובר) → Translator (שפת יעד) → TTS (שפת יעד)
```
מי שמצפה לקבל תרגום ישיר מ-Speech יקבל תמלול בשפת המקור בלבד.

## טעויות נפוצות

**1. Header חסר של region בגלובל endpoint.** `https://api.cognitive.microsofttranslator.com` דורש `Ocp-Apim-Subscription-Region`. בלעדיו: 401 עם "region is required". Endpoint אזורי (כגון `https://eastus.api.cognitive.microsofttranslator.com`) לא דורש אותו.

**2. שימוש ב-Translator לתוכן שצריך הקשר.** "Light the fire" + Translator = "הדלק את האש". GPT-4o עם context של email בין חברים = "תעשה חיים". בנפח גדול תמיד Translator; בתוכן שדורש סגנון או הקשר - OpenAI.

**3. `speak_text_async` בלי שליטה על קול.** `speak_text_async("...")` משתמש בקול ברירת המחדל ובמאפיינים ברירת המחדל. `speak_ssml_async(ssml)` עם SSML wrapper נכון נותן שליטה על שם הקול, קצב, גובה. SSML בלי `<speak>` wrapper יחזיר 400.

**4. AudioConfig עם MP3.** `AudioConfig(filename="input.mp3")` ייכשל. ה-SDK מצפה ל-WAV (PCM 16-bit, 16kHz, mono) כברירת מחדל. MP3 דורש PullAudioInputStream עם AudioStreamFormat מפורש, או המרה ל-WAV לפני הקריאה.

**5. Custom Translator בלי corpus מספיק.** ניתן לאמן עם מעט זוגות אבל השיפור על המודל הבסיסי יהיה אפסי. אלפי זוגות ומעלה מניבים שיפור מדיד. הממשק לא מזהיר.

## מתי זה לא משנה

**כשה-UI כבר רב-לשוני בצד הלקוח.** אפליקציות עם i18n (קבצי `en.json`, `he.json` ב-bundle) לא צריכות Translator לכתוביות סטטיות. Translator מתאים לתוכן דינמי שמגיע ב-runtime: הודעות ממשתמש, תגובות, מסמכים שנשלפים.

**כשהשפה ידועה ויחידה.** אפליקציה שמשרתת ישראלים בעברית בלבד לא צריכה STT רב-שפתי. Language detection רלוונטי כשהמשתמש עשוי לכתוב בכל שפה.

**ראיון:** "מתי Translator ומתי OpenAI לתרגום?" - Translator: נפח גדול, עלות לאות, שפות נדירות, ללא context. OpenAI: הקשר, ז'רגון, סגנון, תרגום יצירתי. ב-AI-103 שתי השיטות נבחנות; שאלת הבחינה תכיל רמז (budget, volume, domain) שיסמן את הבחירה.

## חיבור
יחידה זו שייכת לבלוק M5, שורת "The tail: CV, text, extraction" לפני בחינת AI-103. הבחינה בודקת נושא זה בסעיף "Implement natural language processing solutions," שכולל גם entity+sentiment (m5-extraction), גם OCR ומסמכים (m5-ocr-layout), וגם AI Search (m5-ai-search).

היחידה הבאה: **m5-ocr-layout** - Document Intelligence ו-OCR: כשה-input הוא תמונה סרוקה של מסמך ולא טקסט מוקלד.

```quiz
{"id":"u-m5-translation-speech-q1","tree":"ops","skill":"azure-foundry","q":"Which HTTP header is required when calling the global Azure Translator endpoint (api.cognitive.microsofttranslator.com) but NOT a regional endpoint?","options":["Content-Type","Ocp-Apim-Subscription-Key","Ocp-Apim-Subscription-Region","api-version"],"answer":2,"explain":"The global endpoint routes requests across Azure regions, so it needs Ocp-Apim-Subscription-Region to identify the billing region. A regional endpoint embeds the region in its URL, so the header is not required there. Ocp-Apim-Subscription-Key is required on both."}
```

```fillin
{"id":"u-m5-translation-speech-f1","tree":"ops","skill":"azure-foundry","prompt":"ב-Azure Speech SDK, השירות שמקבל SpeechConfig ו-AudioConfig ומחזיר טקסט מאודיו נקרא _________.","answer":"SpeechRecognizer","alt":["speechrecognizer","speech recognizer"],"explain":"SpeechRecognizer הוא המחלקה ב-azure.cognitiveservices.speech שמבצעת Speech-to-Text. SpeechSynthesizer הוא ה-TTS (Text-to-Speech). מקבל SpeechConfig (מפתח, region, שפה) ו-AudioConfig (קובץ או מיקרופון) ומספק recognize_once() לתמלול חד-פעמי."}
```

```quiz
{"id":"u-m5-translation-speech-q2","tree":"ops","skill":"azure-foundry","q":"A company must translate 200,000 DOCX files from Spanish to English while preserving their formatting. Which Azure Translator feature is designed for this?","options":["Real-time text translation via /translate","Document Translation (async batch to Blob Storage)","Custom Translator fine-tuning","Azure AI Language NER"],"answer":1,"explain":"Document Translation is the async batch feature of Azure Translator. It reads source files from an Azure Blob container and writes translated files to another container, preserving document formatting. The synchronous /translate endpoint handles short text strings, not whole files. Custom Translator fine-tunes the model for domain vocabulary but does not handle bulk file conversion. NER is unrelated."}
```

```concepts
{"items":[{"id":"c-azure-translator","t":"Azure AI Translator","he":"שירות התרגום","d":"REST+SDK for text and document translation across 100+ languages via NMT","rel":["c-llm-translation","c-azure-speech"],"node":"azure-core"},{"id":"c-llm-translation","t":"LLM translation","he":"תרגום ב-LLM","d":"Using Azure OpenAI with a system prompt to translate with context, style and domain instructions","rel":["c-azure-translator"],"node":"azure-core"},{"id":"c-azure-speech","t":"Azure AI Speech","he":"שירות הדיבור","d":"Azure cognitive service for Speech-to-Text and Text-to-Speech","rel":["c-azure-translator","c-stt","c-tts"],"node":"azure-core"},{"id":"c-stt","t":"Speech to Text","he":"דיבור לטקסט","d":"Real-time or batch audio transcription using SpeechRecognizer in the Azure Speech SDK","rel":["c-azure-speech"],"node":"azure-core"},{"id":"c-tts","t":"Text to Speech","he":"טקסט לדיבור","d":"Neural voice synthesis using SpeechSynthesizer and SSML markup","rel":["c-azure-speech"],"node":"azure-core"}]}
```

<!-- audited -->
