# ביקורת, מקור ואישורים ב-Azure AI Foundry

מודל שעונה נכון היום ומטעה מחר יעורר שאלה אחת: מי שינה מה ומתי, ומי אישר את זה.

## מה תדע בסוף

תדע להסביר את שלוש שכבות ה-governance של Azure AI Foundry (audit trail, provenance, change approval), להצביע על המקום שבו כל אחת נוצרת, ולתאר את זרימת האישור שמונעת ממודל להגיע ל-prod בלי סקירה שנייה.

## האינטואיציה

חשוב על מטבח של מסעדה שקיבלה תלונה על מנה. הדבר הראשון שהמנהל שואל: מי בישל? מתי? לפי איזה מתכון? זה **audit trail, נתיב ביקורת**: יומן פעולות עם חותם זמן וזהות. אחר כך הוא רוצה לדעת מאיפה הגיעו המרכיבים ובאיזה תאריך תוקף. זה **provenance, מקור**: הקישור בין תוצר לרכיביו. ולבסוף, כשמחליטים להחליף ספק בשר, לא נותנים לטבח לעשות זאת לבד. שני אנשים מאשרים. זה **change approval, אישור שינוי**.

Foundry מיישם את אותה משמעת: כל שינוי משאיר עקבה, כל תשובת מודל ניתנת לשחזור אחורה עד למקורות שהזינו אותה, ופריסות ל-prod עוברות דרך גייט של אישור. כשמישהו שואל "למה המערכת אמרה את זה?", התשובה חייבת להיות מוכיחה, לא מוזכרת מהזיכרון.

## ההגדרות המדויקות

**Audit trail, נתיב ביקורת** הוא סדרה כרונולוגית של רשומות של פעולות control-plane (יצירה, מחיקה, עדכון של resources) ו-data-plane (בקשות ותשובות של המודל). ב-Azure יש שני מקורות נפרדים:

- **Azure Activity Log**: כל פעולת control-plane על subscription, כולל "מי יצר deployment", "מי שינה RAI policy", "מי מחק endpoint". שמור לתשעים ימים כברירת מחדל, ללא תלות בהגדרות נוספות.
- **Diagnostic Settings**: הצינור שמפנה metrics ו-logs של המשאב עצמו (בקשות למודל, פילוח על ידי content filter, כשלים) ליעד: Log Analytics, Storage או Event Hub.

הפרדה זו חשובה: מי שינה את ה-policy מתועד ב-Activity Log ללא הגדרה, מה המודל ענה מתועד ב-Diagnostic Settings רק אם הפעלת זאת.

**Provenance, מקור** בהקשר של AI application הוא היכולת לענות על "איזה גרסה של מודל, איזה prompt template, ואיזה מסמכי context הפיקו את התשובה הזו". Foundry שומר שלושה שדות מזהים בכל בקשה שנרשמת:

- `deployment_name` ו-`model_version`: מזהה את ה-endpoint המדויק.
- `prompt_template_id`: הגרסה של ה-template מ-Prompt Flow.
- `retrieved_docs[]`: ב-RAG, רשימת document ids ו-chunk hashes שהוזרקו ל-context.

בלי שלוש אלה, "המודל טעה" הוא טענה שאי-אפשר לחקור. עם שלוש אלה, אפשר לשחזר את הריצה בסביבת בדיקה ולהריץ אותה עם אותם קלטים בדיוק.

**Change approval, אישור שינוי** הוא גייט שדורש חתימה של יותר מאדם אחד לפני שהתהליך מתקדם. ב-Foundry pipeline מיישם זאת דרך **GitHub Environments** או **Azure DevOps Environments** שדורשים required reviewers לפני שה-job שרץ ב-project-prod יכול להתחיל. עקרון four-eyes, ארבע עיניים, הוא הכלל שהאדם שכתב את השינוי אינו יכול להיות זה שמאשר אותו.

