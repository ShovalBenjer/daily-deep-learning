# מה עושה מנהל חבילות

כשאתה כותב `pip install requests` אתה מצפה שהקוד יעבוד כמה שניות אחר כך. מי עשה את כל הנסיעה לשרת, את האימות, את ההנחה בתיקיה הנכונה?

## מה תדע בסוף

תוכל להסביר מה מנהל החבילות עושה בשלבים, תכיר את PyPI, npm/bun ו-apt, ותדע מתי הסביבה הווירטואלית הכרחית ולמה הlockfile קריטי לצוות.

## האינטואיציה

דמיין חנות אפליקציות עבור קוד. אתה מחפש שם, לוחץ "התקן", והחנות מביאה את הגרסה המתאימה, בודקת שהיא לא מדורגת, ומורידה בנוסף את כל התלויות שלה. כל הגרסאות לא מתנגשות, כי כל פרויקט מקבל את אזור ההתקנה שלו.

זה בדיוק מה שעושה **package manager, מנהל חבילות**: אוטומציה של ארבעה שלבים שאחרת עשית ביד: מציאת הקוד, הורדתו, אימותו ומיקומו במקום שבו ה-interpreter מוצא אותו.

## ההגדרות המדויקות

**Package, חבילה**: ארכיב (בד"כ `.tar.gz` או `.whl`) שמכיל קוד, מטא-נתונים (`name`, `version`, `author`) ורשימת תלויות. ב-Python הפורמט הסטנדרטי הוא `wheel` (.whl).

**Registry, מרשם**: שרת מרכזי שמאחסן packages ונותן API לחיפוש ולהורדה.
- Python: **PyPI** (pypi.org)
- JavaScript: **npmjs.com**
- Debian/Ubuntu: **apt repositories** (servers.ubuntu.com ועוד)

**Dependency, תלות**: package שהקוד שלך צריך כדי לרוץ. תלות יכולה להיות direct (אתה קראת לה) או transitive (היא נדרשת על-ידי package אחרת שהכנסת).

**Lockfile, קובץ נעילה**: קובץ שמנהל החבילות מייצר ומתעד בו את הגרסאות המדויקות שנבחרו לכל תלות. `requirements.txt` (לא lockfile אמיתי), `poetry.lock`, `bun.lockb`, `package-lock.json`. בלי lockfile שני מפתחים שמריצים `install` בתאריכים שונים עלולים לקבל גרסאות שונות.

**Virtual environment, סביבת וירטואל**: תיקיה מבודדת שמכילה interpreter ו-packages משלה. פרויקט A שצריך `numpy==1.24` ופרויקט B שצריך `numpy==2.0` יכולים לחיות על אותו מחשב בלי התנגשות.

## דוגמה מחושבת

### Python: `pip install requests`

```
$ python -m venv .venv          # יוצר סביבה וירטואלית בתיקיה .venv
$ source .venv/bin/activate     # מפעיל אותה (Windows: .venv\Scripts\activate)
$ pip install requests
```

מה pip עושה מאחורי הקלעים:

1. שואל PyPI ב-JSON API: "מה הגרסה האחרונה של requests?"
2. מוריד `requests-2.32.4-py3-none-any.whl`
3. מוודא ה-SHA256 hash (מובנה ב-PyPI)
4. מחלץ לתוך `.venv/lib/python3.x/site-packages/requests/`
5. חוזר לשלב 1 עבור כל תלות (charset-normalizer, idna, certifi, urllib3)

בסיום אפשר לשמור: `pip freeze > requirements.txt` - מכיל את כל מה שהותקן עם גרסאות מדויקות.

### JavaScript: `bun add marked`

```
$ bun add marked
```

bun מוריד מnpmjs.com, כותב לתוך `node_modules/`, ומעדכן `package.json` ו-`bun.lockb` אוטומטית. הלוגיקה זהה, התחביר שונה.

### apt (Linux system packages)

```
$ sudo apt update              # מרענן רשימת packages זמינים
$ sudo apt install curl
```

apt פונה ל-repository רשמי, בודק GPG signature, ומתקין ל-`/usr/` - מחוץ לפרויקט, ברמת המערכת.

## המקרה שמפיל את האינטואיציה

**שני פרויקטים, אותו package, גרסאות שונות.**

פרויקט ישן שלך תלוי ב-`Flask==2.0.1`, פרויקט חדש צריך `Flask==3.1.0`. ב-Python, אי-אפשר להתקין שתי גרסאות של אותו package ב-global site-packages - האחרונה תדרוס את הקודמת.

הפתרון: virtual environment אחד לכל פרויקט. כל `.venv` עצמאי לחלוטין. זה לא workaround - זה התכנון המכוון של pip מגרסה 23 ומעלה.

```
project-old/  .venv/  Flask 2.0.1
project-new/  .venv/  Flask 3.1.0
```

**עם global: התקנה תקינה + `import` נשבר.** עם venv: הכל מבודד.

## טעויות נפוצות

**1. התקנה global בלי venv.**
`pip install pandas` בלי venv ב-macOS/Linux עלול להידרש ל-`sudo`, לזהם את interpreter המערכת, ולגרום לקונפליקטים עתידיים. השתמש תמיד ב-venv או ב-tool שמנהל אותו (poetry, uv, rye).

**2. לא לcommit את הlockfile.**
אם `bun.lockb` לא נמצא ב-git, המפתח הבא שעושה `bun install` עלול לקבל גרסאות שונות, ו-bug שלך לא יתרחש אצלו - וזה קשה לדבאג.

**3. ערבוב מנהלי חבילות ב-JavaScript.**
`npm install` ו-`yarn add` באותו פרויקט מייצרים שני lockfiles סותרים. בחר אחד, commit את ה-lockfile שלו, והוסף `.npmrc` שחוסם את השני (`engine-strict=true`).

**4. להסתמך על `requirements.txt` כלockfile.**
`pip freeze > requirements.txt` מתעד גרסאות מדויקות, אבל לא hash. עדיף `pip-compile` (pip-tools) שמייצר lockfile עם hashes ומקשר תלויות.

## מתי זה לא משנה

**Script חד-פעמי ללא תלויות.** קובץ Python שמשתמש רק ב-`os`, `sys`, `json` (ספריות standard library) לא צריך מנהל חבילות ולא venv - אין תלויות חיצוניות.

**Containers ב-production.** ב-Docker image, `apt install` עושה את העבודה ישירות בשכבת ה-image; אין מקום למנגנון venv כי ה-container הוא הבידוד.

**ב-ראיון:** עשוי לשאול "pip vs venv vs conda." הדגש: pip הוא ה-installer, venv הוא הבידוד, conda עושה את שניהם ומוסיף packages שאינם Python. לייצור Python טהור, pip + venv (או uv) עדיפים על conda.

## חיבור

יחידה זו שייכת לבלוק M0 (יסודות מערכת ההפעלה). packages מותקנים לתיקיות מסוימות - ה-**m0-fs-paths** תסביר את המבנה. כלי dev-server שמפעילים `npm start` הם packages שהותקנו ופותחים port - **m0-ports-localhost** מרחיב. בMAST ועל CI/CD, הrequirements.txt שכתבת כאן נהיה הפקודה הראשונה ב-pipeline.

```widget
{"type":"algviz","algo":"path-scan","title":"Package Resolution: צפה כיצד מנהל חבילות סורק registries עד שמוצא את החבילה","dirs":["local cache","private registry","pypi.org","fallback"],"cmd":"requests"}
```

```concepts
{"items":[{"id":"package-manager","t":"Package Manager","he":"מנהל חבילות","d":"כלי שמוריד, מאמת ומתקין packages מ-registry, ומנהל תלויות ו-lockfiles.","rel":["virtual-env","lockfile","registry"],"node":"os"},{"id":"virtual-env","t":"Virtual Environment","he":"סביבת וירטואל","d":"תיקיה מבודדת עם Python interpreter ו-packages משלה, למניעת קונפליקטים בין פרויקטים.","rel":["package-manager"],"node":"os"},{"id":"lockfile","t":"Lockfile","he":"קובץ נעילה","d":"קובץ שמתעד גרסאות מדויקות של כל תלות, מבטיח builds שניתן לשחזר.","rel":["package-manager"],"node":"os"}]}
```

```quiz
{"id":"u-m0-package-manager-q1","tree":"systems","skill":"sdlc","q":"מה עושה הlockfile של מנהל חבילות?","options":["מונע מ-packages ישנים להיות מותקנים","מתעד גרסאות מדויקות של כל תלות כדי לאפשר build שניתן לשחזר","נועל את תיקיית node_modules כנגד שינויים","מצפין את קוד הpackages"],"answer":1,"explain":"הlockfile (כגון bun.lockb או poetry.lock) מתעד את הגרסה המדויקת שנבחרה לכל תלות, כולל תלויות transitive. שני מפתחים שרצים install עם אותו lockfile יקבלו תמיד אותם packages - זה המטרה."}
```

```fillin
{"id":"u-m0-package-manager-f1","tree":"systems","skill":"sdlc","prompt":"כדי ליצור סביבה וירטואלית בפרויקט Python, מריצים: python -m ___ .venv","answer":"venv","alt":["virtualenv"],"explain":"python -m venv .venv יוצר תיקיית .venv עם interpreter ו-pip מבודדים. אחרי source .venv/bin/activate כל pip install מתקין לתוך הvenv בלבד."}
```
