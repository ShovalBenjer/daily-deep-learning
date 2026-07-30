# משתני סביבה וסודות

`DATABASE_URL` לא יושבת בקוד. היא יושבת בסביבת ההרצה, ולכל תהליך יש עותק שלו.

## מה תדע בסוף

להציב, לקרוא ולמחוק משתני סביבה משורת הפקודה; להסביר למה `export` הכרחי; ולדעת למה סוד שיושב במשתנה סביבה בטוח יותר מסוד שכתוב בקוד.

## האינטואיציה

דמיין פתק שמוצמד לכל תהליך כשהוא מתחיל.

הפתק כולל שורות בפורמט `KEY=VALUE`. התהליך יכול לקרוא את הפתק בכל רגע. כשהתהליך מפעיל תהליך ילד, הוא מצלם את הפתק שלו ומוסר עותק לילד. הילד מתחיל עם אותם ערכים, אבל כל שינוי שהוא יעשה בפתק שלו לא חוזר להורה.

## ההגדרות המדויקות

**Environment, סביבת תהליך**: אוסף מחרוזות `KEY=VALUE` שמערכת ההפעלה מחזיקה עבור כל תהליך. ב-Python נגישה דרך `os.environ`, ב-Node דרך `process.env`, ב-Go דרך `os.Getenv`.

**Environment variable, משתנה סביבה**: רשומה בודדת בסביבה. ה-KEY חייב להכיל אותיות לטיניות, ספרות ו-`_`, ולא להתחיל בספרה. ה-VALUE הוא תמיד מחרוזת; אין טיפוסים.

**Shell variable לעומת environment variable**: ב-bash, `FOO=bar` יוצר משתנה shell פרטי ל-shell הנוכחי. תהליכים ילדים לא מקבלים אותו. `export FOO=bar` מוסיף אותו לסביבה שה-shell מורישה לילדים. הסינטקס `FOO=bar python script.py` מגדיר את הערך לאותה ריצה בלבד, מבלי לשנות את הסביבה של ה-shell הנוכחי.

**Inheritance, ירושת סביבה**: כשתהליך-הורה מפעיל תהליך-ילד, הקרנל מעתיק את כל הסביבה של ההורה לתוך הסביבה הראשונית של הילד. הילד יכול לשנות את עותקו; ההורה לא יראה את השינויים.

**`.env` file**: קובץ טקסט שכלים כמו `python-dotenv` (Python) או `dotenv` (Node) קוראים ומטענים לסביבה בזמן ריצה בפיתוח. הקובץ הזה לא מחליף משתני סביבה שכבר מוגדרים בסביבה. לעולם לא מחויב ל-git.

## דוגמה מחושבת

**קביעה, בדיקה ומחיקה של משתנה**:

```
export DATABASE_URL="postgresql://localhost/mydb"

printenv DATABASE_URL
# postgresql://localhost/mydb

python -c "import os; print(os.environ['DATABASE_URL'])"
# postgresql://localhost/mydb

unset DATABASE_URL

python -c "import os; print(os.environ['DATABASE_URL'])"
# KeyError: 'DATABASE_URL'
```

**הפרש בין shell variable ל-export**:

```
SECRET=hunter2
python -c "import os; print(os.environ.get('SECRET', 'not found'))"
# not found    -- לא עבר לילד

export SECRET=hunter2
python -c "import os; print(os.environ.get('SECRET', 'not found'))"
# hunter2      -- עכשיו עבר
```

**שימוש ב-`.env` בפיתוח מקומי**:

```
# קובץ .env
DATABASE_URL=postgresql://localhost/mydb
API_KEY=dev-key-not-real
```

```python
from dotenv import load_dotenv
import os
load_dotenv()
print(os.environ["DATABASE_URL"])
```

ב-production לא משתמשים ב-`load_dotenv`. משתני הסביבה מוגדרים ישירות על ידי פלטפורמת ה-hosting, לא מקובץ מקומי.

## המקרה שמפיל את האינטואיציה

**שינוי שנעשה בתוך script לא חוזר ל-shell שהריץ אותו.**

```bash
# script.sh
export TOKEN=abc
```

```bash
bash script.sh
echo $TOKEN
# (ריק)
```

`bash script.sh` פותח תהליך ילד. הילד קובע את `TOKEN` בסביבה שלו, ואז מסתיים. ההורה לא ראה את הערך מעולם.

כדי לטעון הגדרות מקובץ לתוך ה-shell הנוכחי משתמשים ב-`source`:

```bash
source script.sh
echo $TOKEN
# abc
```

`source` (ניתן לכתוב גם `. script.sh`) מריץ את הפקודות בתהליך ה-shell הנוכחי, לא בתהליך ילד.

## טעויות נפוצות

1. **חיוב `.env` ל-git**. קובץ `.env` עם מפתחות אמיתיים שנדחף ל-GitHub הוא חשיפה מלאה, גם אם מחקת אותו מאוחר יותר. git שומר את כל ההיסטוריה. מוסיפים `.env` ל-`.gitignore` לפני הקומיט הראשון, לא אחריו.