**Approval workflow לסוכן, זרימת אישור לסוכן** נדרשת כשסוכן מבצע פעולה בעולם האמיתי (שולח מייל, מבצע החזר כספי, כותב ל-DB). המנגנון הוא **human-on-the-loop**: הסוכן מפרסם את הפעולה המוצעת ל-queue, אדם רואה אותה, מאשר או דוחה, ורק אז ה-tool call מבוצע.

**Immutable log, יומן בלתי-ניתן-לשינוי** הוא נכס שקריטי לביקורת רגולטורית. ב-Azure Storage אפשר להפעיל **immutability policy** על container: לוגים שנכתבו לא ניתנים למחיקה או שינוי עד תום תקופת שמירה. זה מונע ממי שגרם לבעיה למחוק את עקבותיה.

## דוגמה מחושבת

**סצנריו:** לקוח פנימי מקבל תשובה שגויה על נוהל HR. הצוות צריך לענות: מה קרה, מי שינה משהו לאחרונה, מי אישר.

1. **שאילתה על Diagnostic Settings** ב-Log Analytics:

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.MACHINELEARNINGSERVICES"
| where TimeGenerated between (datetime(2026-08-24 09:00) .. datetime(2026-08-24 10:00))
| where properties_s contains "hr-policy-bot"
| project TimeGenerated, model_version_s, prompt_template_id_s, retrieved_docs_s
```

תוצאה לדוגמה:

```
TimeGenerated       model_version    prompt_template_id    retrieved_docs
2026-08-24 09:47    gpt-4o-2024-11   hr-answer-v3          ["hr-vac-2024.pdf#c7","hr-vac-2024.pdf#c8"]
```

2. הצוות רואה שה-context הכיל רק את מסמך 2024. הבודקים בודקים ב-Blob Storage את `hr-vac-2026.pdf` וגם הוא קיים. למה לא נבחר?

3. **שאילתה על Activity Log**:

```kusto
AzureActivity
| where OperationNameValue == "MICROSOFT.SEARCH/INDEXES/WRITE"
| where TimeGenerated > ago(7d)
| project TimeGenerated, Caller, Properties
```

תוצאה: לפני יומיים משתמש `bot-service-principal` דחף index חדש שהחליף את הישן. ה-ingestion pipeline שדחף את המסמך של 2026 עוד לא רץ.

4. **בדיקת אישור**: ה-pipeline של index write עבר דרך GitHub Environment `search-prod` עם required reviewer אחד. הרשומה של האישור נשמרת ב-GitHub Actions run history עם שם המאשר.

5. מסקנה: ה-audit trail הצביע על השינוי, ה-provenance הצביע על הפער בין המסמכים הקיימים לזה שהמודל ראה, ה-approval log מזהה את שני האנשים המעורבים. בלי שלוש השכבות, זה היה נראה כמו "hallucination".

## המקרה שמפיל את האינטואיציה

Diagnostic Settings לא מפעילים את עצמם. שירות Foundry חדש שהוקם על ידי הפעלת ה-portal מגיע ללא Diagnostic Settings פעילים. כלומר: כל בקשה שרצה בשבועיים הראשונים לא מותירה עקבות של data-plane. כשמישהו שואל "מה המודל ענה ב-15 באוגוסט", התשובה תהיה "אין נתונים". שווה יותר לוודא שההפעלה קיימת כחלק מ-infrastructure-as-code של ה-deployment עצמו, לא כמשימה נפרדת.

## טעויות נפוצות

**סמיכה על Activity Log לחקירת תוכן.** Activity Log מכיל רק פעולות control-plane. הוא יגיד "משתמש X שינה policy", אבל לא "המודל ענה Y ל-Z". לחקירת תוכן חייבים Diagnostic Settings שמפנים ל-Log Analytics.

**שמירת retention קצר מדי.** Log Analytics ב-default שומר 30 יום. חקירת bug ש-user מדווח עליו חודש אחרי הופעתו לא תמצא נתונים. Compliance regulations כמו GDPR או HIPAA דורשות retention ארוך יותר; יש להעביר לוגים ישנים ל-Storage עם immutability policy.

**אישור עצמי ב-pipeline.** GitHub Environment שהוגדר עם required reviewer, אבל האדם שדוחף את ה-commit הוא גם המאשר, מפר את עיקרון four-eyes. Environment protection rules של GitHub תומכות בהגדרה "prevent self-review" שחייבים להפעיל.

**שמירת prompts ותשובות בלי redaction.** לוגים של data-plane עשויים להכיל PII של משתמשים. שמירתם ב-Log Analytics ללא סינון היא הפרת פרטיות. Foundry תומך ב-inference data collection עם sampling ו-scrubbing rules שיש להגדיר לפני הפעלת ה-collection.

**סוכן שמבצע פעולות ללא approval workflow.** סוכן שכותב ל-CRM או שולח מייל צריך לעבור דרך queue של אישור אנושי לפחות עד שרמת ה-trust במודל נקבעה. פריסת סוכן autonomous ליישום חדש בלי human-on-the-loop היא הסיבה הראשונה לתקריות פומביות של AI agents ב-2025 ו-2026.

## מתי זה לא משנה

Sandbox אישי שאין לו משתמשים חיצוניים ואין לו קישור לנתונים רגישים יכול לרוץ בלי Diagnostic Settings ובלי approval workflow. ההשקעה של הגדרת שלוש השכבות הופכת להיות חיונית ברגע שיש user שאינו אתה, או ברגע שמידע רגיש עובר דרך המערכת. ראיון על הנדסת AI production תמיד ישאל על הפער בין prototype ל-audit-ready deployment; הידיעה שהגייטים האלו אינם אופציונליים היא סימן לכך שאתה מבין את הצד הרגולטורי של השדה.

## חיבור

יחידה זו ממשיכה מ-`m5-monitoring-drift` (מה קרה כשהמודל התחיל להתנהג שונה) ומ-`m5-identity-rbac` (מי הוא זה שביצע את הפעולה). היא פותחת את `m5-agent-approval` שמעמיק בזרימת ה-human-on-the-loop לסוכנים, ואת `m5-eval-fabrication` שסוגר את הלולאה עם evaluators שרצים כחלק מגייט האישור לפני שגרסה חדשה עוברת ל-prod.

```quiz
{"id":"u-m5-audit-provenance-q1","tree":"ops","skill":"azure-foundry","q":"A user reports that on 2026-08-24 the HR bot returned an outdated policy answer. Which log source is required to reconstruct WHICH prompt template and WHICH retrieved documents produced that specific answer?","options":["Azure Activity Log","Azure AD Sign-in logs","Log Analytics data populated via Diagnostic Settings on the Foundry resource","GitHub Actions run history"],"answer":2,"explain":"Activity Log records control-plane operations (who changed a policy or created a deployment), not model requests and responses. Sign-in logs cover identity events. GitHub Actions history covers deployment approvals. Only Diagnostic Settings piped to Log Analytics captures data-plane details like prompt_template_id and retrieved_docs[] required for provenance."}
```

```quiz
{"id":"u-m5-audit-provenance-q2","tree":"ops","skill":"azure-foundry","q":"Which control most directly enforces the four-eyes principle on a production model deployment?","options":["Enabling immutability policy on the Storage container that receives logs","Increasing Log Analytics retention to 365 days","Configuring a GitHub Environment with required reviewers and preventing self-review","Adding Prompt Shields to the deployment"],"answer":2,"explain":"Four-eyes means a second person must approve a change before it takes effect. GitHub Environments with required reviewers and self-review disabled implement exactly this gate for a deployment pipeline. Immutability protects logs from tampering afterwards. Retention affects investigation window. Prompt Shields are a data-plane safety layer, unrelated to change approval."}
```

```quiz
{"id":"u-m5-audit-provenance-q3","tree":"ops","skill":"azure-foundry","q":"תרחיש: סוכן autonomous שפרסת אתמול שלח מיילים שגויים ל-30 לקוחות. לפי כלל השיפוט של הקורס לפריסת סוכנים, איזו החלטת עיצוב הייתה מונעת את התקרית?","options":["הוספת content filter מחמיר יותר","הפעלת Prompt Shields על ה-endpoint","הכנסת human-on-the-loop approval queue לפעולות חיצוניות של הסוכן","בחירת מודל חזק יותר כמו gpt-4o במקום gpt-4o-mini"],"answer":2,"explain":"פעולה של סוכן על העולם האמיתי (שליחת מייל, החזר, כתיבה ל-CRM) חייבת לעבור דרך approval workflow לפחות עד שרמת trust מוכחת. כלל השיפוט של הקורס: אין agent autonomous מול נתוני לקוחות ללא human-on-the-loop. content filter ו-Prompt Shields מגינים מפני קלטים מזיקים אבל לא מפני החלטות שגויות של הסוכן, ומודל חזק יותר עדיין יכול לטעות."}
```

```fillin
{"id":"u-m5-audit-provenance-f1","tree":"ops","skill":"azure-foundry","prompt":"כדי שהחקירה של תקרית content תשחזר במדויק איזו גרסת prompt template שימשה, על ה-Diagnostic Settings לשמור את השדה _____ בכל רשומת בקשה.","answer":"prompt_template_id","alt":["prompt template id","prompt_template","template_id","templateid","promptTemplateId"],"explain":"Foundry רושם prompt_template_id בכל בקשה שנרשמת דרך inference data collection. השדה מזהה את הגרסה של ה-template ב-Prompt Flow ומאפשר להריץ מחדש את אותה בקשה בסביבת בדיקה עם אותו template בדיוק."}
```

```concepts
{"items":[{"id":"audit-trail","t":"Audit Trail","he":"נתיב ביקורת","d":"סדרה כרונולוגית של רשומות פעולה control-plane ו-data-plane עם חותם זמן וזהות; ב-Azure מפוצל בין Activity Log ל-Diagnostic Settings.","rel":["diagnostic-settings","provenance"],"node":"azure-core"},{"id":"provenance","t":"Provenance","he":"מקור","d":"היכולת לקשר תשובת מודל לגרסה מדויקת של deployment, prompt template ומסמכי context שיצרו אותה; דורש שדות מזהים בכל log של בקשה.","rel":["audit-trail","diagnostic-settings"],"node":"azure-core"},{"id":"change-approval","t":"Change Approval Gate","he":"גייט אישור שינוי","d":"גייט ב-pipeline שדורש חתימה של אדם שאינו יוצר השינוי לפני שה-deployment ממשיך ל-prod; ב-GitHub זה Environment עם required reviewers ו-prevent self-review.","rel":["ai-cd-pipeline","four-eyes"],"node":"azure-core"},{"id":"four-eyes","t":"Four-Eyes Principle","he":"עיקרון ארבע עיניים","d":"שני אנשים לפחות מעורבים בכל שינוי מבצעי: אחד יוצר, שני מאשר; מונע הצפה של שגיאה יחידה או של אדם יחיד עוין ל-prod.","rel":["change-approval"],"node":"azure-core"},{"id":"human-on-the-loop-approval","t":"Human-on-the-Loop Approval","he":"אישור אנושי בלולאה","d":"סוכן שמציע פעולה בעולם האמיתי מפרסם אותה ל-queue, ואדם מאשר או דוחה לפני שה-tool call מבוצע; חובה לפני פריסת agent autonomous מול נתוני לקוחות.","rel":["human-on-the-loop","change-approval"],"node":"azure-core"},{"id":"immutable-log","t":"Immutable Log","he":"יומן בלתי-ניתן-לשינוי","d":"container של Azure Storage עם immutability policy: לוגים שנכתבו לא ניתנים למחיקה או שינוי עד תום תקופת שמירה; דרישת compliance נפוצה.","rel":["audit-trail","diagnostic-settings"],"node":"azure-core"}]}
```
