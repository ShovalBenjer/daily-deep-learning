# בחירת שירות ומודל ב-Foundry

כדי לפרוס מודל AI ב-Azure, עליך לנווט בין עשרות מודלים ושלושה מסלולי תמחור שונים. Azure AI Foundry הוא הממשק שבו הבחירה נעשית.

## מה תדע בסוף

תדע לנווט בתצורת Hub-Project ב-Azure AI Foundry, לבחור מודל מתאים מהקטלוג לפי משימה ותקציב, ולהתאים deployment type לעומס ולדרישות Data Residency.

## האינטואיציה

דמיין חברה שכוללת **Hub** בתפקיד מחלקת IT המרכזית ו-**Project** בתפקיד צוות עבודה. ה-IT המרכזית מחזיקה את הרשת, הרשיונות והמחשוב המשותף; כל צוות עובד בחדר ישיבות נפרד עם גישה לאותם משאבים. כשאתה פורס מודל, אתה בוחר קודם לאיזה "חדר ישיבות" (Project) הוא שייך, ואחר כך איזה "מנוע" (מודל) ובאיזה "הסכם ספק" (deployment type) הוא יעבוד.

## ההגדרות המדויקות

**Azure AI Foundry Hub, Hub של Foundry** הוא משאב Azure ברמת resource group. ה-Hub מחזיק:
- חיבורים משותפים (shared connections): endpoint URLs, מפתחות API, storage accounts
- managed virtual network, חומת אש ומדיניות outbound
- מדיניות IAM ו-managed identity שחלה על כל ה-Projects שמתחתיו
- quotas משותפות למחשוב

**Azure AI Foundry Project, פרויקט Foundry** הוא namespace מבודד בתוך ה-Hub. לכל Project:
- storage account משלו ו-blob container נפרד
- managed identity ייחודית (לא חולקת עם Projects אחרים)
- deployments, flows ו-evaluations משלו
- connection string נפרד שהקוד משתמש בו (project connection string)

כל הקוד שכותבים עובד דרך ה-Project, לא ישירות דרך ה-Hub.

**Model Catalog, קטלוג מודלים** הוא הממשק ב-Foundry שמציג מודלים משלושה מקורות:
- **Azure OpenAI**: GPT-4o, GPT-4o mini, o1-preview, text-embedding-ada-002, DALL-E, Whisper ואחרים.
- **שותפים (Partner Models)**: Meta Llama 3 ו-3.1, Mistral Large, Cohere Command R, Phi-3 ואחרים.
- **Hugging Face**: אלפי מודלים פתוחים שפרוסים כ-managed compute בתשתית Azure.