2. **הנחה ש-CI קורא `.bashrc`**. `.bashrc` נקרא כשנפתח shell אינטראקטיבי. רוב מערכות ה-CI פותחות shell non-interactive ולא קוראות אותו. משתני סביבה ב-CI מוגדרים דרך ממשק ה-CI (GitHub Actions secrets, GitLab CI variables וכדומה), לא דרך קבצי shell.

3. **הדפסת ערכי סודות ללוג**. `print(os.environ["API_KEY"])` לצורך debugging יכול לשלוח את הערך לפלטפורמת monitoring, לפלט ה-CI, ולכל מי שיש לו גישה ללוגים. משתמשים ב-logging ברמת DEBUG שמבוטל ב-production, ומעולם לא מדפיסים ערכים שלמים.

4. **סמיכה על `.env` ב-production**. קובץ `.env` על שרת production קל לשכוח לחסום, קל לחייב ל-git בטעות, וקל להשאיר בו ערכי staging. ב-production משתמשים בהגדרת משתני סביבה ישירה בפלטפורמה, או ב-secrets manager (HashiCorp Vault, AWS Secrets Manager).

## מתי זה לא משנה

בסקריפטים חד-פעמיים שרצים מקומית ואין בהם סודות, אפשר לכתוב ערכי config ישירות בקוד. ברגע שיש ערך שאסור להופיע ב-git, הוא חייב להיות משתנה סביבה או להגיע ממערכת secrets management. ה-pattern הזה נדרש בכל ראיון DevOps ו-backend.

## חיבור

בבלוק M0, משתני סביבה נוגעים בכל יחידה. `PATH` הוא משתנה סביבה שמכיל את רשימת התיקיות שה-shell מחפש בהן פקודות. SSH מורישה סביבה לתהליכים מרוחקים. מנהלי חבילות קוראים `VIRTUAL_ENV`, `NODE_ENV` ו-`PYTHONPATH` מהסביבה כדי להחליט איפה לחפש ספריות. היחידה הבאה היא m0-package-manager.

```quiz
{"id":"u-m0-env-vars-q1","tree":"systems","skill":"sdlc","q":"הרצת `FOO=bar` בלי export, ואז `python -c \"import os; print(os.environ.get('FOO', 'missing'))\"`. מה יודפס?","options":["bar","missing","שגיאת KeyError","ריק -- מחרוזת ריקה"],"answer":1,"explain":"בלי export, FOO הוא משתנה shell פנימי ולא נכנס לסביבה שה-shell מורישה לתהליכים ילדים. Python מקבל עותק של הסביבה ללא FOO, ו-get מחזיר את ברירת המחדל 'missing'."}
```

```quiz
{"id":"u-m0-env-vars-q2","tree":"systems","skill":"sdlc","q":"ב-bash script הרצת `export TOKEN=abc` ואז ה-script הסתיים. בשורת הפקודה שהריצה את ה-script, מה הערך של TOKEN?","options":["abc -- ה-script שינה את הסביבה","ריק -- ה-script רץ בתהליך ילד ושינויים לא חוזרים להורה","תלוי אם ה-script רץ עם sudo","abc, אבל רק עד לסיום ה-session הנוכחי"],"answer":1,"explain":"כל הרצה של script יוצרת תהליך ילד. הילד מקבל עותק של הסביבה של ההורה, אבל שינויים בעותק לא חוזרים. כדי לשנות את הסביבה של ה-shell הנוכחי משתמשים ב-source."}
```

```fillin
{"id":"u-m0-env-vars-f1","tree":"systems","skill":"sdlc","prompt":"איזו פקודה מריצה script.sh בתוך ה-shell הנוכחי במקום בתהליך ילד, כך שהגדרות ה-export שבו יחולו על ה-shell?","answer":"source","alt":["source script.sh",". script.sh","."],"explain":"source (או . ) מריץ את הפקודות בתהליך ה-shell הנוכחי. בניגוד ל-bash script.sh שפותח תהליך ילד, source גורם לשינויים ב-export ובמשתנים להיות גלויים ב-shell שקרא אותו."}
```

```concepts
{"items":[{"id":"env-vars","t":"Environment variable","he":"משתנה סביבה","d":"רשומת KEY=VALUE שמערכת ההפעלה מחזיקה לכל תהליך; נגישה לתהליכים ילדים בירושה","rel":["env-inheritance","shell-variable","dotenv-file"]},{"id":"env-inheritance","t":"Environment inheritance","he":"ירושת סביבה","d":"תהליך ילד מתחיל עם עותק של הסביבה של ההורה; שינויים בעותק אינם גלויים להורה","rel":["env-vars","process"]},{"id":"shell-variable","t":"Shell variable","he":"משתנה shell","d":"משתנה פנימי ל-shell שלא עובר לתהליכים ילדים אלא לאחר export","rel":["env-vars"]},{"id":"dotenv-file","t":".env file","he":"קובץ .env","d":"קובץ dev-only שמגדיר משתני סביבה מקומיים; לעולם לא מחויב ל-git","rel":["env-vars"]}]}
```
