# עיצוב סכמת כלים

כשסוכן שולח קריאה עם ארגומנטים שגויים, הבאג כמעט תמיד במפרט שקיבל, לא בקוד שהגדיר אותו.

## מה תדע בסוף

לכתוב tool schema שסוכן LLM יוכל לפעול לפיו: שם ברור, description שמסביר מה הכלי עושה ומה הוא מחריג, ופרמטרים עם סוגים ואילוצים. לזהות אילו חלקים הכי חשובים לאיכות הקריאה, ולהימנע מהמלכודות הנפוצות.

## האינטואיציה

**Tool Schema, סכמת כלים** היא מפרט שהמודל קורא לפני שהוא מחליט אם לקרוא לכלי ואיך. תחשוב עליה כמו מודעת דרושים.

מודעה טובה אומרת בדיוק מה התפקיד, מה מתחייב, ומה לא כלול. מועמד שקרא אותה מגיע עם ציפיות נכונות וכישורים מתאימים. מודעה עמומה מביאה מועמדים שלא מתאימים, או שמועמדים טובים לא נרשמים כי לא הבינו שזה רלוונטי עבורם.

כך גם tool schema: LLM שקרא schema טוב שולח קריאה עם הארגומנטים הנכונים, בזמן הנכון. LLM שקרא schema עמום ינחש. לפעמים ינחש נכון, לרוב לא.

## ההגדרות המדויקות

**Tool Schema, סכמת כלים** בנויה משלושה שדות מרכזיים:

### name

שם הכלי. מזהה ייחודי ללא רווחים. מוסכמות: `snake_case` או `camelCase` לפי הפלטפורמה. קצר ותיאורי.

```
get_current_weather    # טוב
tool1                  # גרוע
fetch_weather_data_from_api_for_city  # ארוך מדי
```

### description

**Description, תיאור** הוא החלק הקריטי ביותר. המודל משתמש בו כדי להחליט:
- האם לקרוא לכלי בכלל
- מה להעביר לפרמטרים
- מה לצפות מהתוצאה

description טוב מכיל:
1. מה הכלי עושה (פועל + מושא מדויק)
2. מתי להשתמש בו (use case אחד או שניים)
3. מה הוא **לא** עושה (מונע קריאות שגויות)

### parameters

**Parameters, פרמטרים** מתוארים בפורמט **JSON Schema, סכמת JSON**. התבנית:

```json
{
  "type": "object",
  "properties": {
    "param_name": {
      "type": "string",
      "description": "מה הפרמטר מייצג ואיזה ערכים תקינים"
    }
  },
  "required": ["param_name"]
}
```

הסוגים הנפוצים:
- `"type": "string"` עם `"enum": ["a","b","c"]` לרשימה סגורה
- `"type": "number"` לערכים רציפים, עם `"minimum"` ו-`"maximum"` לאילוצים
- `"type": "boolean"` לדגלים
- `"type": "array"` עם `"items"` לרשימות

**required**: מערך שמות פרמטרים חובה. פרמטר שאינו ברשימה הוא אופציונלי; המודל לא חייב להעביר אותו ומוזמן להשמיט אם לא ידוע.

כל פרמטר צריך `description` משלו, לא רק לאובייקט הראשי.

## דוגמה מחושבת

נתחיל עם schema רע, ונשפר שלב אחרי שלב.

### גרסה 0 - schema עני

```json
{
  "name": "weather",
  "description": "מזג אוויר",
  "parameters": {
    "type": "object",
    "properties": {
      "place": { "type": "string" }
    },
    "required": ["place"]
  }
}
```

הבעיות:
- `description` חסר: "מזג אוויר" לא אומר האם זה עכשווי, תחזית, או היסטורי
- `place` לא ברור: עיר? קואורדינטות? קוד מדינה? מיקוד?

### גרסה 1 - schema שמישותי

```json
{
  "name": "get_current_weather",
  "description": "Returns current weather conditions for a city. Use when the user asks about weather, temperature, rain, humidity, or outdoor conditions right now. Does NOT return forecasts or historical data.",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "City name in English, e.g. 'Tel Aviv', 'New York'. City only, no country or zip code."
      },
      "units": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "Temperature unit. Default: celsius."
      }
    },
    "required": ["city"]
  }
}
```

השיפורים:
1. שם ברור: `get_current_weather` במקום `weather`
2. Description: מה עושה, מתי להשתמש, ומה **לא** עושה (תחזית, היסטורי)
3. `city` עם דוגמה: `'Tel Aviv'` מונע ניחוש של קוד מדינה
4. `enum` ל-`units`: המודל לא ישלח `"kelvin"` בטעות
5. `units` אופציונלי (לא ב-`required`): אם המשתמש לא ציין, המודל ישמיט ויקבל ברירת מחדל

כשמשתמש שואל "האם כדאי לצאת לחצר?" המודל יקרא `get_current_weather` עם ה-city הנכונה. בגרסה 0, היה מנחש `location` או שם אחר ומקבל שגיאת validation.

```quiz
{"id":"u-m4-tool-schema-design-q1","tree":"craft","skill":"mcp","q":"מה החלק הכי חשוב ב-tool schema שמשפיע על האם LLM יקרא לכלי הנכון ואיך?","options":["שם הכלי (name)","תיאור הכלי (description)","רשימת הפרמטרים required","סדר הפרמטרים ב-properties"],"answer":1,"explain":"ה-description הוא המחרוזת שהמודל קורא כדי להחליט אם ומתי לקרוא לכלי. שם ברור חשוב, אבל description עמום יגרום לקריאות שגויות גם עם שם מושלם."}
```

