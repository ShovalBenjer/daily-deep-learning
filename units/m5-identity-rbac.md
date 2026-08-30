# זהות מנוהלת והרשאות

בלי Managed Identity, כל קוד שקורא ל-Azure OpenAI מחזיק מפתח שיכול לדלוף. עם Managed Identity, Azure הוא ה"ארנק" - הקוד לא נוגע במפתחות בכלל.

## מה תדע בסוף

תדע להפעיל Managed Identity על App Service, להקצות לה תפקיד RBAC מתאים, ולכתוב קוד Python שמאמת ל-Azure OpenAI בלי מפתחות. תכיר גם מתי Private Endpoint נדרש ואיך הוא משתלב בתמונה.

## האינטואיציה

דמיין כרטיס מלון: המלון לא נותן לך את מפתח הראשי של כל החדרים. הוא מנפיק כרטיס חכם שתקף לחדר שלך בלבד, לזמן שהוגדר מראש. ברגע שצ'קאאוט, הכרטיס מבוטל אוטומטית.

**Managed Identity** היא כרטיס שהמלון (Azure) מנפיק לחדר עצמו, לא לאורח. ה-App Service, ה-Container App, ה-VM - כל אחד מהם מקבל "כרטיס" שמזהה אותו באופן ייחודי. RBAC מגדיר אילו דלתות הכרטיס הזה יכול לפתוח, ו-Private Endpoint מוסיף מנהרה מאובטחת כך שהתנועה לא עוברת כלל על האינטרנט הציבורי.

## ההגדרות המדויקות

**Managed Identity, זהות מנוהלת** היא עיקרון Service Principal שנוצר ומנוהל על ידי Azure עצמו, ללא צורך בסיסמה או ב-client secret. שני סוגים:

- **System-assigned identity**: נוצרת כשמפעילים אותה על resource (כגון App Service) ונמחקת כאשר ה-resource נמחק. 1:1 עם ה-resource. נוחה לשירותים שאינם משותפים.
- **User-assigned identity**: משאב Azure עצמאי שניתן להקצות לכמה resources. שורדת גם אחרי מחיקת resource. מתאימה כשכמה שירותים צריכים את אותן הרשאות.

**RBAC, בקרת גישה מבוססת תפקיד** (Role-Based Access Control) מגדיר מה הזהות מורשית לעשות. ב-Azure AI Foundry ו-Azure OpenAI, שלושת התפקידים הרלוונטיים:

| תפקיד | מה הוא מאפשר | מתי |
|---|---|---|
| `Cognitive Services User` | קריאות inference בלבד (generate, embed) | שירות בפרוד |
| `Azure AI Developer` | פריסה, ניהול ומבחנים | pipeline CI/CD |
| `Contributor` / `Owner` | ניהול ה-resource עצמו | ניהול תשתית בלבד |

**Scope, היקף ההקצאה** קובע על אילו resources חל התפקיד:
- ברמת resource ספציפי (הכי מצומצם) - מומלץ בפרוד
- ברמת resource group - כל resources בקבוצה
- ברמת subscription - הכל; יש לבחור בכך רק בצורה מכוונת

**Private Endpoint, נקודת קצה פרטית** מקצה לשירות Azure (כגון Azure OpenAI) כתובת IP פרטית בתוך ה-VNet שלך. כל הטראפיק עובר על גבי Microsoft backbone ולא יוצא לאינטרנט הציבורי. מחייב הגדרת DNS פרטי כדי שהשם (`my-resource.openai.azure.com`) יפתור לכתובת הפרטית.

## דוגמה מחושבת

**תרחיש**: App Service ב-Python צריכה לקרוא ל-Azure OpenAI ללא מפתחות.

**שלב 1**: הפעל system-assigned identity על ה-App Service:

```bash
az webapp identity assign \
  --name my-app \
  --resource-group my-rg
# פלט כולל principalId: "aabbcc11-..."
```

**שלב 2**: הקצה תפקיד `Cognitive Services User` לאותה identity, ברמת resource הספציפי של Azure OpenAI:

```bash
PRINCIPAL_ID="aabbcc11-..."
OPENAI_RESOURCE_ID="/subscriptions/SUB/resourceGroups/my-rg/providers/Microsoft.CognitiveServices/accounts/my-openai"

az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Cognitive Services User" \
  --scope "$OPENAI_RESOURCE_ID"
```

