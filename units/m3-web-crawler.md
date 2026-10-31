# סורק אתרים
האינטרנט הוא גרף; כל דף הוא קודקוד, כל קישור הוא קשת, ו-web crawler הוא BFS שמעולם לא יסתיים.

## מה תדע בסוף
תוכל לתאר ארכיטקטורת web crawler מבוזרת בראיון system design: הרכיבים המרכזיים, מדוע כל אחד קיים, ואיפה הבעיות הלא-ברורות מסתתרות.

## האינטואיציה
דמיין שאתה רוצה לקרוא כל ספר בספריית אלכסנדריה, אבל כל ספר מפנה לספרים אחרים, וחלק מהמדפים הם מראות שמשקפות את עצמן. תתחיל עם רשימת ספרים ראשונים, תקרא כל אחד, תרשום את כל ההפניות שמצאת, ותמשיך. כך בדיוק עובד crawler.

הגרף הזה הוא גרף **מכוון, ממש ענק, ולא נראה מראש**. אינך יודע מה כתוב בצומת עד שהגעת אליה. ולכן האתגר האמיתי אינו האלגוריתם אלא הנדסת התהליך: איך שומרים על הצומת הבאה תמיד זמינה, בלי לבקר צומת פעמיים, בלי להרוס את השרת שאתה מבקר.

<svg viewBox="0 0 320 180" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="מחזור הזחילה">
  <rect x="10" y="70" width="70" height="40" rx="6" stroke-width="1.5"/>
  <text x="45" y="95" text-anchor="middle" font-size="10" fill="currentColor">Frontier</text>
  <rect x="125" y="20" width="70" height="40" rx="6" stroke-width="1.5"/>
  <text x="160" y="45" text-anchor="middle" font-size="10" fill="currentColor">Fetcher</text>
  <rect x="125" y="120" width="70" height="40" rx="6" stroke-width="1.5"/>
  <text x="160" y="145" text-anchor="middle" font-size="10" fill="currentColor">Parser</text>
  <rect x="240" y="70" width="70" height="40" rx="6" stroke-width="1.5"/>
  <text x="275" y="95" text-anchor="middle" font-size="10" fill="currentColor">Storage</text>
  <path d="M80 82 L125 35" stroke-width="1.2" marker-end="url(#arr)"/>
  <path d="M80 98 L125 135" stroke-width="1.2" marker-end="url(#arr)"/>
  <path d="M195 35 L240 82" stroke-width="1.2" marker-end="url(#arr)"/>
  <path d="M195 135 L240 98" stroke-width="1.2" marker-end="url(#arr)"/>
  <path d="M160 160 Q160 170 45 170 Q20 170 20 150 L20 110" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#arr)"/>
  <defs>
    <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
</svg>

## ההגדרות המדויקות

**URL Frontier, תור הכתובות** הוא מבנה הנתונים המרכזי: רשימת ממתינים של URLs שטרם ביקרנו. בגרסה פשוטה זה FIFO. בגרסה ייצורית זה תור עדיפויות מבוזר, שמדרג לפי עדיפות הדף (PageRank משוקלל) ולפי מדיניות הנימוס.

**Seed URLs** הם נקודות ההתחלה שמוזנות ידנית. לגוגל אלה מיליארדי כתובות; לcrawler ממוקד אולי עשרות.

**Fetcher, המוריד** הוא הרכיב שפונה ל-HTTP, מחזיר את ה-HTML, ומשמר את ה-response. כל fetcher הוא worker בלתי-תלוי; מאות עד אלפי workers רצים במקביל.

**DNS Cache, מטמון שמות** נחוץ כי כל בקשה חדשה ל-DNS לוקחת 20-100ms. crawler ללא DNS cache ישבות על latency פשוטה. כל worker מנהל מטמון מקומי; לעתים קיים גם Redis משותף.

**HTML Parser, מנתח ה-HTML** חולץ את כל תגיות `<a href="...">` ומייצר רשימת URLs גולמיים שצריך לנרמל.

