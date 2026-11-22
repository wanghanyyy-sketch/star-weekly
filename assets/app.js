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
const plainGuide=r=>(window.STAR_SIMPLE_GUIDES||{})[r.name]||{
  title:firstSeg(r.name),
  one:r.zhSummary||'这个新上榜项目尚未完成通俗解读，可以先查看项目作者的原始介绍。',
  example:r.useCase||'目前还没有核实可靠的实际使用示例。',
  who:r.audience||'适用对象尚待核实',
  how:'先阅读 GitHub 仓库说明，确认功能、部署条件和使用步骤。',
  level:'使用门槛待核实',
  note:'这是新上榜项目的基础信息，通俗介绍尚未人工整理，请以官方 README 为准。'
};
function plainGuideHTML(r){
 const g=plainGuide(r);
 return `<section class="plain-guide" aria-label="用大白话了解项目">
 <div class="plain-kicker"><span>30 秒看懂</span><span class="plain-level">${html(g.level)}</span></div>
 <h3>${html(g.title)}</h3>
 <p class="plain-one">${html(g.one)}</p>
 <div class="plain-example"><strong>举个实际例子</strong><p>${html(g.example)}</p></div>
 <div class="plain-facts"><div><strong>适合谁</strong><p>${html(g.who)}</p></div><div><strong>怎样使用</strong><p>${html(g.how)}</p></div></div>
 <p class="plain-note"><b>使用前注意：</b>${html(g.note)}</p>
 </section>`;
}

const categoryLabel=c=>({'AI / Agent':'AI 智能体','AI/Agent':'AI 智能体'}[c]||c||'其他');
const categoryIcon=r=>r.category?.includes('AI')?'✳':r.category?.includes('网页')?'⌘':r.category?.includes('生活')?'◈':'⟡';
const trustedImage=u=>{try{let p=new URL(String(u));return p.protocol==='https:'&&['raw.githubusercontent.com','github.com','user-images.githubusercontent.com','private-user-images.githubusercontent.com','lookaside.facebook.com','media.githubusercontent.com','opengraph.githubassets.com','repository-images.githubusercontent.com'].includes(p.hostname)?p.href:null}catch{return null}};
const imageItems=r=>(r.visuals||[]).filter(v=>trustedImage(v.url)&&/^\.\/assets\/media\/[a-f0-9]{20}\.webp$/.test(v.cachedUrl||'')).slice(0,5);
const imageSrc=v=>/^\.\/assets\/media\/[a-f0-9]{20}\.webp$/.test(v.cachedUrl||'')?v.cachedUrl:trustedImage(v.url);
const warmImage=r=>{if(!r)return;const g=imageItems(r)[0];if(g){const im=new Image();im.src=imageSrc(g)}};

