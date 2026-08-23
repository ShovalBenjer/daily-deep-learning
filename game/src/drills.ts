/**
 * Drill content for the SQL district. Four lamps: three SQL patterns graded
 * by result-set match against a reference query run on the same seeded
 * DuckDB, and one fraud-decisioning case file in the take-home's shape
 * (verdict + policy block + the 30-second why).
 *
 * Contracts: sql drills declare the exact output columns in the task text,
 * because grading compares ordered canonical result sets, not SQL text.
 * Story text is authored here; it references the seeded dataset only.
 */

/**
 * A hole is one gap in the starter SQL with its own teaching ladder:
 * check() greps the student's SQL for a satisfying shape; the ladder is
 * nudge (words), diagnostic (a runnable helper query, the coach's move),
 * then reveal (the fragment itself). Praise fires the moment a hole is
 * satisfied, because the buzzer-only version was unplayable.
 */
export interface Hole {
  label: string;
  check: (sql: string) => boolean;
  nudge: string;
  diagnostic?: string;
  reveal: string;
  praise: string;
}

export interface SqlDrill {
  kind: 'sql';
  id: string;
  title: string;
  story: string;
  task: string;
  prediction: string;
  starter: string;
  reference: string;
  holes: Hole[];
  verbalQ: string;
  verbalA: string;
  analystRead: string;
}

export interface CaseDrill {
  kind: 'case';
  id: string;
  title: string;
  policy: string[];
  caseFile: string;
  verdicts: string[];
  correctVerdict: string;
  correctBlock: number;
  modelRead: string;
}

export type Drill = SqlDrill | CaseDrill;

const SCHEMA = `merchants (merchant_id, name, category, country, signup_date, kyc_verified)
transactions (txn_id, merchant_id, txn_ts TIMESTAMP, amount, status, card_id)`;

export const schemaNote = SCHEMA;

