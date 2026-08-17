# פריסה ו-CI/CD ב-Azure AI Foundry

קוד שלא פרוס אינו מוצר. פריסה אוטומטית ובטוחה של מודלי AI ב-Azure AI Foundry מחייבת pipeline מובנה ועיצוב מכוון של סביבות.

## מה תדע בסוף

תדע לבנות GitHub Actions workflow שפורס מודל ל-Azure AI Foundry, להפריד בין סביבות פיתוח וייצור באמצעות Projects שונים, ולהחליף תעבורה בין שתי versions של deployment בלי זמן השבתה.

## האינטואיציה

כשמפרסים אתר, הקוד עובר בשלוש תחנות: dev לפיתוח, staging לבדיקה, prod לצופה האמיתי. פריסת מודל AI עוקבת אחרי אותו מבנה בדיוק, עם הבדל אחד: במקום "לדחוף קוד" אתה "פורס endpoint". כל תחנה היא Azure AI Foundry Project נפרד עם connection string משלו, תחת אותה Hub. ה-pipeline הוא הגשר שמעביר את ה-deployment בין התחנות בצורה מבוקרת ואוטומטית.

## ההגדרות המדויקות

**Environment stage, שלב סביבה** הוא הפרדה בין Projects: project-dev לפיתוח שוטף, project-staging לאישור לפני שחרור, project-prod לתעבורה אמיתית. Projects שונים מבטיחים שבדיקות dev לא צורכות quota של prod ושגיאה בפיתוח לא מגיעה ללקוח. ל-Hub משותף מעל כולם, כך שה-IAM וה-networking מנוהלים פעם אחת.

**CI/CD pipeline, צינור שילוב ופריסה** הוא רצף אוטומטי שרץ בכל push לגיט. עבור Foundry הרצף הוא:
1. בדיקות יחידה ואמות את ה-prompt template
2. פריסה ל-project-dev ובדיקות integration
3. בהגעה ל-branch main, פריסה ל-project-prod

**אימות pipeline** ל-Azure נעשה דרך workload identity federation: ה-pipeline מקבל JWT קצר-חיים מ-GitHub ומחליפו בטוקן Azure ללא שמירת client secret. האלטרנטיבה הישנה היא service principal עם client secret שיפוג ומחייב rotate ידני.

**Traffic split, פיצול תעבורה** ב-Foundry: endpoint אחד יכול להחזיק שתי deployments בו-זמנית עם חלוקת אחוזים. גרסה 1.0 מקבלת 100%, בגרסה 2.0 מורידים ל-80%/20%, בודקים שגיאות, ואחר כך עוברים ל-0%/100%.

**Blue-green deployment, פריסה כחולה-ירוקה** הוא מקרה פרטי: שתי deployments פעילות במקביל, ה-swap הוא מיידי ל-100% ו-rollback אפשרי בלחיצה אחת אם משהו משתבש.

## דוגמה מחושבת

GitHub Actions workflow מינימלי לפריסה ל-Foundry:

```yaml
name: deploy-model
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Azure
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy model endpoint
        run: |
          az ml online-deployment create \
            --file deployment.yaml \
            --endpoint-name my-endpoint \
            --resource-group my-rg \
            --workspace-name project-prod \
            --all-traffic \
            --no-wait
```

בדיקת הסיום אחרי ה-deployment:

```bash
az ml online-deployment show \
  --name my-deployment \
  --endpoint-name my-endpoint \
  --resource-group my-rg \
  --workspace-name project-prod \
  --query "provisioning_state"
```

פלט מצופה כשהפריסה הצליחה:

```
"Succeeded"
```

`--no-wait` קריטי: פריסה ל-Foundry יכולה לקחת 5 עד 20 דקות, ובלעדיו ה-runner נחסם לכל אותו הזמן.

## המקרה שמפיל את האינטואיציה

שימוש ב-Project אחד לשתי סביבות נראה חסכוני. אבל quota של tokens-per-minute משותפת: בעומס dev גבוה, בקשות prod מתחילות לקבל 429 Too Many Requests. הפרדת Projects היא ה-isolation האמיתי של quota, לא רק הפרדה לוגית.

## טעויות נפוצות

**שימוש ב-client secret ב-pipeline.** הסוד יפוג ו-rotate מחייב עדכון ידני בכל ה-workflows שמשתמשים בו. workload identity federation הוא ה-zero-secret alternative הסטנדרטי ב-GitHub Actions.

**הרצת פקודת פריסה ללא `--no-wait`.** הפקודה סינכרונית ברירת המחדל: ה-runner נשאר פעיל עד סיום הפריסה. pipeline שפורס כמה endpoints ברצף, כל אחד 15 דקות, עלול לחצות את מגבלת 6 השעות של GitHub Actions runner בחינם.

