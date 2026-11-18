# ניטור מדדים
כשהמערכת נשברת בשעה 03:00, ההבדל בין מינוט ולחכות עד הבוקר הוא האם מדדים זורמים לתוך מאגר שמחפש חריגות בזמן אמת.

## מה תדע בסוף
תוכל לתאר ארכיטקטורת מערכת ניטור מדדים מבוזרת בראיון system design: הרכיבים, זרימת הנתונים, ואיפה האתגרים האמיתיים מסתתרים.

## האינטואיציה

דמיין שכל שירות ברשת שלך הוא רופא שמודד דופק, לחץ דם וטמפרטורה כל שניה. לבד, כל מדידה חסרת ערך. ביחד, לאורך זמן, על פני אלפי שירותים, הן יוצרות את המפה שמראה איך הגוף מגיב כשאתה מכניס תנועה חדשה. בלי מפה כזו אתה מנחש.

**Metrics Monitoring, ניטור מדדים** הוא המערכת שאוספת מדידות מספריות מרובות מקורות, שומרת אותן בצורה יעילה לאורך זמן, ומאפשרת שאילתות וסיפים שמפעילים התראות.

ההבחנה הקריטית: metrics הן תמיד **נתוני סדרת-זמן, time-series data**. ערך + timestamp. זה לא כמו logs (טקסט חופשי) ולא כמו traces (עקיבות בקשה). כל אחד עונה על שאלה אחרת: metrics עונות "כמה?" ו"מה המגמה?".

## ההגדרות המדויקות

**Metric, מדד** הוא זוג (name, value) עם timestamp ורשת labels/tags. דוגמה: `http_requests_total{service="payment", status="200"} 4512 1748000000`.

**Metric Types, סוגי מדדים:**
- **Counter, מונה** עולה תמיד ולעולם לא יורד. סופרים בקשות, שגיאות, ביטים שהועברו. תמיד עובדים על ה-rate שלו, לא על הערך הגולמי.
- **Gauge, מד** יכול לעלות וגם לרדת. זיכרון בשימוש, מספר connections פעילים, טמפרטורת CPU.
- **Histogram, היסטוגרמה** מחלקת ערכים לדליים ומספרת כמה מדידות נפלו בכל דלי. שימושי ל-latency: "כמה בקשות לקחו 0-10ms? 10-50ms? 50-200ms?". מאפשר חישוב percentile (P99, P95).
- **Summary, סיכום** דומה ל-histogram אבל מחשב percentiles בצד ה-client. חישוב אחר, trade-offs שונים.

**Collection Model, מודל האיסוף:**
יש שני מודלים עיקריים.
**Pull model, משיכה**: הMentor (לרוב Prometheus) שולח בקשה HTTP ל-`/metrics` על כל שירות בזמן קבוע (כל 15 שניות). השירות צריך לחשוף endpoint מאומת. יתרון: Prometheus שולט על קצב ועל מה שנאסף. חיסרון: השירות חייב להיות נגיש לשאיחה.
**Push model, דחיפה**: שירות שולח מדדים לנקודת איסוף מרכזית (Collector) כשהם מוכנים. נוח לעבודות קצרות מועד (Lambda, batch jobs) שלא חיות מספיק זמן ל-pull.
בפועל מערכות גדולות משלבות: collectors מכינים buffers, Prometheus עושה pull מה-collectors.

**TSDB, מסד נתוני סדרת-זמן** (Time-Series Database) הוא הרכיב שמאחסן את כל המדדים. הוא מותאם לכתיבת timestamp+value ברצף, ולשאילתות לפי טווח זמן. דוגמאות: Prometheus TSDB (מקומי), InfluxDB, VictoriaMetrics, Thanos (Prometheus מבוזר עם S3).

**Cardinality, עוצמת מימד** = כמה ערכים שונים יש ל-label מסוים. `service` עם 1000 ערכים = cardinality 1000. כל צירוף ייחודי של labels יוצר time-series נפרד. זה האתגר המרכזי בביצועים.