**URL Normalization, נרמול כתובות** הופך `HTTP://Www.Example.COM/foo/../bar?z=1&a=2` לצורה סטנדרטית `http://www.example.com/bar?a=2&z=1`. בלי נרמול אותו דף ייראה כעשרות URLs שונים.

**Bloom Filter, פילטר בלום** הוא מבנה הסתברותי בגודל קבוע שיכול לענות "כבר ראיתי URL זה?" ב-O(1) ובזיכרון זעיר. המחיר: false positives אפשריים (אחוז קטן מ-URLs חדשים יידחו בשגגה). בפועל זה מקובל.

**robots.txt** הוא קובץ טקסט בשורש כל אתר שמגדיר אילו דפים מותרים לסריקה. crawler מכובד תמיד מוריד ומציית. דוגמה: `User-agent: * Disallow: /private/`.

**Politeness Policy, מדיניות נימוס** קובעת את קצב הבקשות לכל domain. המטרה: לא להציף שרת יחיד. כלל אצבע: המתן לפחות 1 שנייה בין בקשות לאותו host.

## דוגמה מחושבת

נניח שאנחנו בנים crawler פשוט שמתחיל ב-`https://example.com`.

**שלב 1 - אתחול:**
Frontier: `[example.com]`. Visited set ריק.

**שלב 2 - משיכה:**
Worker 1 שולף `example.com` מהתור. בודק DNS cache, מוריד את ה-HTML. מקבל `<a href="/about">` ו-`<a href="https://news.example.com/2026">`.

**שלב 3 - נרמול ובדיקת כפילויות:**
Parser מייצר: `https://example.com/about` ו-`https://news.example.com/2026`. הפילטר בודק שניהם. שניהם חדשים. מוסיפים לפילטר ולתור.

**שלב 4 - robots.txt:**
לפני שworker 2 פונה ל-`news.example.com` הוא מוריד `news.example.com/robots.txt`. אם `/2026` אסור, הurl נדחה.

**שלב 5 - מדיניות נימוס:**
הworker מחכה 1 שניה לפני הבקשה הבאה ל-`news.example.com`.

**שלב 6 - שמירה:**
ה-HTML הגולמי וה-metadata (URL, timestamp, status code) נשמרים ב-object storage (S3-style). ה-index ב-key-value store.

## המקרה שמפיל את האינטואיציה

**Spider Trap, מלכודת עכביש** הוא URL space אינסופי שנראה לגיטימי. דוגמה קלאסית: לוח שנה שמייצר `/calendar/2026/10/31/2026/10/31/...` לכל לחיצה. BFS נאיבי יוסיף מיליוני URLs וידשדש לנצח.

פתרונות:
1. **עומק מקסימלי** - לא נכנסים לdepth מעל N מ-seed URL.
2. **ספירת מקטעי path** - URL עם יותר מ-10 פסיקים נדחה.
3. **גילוי כפילויות בתוכן** - hash של ה-HTML מזהה דפים זהים גם כשה-URL שונה (SimHash).

```quiz
{"id":"u-m3-web-crawler-q1","tree":"systems","skill":"system-design","q":"Bloom filter משמש ב-web crawler בעיקר כדי:","options":["לשמור את ה-HTML הגולמי של הדפים","לדעת בזמן O(1) אם URL כבר נסרק, בזיכרון קטן","לנתח קישורים בתוך דפי HTML","לנהל תור עדיפויות בין domains"],"answer":1,"explain":"Bloom filter הוא מבנה הסתברותי שמוסיף ובודק URLs בO(1) ובשבריר מהזיכרון שנדרש לשמירת כל URL. המחיר הוא false positives נדירים, שמקובלים ב-web crawling."}
```

## טעויות נפוצות

**לשכוח URL normalization.** `http://example.com/foo` ו-`HTTP://EXAMPLE.COM/foo/` ו-`http://example.com/bar/../foo` הם אותו URL. בלי נרמול הcrawler יבקר אותו דף פעמים רבות.

**להתעלם מ-robots.txt.** בנוסף לבעיה מוסרית, אתרים רבים מוסיפים honeypot URLs שמוקעים ל-blacklist כל IP שביקר בהם.