export const drills: Drill[] = [
  {
    kind: 'sql',
    id: 'approval-rate',
    title: 'אחוז האישורים',
    story:
      'צוות הסיכון מריח משהו ביולי. לפני שצוללים לסוחר ספציפי, בונים את התמונה: ' +
      'אחוז האישורים של כל סוחר פעיל. התבנית היא conditional aggregation, ' +
      'הלחם והחמאה של כל ראיון אנליטי: תרגם כל שורה ל-1 או 0, והממוצע הוא האחוז.',
    task:
      'לכל סוחר עם לפחות 50 טרנזקציות ביולי 2026: השם, מספר הטרנזקציות, ואחוז ה-approved. ' +
      'החזר בדיוק את העמודות (name, num_txn, approval_rate), ממוין מהנמוך לגבוה לפי approval_rate.',
    prediction:
      'לפני שאתה מריץ: כמה שורות תקבל, ומי לדעתך יישב בתחתית? כתוב את הניחוש, ואז הרץ.',
    starter:
      'SELECT m.name,\n       COUNT(*) AS num_txn,\n       -- החור: איך הופכים סטטוס לאחוז?\n       ______ AS approval_rate\nFROM transactions t\nJOIN merchants m ON m.merchant_id = t.merchant_id\nWHERE ______  -- יולי 2026\nGROUP BY m.name\nHAVING COUNT(*) >= 50\nORDER BY approval_rate;',
    reference:
      "SELECT m.name, COUNT(*) AS num_txn, AVG(CASE WHEN t.status = 'approved' THEN 1.0 ELSE 0 END) AS approval_rate " +
      "FROM transactions t JOIN merchants m ON m.merchant_id = t.merchant_id " +
      "WHERE t.txn_ts >= '2026-07-01' AND t.txn_ts < '2026-08-01' " +
      'GROUP BY m.name HAVING COUNT(*) >= 50 ORDER BY approval_rate',
    holes: [
      {
        label: 'האחוז',
        check: sql => /case\s+when[\s\S]*status\s*=\s*'approved'/i.test(sql) && /\b(avg|sum)\s*\(/i.test(sql),
        nudge: 'תרגם כל שורה ל-1 (approved) או 0 (כל השאר), ואז שאל: איזו אגרגציה הופכת רצף של אפסים ואחדים לאחוז?',
        diagnostic: 'SELECT DISTINCT status FROM transactions;',
        reveal: "AVG(CASE WHEN t.status = 'approved' THEN 1.0 ELSE 0 END)",
        praise: 'החור הקשה נסגר: conditional aggregation, הלחם והחמאה של ראיונות אנליטיקה.',
      },
      {
        label: 'חלון הזמן',
        check: sql => (/txn_ts\s*>=\s*'2026-07-01'/i.test(sql) && /txn_ts\s*<\s*'2026-08-01'/i.test(sql))
          || (/year\s*\(\s*t?\.?txn_ts\s*\)\s*=\s*2026/i.test(sql) && /month\s*\([^)]*\)\s*=\s*7/i.test(sql)),
        nudge: 'יולי הוא טווח: מתחילת החודש ועד לפני תחילת הבא. אפשר גם year()+month() על העמודה, אבל טווח ידידותי יותר לאינדקסים.',
        diagnostic: 'SELECT MIN(txn_ts), MAX(txn_ts) FROM transactions;',
        reveal: "t.txn_ts >= '2026-07-01' AND t.txn_ts < '2026-08-01'",
        praise: 'חלון הזמן נקי, ובצורה שמקצוענים מעדיפים.',
      },
    ],
    verbalQ:
      'ב-30 שניות, כמו למראיין: למה הסף של 50 חייב לשבת ב-HAVING ולא ב-WHERE?',
    verbalA:
      'WHERE רץ לפני הקיבוץ ומסנן שורות בודדות, ובשלב הזה COUNT() עוד לא קיים. ' +
      'HAVING רץ אחרי GROUP BY ומסנן קבוצות שלמות לפי תוצאות אגרגציה. ' +
      'הסף שלנו הוא תנאי על אגרגט, טרנזקציות לסוחר, ולכן הוא חי רק ב-HAVING.',
    analystRead:
      'השורה התחתונה היא לא "סוחר גרוע": פרץ של חיובים קטנים שכמעט כולם נדחים ' +
      'הוא דפוס card testing. שאילתה + פרשנות = אנליסט; שאילתה בלבד = מתכנת.',
  },
  {
    kind: 'sql',
    id: 'monthly-rollup',
    title: 'ציר הזמן של Aurora',
    story:
      'Aurora Jewels נראתה תקינה ביולי, אבל היא הסוחר החדש שה-KYC שלו לא הושלם. ' +
      'סוחר לא מאומת בודקים על ציר הזמן, לא בממוצע: התבנית היא monthly rollup עם ' +
      "DATE_TRUNC('month', ts), שמעגל timestamp לתחילת החודש ומאפשר לקבץ לפיו.",
    task:
      'לסוחר Aurora Jewels בלבד, ורק טרנזקציות approved: לכל חודש, מספר הטרנזקציות וסך ה-amount. ' +
      'החזר בדיוק את העמודות (month, num_txn, total_amount), ממוין כרונולוגית.',
    prediction:
      'היא נפתחה ב-20 ביוני. כמה שורות תקבל, ומה אתה מצפה לראות בין יוני, יולי ואוגוסט?',
    starter:
      "SELECT DATE_TRUNC('month', t.txn_ts) AS month,\n       COUNT(*) AS num_txn,\n       ______ AS total_amount\nFROM transactions t\nJOIN merchants m ON m.merchant_id = t.merchant_id\nWHERE ______\nGROUP BY 1\nORDER BY 1;",
    reference:
      "SELECT DATE_TRUNC('month', t.txn_ts) AS month, COUNT(*) AS num_txn, SUM(t.amount) AS total_amount " +
      "FROM transactions t JOIN merchants m ON m.merchant_id = t.merchant_id " +
      "WHERE m.name = 'Aurora Jewels' AND t.status = 'approved' GROUP BY 1 ORDER BY 1",
    holes: [
      {
        label: 'הסכום',
        check: sql => /sum\s*\(\s*t?\.?amount\s*\)/i.test(sql),
        nudge: 'מספר הטרנזקציות כבר נספר; לסכום הכסף יש אגרגציה משלו.',
        reveal: 'SUM(t.amount)',
        praise: 'הסכום במקום.',
      },
      {
        label: 'הסינון',
        check: sql => /aurora jewels/i.test(sql) && /status\s*=\s*'approved'/i.test(sql),
        nudge: 'שני תנאים חיים כאן יחד: הסוחר האחד, ורק השורות שאושרו. שניהם מסנני שורות, אז שניהם ב-WHERE.',
        diagnostic: 'SELECT name FROM merchants;',
        reveal: "m.name = 'Aurora Jewels' AND t.status = 'approved'",
        praise: 'סינון מדויק, וזו בדיוק ההזדמנות לומר בראיון למה הוא ב-WHERE ולא ב-CASE.',
      },
    ],
    verbalQ:
      "ב-30 שניות: מה ההבדל בין WHERE status='approved' כאן לבין ספירה מותנית כמו בדריל הקודם? מתי כל גישה נכונה?",
    verbalA:
      'כשכל המדדים בשאילתה מתייחסים רק לתת-הקבוצה, מסננים ב-WHERE וזה גם מהיר יותר. ' +
      'כשצריך בשורה אחת גם את הכלל וגם את תת-הקבוצה (למשל אחוז), עוברים ל-CASE בתוך האגרגציה. ' +
      'לבחור נכון בין השניים זו בדיוק השאלה שמראיינים בודקים.',
    analystRead:
      'יוני קטן, יולי נורמלי, ואוגוסט מזנק בסכומים גדולים פי כמה. אצל סוחר עם KYC פתוח ' +
      'זו תבנית bust-out: בונים אמון, מרימים נפח, ונעלמים לפני ה-chargebacks. הייתי מקפיא settlement עד אימות.',
  },
  {
    kind: 'sql',
    id: 'window-top-per-category',
    title: 'המוביל בכל קטגוריה',
    story:
      'המנהלת רוצה שקף אחד: מי הסוחר החזק בכל קטגוריה ביולי. שני שלבים: קודם אגרגציה ' +
      'לסכומים, ואז window function שמדרגת בתוך כל קטגוריה. PARTITION BY פותח חלון נפרד לכל קבוצה.',
    task:
      'לכל category: הסוחר עם סך ה-amount הגבוה ביותר על טרנזקציות approved ביולי 2026. ' +
      'החזר בדיוק את העמודות (category, name, total_amount), ממוין לפי category. השתמש ב-window function.',
    prediction:
      'ארבע קטגוריות בדאטה. מי לוקח את digital: הנפח הגדול של StreamBoost או משהו אחר?',
    starter:
      "WITH sums AS (\n  SELECT m.category, m.name, SUM(t.amount) AS total_amount\n  FROM transactions t\n  JOIN merchants m ON m.merchant_id = t.merchant_id\n  WHERE ______\n  GROUP BY 1, 2\n)\nSELECT category, name, total_amount\nFROM (\n  SELECT *, ______ AS rn\n  FROM sums\n)\nWHERE rn = 1\nORDER BY category;",
    reference:
      "WITH sums AS (SELECT m.category, m.name, SUM(t.amount) AS total_amount FROM transactions t " +
      "JOIN merchants m ON m.merchant_id = t.merchant_id WHERE t.status = 'approved' AND " +
      "t.txn_ts >= '2026-07-01' AND t.txn_ts < '2026-08-01' GROUP BY 1, 2) " +
      'SELECT category, name, total_amount FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY total_amount DESC) AS rn FROM sums) WHERE rn = 1 ORDER BY category',
    holes: [
      {
        label: 'הסינון',
        check: sql => /status\s*=\s*'approved'/i.test(sql) && /2026-07-01/.test(sql),
        nudge: 'אותו חלון יולי מהדריל הראשון, ועוד תנאי אחד: רק approved נכנסות לסכום.',
        reveal: "t.status = 'approved' AND t.txn_ts >= '2026-07-01' AND t.txn_ts < '2026-08-01'",
        praise: 'הבסיס נקי; עכשיו החלק שהראיון באמת בודק.',
      },
      {
        label: 'החלון',
        check: sql => /partition\s+by\s+category/i.test(sql) && /order\s+by\s+total_amount\s+desc/i.test(sql) && /\b(row_number|rank)\s*\(/i.test(sql),
        nudge: 'window function פותחת חלון נפרד לכל קבוצה: PARTITION BY קובע את הקבוצה, ORDER BY את מי מדרגים ראשון, והפונקציה נותנת את המספר.',
        diagnostic: "SELECT category, COUNT(DISTINCT name) FROM merchants GROUP BY 1;",
        reveal: 'ROW_NUMBER() OVER (PARTITION BY category ORDER BY total_amount DESC)',
        praise: 'זה הדפוס ששואלים עליו בכל ראיון דאטה שני. עכשיו הוא שלך.',
      },
    ],
    verbalQ:
      'ב-30 שניות: ROW_NUMBER מול RANK מול DENSE_RANK, ולמה כאן דווקא ROW_NUMBER בסדר?',
    verbalA:
      'ROW_NUMBER נותן מספור רציף וייחודי גם בשוויון; RANK מדלג אחרי שוויון; DENSE_RANK לא מדלג. ' +
      'כאן רוצים בדיוק שורה אחת לקטגוריה, אז ROW_NUMBER; אם היינו רוצים את כל השווים בפסגה, RANK.',
    analystRead:
      'שקף הוא לא תוצאה, הוא טענה. אם digital נלקח על ידי סוחר שהנפח שלו בא מטרנזקציות חריגות, ' +
      'המספר הגדול הוא בדיוק המקום להפעיל חשדנות, לא גאווה.',
  },
  {
    kind: 'case',
    id: 'case-file-1',
    title: 'תיק החלטה: CASE-207',
    policy: [
      'Block 1, פסילה מוחלטת: קשר ישיר (מכשיר/כרטיס זהה) לתיק הונאה שהוכרע גובר על כל שיקול אחר.',
      'Block 2, דפוס טרנזקציות: הרבה ניסיונות קטנים שנכשלים בחלון קצר מעידים על card testing, לא על מסחר רגיל.',
      'Block 3, גיאוגרפיה ותנועה: סתירה פיזית בלתי אפשרית בין מיקומי שימוש היא דגל אדום.',
      'Block 4, זהות ורשימות: התאמת שם לרשימה היא false positive כשהדמוגרפיה סותרת והזהות אומתה עצמאית.',
      'Block 5, היגיון עסקי רגיל: נפח גבוה מוסבר על ידי היסטוריה יציבה ויעד settlement מאומת.',
    ],
    caseFile:
      'CASE-207: סוחר digital ותיק. הלילה, בין 02:10 ל-02:40, נרשמו 63 ניסיונות חיוב בסכומים של ' +
      '1 עד 5 דולר, על 61 כרטיסים שונים, 58 מהם נדחו. בשאר היום התנועה רגילה. ' +
      'הסוחר עצמו מאומת, בלי קשר לתיקים קודמים, והדמוגרפיה של הבעלים תקינה.',
    verdicts: ['APPROVE', 'REJECT'],
    correctVerdict: 'REJECT',
    correctBlock: 2,
    modelRead:
      'הפרופיל הוא Block 2 קלאסי: פרץ לילי של מיקרו-חיובים על עשרות כרטיסים עם שיעור כישלון קיצוני ' +
      'הוא card testing של כרטיסים גנובים, גם כשהסוחר עצמו כשר. הזהות התקינה (Block 4) לא מנקה דפוס ' +
      'טרנזקציות; ב-Lying for Money זו בדיוק נקודת העיוורון של אמון מבוזר: המערכת בודקת את הסוחר, ' +
      'והתוקף משתמש בו כמעבדה. ההחלטה: REJECT לפרץ, פתיחת case, והסוחר נשאר פעיל.',
  },
];