function init(){
 const arr=(data.repos||[]).slice().sort((a,b)=>b.weeklyStars-a.weeklyStars);
 $('#updated').textContent='采集于 '+when(data.collectedAt);$('#sideUpdate').textContent='最近一次采集：'+when(data.collectedAt);
 $('#metricProjects').textContent=fmt(arr.length);$('#metricStars').textContent='+'+compact(arr.reduce((s,r)=>s+Number(r.weeklyStars||0),0));
 const langs={};arr.forEach(r=>langs[r.language||'未知']=(langs[r.language||'未知']||0)+1);
 $('#metricLanguage').textContent=Object.keys(langs).sort((a,b)=>langs[b]-langs[a])[0]||'—';
 for(const [id,vals] of [['language',Object.keys(langs)],['category',[...new Set(arr.map(r=>r.category||'其他'))]]]){
  const el=$('#'+id), current=el.value;
  el.innerHTML='<option value="all">全部'+(id==='language'?'语言':'分类')+'</option>'+vals.sort().map(v=>`<option value="${html(v)}">${html(id==='category'?categoryLabel(v):v)}</option>`).join('');
  if(vals.includes(current))el.value=current;
 }
 $('#spotlights').innerHTML=arr.slice(0,3).map((r,i)=>`<button type="button" class="spotlight" data-name="${html(r.name)}" aria-label="查看 ${html(r.name)} 的图文详解"><div class="spot-top"><span class="spot-rank">本周第 ${i+1} 名</span><span class="spot-icon">${categoryIcon(r)}</span></div><div class="spot-name">${html(plainGuide(r).title)}</div><div class="spot-desc">${html(plainGuide(r).one)}</div><div class="spot-repo">${html(r.name)}</div><div class="spot-foot"><span>${html(r.language||'未知')} · ${html(categoryLabel(r.category))}</span><span class="weekly-green">+${fmt(r.weeklyStars)} ★</span></div><div class="spot-hint">查看图文详解 <span>↗</span></div></button>`).join('');
 $('#spotlights').querySelectorAll('[data-name]').forEach(x=>{x.addEventListener('click',()=>openDetails(x.dataset.name));x.addEventListener('pointerenter',()=>warmImage((data.repos||[]).find(r=>r.name===x.dataset.name)),{once:true})});
 filter();
}
function filter(){
 const q=$('#search').value.trim().toLowerCase(),lang=$('#language').value,cat=$('#category').value,sort=$('#sort').value;
 filtered=(data.repos||[]).filter(r=>(lang==='all'||r.language===lang)&&(cat==='all'||r.category===cat)&&(!q||[r.name,r.description,r.zhSummary,r.category,r.useCase,plainGuide(r).title,plainGuide(r).one,plainGuide(r).example,...(r.tags||[]),...(r.features||[])].join(' ').toLowerCase().includes(q)));
 filtered.sort((a,b)=>sort==='total'?b.stars-a.stars:sort==='growth'?pct(b)-pct(a):b.weeklyStars-a.weeklyStars);
 $('#countLabel').textContent='共 '+filtered.length+' 个项目';$('#empty').hidden=filtered.length>0;
 $('#repoList').innerHTML=filtered.map((r,i)=>`<button class="repo-row" type="button" data-name="${html(r.name)}" aria-label="查看 ${html(r.name)} 的图文详解"><div class="repo-left"><span class="repo-rank ${i===0?'first':''}">${String(i+1).padStart(2,'0')}</span><span class="repo-badge">${categoryIcon(r)}</span><div class="repo-info"><div class="repo-easy-title">${html(plainGuide(r).title)}</div><div class="repo-description">${html(plainGuide(r).one)}</div><div class="repo-name">${html(r.name)}</div><span class="repo-readmore">查看实际用途和使用方法 ↗</span></div></div><div class="repo-language"><span class="dot"></span>${html(r.language||'未知')}</div><div class="repo-total">${html(compact(r.stars))}${r.starsApprox?' ≈':''}</div><div class="repo-weekly"><strong>+${fmt(r.weeklyStars)} ★</strong><small>周增约 ${pct(r)}%</small></div></button>`).join('');
 $('#repoList').querySelectorAll('.repo-row').forEach(x=>{x.addEventListener('click',()=>openDetails(x.dataset.name));x.addEventListener('pointerenter',()=>warmImage((data.repos||[]).find(r=>r.name===x.dataset.name)),{once:true})});
}
function overview(r){
 const parts=(r.features&&r.features.length?r.features:['发现项目','阅读文档','核实功能']).slice(0,3);
 return `<div class="visual-overview" role="img" aria-label="${html(r.name)} 的主要功能结构示意图，非软件真实界面"><div class="overview-top"><span>项目功能速览</span><span class="overview-type">${html(categoryLabel(r.category))}</span></div><div class="overview-center"><div class="overview-emblem">${categoryIcon(r)}</div><strong>${html(firstSeg(r.name))}</strong><small>${html(r.zhSummary||r.description||'开源项目')}</small></div><div class="overview-arrows"><span></span><span></span><span></span></div><div class="overview-features">${parts.map((f,i)=>`<div class="overview-chip"><span>0${i+1}</span><b>${html(f)}</b></div>`).join('')}</div><div class="overview-label">结构示意图，仅解释功能，不代表产品实际界面</div></div>`;
}
function galleryHTML(r){
 const shots=imageItems(r);
 if(!shots.length)return `<div class="media-head"><h3>项目视觉速览</h3><span>功能示意图</span></div>${overview(r)}<p class="media-note">该项目当前没有可用的本站配图，因此显示功能示意图。手机无需连接外部图床，真实界面可在原项目 README 中查看。</p>`;
 const g=shots[0];
 return `<div class="media-head"><h3>项目视觉速览</h3><span>官方资料配图 ${shots.length} 张</span></div><div class="media-stage"><a id="mediaLink" href="${html(trustedImage(g.url))}" target="_blank" rel="noopener noreferrer" title="打开原始图片"><div class="media-placeholder"><div class="loading-shot"><span class="shot-spinner"></span><strong>正在加载官方项目图片…</strong><small>优先加载压缩预览图，加载完成后显示真实图片</small></div></div><img id="mediaImage" src="${html(imageSrc(g))}" alt="${html(g.alt)}" decoding="async" loading="eager" fetchpriority="high" referrerpolicy="no-referrer"><div class="image-failure" hidden><p>官方配图暂时无法加载，以下为项目功能示意图。</p>${overview(r)}</div></a><div class="media-caption"><span id="mediaCaption">${html(g.alt)}</span><span id="mediaSource">${html(g.source||'项目 README 配图')}</span></div></div>${shots.length>1?`<div class="gallery-nav">${shots.map((v,i)=>`<button type="button" class="gallery-thumb ${i===0?'active':''}" data-gallery-index="${i}" aria-label="查看第 ${i+1} 张图片" aria-pressed="${i===0?'true':'false'}"><span>${String(i+1).padStart(2,'0')}</span>${html(v.alt)}</button>`).join('')}</div>`:''}<details class="diagram-expand"><summary>查看项目功能示意图 <span>⌄</span></summary>${overview(r)}</details><p class="media-note">图片来自该项目的公开 README，并非本站制作；点击大图可查看原图。功能图仅用于中文解释。</p>`;
}
function updateGallery(i){
 if(!selectedRepo)return;
 const shots=imageItems(selectedRepo);if(i<0||i>=shots.length)return;
 galleryIndex=i;
 const g=shots[i];const im=$('#mediaImage');if(!im)return;
 const failed=$('.image-failure');if(failed)failed.hidden=true;im.classList.remove('is-ready');
 const place=$('.media-placeholder');if(place)place.hidden=false;
 im.dataset.fallback='';im.dataset.originalSrc=trustedImage(g.url);im.src=imageSrc(g);im.alt=g.alt;
 $('#mediaLink').href=trustedImage(g.url);
 $('#mediaCaption').textContent=g.alt;$('#mediaSource').textContent=g.source||'项目 README 配图';
 $('#drawerContent').querySelectorAll('.gallery-thumb').forEach(b=>{const on=+b.dataset.galleryIndex===i;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
}
function openDetails(name){
 const r=(data.repos||[]).find(p=>p.name===name);if(!r)return;
 selectedRepo=r;galleryIndex=0;lastFocus=document.activeElement;
 const features=(r.features||[]).slice(0,6);
 const content=`<div class="drawer-label">开源星榜 / 项目图文解读</div><div class="drawer-heading"><div class="drawer-logo">${categoryIcon(r)}</div><div><p class="drawer-owner">${html(r.name.split('/')[0])} / GitHub 开源仓库</p><h2 class="drawer-title">${html(plainGuide(r).title)}</h2></div></div><p class="drawer-lead">原项目：${html(r.name)}</p><div class="drawer-tags"><span>${html(r.language||'未知语言')}</span><span>${html(categoryLabel(r.category))}</span>${(r.tags||[]).slice(0,5).map(t=>`<span>${html(t)}</span>`).join('')}</div>${plainGuideHTML(r)}<div class="drawer-stats"><div class="drawer-stat"><b>+${compact(r.weeklyStars)}</b><span>本期榜单周增 Star</span></div><div class="drawer-stat"><b>${compact(r.stars)}${r.starsApprox?'≈':''}</b><span>仓库总 Star${r.starsApprox?'（近似）':''}</span></div><div class="drawer-stat"><b>${pct(r)}%</b><span>相对增长（约）</span></div></div><section class="detail-section">${galleryHTML(r)}</section><details class="advanced-more"><summary>需要更详细的技术说明？点击展开</summary><section class="detail-section"><div class="detail-kicker">01 / 快速了解</div><h3>一分钟看懂这个项目</h3><p class="detail-text">${html(r.zhSummary||r.description||'请前往 GitHub 仓库查看项目介绍。')}</p><div class="usecase-panel"><div class="usecase-symbol">↗</div><div><strong>实际可以用来做什么？</strong><p>${html(r.useCase||'结合自己的实际需求，查看仓库文档了解项目能力。')}</p></div></div></section><section class="detail-section"><div class="detail-kicker">02 / 核心功能</div><h3>核心功能拆解</h3>${features.length?`<div class="feature-grid">${features.map((f,i)=>`<div class="feature-card"><span class="feature-index">0${i+1}</span><div class="feature-sign">${['✦','⌘','◇','▣','◉','⚙'][i]}</div><strong>${html(f)}</strong><p>${html((r.featureDetails||[])[i]||'具体实现与适用条件请查看项目 README。')}</p></div>`).join('')}</div>`:`<p class="detail-text">暂无结构化功能列表，可在原项目 README 中了解详细功能。</p>`}</section><section class="detail-section"><div class="detail-kicker">03 / 适用人群</div><h3>适合什么人使用？</h3><p class="detail-text">${html(r.audience||'对该技术方向感兴趣，并愿意阅读项目文档的开发者或用户。')}</p><div class="reader-tip"><strong>阅读建议</strong><p>先看官方 README 的演示、安装方法、最近更新和许可证，再决定是否尝试部署或集成到自己的项目中。</p></div></section><section class="detail-section"><div class="detail-kicker">04 / 原始资料</div><h3>开发者原始说明</h3><p class="detail-text original-text">${html(r.description||'暂无英文原始摘要')}</p>${r.readmeIntro?`<p class="detail-text original-text">README 摘要：${html(r.readmeIntro)}</p>`:''}</section></details><div class="drawer-actions"><a href="${ghURL(r.name)}" target="_blank" rel="noopener noreferrer">查看 GitHub 仓库 ↗</a><a class="secondary" href="${ghURL(r.name)}#readme" target="_blank" rel="noopener noreferrer">阅读 README ↗</a></div><p class="source-note">本期数据采集于 ${html(when(data.collectedAt))}。中文说明来自测试版编辑内容；后续新增项目不保证自动生成中文解读。图片均注明来源，可能受网络或原项目文件变动影响。Star 数值仅代表当时快照。</p>`;
 $('#drawerContent').innerHTML=content;
 $('#drawerBackdrop').hidden=false;$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');document.body.classList.add('drawer-open');
 const scroll=$('.drawer-scroll');if(scroll)scroll.scrollTop=0;
 const im=$('#mediaImage');if(im){
    const showImage=()=>{im.classList.add('is-ready');const place=$('.media-placeholder');if(place)place.hidden=true;const failed=$('.image-failure');if(failed)failed.hidden=true};
    const showError=()=>{im.classList.remove('is-ready');const place=$('.media-placeholder');if(place)place.hidden=true;const failed=$('.image-failure');if(failed)failed.hidden=false};
    im.dataset.originalSrc=trustedImage(imageItems(r)[0]?.url)||'';
    im.addEventListener('load',showImage);im.addEventListener('error',showError);
    if(im.complete){if(im.naturalWidth)showImage();else showError()}
  }
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