**לא להגביל קצב לפי domain.** שליחת 100 בקשות לשניה ל-`small-blog.com` תעצור אותו. גם אם לא, זה anti-social.

**להשתמש ב-visited set בזיכרון לבד.** עבור מיליארד URLs, set רגיל ידרוש עשרות GB. Bloom filter של 1GB עם שגיאה 0.1% הוא הפתרון הנכון.

**להתעלם מ-spider traps.** URL space יכול להיות אינסופי. בלי הגבלת עומק ובדיקת כפילות תוכן, הcrawler ישבות לנצח.

**לא לתת עדיפות ל-seed domains.** crawler שמתחיל מ-hacker-news וגולש חופשי יסרוק spam sites לפני שיחזור לתוכן רלוונטי. תור עדיפויות (לא FIFO) חיוני.

## מתי זה לא משנה

**סריקה ממוקדת (Focused Crawling)** של פחות מ-1 מיליון דפים לא מצריכה את רוב המורכבות. שורה אחת של Python עם `requests` ו-`BeautifulSoup` ו-set פשוט תעבוד. הבנית את הגרסה המבוזרת רק כשיש לך evidence שצריך.

**ב-system design interview:** אל תתחיל עם Bloom filter ו-SimHash. תתחיל עם "מה הdataset?" ו-"כמה QPS נצפה?". אם הJob הוא לסרוק 10,000 דפים ביום - מכונה אחת מספיקה. Scale-first הוא trap נפוץ בראיונות.

**מול Scrapy/Playwright:** כאשר המטרה היא scraping של אתר ספציפי ולא crawling כללי, כלים כמו Scrapy (Python) או Playwright מתאימים יותר. הם מטפלים ב-JavaScript rendering, cookies, ו-pagination. Web crawler כללי אינו scraper.

## חיבור

היחידה הזו שייכת לאשכול **system design mastery** (sysdesign). כל שאלת system design בראיון עוקבת אחרי אותו מבנה:

1. בהרת scope (מה crawl, כמה URLs, freshness SLA)
2. תכנון מרכיבים עיקריים (Frontier, Fetcher, Parser, Storage)
3. deep-dive על הרכיב הכי אינטרסנטי (בדרך כלל: deduplication או politeness)
4. bottleneck ו-scaling (איפה ה-bottleneck? מה אופקי ומה לא?)

היחידה הבאה שפותחת את אותו שריר: **Design a notification system** שבה תדון ב-fan-out patterns ו-message queues.

```concepts
{"items":[{"id":"url-frontier","t":"URL Frontier","he":"תור הכתובות","d":"תור עדיפויות מבוזר של URLs שטרם נסרקו; הלב של כל web crawler","rel":["politeness-policy","bloom-filter"],"node":"sysdesign"},{"id":"bloom-filter","t":"Bloom Filter","he":"פילטר בלום","d":"מבנה הסתברותי O(1) לבדיקת שייכות בסט; false positives אפשריים, false negatives אינם; משמש לdeduplication בcrawler","rel":["url-frontier","url-normalization"],"node":"sysdesign"},{"id":"spider-trap","t":"Spider Trap","he":"מלכודת עכביש","d":"URL space אינסופי כמו לוח שנה דינמי שמוביל crawler ללולאה אינסופית","rel":["url-frontier","url-normalization"],"node":"sysdesign"},{"id":"robots-txt","t":"robots.txt","he":"קובץ הרשאות לסורקים","d":"קובץ טקסט בשורש domain שמגדיר אילו paths מותרים לסריקה אוטומטית","rel":["politeness-policy"],"node":"sysdesign"},{"id":"politeness-policy","t":"Politeness Policy","he":"מדיניות נימוס","d":"הגבלת קצב בקשות לאותו domain כדי לא להציף שרתים; בדרך כלל 1 שנייה מינימום בין בקשות","rel":["url-frontier","robots-txt"],"node":"sysdesign"},{"id":"url-normalization","t":"URL Normalization","he":"נרמול כתובות","d":"המרת URL לצורה קנונית: lowercase scheme+host, הסרת port דיפולטי, מיון query params","rel":["url-frontier","bloom-filter"],"node":"sysdesign"}]}
```