**שלב 3**: קוד Python ללא מפתחות:

```python
from azure.identity import ManagedIdentityCredential
from openai import AzureOpenAI
from azure.core.credentials import get_bearer_token_provider

credential = ManagedIdentityCredential()
token_provider = get_bearer_token_provider(
    credential, "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(
    azure_endpoint="https://my-openai.openai.azure.com/",
    azure_ad_token_provider=token_provider,
    api_version="2024-02-01",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "שלום"}],
)
print(response.choices[0].message.content)
```

הקוד לא מחזיק מפתח בשום מקום. כשה-App Service מריצה אותו, היא מאמתת דרך הזהות המנוהלת שלה ומקבלת טוקן קצר-חיים אוטומטית.

## המקרה שמפיל את האינטואיציה

הקצאת התפקיד הצליחה, הקוד פרוס, אבל המערכת עדיין מקבלת 401. שלושה גורמים נפוצים:

1. **scope שגוי**: התפקיד הוקצה ב-resource group level, אבל ה-Azure OpenAI resource נמצא ב-resource group שונה. הקצאה ב-parent לא "מסתננת" לבן ברמה גבוהה יותר.
2. **שגיאת propagation**: Azure מתעכב עד 5 דקות בהפצת role assignments. בדיקה מיד אחרי ה-assign עשויה להיכשל בצורת 403 זמנית.
3. **DefaultAzureCredential בפיתוח**: בסביבת פיתוח מקומית, `DefaultAzureCredential` מנסה שיטות אימות לפי סדר קבוע (סביבה, Workload Identity, Managed Identity, IDE, CLI). בלפטופ בלי Azure תקבל 401 כי managed identity אינה זמינה; השתמש ב-`DefaultAzureCredential` בפרוד ובסביבה מקומית הסתמך על `az login`.

## טעויות נפוצות

**אחסון API key ב-`.env` או ב-environment variable**. הסוד יכול לדלוף בלוגים, ב-crash dump, בקונסולת Azure Portal שמוצגת לצוות. Managed Identity מאפשרת לבטל הרשאות ממקום אחד, ללא rotate מפתחות.

**הקצאת `Contributor` או `Owner` כשמספיק `Cognitive Services User`**. הפרה של עיקרון least privilege. Contributor יכול למחוק את ה-resource עצמו; Cognitive Services User לא.

**בלבול בין שני הסוגים**: system-assigned identity נמחקת עם ה-resource, ולכן אינה מתאימה כשאתה רוצה לעבור שרות ולשמור הרשאות. user-assigned שורדת את ה-resource ומאפשרת rollout הדרגתי.

**Private Endpoint ללא DNS**. כשמוסיפים Private Endpoint, Azure OpenAI ממשיך לפתור לכתובת ציבורית עד שמקנפגים Private DNS Zone ומקשרים אותה ל-VNet. בלי DNS, הבקשות יוצאות לאינטרנט הציבורי אפילו שה-endpoint קיים.

## מתי זה לא משנה

בפיתוח מקומי, managed identity לא זמינה. ניתן להשתמש ב-`az login` ו-`DefaultAzureCredential` ייקח את ה-CLI credentials. לפרויקט ניסיון פנימי שאינו עולה לפרוד, API key ב-Azure Key Vault (ולא ב-`.env`) הוא פשרה סבירה. Managed Identity הופכת קריטית ברגע שהשירות עולה לפרוד ועוסק בנתוני לקוחות.

## חיבור

יחידה זו ממשיכה מ-m5-foundry-model-selection (Hub, Project, managed identity שנזכרה שם) ומ-m5-deployment-cicd (workload identity federation ב-pipeline). היא פותחת את m5-monitoring-drift: יומני Entra ID מתעדים כל קריאה של managed identity ומאפשרים audit trail מלא.