**PromQL, שפת השאילתות של Prometheus** מאפשרת ביטויים כמו:
`rate(http_requests_total[5m])` = קצב בקשות ל-5 דקות אחרונות.
`histogram_quantile(0.99, rate(http_request_duration_bucket[5m]))` = P99 latency.

**Alerting Rule, כלל התראה** מוגדר בקובץ YAML ומחושב כל X שניות. אם תנאי PromQL מתקיים מעל סף זמן, alert manager שולח התראה (PagerDuty, Slack).

**Grafana, לוח הניהול** הוא שכבת ה-visualization: dashboards עם גרפים, מחובר ל-TSDB כמקור נתונים.

<svg viewBox="0 0 320 200" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="ארכיטקטורת ניטור מדדים">
  <rect x="10" y="80" width="60" height="30" rx="4" stroke-width="1.5"/>
  <text x="40" y="99" text-anchor="middle" font-size="9" fill="currentColor">Services</text>
  <rect x="10" y="130" width="60" height="30" rx="4" stroke-width="1.5"/>
  <text x="40" y="149" text-anchor="middle" font-size="9" fill="currentColor">Exporters</text>
  <rect x="130" y="90" width="60" height="30" rx="4" stroke-width="1.5"/>
  <text x="160" y="109" text-anchor="middle" font-size="9" fill="currentColor">Collector</text>
  <rect x="250" y="60" width="60" height="30" rx="4" stroke-width="1.5"/>
  <text x="280" y="79" text-anchor="middle" font-size="9" fill="currentColor">TSDB</text>
  <rect x="250" y="110" width="60" height="30" rx="4" stroke-width="1.5"/>
  <text x="280" y="129" text-anchor="middle" font-size="9" fill="currentColor">Alert Mgr</text>
  <rect x="250" y="160" width="60" height="30" rx="4" stroke-width="1.5"/>
  <text x="280" y="179" text-anchor="middle" font-size="9" fill="currentColor">Grafana</text>
  <path d="M70 92 L130 100" stroke-width="1.2" marker-end="url(#ar)"/>
  <path d="M70 142 L130 108" stroke-width="1.2" marker-end="url(#ar)"/>
  <path d="M190 100 L250 70" stroke-width="1.2" marker-end="url(#ar)"/>
  <path d="M190 105 L250 118" stroke-width="1.2" marker-end="url(#ar)"/>
  <path d="M310 90 Q320 175 310 175" stroke-width="1.2" marker-end="url(#ar)"/>
  <path d="M310 90 Q320 60 310 60" stroke-width="0"/>
  <defs>
    <marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
</svg>

## דוגמה מחושבת

נעצב מערכת ניטור ל-1000 microservices שמייצרים 1000 מדדים כל אחד.

**חישוב עומס הכתיבה:**
1000 services x 1000 metrics = 1,000,000 data points כל צעד.
עם pull interval של 15 שניות: 1,000,000 / 15 = כ-67,000 writes/sec.
כל data point הוא 16 bytes (timestamp int64 + value float64) + labels overhead.

**בחירת TSDB:**
Prometheus standalone מתמודד עם עד ~10M active time-series. עם 1000 services x 1000 metrics = 1M time-series, Prometheus יחיד עם SSD מספיק.
מעבר ל-10M time-series מחייב Thanos או VictoriaMetrics עם clustering.

**אחסון לאורך זמן:**
Prometheus שומר נתונים מקומית ל-15 יום כברירת מחדל. לאחסון ארוך-טווח Thanos שולח chunks ל-S3.
90 יום x 1M time-series x (sample כל 15s) = 90 x 86400/15 x 1M x 16 bytes כ-82 TB בשנה. עם דחיסה (Gorilla encoding, ~10:1 ratio): כ-8.2 TB. S3 עולה פחות מ-$200/חודש.

