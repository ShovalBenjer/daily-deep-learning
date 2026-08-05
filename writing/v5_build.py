# Build the-bench-v5.html: a full reskin of the live article into the
# forensic-data / IBM Plex / colour-as-grammar system, keeping all content and
# all interactive JS figures. Strategy: APPEND an override stylesheet (remap the
# shared CSS variables + restyle key components) rather than delete the original,
# so the segbar/steps/route-graph figures keep their rules and keep working.
# Plus inject the hero (live chip, count-up number, stat strip) and its JS, and
# an ABSTRACTED map texture (procedural SVG, not the real location).
import io, re, base64

SRC = "the-bench.html"
OUT = "the-bench-v5.html"
html = io.open(SRC, encoding="utf-8").read()

# ---- abstracted map: procedural SVG, evokes a street grid + route, no real place ----
svg = """<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
<rect width='800' height='600' fill='#0e1618'/>
<g stroke='#243b3a' stroke-width='1.2' fill='none' opacity='.9'>
""" + "".join(f"<line x1='{x}' y1='0' x2='{x}' y2='600'/>" for x in range(0,801,46)) \
    + "".join(f"<line x1='0' y1='{y}' x2='800' y2='{y}'/>" for y in range(0,601,46)) + """
</g>
<g stroke='#2f4f4d' stroke-width='6' fill='none' opacity='.55'>
<path d='M40 120 H360 V300 H620'/><path d='M180 40 V420 H500 V560'/><path d='M600 80 V520'/>
</g>
<path d='M70 540 C 160 420, 120 300, 300 260 S 520 200, 560 380' fill='none' stroke='#ff2e88' stroke-width='3' stroke-dasharray='7 6' opacity='.9'/>
<g fill='none' stroke='#ff2e88' stroke-width='3'>
<circle cx='70' cy='540' r='7'/><circle cx='210' cy='330' r='7'/><circle cx='300' cy='260' r='7'/><circle cx='440' cy='230' r='7'/></g>
<circle cx='560' cy='380' r='9' fill='#12b8a2' stroke='#0a7d6f' stroke-width='3'/>
</svg>"""
mapuri = "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

# ---- override stylesheet ----
OV = """
<style id="v5">
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
/* v5 reskin: forensic-data light, colour is grammar (magenta=wrong/agent, teal=truth/operator).
   html:root + !important so it beats the original's !important custom properties and its
   prefers-color-scheme media block, at both light and dark. */
html:root, html:root[data-theme], :root{
  --bg:#f2f5f4!important;--panel:#ffffff!important;--panel-2:#ebf0ee!important;--well:#eef3f1!important;--code-bg:#eef3f1!important;
  --ink:#0e1618!important;--faded:#55615c!important;--line:#dde4e2!important;--line-soft:#eef2f1!important;
  --serif:"IBM Plex Sans Condensed","Arial Narrow",sans-serif!important;
  --sans:"IBM Plex Sans",system-ui,sans-serif!important;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace!important;
  --red:#c8145f!important;--warden:#c8145f!important;
  --gold:#0a7d6f!important;--gold-hi:#12b8a2!important;--green:#0a7d6f!important;--architect:#0a7d6f!important;--oracle:#0a7d6f!important;
  --engrave-lo:rgba(0,0,0,0)!important;--engrave-hi:rgba(0,0,0,0)!important;--grain-op:0!important;
}
@media(prefers-color-scheme:dark){html:root,:root{
  --bg:#f2f5f4!important;--panel:#ffffff!important;--ink:#0e1618!important;--faded:#55615c!important;--line:#dde4e2!important;--well:#eef3f1!important;--panel-2:#ebf0ee!important;
}}
body{background-color:var(--bg)!important;color:var(--ink)!important;font-family:var(--sans)!important;
  background-image:linear-gradient(#e6ece9 1px,transparent 1px),linear-gradient(90deg,#e6ece9 1px,transparent 1px)!important;
  background-size:32px 32px!important;background-attachment:fixed!important}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.06;
  background:url("__MAP__") center/cover;
  -webkit-mask-image:linear-gradient(#000 40%,transparent 78%);mask-image:linear-gradient(#000 40%,transparent 78%)}
h1,h2,h3,h4{font-family:var(--serif)!important;font-weight:700;letter-spacing:-.01em}
.mast h1,h1{font-size:clamp(30px,5.2vw,58px);line-height:1.02}
.mast h1 em{color:var(--faded);font-style:normal}
.kick,.agentmark{color:var(--red)}
/* hero additions */
.v5chip{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;
  letter-spacing:.14em;text-transform:uppercase;color:var(--faded);margin:0 0 18px}
.v5chip .dot{width:8px;height:8px;border-radius:50%;background:var(--red)}
.v5chip.live .dot{animation:v5pulse 1.4s ease-out infinite}
.v5chip.done .dot{background:var(--gold);animation:none}.v5chip.done b{color:var(--gold)}
@keyframes v5pulse{0%{box-shadow:0 0 0 0 rgba(200,20,95,.5)}70%{box-shadow:0 0 0 9px rgba(200,20,95,0)}100%{box-shadow:0 0 0 0 rgba(200,20,95,0)}}
.v5num{font-family:var(--serif);font-weight:700;font-size:clamp(66px,19vw,214px);line-height:.8;
  letter-spacing:-.02em;color:var(--gold);text-shadow:.05em .055em 0 var(--red);
  font-feature-settings:"tnum";margin:20px 0 2px}
.v5numsub{max-width:44ch;font-size:16px;border-top:2px solid var(--gold);padding-top:12px;color:var(--faded)}
.v5numsub b{color:var(--gold)}
.v5strip{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--line);
  border:1px solid var(--line);margin:34px 0;box-shadow:0 1px 2px rgba(16,30,32,.05)}
.v5strip .c{background:var(--panel);padding:18px 14px 14px;transition:transform .18s ease,box-shadow .18s ease}
.v5strip .c:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(16,30,32,.1)}
.v5strip .n{font-family:var(--serif);font-weight:700;font-size:clamp(26px,3.4vw,42px);line-height:.9}
.v5strip .c.bad .n{color:var(--red)}.v5strip .c.good .n{color:var(--gold)}
.v5strip .l{font-family:var(--mono);font-size:9px;letter-spacing:.07em;text-transform:uppercase;
  color:var(--faded);margin-top:8px;line-height:1.35}
/* component reskins */
.said{background:var(--panel)!important;border:1px solid var(--line)!important;border-left:3px solid var(--architect)!important;border-radius:0!important}
.said .who{color:var(--architect)!important}
.byline,.lede{color:var(--faded)}
.lede::first-letter{color:var(--gold)!important}
.brief dt{color:var(--gold)!important}
figure.code pre{background:var(--well)!important;border:1px solid var(--line)!important;border-left:2px solid var(--gold)!important;border-radius:0!important}
figure img{border:1px solid var(--line)!important;border-radius:0!important}
.app::after{color:var(--faded)!important}
.layer{border-top:1px solid var(--ink)!important;border-bottom:1px solid var(--line)!important;color:var(--faded)}
.corr td.q::before{color:var(--red)!important}
table th{color:var(--gold)!important}
@media(max-width:760px){.v5strip{grid-template-columns:repeat(2,1fr)}}
@media(prefers-reduced-motion:reduce){.v5chip .dot{animation:none!important}.v5num{transition:none}}
</style>
""".replace("__MAP__", mapuri)