```quiz
{"id":"u-m5-identity-rbac-q1","tree":"ops","skill":"azure-foundry","q":"מהו ההבדל העיקרי בין system-assigned managed identity ל-user-assigned managed identity ב-Azure?","options":["System-assigned ניתנת לשיתוף בין כמה resources; user-assigned קשורה למשאב יחיד","System-assigned נוצרת עם המשאב ונמחקת כשהוא נמחק; user-assigned היא משאב עצמאי שניתן לשתף ושורדת מחיקת resource","User-assigned חופשית; system-assigned בתשלום","System-assigned מאובטחת יותר כי האישורים אינם ניתנים להעברה"],"answer":1,"explain":"System-assigned identity חיה וגוועת עם ה-resource ולא ניתנת לשיתוף. User-assigned היא משאב Azure עצמאי: ניתן להקצות אותה לכמה resources ולשמור אותה גם אחרי מחיקת resource ספציפי."}
```

```quiz
{"id":"u-m5-identity-rbac-q2","tree":"ops","skill":"azure-foundry","q":"איזה תפקיד RBAC מספיק כדי לבצע קריאות inference ל-Azure OpenAI מ-App Service, בלי יכולת לנהל או למחוק את ה-resource?","options":["Owner","Contributor","Cognitive Services User","Azure AI Developer"],"answer":2,"explain":"Cognitive Services User מעניקה גישת data plane בלבד: שליחת בקשות generate ו-embed. Contributor ו-Owner מעניקות גם גישת control plane (ניהול, מחיקה, שינוי הגדרות), שזה יותר ממה שנדרש ומהווה הפרה של least privilege."}
```

```fillin
{"id":"u-m5-identity-rbac-f1","tree":"ops","skill":"azure-foundry","prompt":"כשמחברים App Service ל-Azure OpenAI בלי לאחסן מפתחות, מפעילים _____ על ה-App Service ומקצים לה תפקיד RBAC ברמת ה-resource.","answer":"Managed Identity","alt":["managed identity","system-assigned identity","זהות מנוהלת","managed-identity"],"explain":"Managed Identity היא Service Principal שמנוהל על ידי Azure עצמו, ללא צורך בסיסמה או client secret. הקוד מבקש טוקן מ-Azure IMDS ומקבל אותו אוטומטית כשרץ על compute מוכר בתוך Azure."}
```

```widget
{"type":"algviz","algo":"layer-stack","title":"RBAC Chain: צפה כיצד Identity, Role ו-Scope מתחברים לאישור גישה","layers":["Managed Identity","Role (Cognitive Services User)","Scope (resource)","Access Granted"]}
```

```concepts
{"items":[{"id":"managed-identity-types","t":"Managed Identity Types","he":"סוגי זהות מנוהלת","d":"System-assigned: נוצרת עם resource ונמחקת איתו, 1:1. User-assigned: משאב עצמאי הניתן לשיתוף ושורד מחיקת resource.","rel":["rbac-role-assignment","keyless-auth"],"node":"azure-core"},{"id":"rbac-role-assignment","t":"RBAC Role Assignment","he":"הקצאת תפקיד RBAC","d":"קישור בין identity (service principal/managed identity) לתפקיד (Cognitive Services User, Contributor) בהיקף scope מסוים (resource, resource group, subscription).","rel":["managed-identity-types","cognitive-services-user"],"node":"azure-core"},{"id":"cognitive-services-user","t":"Cognitive Services User","he":"משתמש שירותי קוגניציה","d":"תפקיד RBAC שמעניק גישת data plane בלבד ל-Azure Cognitive Services ו-Azure OpenAI: inference, embedding. ללא יכולת ניהול resource.","rel":["rbac-role-assignment","managed-identity-types"],"node":"azure-core"},{"id":"private-endpoint-ai","t":"Private Endpoint for Azure AI","he":"נקודת קצה פרטית ל-AI","d":"כתובת IP פרטית בתוך VNet לשירות Azure OpenAI/Foundry; מחייב Private DNS Zone. הטראפיק אינו עובר על האינטרנט הציבורי.","rel":["managed-identity-types"],"node":"azure-core"},{"id":"keyless-auth","t":"Keyless Authentication","he":"אימות ללא מפתח","d":"דפוס שבו compute ב-Azure מאמת לשירותים דרך Managed Identity + RBAC, ללא API keys או client secrets בקוד או ב-environment variables.","rel":["managed-identity-types","rbac-role-assignment"],"node":"azure-core"}]}
```
