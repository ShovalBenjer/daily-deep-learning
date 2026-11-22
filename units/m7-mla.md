# Multi-head Latent Attention
DeepSeek-V2 מריצה 128 ראשות attention עם KV cache קטן פי 57 מ-MHA רגיל - MLA הוא הרעיון שמאחורי זה.

## מה תדע בסוף

תסביר מה MLA שומר ב-KV cache לעומת MHA, תחשב כמה זיכרון נחסך בדוגמה מספרית, ותסביר למה ספיגת המטריצה (matrix absorption) מאפשרת inference יעיל גם ללא פריסה מפורשת של K ו-V.

## האינטואיציה

בכל שלב decode, ה-transformer צריך לזכור כל מה שעיבד. הוא שומר זאת ב-KV cache: מטריצות K ו-V מכל שכבה, לכל token שעיבד. ב-MHA רגיל, 128 ראשות עם 128 ממדים לראש = 32,768 מספרים לכל token, לכל שכבה. ב-100K tokens זה עצום.

ה-insight של MLA: K ו-V נגזרים שניהם מאותו hidden state h. במקום לשמור אותם, שומרים דחיסה קטנה \(c_{KV}\) שממנה K ו-V מחושבים מחדש לפי הצורך. כמו לשמור תמצות של פגישה במקום כל התמליל.

## ההגדרות המדויקות

**Multi-head Latent Attention, תשומת לב חבויה רב-ראשית:** מנגנון attention שבו ה-KV cache מאחסן וקטור latent דחוס \(c_{KV}\), לא מטריצות K ו-V מלאות.

**Downprojection, הקרנה מצמצמת:** מטריצה \(W^{DKV}\) שמצמצמת את ה-hidden state h לוקטור קטן:

\[c_{KV} = W^{DKV} \cdot h, \quad c_{KV} \in \mathbb{R}^{d_c}\]

כאשר \(d_c \ll n_h \cdot d_h\) (למשל 512 במקום 32,768 ב-DeepSeek-V2).

**Uprojection, הקרנה מרחיבה:** בזמן attention, K ו-V מחושבים מ-\(c_{KV}\):

\[K_C = W^{UK} \cdot c_{KV}, \quad V = W^{UV} \cdot c_{KV}\]

**RoPE, Rotary Position Embedding:** קידוד מיקום שמוחל על K. כיוון שהקידוד לא עובר דרך ה-uprojection, יש רכיב נפרד שנשמר ב-KV cache:

\[k_R = W^{KR} \cdot h\]

ה-KV cache שומר: \(c_{KV}\) (512 ממדים) ו-\(k_R\) (64 ממדים) = **576 ממדים לכל token** במקום 32,768.

**Matrix absorption, ספיגת מטריצה:** לחישוב \(Q \cdot K_C^T\), מקפלים את \(W^{UK}\) לתוך \(W^Q\):

\[Q \cdot K_C^T = Q \cdot (W^{UK} \cdot c_{KV})^T = (Q \cdot {W^{UK}}^T) \cdot c_{KV}^T\]

כלומר attention מחושב ישירות על \(c_{KV}\). K לא פורש לעולם. אותו הגיון מוחל על V עם \(W^{UV}\) ו-\(W^O\).

## דוגמה מחושבת

נגדיר מודל עם: n_h=8 ראשות, d_h=128, d_c=128, d_R=32.

**KV cache ב-MHA:**

\[n_h \times d_h \times 2 = 8 \times 128 \times 2 = 2{,}048 \text{ מספרים לכל token}\]

**KV cache ב-MLA:**

\[d_c + d_R = 128 + 32 = 160 \text{ מספרים לכל token}\]

**חיסכון: פי 12.8 פחות זיכרון.**

בגרסה האמיתית של DeepSeek-V2 (n_h=128, d_h=128, d_c=512, d_R=64):

| שיטה | מספרים לכל token |
|---|---|
| MHA | 32,768 |
| GQA (8 groups) | 4,096 |
| MLA | 576 |

ב-100K tokens, batch=32, fp16:
- MHA: ~209 GB לשכבה אחת
- MLA: ~3.7 GB לשכבה אחת

```quiz
{"id":"u-m7-mla-q1","tree":"craft","skill":"pytorch","q":"מה MLA שומר ב-KV cache לכל token, בניגוד ל-MHA שמאחסן K ו-V מלאים?","options":["וקטור latent דחוס c_KV בלבד","את K ו-V של ראש אחד בלבד","hash של ה-hidden state","כלום - MLA לא משתמש ב-KV cache"],"answer":0,"explain":"MLA שומר c_KV (וקטור latent דחוס) ורכיב k_R לחלק ה-RoPE של K, במקום K ו-V מלאים. זה מה שחוסך פי 57 בזיכרון ה-KV cache של DeepSeek-V2."}
```