**Downsampling, דגימה מופחתת:**
נתונים ישנים לא צריכים רזולוציה של 15 שניות. אחרי 7 ימים: דגימה כל 5 דקות. אחרי 30 יום: כל שעה. חוסך ~20x אחסון ומקל על שאילתות היסטוריות.

**Alert setup:**
```yaml
- alert: HighErrorRate
  expr: rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 2m
  labels:
    severity: warning
```
הביטוי מחושב כל 15 שניות. אם האחוז עולה מעל 5% למשך 2 דקות רצופות, Alert Manager שולח לPagerDuty.

## המקרה שמפיל את האינטואיציה

**פיצוץ Cardinality, Cardinality Explosion.**

נניח שמוסיפים label של `user_id` למדד `http_request_latency`. בבת אחת במקום 1000 time-series יש 1000 services x 100,000 users = 100 מיליון time-series. Prometheus יקרוס.

כלל: **labels מתאימים לממדים שמספרם קטן וידוע מראש** (service, region, status_code, method). אף פעם לא user_id, session_id, trace_id או כל ערך עם cardinality בלתי-חסום.

אם צריך לנתח לפי user, זה domain של logs או traces, לא metrics.

זאת הסיבה שפרומתאוס מגביל את מספר ה-labels per metric ומאפשר הגדרת מגבלות cardinality ב-recording rules.

## טעויות נפוצות

**1. Offset על counter במקום rate.**
`http_requests_total` = 15,000. מה זה אומר? כלום. `rate(http_requests_total[5m])` = 50 req/sec. זה מידע. תמיד שאל rate על counter.

**2. Alert על כל שינוי קטן.**
התראה על "latency עלה ב-5ms" תוביל לעייפות מהתראות (alert fatigue). התראות צריכות לסמן דבר שדורש פעולה אנושית: חריגה מ-SLO, error rate מעל סף, שירות לא מגיב.

**3. לא להגדיר retention policy.**
שרתי Prometheus ללא policy ימלאו את הדיסק. תמיד הגדר `--storage.tsdb.retention.time=15d`.

**4. Labels שמשקפים את הפתרון ולא הבעיה.**
Label של `pod_name` בסביבת Kubernetes עם auto-scaling יוצר time-series חדש לכל pod שנולד ומת. בתוך שבוע יש עשרות אלפי time-series "מתות". עדיף label של `deployment` שיציב.

**5. Pull בלי service discovery.**
עם 1000 services ב-Kubernetes, לתחזק קובץ configuration ידני של כתובות הוא כסיפוס על עצב. חייבים Kubernetes service discovery (`kubernetes_sd_configs`) שמוצא endpoints אוטומטית.

## מתי זה לא משנה

מונוליט קטן עם 3 endpoints ו-5 משתמשים לא צריך Prometheus + Grafana. `healthcheck` פשוט, לוגים מובנים שנשלחים לCloudWatch, והתראה על error rate מספיקים.

Metrics monitoring מתחיל לתת ערך כשיש **יותר ממערכת אחת** (microservices, multi-region), **חוזי SLO** שצריך לאכוף, ו**צוות on-call** שצריך לאבחן במהירות. כלל אצבע: אם ה-MTTR שלך (Mean Time To Recovery) יותר ממה שאתה יכול לאפשר, metrics monitoring הוא ההשקעה הנכונה.

**Metrics לעומת Logs לעומת Traces** (the "three pillars of observability"):
- Metrics: "מה?" + "כמה?" ברמת מערכת. זול, מהיר, לא מפרט.
- Logs: "מה בדיוק קרה לבקשה X?" ברמת event. יקר, מפורט.
- Traces: "מה המסלול של בקשה דרך כל השירותים?" ברמת request. הכי יקר.
Metrics הם תמיד השלב הראשון לא כי הם הטובים ביותר אלא כי הם הכי זולים לצרוך בזמן אמת.

## חיבור

