(()=>{
'use strict';
const data=window.GITHUB_WEEKLY_DATA||{repos:[],collectedAt:null,mode:'missing'};
let filtered=[];
let selectedRepo=null;
let galleryIndex=0;
let lastFocus=null;
const $=s=>document.querySelector(s);
const fmt=n=>new Intl.NumberFormat('en-US').format(Number(n)||0);
const compact=n=>Number(n)>=1000?(Math.round(Number(n)/100)/10)+'k':fmt(n);
const html=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ghURL=name=>'https://github.com/'+String(name).split('/').map(encodeURIComponent).join('/');
const pct=r=>r.stars>r.weeklyStars?Math.round(r.weeklyStars/(r.stars-r.weeklyStars)*100):0;
const when=iso=>{if(!iso)return'暂无';const d=new Date(iso);return isNaN(d)?'暂无':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+'（北京时间）'};
const firstSeg=n=>n.split('/')[1]||n;
const categoryIcon=r=>r.category?.includes('AI')?'✳':r.category?.includes('网页')?'⌘':r.category?.includes('生活')?'◈':'⟡';
const trustedImage=u=>{try{let p=new URL(String(u));return p.protocol==='https:'&&['raw.githubusercontent.com','github.com','user-images.githubusercontent.com','private-user-images.githubusercontent.com','lookaside.facebook.com','media.githubusercontent.com','opengraph.githubassets.com','repository-images.githubusercontent.com'].includes(p.hostname)?p.href:null}catch{return null}};
const imageItems=r=>(r.visuals||[]).filter(v=>trustedImage(v.url)).slice(0,5);
function init(){
 const arr=(data.repos||[]).slice().sort((a,b)=>b.weeklyStars-a.weeklyStars);
 $('#updated').textContent='采集于 '+when(data.collectedAt);$('#sideUpdate').textContent='最近一次采集：'+when(data.collectedAt);
 $('#metricProjects').textContent=fmt(arr.length);$('#metricStars').textContent='+'+compact(arr.reduce((s,r)=>s+Number(r.weeklyStars||0),0));
 const langs={};arr.forEach(r=>langs[r.language||'未知']=(langs[r.language||'未知']||0)+1);
 $('#metricLanguage').textContent=Object.keys(langs).sort((a,b)=>langs[b]-langs[a])[0]||'—';
 for(const [id,vals] of [['language',Object.keys(langs)],['category',[...new Set(arr.map(r=>r.category||'其他'))]]]){
  const el=$('#'+id), current=el.value;
  el.innerHTML='<option value="all">全部'+(id==='language'?'语言':'分类')+'</option>'+vals.sort().map(v=>`<option value="${html(v)}">${html(v)}</option>`).join('');
  if(vals.includes(current))el.value=current;
 }
 $('#spotlights').innerHTML=arr.slice(0,3).map((r,i)=>`<button type="button" class="spotlight" data-name="${html(r.name)}" aria-label="查看 ${html(r.name)} 的图文详解"><div class="spot-top"><span class="spot-rank">0${i+1} / THIS WEEK</span><span class="spot-icon">${categoryIcon(r)}</span></div><div class="spot-name">${html(firstSeg(r.name))}</div><div class="spot-desc">${html(r.zhSummary||r.description||'项目介绍待补充')}</div><div class="spot-foot"><span>${html(r.language||'未知')} · ${html(r.category||'其他')}</span><span class="weekly-green">+${fmt(r.weeklyStars)} ★</span></div><div class="spot-hint">查看图文详解 <span>↗</span></div></button>`).join('');
 $('#spotlights').querySelectorAll('[data-name]').forEach(x=>x.addEventListener('click',()=>openDetails(x.dataset.name)));
 filter();
}
function filter(){
 const q=$('#search').value.trim().toLowerCase(),lang=$('#language').value,cat=$('#category').value,sort=$('#sort').value;
 filtered=(data.repos||[]).filter(r=>(lang==='all'||r.language===lang)&&(cat==='all'||r.category===cat)&&(!q||[r.name,r.description,r.zhSummary,r.category,r.useCase,...(r.tags||[]),...(r.features||[])].join(' ').toLowerCase().includes(q)));
 filtered.sort((a,b)=>sort==='total'?b.stars-a.stars:sort==='growth'?pct(b)-pct(a):b.weeklyStars-a.weeklyStars);
 $('#countLabel').textContent='共 '+filtered.length+' 个项目';$('#empty').hidden=filtered.length>0;
 $('#repoList').innerHTML=filtered.map((r,i)=>`<button class="repo-row" type="button" data-name="${html(r.name)}" aria-label="查看 ${html(r.name)} 的图文详解"><div class="repo-left"><span class="repo-rank ${i===0?'first':''}">${String(i+1).padStart(2,'0')}</span><span class="repo-badge">${categoryIcon(r)}</span><div class="repo-info"><div class="repo-name">${html(r.name)}</div><div class="repo-description">${html(r.zhSummary||r.description||'暂无说明')}</div><span class="repo-readmore">图文解读 ↗</span></div></div><div class="repo-language"><span class="dot"></span>${html(r.language||'未知')}</div><div class="repo-total">${html(compact(r.stars))}${r.starsApprox?' ≈':''}</div><div class="repo-weekly"><strong>+${fmt(r.weeklyStars)} ★</strong><small>周增约 ${pct(r)}%</small></div></button>`).join('');
 $('#repoList').querySelectorAll('.repo-row').forEach(x=>x.addEventListener('click',()=>openDetails(x.dataset.name)));
}
function overview(r){
 const parts=(r.features&&r.features.length?r.features:['发现项目','阅读文档','核实功能']).slice(0,3);
 return `<div class="visual-overview" role="img" aria-label="${html(r.name)} 的主要功能结构示意图，非软件真实界面"><div class="overview-top"><span>FEATURE MAP · 功能速览</span><span class="overview-type">${html(r.category||'开源项目')}</span></div><div class="overview-center"><div class="overview-emblem">${categoryIcon(r)}</div><strong>${html(firstSeg(r.name))}</strong><small>${html(r.zhSummary||r.description||'开源项目')}</small></div><div class="overview-arrows"><span></span><span></span><span></span></div><div class="overview-features">${parts.map((f,i)=>`<div class="overview-chip"><span>0${i+1}</span><b>${html(f)}</b></div>`).join('')}</div><div class="overview-label">结构示意图，仅解释功能，不代表产品实际界面</div></div>`;
}
function galleryHTML(r){
 const shots=imageItems(r);
 if(!shots.length)return `<div class="media-head"><h3>项目视觉速览</h3><span>功能示意图</span></div>${overview(r)}<p class="media-note">该仓库暂无适合展示的官方截图，先用功能结构图说明项目主要内容。真实界面请查看项目 README。</p>`;
 const g=shots[0];
 return `<div class="media-head"><h3>项目视觉速览</h3><span>官方资料配图 ${shots.length} 张</span></div><div class="media-stage"><a id="mediaLink" href="${html(trustedImage(g.url))}" target="_blank" rel="noopener noreferrer" title="打开原始图片"><div class="media-placeholder">${overview(r)}</div><img id="mediaImage" src="${html(trustedImage(g.url))}" alt="${html(g.alt)}" loading="eager" referrerpolicy="no-referrer"><div class="image-failure" hidden>官方图片暂时无法加载，当前显示项目功能示意图。</div></a><div class="media-caption"><span id="mediaCaption">${html(g.alt)}</span><span id="mediaSource">${html(g.source||'项目 README 配图')}</span></div></div>${shots.length>1?`<div class="gallery-nav">${shots.map((v,i)=>`<button type="button" class="gallery-thumb ${i===0?'active':''}" data-gallery-index="${i}" aria-label="查看第 ${i+1} 张图片" aria-pressed="${i===0?'true':'false'}"><span>${String(i+1).padStart(2,'0')}</span>${html(v.alt)}</button>`).join('')}</div>`:''}<details class="diagram-expand"><summary>查看项目功能示意图 <span>⌄</span></summary>${overview(r)}</details><p class="media-note">图片来自该项目的公开 README，并非本站制作；点击大图可查看原图。功能图仅用于中文解释。</p>`;
}
function updateGallery(i){
 if(!selectedRepo)return;
 const shots=imageItems(selectedRepo);if(i<0||i>=shots.length)return;
 galleryIndex=i;
 const g=shots[i];const im=$('#mediaImage');if(!im)return;
 const failed=$('.image-failure');if(failed)failed.hidden=true;im.classList.remove('is-ready');
 const place=$('.media-placeholder');if(place)place.hidden=false;
 im.src=trustedImage(g.url);im.alt=g.alt;
 $('#mediaLink').href=trustedImage(g.url);
 $('#mediaCaption').textContent=g.alt;$('#mediaSource').textContent=g.source||'项目 README 配图';
 $('#drawerContent').querySelectorAll('.gallery-thumb').forEach(b=>{const on=+b.dataset.galleryIndex===i;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
}
function openDetails(name){
 const r=(data.repos||[]).find(p=>p.name===name);if(!r)return;
 selectedRepo=r;galleryIndex=0;lastFocus=document.activeElement;
 const features=(r.features||[]).slice(0,6);
 const content=`<div class="drawer-label">STAR SCOPE / 中文开源项目图解</div><div class="drawer-heading"><div class="drawer-logo">${categoryIcon(r)}</div><div><p class="drawer-owner">${html(r.name.split('/')[0])} / GITHUB REPOSITORY</p><h2 class="drawer-title">${html(firstSeg(r.name))}</h2></div></div><p class="drawer-lead">${html(r.zhSummary||r.description||'暂无中文项目介绍，可查阅原始 README。')}</p><div class="drawer-tags"><span>${html(r.language||'未知语言')}</span><span>${html(r.category||'其他')}</span>${(r.tags||[]).slice(0,5).map(t=>`<span>${html(t)}</span>`).join('')}</div><div class="drawer-stats"><div class="drawer-stat"><b>+${compact(r.weeklyStars)}</b><span>本期榜单周增 Star</span></div><div class="drawer-stat"><b>${compact(r.stars)}${r.starsApprox?'≈':''}</b><span>仓库总 Star${r.starsApprox?'（近似）':''}</span></div><div class="drawer-stat"><b>${pct(r)}%</b><span>相对增长（约）</span></div></div><section class="detail-section">${galleryHTML(r)}</section><section class="detail-section"><div class="detail-kicker">01 / IN ONE MINUTE</div><h3>一分钟看懂这个项目</h3><p class="detail-text">${html(r.zhSummary||r.description||'请前往 GitHub 仓库查看项目介绍。')}</p><div class="usecase-panel"><div class="usecase-symbol">↗</div><div><strong>实际可以用来做什么？</strong><p>${html(r.useCase||'结合自己的实际需求，查看仓库文档了解项目能力。')}</p></div></div></section><section class="detail-section"><div class="detail-kicker">02 / WHAT IT DOES</div><h3>核心功能拆解</h3>${features.length?`<div class="feature-grid">${features.map((f,i)=>`<div class="feature-card"><span class="feature-index">0${i+1}</span><div class="feature-sign">${['✦','⌘','◇','▣','◉','⚙'][i]}</div><strong>${html(f)}</strong><p>${html((r.featureDetails||[])[i]||'具体实现与适用条件请查看项目 README。')}</p></div>`).join('')}</div>`:`<p class="detail-text">暂无结构化功能列表，可在原项目 README 中了解详细功能。</p>`}</section><section class="detail-section"><div class="detail-kicker">03 / WHO IT IS FOR</div><h3>适合什么人使用？</h3><p class="detail-text">${html(r.audience||'对该技术方向感兴趣，并愿意阅读项目文档的开发者或用户。')}</p><div class="reader-tip"><strong>阅读建议</strong><p>先看官方 README 的演示、安装方法、最近更新和许可证，再决定是否尝试部署或集成到自己的项目中。</p></div></section><section class="detail-section"><div class="detail-kicker">04 / ORIGINAL SOURCE</div><h3>开发者原始说明</h3><p class="detail-text original-text">${html(r.description||'暂无英文原始摘要')}</p>${r.readmeIntro?`<p class="detail-text original-text">README 摘要：${html(r.readmeIntro)}</p>`:''}</section><div class="drawer-actions"><a href="${ghURL(r.name)}" target="_blank" rel="noopener noreferrer">查看 GitHub 仓库 ↗</a><a class="secondary" href="${ghURL(r.name)}#readme" target="_blank" rel="noopener noreferrer">阅读 README ↗</a></div><p class="source-note">本期数据采集于 ${html(when(data.collectedAt))}。中文说明来自测试版编辑内容；后续新增项目不保证自动生成中文解读。图片均注明来源，可能受网络或原项目文件变动影响。Star 数值仅代表当时快照。</p>`;
 $('#drawerContent').innerHTML=content;
 $('#drawerBackdrop').hidden=false;$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');document.body.classList.add('drawer-open');
 const scroll=$('.drawer-scroll');if(scroll)scroll.scrollTop=0;
 const im=$('#mediaImage');if(im){im.addEventListener('load',()=>{im.classList.add('is-ready');const place=$('.media-placeholder');if(place)place.hidden=true;const failed=$('.image-failure');if(failed)failed.hidden=true});im.addEventListener('error',()=>{im.classList.remove('is-ready');const place=$('.media-placeholder');if(place)place.hidden=false;const failed=$('.image-failure');if(failed)failed.hidden=false});}
 $('#drawerContent').querySelectorAll('.gallery-thumb').forEach(b=>b.addEventListener('click',()=>updateGallery(+b.dataset.galleryIndex)));
 $('#closeDrawer').focus();
}
function closeDetails(){if(!$('#drawer').classList.contains('open'))return;$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#drawerBackdrop').hidden=true;document.body.classList.remove('drawer-open');selectedRepo=null;if(lastFocus?.focus)lastFocus.focus()}
function exportCsv(){const fields=['排名','仓库','分类','编程语言','近7天新增Star','总Star','总Star是否近似','中文摘要','原始项目描述','GitHub链接'];const rows=filtered.map((r,i)=>[i+1,r.name,r.category,r.language,r.weeklyStars,r.stars,r.starsApprox?'是':'否',r.zhSummary||'',r.description||'',ghURL(r.name)]);const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';const csv='\ufeff'+[fields,...rows].map(row=>row.map(esc).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='github-weekly-'+(data.collectedAt||'snapshot').slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
for(const id of ['search','language','category','sort'])$('#'+id).addEventListener(id==='search'?'input':'change',filter);
$('#reset').addEventListener('click',()=>{$('#search').value='';$('#language').value='all';$('#category').value='all';$('#sort').value='weekly';filter()});
$('#closeDrawer').addEventListener('click',closeDetails);$('#drawerBackdrop').addEventListener('click',closeDetails);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetails()});$('#exportCsv').addEventListener('click',exportCsv);
init();
})();