**חיבור connection string של project-dev לקוד prod.** ה-connection string מכיל endpoint URL שמפנה לפרויקט ספציפי. החלפה שגויה שולחת את כל בקשות prod לסביבת הניסיון.

**הנחה שעדכון prompt flow אינו מחייב פריסה מחדש.** ב-Foundry כל שינוי ב-flow מגדיר גרסה חדשה שדורשת deployment מחדש. Flow אינו hot-reload.

## מתי זה לא משנה

פרויקט ניסוי עם קהל פנימי בלבד ומוצר שטרם שוחרר יכול לחיות ב-Project יחיד עם פריסה ידנית מהפורטל. ה-pipeline ו-blue-green מתחילים להיות קריטיים ברגע שיש תעבורה אמיתית ודרישה של uptime מעל 99%. ראיון טכני ישאל תמיד על ההפרדה הזו.

## חיבור

יחידה זו ממשיכה מ-m5-foundry-model-selection (Hub, Project, deployment types) ופותחת את m5-identity-rbac: service principal ו-workload identity הם יישום ישיר של RBAC ו-managed identity שנלמד שם.

```quiz
{"id":"u-m5-deployment-cicd-q1","tree":"ops","skill":"azure-foundry","q":"מה יקרה אם pipeline ב-GitHub Actions מריץ `az ml online-deployment create` ללא `--no-wait`?","options":["הפריסה תכשל כי ה-CLI מחייב async","ה-runner יחסם עד שהפריסה תסיים, עד 20 דקות ויותר","ה-deployment יסיים מיד ב-background ללא חסימה","Azure תבטל פריסה שלא נסיימה תוך 5 דקות"],"answer":1,"explain":"ללא --no-wait הפקודה סינכרונית: ה-runner נשאר תפוס עד להשלמת הפריסה. runner חינמי ב-GitHub Actions מוגבל ל-360 דקות, ופריסות מרובות ברצף יכולות לחצות את הגבול."}
```

```quiz
{"id":"u-m5-deployment-cicd-q2","tree":"ops","skill":"azure-foundry","q":"צוות רוצה לעדכן מודל GPT-4o ב-Azure AI Foundry לגרסה חדשה בלי השבתה. איזה מנגנון נכון?","options":["עדכון ה-deployment הקיים in-place","מחיקת ה-deployment הישן לפני יצירת חדש","פיצול תעבורה: deployment חדש ב-20%, ישן ב-80%, ואז swap הדרגתי ל-100%","יצירת Hub חדש לגרסה החדשה"],"answer":2,"explain":"Foundry תומך ב-traffic split בין שתי deployments על אותו endpoint. אפשר להעלות גרסה חדשה בהדרגה, לאמת ולהגיע ל-100% בלי השבתה. מחיקה ויצירה מייצרות downtime, ו-Hub חדש הוא עלות מיותרת."}
```

```fillin
{"id":"u-m5-deployment-cicd-f1","tree":"ops","skill":"azure-foundry","prompt":"כדי שה-pipeline יכיר את ה-endpoint של project-prod ויבדל אותו מ-project-dev, כל Foundry Project חייב לקבל _____ ייחודי שהקוד משתמש בו.","answer":"connection string","alt":["connection-string","endpoint URL","endpoint url","connection_string"],"explain":"כל Foundry Project מקבל connection string ייחודי שמכיל את ה-endpoint URL של הפרויקט. זו הסיבה שהפרדת Projects מבטיחה שקוד dev ו-prod מדברים עם endpoints נפרדים."}
```

```concepts
{"items":[{"id":"ai-cd-pipeline","t":"AI CI/CD Pipeline","he":"צינור שילוב ופריסה ל-AI","d":"רצף אוטומטי של בדיקות ופריסה שמוציא מודל AI מ-dev ל-prod, בדרך כלל דרך GitHub Actions עם azure/login ו-az ml CLI.","rel":["environment-stage","foundry-project"],"node":"azure-core"},{"id":"model-endpoint-swap","t":"Traffic Split and Blue-Green","he":"פיצול תעבורה ו-blue-green","d":"שתי deployments על endpoint אחד עם חלוקת אחוזים; swap מיידי ל-100% הוא blue-green עם rollback בלחיצה אחת.","rel":["ai-cd-pipeline","deployment-types"],"node":"azure-core"},{"id":"environment-stage","t":"Environment Stage Isolation","he":"בידוד שלבי סביבה","d":"Foundry Project נפרד לכל שלב (dev/staging/prod) כך שקוטה, תעבורה ו-connection strings של סביבות לא מתנגשות.","rel":["foundry-project","ai-cd-pipeline"],"node":"azure-core"}]}
```