הרכיב הזה יושב בבלוק M3 של system design. קדמו לו יחידות על consistent hashing (שמשמש לחלוקת עומס בין Prometheus instances) ועל key-value stores (שהם הבסיס של TSDB). הוא מחבר ל-m3-ad-click-aggregation שם אנחנו פוגשים אתגר דומה של נפח גבוה עם דרישת latency נמוכה, ול-m5-monitoring-drift (AI-103) שדן במדדים ספציפיים לשירותי AI כמו drift detection וsafety metrics.

```quiz
{"id":"u-m3-metrics-monitoring-q1","tree":"systems","skill":"system-design","q":"שירות מחשוב מדווח על המדד http_requests_total. לאחר שעה הערך עומד על 36,000. מה המידע השימושי לאבחון?","options":["הערך 36,000 מצביע על עומס גבוה","rate(http_requests_total[5m]) מחושב על חלון 5 דקות אחרונות","הערך עלה מ-0 ל-36,000 כלומר יש בעיה","counter תמיד צריך לאפס כל שעה"],"answer":1,"explain":"Counter מייצג מונה מצטבר מאז הפעלת השירות. הערך הגולמי 36,000 לבדו חסר משמעות ללא הקשר. rate() מחשב את הקצב לשנייה על פני החלון שהגדרת, וזה המדד השימושי: כמה בקשות לשנייה עכשיו."}
```

```quiz
{"id":"u-m3-metrics-monitoring-q2","tree":"systems","skill":"system-design","q":"מה הסכנה בהוספת label של user_id למדד http_request_latency?","options":["הנתונים יהיו לא מדויקים","cardinality תהפוך לבלתי-מוגבלת ותקרוס את ה-TSDB","Prometheus לא תומך ב-label שנקרא user_id","latency לא ניתן לחלק לפי משתמש"],"answer":1,"explain":"כל צירוף ייחודי של labels יוצר time-series נפרד. עם 100,000 משתמשים x 1000 שירותים = 100 מיליון time-series פעילים. Prometheus ישתמש בזיכרון RAM עצום ויקרוס. Labels מתאימים לממדים שמספרם קטן וידוע: service, region, status_code. ניתוח לפי user הוא domain של logs."}
```

```fillin
{"id":"u-m3-metrics-monitoring-f1","tree":"systems","skill":"system-design","prompt":"מדד שמייצג את כמות החיבורים הפעילים לשרת DB בכל רגע נתון (יכול לעלות וגם לרדת) הוא מסוג ___","answer":"gauge","alt":["Gauge","GAUGE"],"explain":"Gauge (מד) הוא סוג המדד שיכול לעלות וגם לרדת. Counter רק עולה, Histogram מחלק לדליים, Summary מחשב percentiles. 'כמות חיבורים פעילים' הוא בדיוק gauge."}
```

```concepts
{"items":[{"id":"metrics-monitoring","t":"Metrics Monitoring","he":"ניטור מדדים","d":"מערכת לאיסוף, אחסון ושאילתות של time-series numerical data משירותים מרובים","rel":["tsdb","cardinality","promql"],"node":"sysdesign"},{"id":"tsdb","t":"TSDB","he":"מסד נתוני סדרת-זמן","d":"מסד נתונים מותאם לכתיבה וקריאה של ערכים עם timestamp ברצף; Prometheus, InfluxDB, VictoriaMetrics","rel":["metrics-monitoring"],"node":"sysdesign"},{"id":"cardinality","t":"Cardinality","he":"עוצמת מימד","d":"מספר הערכים הייחודיים של label; cardinality גבוהה = time-series רבות = עומס TSDB","rel":["metrics-monitoring","tsdb"],"node":"sysdesign"},{"id":"promql","t":"PromQL","he":"שפת שאילתות פרומתאוס","d":"שפת ביטויים לשאילתת time-series; rate(), histogram_quantile(), label_replace()","rel":["metrics-monitoring"],"node":"sysdesign"}]}
```