# insert override right before </body> so it wins the cascade
html = html.replace("</body>", OV + "\n</body>", 1)

# ---- inject hero: live chip before h1, number+strip after the brief ----
html = html.replace('<header class="mast">',
    '<header class="mast">\n  <span class="v5chip live" id="v5chip"><span class="dot"></span>'
    '<b id="v5chiptxt">Decrypting local store</b></span>', 1)

HERO_NUM = '''
  <div class="v5num" id="v5num" data-to="78406">0</div>
  <p class="v5numsub"><b>messages decrypted</b> from the WhatsApp Desktop local store, once the guessing stopped and the reading began.</p>
  <div class="v5strip">
    <div class="c bad"><div class="n" data-to="5">0</div><div class="l">&#215; wrong answers</div></div>
    <div class="c"><div class="n" data-to="631" data-fmt="clock">0</div><div class="l">hours elapsed</div></div>
    <div class="c"><div class="n" data-to="4">0</div><div class="l">years of archive</div></div>
    <div class="c"><div class="n" data-to="597">0</div><div class="l">conversations</div></div>
    <div class="c"><div class="n" data-to="165" data-fmt="m">0</div><div class="l">output tokens</div></div>
    <div class="c good"><div class="n" data-to="0" data-txt="Daphne">0</div><div class="l">&#10003; the one street</div></div>
  </div>'''
# place the number block right after the brief's closing (brief ends before .target or mast end)
html = html.replace('</header>', HERO_NUM + '\n</header>', 1)

# ---- count-up + chip JS before </body> ----
JS = '''
<script>
(function(){
 var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function fmt(v,k){if(k==='clock'){var h=Math.floor(v/60),m=v%60;return h+':'+String(m).padStart(2,'0');}
  if(k==='m')return (v/100).toFixed(2)+'M';return v.toLocaleString();}
 function up(el){var txt=el.getAttribute('data-txt');if(txt){el.textContent=txt;return;}
  var to=+el.dataset.to,k=el.dataset.fmt,d=900;if(reduce){el.textContent=fmt(to,k);return;}
  var t0=performance.now();(function s(t){var p=Math.min(1,(t-t0)/d),e=1-Math.pow(1-p,3);
   el.textContent=fmt(Math.round(to*e),k);if(p<1)requestAnimationFrame(s);})(performance.now());}
 addEventListener('load',function(){
  document.querySelectorAll('[data-to]').forEach(function(el,i){setTimeout(function(){up(el);},reduce?0:140+i*80);});
  setTimeout(function(){var c=document.getElementById('v5chip');if(c){c.className='v5chip done';
   document.getElementById('v5chiptxt').textContent='Resolved \\u00b7 Daphne';}},reduce?0:1500);
 });
})();
</script>'''
html = html.replace("</body>", JS + "\n</body>", 1)

io.open(OUT, "w", encoding="utf-8").write(html)
print("wrote", OUT, len(html)//1024, "KB")
print("checks: v5 style block", html.count('id="v5"'),
      "| hero num", html.count('id="v5num"'),
      "| chip", html.count('id="v5chip"'),
      "| map svg embedded", 'data:image/svg' in html)