עבור כל מודל בקטלוג מוצגים: benchmark (MMLU, MT-Bench וכד'), תמחור לאלף טוקנים, גודל context window, הסכם שימוש ואפשרויות deployment.

**Deployment type, סוג פריסה** קובע את אופן ניתוב הבקשות ואת מודל החיוב:

| סוג | ניתוב | חיוב | מתי לבחור |
|---|---|---|---|
| Global Standard | multi-region (Azure בוחר) | לפי טוקן | ברירת מחדל, רוב הפרויקטים |
| Data Zone Standard | בתוך US או EU בלבד | לפי טוקן | דרישות Data Residency גיאוגרפיות |
| Standard (regional) | region יחיד שבחרת | לפי טוקן | שליטה מלאה על מיקום הנתונים |
| Provisioned Throughput (PTU) | לפי בחירה | לפי שעה, גם ללא שימוש | עומס גבוה ויציב, latency צפוי |

## דוגמה מחושבת

**תרחיש**: chatbot לתמיכה בלקוחות של חברה אירופית.
- פנייה ממוצעת: 4,000 טוקנים (שאלה + היסטוריה + תשובה)
- עומס: כ-20 בקשות בשנייה בשעות שיא, 2 בשנייה בשאר הזמן
- דרישה: נתוני הלקוחות לא יעזבו את האיחוד האירופי

**בחירות**:
1. **מודל**: GPT-4o mini. מספיק לפעולות תמיכה (מיון, ניסוח, חיפוש), זול משמעותית מ-GPT-4o.
2. **Deployment type**: Data Zone Standard (EU). עונה על Data Residency בלי לוותר על גמישות של pay-as-you-go.
3. **PTU?** לא. העומס לא-אחיד; Global/DataZone Standard יהיו זולים יותר בממוצע.

**נתיב בפורטל**:
Foundry Portal → בחר Hub → בחר Project → Deployments → New Deployment → בחר מודל מהקטלוג → בחר deployment type → Deploy.

## המקרה שמפיל את האינטואיציה

PTU נראה "בטוח" כי מובטח throughput. אך PTU גובה לפי שעה גם ב-zero traffic. פרויקט proof-of-concept שפורס PTU ל-3 חודשים ולא מגיע ל-40% utilization שורף את כל יתרון העלות. Global Standard עלול להיות זול פי 3 עד 5 לפרויקט לא-אחיד. PTU רלוונטי רק כשה-utilization גבוהה ויציבה.

## טעויות נפוצות

**בחירת GPT-4o כשמספיק GPT-4o mini**. ההבדל בעלות הוא בדרך כלל פי 10 ומעלה לאותה משימה. התחל מ-mini וקדם מעלה רק עם benchmark.

**פריסה ישירות ב-Hub ולא בתוך Project**. deployments חייבים לחיות בתוך Project; פריסה ב-Hub אינה אפשרות.

**קנייה של PTU לפרויקט ניסיון**. PTU מתאים לתעבורה יציבה ומאסיבית. לפיילוט, Global Standard ומדידה ראשונה.

**נחת ש-Hugging Face endpoint ו-Azure OpenAI endpoint זהים**. מודל מ-Hugging Face פרוס כ-managed compute ונגיש דרך inference endpoint ייחודי, לא דרך azure.openai.com.

## מתי זה לא משנה

אם האפליקציה קוראת ישירות ל-Azure OpenAI REST API ואינה צריכה evals, prompt flows, agents או multi-model orchestration, ניתן לעבוד ישירות עם Azure OpenAI resource ובלי Foundry Project. Foundry רלוונטי כשצריך ניהול מחזור חיים, שיתוף פעולה בין צוותים, ניטור ו-content filters ממוסדים.

## חיבור

יחידה זו פותחת את M5: AI-103 Engineer. היא הבסיס ל-m5-deployment-cicd (כיצד מאטמים Pipeline של פריסה) ול-m5-identity-rbac (Managed Identity, RBAC ו-private networking בתוך ה-Project).

```quiz
{"id":"u-m5-foundry-model-selection-q1","tree":"ops","skill":"azure-foundry","q":"חברה אירופית דורשת שהנתונים יישארו בתחום ה-EU. איזה deployment type ב-Azure AI Foundry מתאים?","options":["Global Standard","Data Zone Standard","Provisioned Throughput (PTU)","Standard (East US)"],"answer":1,"explain":"Data Zone Standard מנתב בקשות בתוך גיאוגרפיה אחת (US או EU בלבד) ועונה על דרישות Data Residency. Global Standard עשוי לנתב מחוץ ל-EU."}
```

```quiz
{"id":"u-m5-foundry-model-selection-q2","tree":"ops","skill":"azure-foundry","q":"מהו ההבדל הארגוני בין Hub ל-Project ב-Azure AI Foundry?","options":["Hub ו-Project הם שמות נרדפים לאותו משאב","Hub מחזיק compute, connections ומדיניות IAM משותפים; Project הוא namespace מבודד בתוך Hub","Project מחזיק את ה-compute; Hub הוא namespace","Hub שייך למנוי; Project שייך ל-resource group"],"answer":1,"explain":"Hub הוא שכבת השיתוף (compute, connections, IAM); Project הוא namespace מבודד עם storage, managed identity ו-deployments משלו. הקוד עובד תמיד דרך Project."}
```

```concepts
{"items":[{"id":"foundry-hub","t":"Azure AI Foundry Hub","he":"Hub של Foundry","d":"משאב Azure המחזיק compute, connections ומדיניות IAM משותפת לכמה Projects.","rel":["foundry","foundry-project"]},{"id":"foundry-project","t":"Azure AI Foundry Project","he":"פרויקט Foundry","d":"namespace מבודד בתוך Hub עם storage, managed identity ו-deployments משלו; נקודת הכניסה בקוד.","rel":["foundry-hub","deployment-types"]},{"id":"model-catalog","t":"Azure AI Foundry Model Catalog","he":"קטלוג מודלים","d":"ממשק ב-Foundry לסינון והשוואת מודלים מ-Azure OpenAI, שותפים (Meta, Mistral, Cohere, Phi) ו-Hugging Face לפני פריסה.","rel":["foundry","deployment-types"]}]}
```