## המקרה שמפיל את האינטואיציה

description מדויק לא מונע קריאות שגויות כשיש **חפיפה סמנטית** בין כלים.

נניח שני כלים: `search_documents` ו-`search_web`. שניהם מחפשים. אם ה-descriptions שלהם לא מנוגדים מספיק, המודל יבחר ביניהם לפי הקשר וינחש. התיקון: כתוב כל description כך שיכלול משפט שמצביע מפורשות על הכלי החלופי:

```
"description": "Searches internal company documents only. Use for HR policies,
internal FAQs, and company procedures. For anything about the public internet,
use search_web instead."
```

מקרה נוסף: enum שמוציא ערך שהמשתמש עשוי לבקש. אם `type` ב-schema כולל רק `["current", "hourly"]` אבל המשתמש ביקש "תחזית שבועית", המודל לא יוכל לספק את הצורך גם אם כתבת description מדהים. schema לא יכול לפצות על API שחסר יכולת.

```fillin
{"id":"u-m4-tool-schema-design-f1","tree":"craft","skill":"mcp","prompt":"ב-JSON Schema של tool, כדי להגביל פרמטר string לרשימה סגורה של ערכים תקינים, משתמשים במפתח ___","answer":"enum","alt":["\"enum\""],"explain":"המפתח enum מקבל מערך של ערכים תקינים. המודל ישתמש רק בערכים שברשימה ולא ינחש ערכים אחרים."}
```

## טעויות נפוצות

1. **Description חד-מילי**: `"description": "Sends email"`. מה שולחים? לאיזה כתובת? מה הפורמט? בלי זה המודל לא יודע מה לשים ב-to, subject, body. כתוב description שמסביר כל פרמטר ומה מקרה הקצה.

2. **שם פרמטר עמום**: `location` יכול להיות שם עיר, קואורדינטות, ID בבסיס נתונים, כתובת רחוב. כתוב ב-description את הפורמט המדויק. `"City name in English, e.g. 'Tel Aviv'"` טוב יותר מ-`"The location"`.

3. **כל הפרמטרים ב-required**: אם `units` הוא אופציונלי עם ברירת מחדל סבירה, אל תדרוש אותו. כשמודל חייב להעביר הרבה פרמטרים, טעות באחד תוקעת את כולם. פרמטרים אופציונליים עם ברירות מחדל טובות מקטינים את שטח הטעות.

4. **חסר constraints על מספרים**: פרמטר int לשנה בלי min/max. המודל יכול לשלוח שנת 1850 אם לא קבעת `"minimum": 1900, "maximum": 2030`. הוסף `"minimum"` ו-`"maximum"` לכל פרמטר מספרי.

5. **שם ארוך מדי**: `create_new_user_account_in_database`. הכלי עצמו הוא הפועל; `create_user` מספיק ומובן. שמות ארוכים נגמרים בחתיכה כש-API מגביל אורך (OpenAI: 64 תווים, MCP: 64 תווים), ולוקים בקריאות.

## מתי זה לא משנה

Tool schema חשוב רק כשה-caller הוא LLM שמחפש כלי מתוך רשימה. כשקוראים לכלי ישירות מקוד Python בלי מעבר LLM, schema הוא documentation בלבד.

גם כשמשתמשים ב-MCP עם כלי אחד בלבד: המודל לא צריך לבחור, ולכן ה-description פחות קריטי לבחירה (אבל עדיין עוזר לאיכות הארגומנטים).

כשה-framework יוצר schema אוטומטית מ-docstring (Pydantic, TypedDict): כדאי לאמת שה-generated schema מכיל descriptions ולא רק types. לעתים קרובות הוא לא.

**לעומת prompt engineering**: אפשר להסביר ל-LLM ב-system prompt "השתמש בכלי X כשמדובר ב-Y". זה עובד כששכבת ה-schema דלה. אבל בסוכן עם 15 כלים, description ספציפי בכל כלי מדויק יותר ממדריך כללי ב-system prompt.

## חיבור

יחידה זו פותחת את המיומנות `mcp`: הצעד הבא הוא הגדרת MCP server שמרשם כלים עם schema כנ"ל ומחבר אותם ל-Claude. הקשר ל-`agents-orch`: כשסוכן מתכנן רצף פעולות, הוא בוחר כלים מתוך ה-roster שלו לפי ה-schemas; schema עמום יגרום לתכנון שגוי עוד לפני שהסוכן פועל.

```concepts
{"items":[{"id":"c-tool-schema","t":"Tool Schema","he":"סכמת כלים","d":"מפרט JSON (name, description, parameters) ש-LLM קורא כדי לדעת מה כלי עושה ואיך לקרוא לו","rel":["c-tool-description","c-json-schema-params"],"node":"agents-loop"},{"id":"c-tool-description","t":"Tool Description","he":"תיאור כלי","d":"השדה הקריטי ב-tool schema: מסביר מה הכלי עושה, מתי להשתמש ומה מחריג; משפיע יותר על איכות הקריאה מכל שדה אחר","rel":["c-tool-schema"],"node":"agents-loop"},{"id":"c-json-schema-params","t":"JSON Schema Parameters","he":"פרמטרי JSON Schema","d":"תבנית type/properties/required שמגדירה קלט לכלי; enum, minimum ו-maximum מאלצים ערכים תקינים","rel":["c-tool-schema"],"node":"agents-loop"}]}
```