```fillin
{"id":"u-m7-mla-f1","tree":"craft","skill":"pytorch","prompt":"ב-MLA עם n_h=8 ראשות, d_h=128, d_c=128, d_R=32: MHA שומר ___ מספרים לכל token (K+V), ואילו MLA שומר רק ___.","answer":"2048, 160","alt":["2048 ו-160","2,048 ו-160"],"explain":"MHA: 8×128×2=2048. MLA: d_c+d_R=128+32=160. חיסכון של פי 12.8."}
```

## המקרה שמפיל את האינטואיציה

**Matrix absorption עובדת ב-inference, לא ב-training.** בזמן training, גרדיאנטים צריכים לזרום דרך \(W^{UK}\) ו-\(W^{UV}\) בנפרד לצורך עדכון. ספיגת המטריצה היא אופטימיזציה של inference בלבד.

יתר על כן: הרווח האמיתי הוא ב-memory bandwidth, לא ב-FLOPS. ב-inference, הצוואר הבקבוק הוא העברת KV cache מה-HBM (ה-VRAM) ל-SRAM של ה-GPU. MLA מקטין את כמות הנתונים בהעברה הזו. במחשב שהוא compute-bound ולא memory-bandwidth-bound, הרווח קטן יותר.

## טעויות נפוצות

1. **"MLA דוחס K ו-V"** - אינו נכון. \(c_{KV}\) אינו "K דחוס" ולא "V דחוס". הוא ייצוג משותף שממנו K ו-V נגזרים. ב-GQA שומרים K ו-V מלאים ומשתפים אותם; ב-MLA (עם absorption) לא שומרים ולא פורשים K ו-V מפורשים כלל.

2. **"GQA ו-MLA אותו דבר"** - לא. GQA מקצרת את ה-KV cache בשיתוף K ו-V בין קבוצות של Q-heads. MLA דוחסת לוקטור latent יחיד. ב-GQA עדיין צריך K ו-V מפורשים; ב-MLA עם absorption, לא.

3. **"d_c קטן = דיוק נמוך"** - ניסיונות DeepSeek הראו ש-d_c=512 שומרת על רוב איכות MHA. K ו-V ב-MHA redundant מאוד; יש להם rank אפקטיבית נמוכה, ולכן הדחיסה כמעט ולא פוגעת.

4. **"MLA קל ליישום ב-vanilla PyTorch"** - המימוש הנאיבי (downproject, upproject, attention) עובד, אך ללא absorption הוא לא יעיל. מנועי inference כמו vLLM ו-SGLang הוסיפו תמיכה מאוחרת ודרשה עבודה משמעותית.

## מתי זה לא משנה

**ב-training:** לא שומרים KV cache בין iterations. Flash Attention רלוונטי יותר לחיסכון ב-training.

**בסדרות קצרות ו-batch קטן:** ה-KV cache לא מלא את ה-VRAM. GQA עם 8 קבוצות מספיקה, בלי מורכבות MLA.

**למודלים קטנים:** מתחת ל-30B עם context עד 32K, GQA נותנת שיפור מספיק.

**לראיון:** שאלה נפוצה: "למה DeepSeek-V2 ממנה MLA?" - הצוואר היה memory bandwidth של ה-KV cache ב-long context, לא FLOPS. MLA פותר זאת מבנית, בלי להגביל את מספר ראשות ה-attention.

## חיבור

יחידה זו ב-M7 מניחה הבנת **KV cache** (c-kv-cache) ו-MHA בסיסי. MLA בא כחלופה לשיפור memory efficiency, חזקה יותר מ-GQA שמסופרת ביחידה הבאה.

הצעד הבא: **m7-kv-sharing** (GQA, MQA, ו-MLA בהשוואה מסודרת) ו-**m7-sliding-window-attn** (attention יעיל ל-context ארוך).

```concepts
{"items":[{"id":"c-mla","t":"Multi-head Latent Attention","he":"תשומת לב חבויה רב-ראשית","d":"מנגנון attention שדוחס K ו-V לוקטור latent משותף c_KV; חוסך עד 57x זיכרון ב-KV cache","rel":["c-kv-cache","c-low-rank-kv"],"node":"llm-core"},{"id":"c-low-rank-kv","t":"Low-rank KV compression","he":"דחיסת KV דרגה נמוכה","d":"הנחה שמטריצות K ו-V ניתנות לייצוג ב-subspace ממדיות נמוכה, בסיס ל-MLA ו-LoRA","rel":["c-mla"],"node":"llm-core"},{"id":"c-matrix-absorption","t":"Matrix absorption","he":"ספיגת מטריצה","d":"אופטימיזציית inference שמקפלת uprojection matrices לתוך Q כדי לחשב attention ישירות על c_KV ללא פריסה מפורשת","rel":["c-mla"],"node":"llm-core"}]}
```
