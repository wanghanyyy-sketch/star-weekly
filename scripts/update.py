#!/usr/bin/env python3
"""每日读取 GitHub Trending 周榜，失败时保留已有快照。"""
import base64,json,os,re,sys
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import quote,urljoin,urlparse
from posixpath import dirname
import requests
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
SOURCE="https://github.com/trending?since=weekly"
API={"Accept":"application/vnd.github+json","User-Agent":"StarScope-Bot/1.0"}
if os.getenv("GITHUB_TOKEN"): API["Authorization"]="Bearer "+os.environ["GITHUB_TOKEN"]
s=requests.Session()
def stars(t):
 n=re.sub(r"[^0-9]","",t or "")
 return int(n) if n else 0
def extract():
 r=s.get(SOURCE,headers={"User-Agent":"Mozilla/5.0 StarScope-Bot/1.0"},timeout=35);r.raise_for_status()
 soup=BeautifulSoup(r.text,"html.parser")
 rows=[]
 for row in soup.select("article.Box-row"):
  head=row.select_one("h2 a[href]")
  if not head:continue
  name=head.get("href","").strip("/").split("?")[0]
  if name.count("/")!=1:continue
  gain=re.search(r"([0-9,]+)\\s+stars?\\s+this\\s+week",row.get_text(" ",strip=True),re.I)
  if not gain:continue
  desc=row.select_one("p");lang=row.select_one('[itemprop="programmingLanguage"]');total=row.select_one('a[href$="/stargazers"]')
  rows.append({"name":name,"description":desc.get_text(" ",strip=True) if desc else "","language":lang.get_text(" ",strip=True) if lang else "未知","stars":stars(total.get_text(" ",strip=True) if total else ""),"starsApprox":False,"weeklyStars":stars(gain.group(1)),"tags":[]})
 if not rows:raise RuntimeError("GitHub Trending 结构发生变化或访问受限；保留旧数据")
 return sorted(rows,key=lambda p:p["weeklyStars"],reverse=True)
def classify(p):
 t=(p["name"]+" "+p.get("description","")).lower()
 if any(k in t for k in ("agent","llm","mcp","claude","ai assistant")):return "AI / Agent"
 if any(k in t for k in ("web","frontend","react","css","ui ","design system")):return "网页开发"
 if any(k in t for k in ("developer","cli","code","terminal","editor")):return "开发工具"
 return "其他"
ALLOW={"raw.githubusercontent.com","github.com","user-images.githubusercontent.com","private-user-images.githubusercontent.com","media.githubusercontent.com","lookaside.facebook.com"}
def readme(name,branch):
 try:
  r=s.get("https://api.github.com/repos/"+quote(name,safe="/")+"/readme",headers=API,timeout=12)
  if not r.ok:return "",[]
  doc=r.json();raw=base64.b64decode(doc.get("content","")).decode("utf-8","replace")[:150000]
  intro=" ".join(re.sub(r"[\`*_]","",t).strip() for t in raw.splitlines() if len(t.strip())>45 and not t.lstrip().startswith(("#","<","|","-","!","[","*","\\`")))[:360]
  base="https://raw.githubusercontent.com/"+quote(name,safe="/")+"/"+quote(branch,safe="")+"/"+dirname(doc.get("path","README.md")).strip("/")+"/"
  pics=[];seen=set()
  items=[(x.get("src",""),x.get("alt","")) for x in BeautifulSoup(raw,"html.parser").find_all("img")]
  items+= [(url.split(' "',1)[0],alt) for alt,url in re.findall(r"!\\[([^]]*)\\]\\(([^)]+)\\)",raw)]
  for url,alt in items:
   addr=urljoin(base,url.strip());p=urlparse(addr)
   if p.scheme!="https" or p.hostname not in ALLOW or addr in seen:continue
   if not re.search(r"\\.(png|jpe?g|gif|webp|svg)(?:$|\\?)",addr,re.I):continue
   if any(w in addr.lower() for w in ("badge","shields.io","star-history","github-readme-stats","counter")):continue
   seen.add(addr);pics.append({"url":addr,"alt":alt[:130] or "项目 README 官方配图","source":"项目 README 配图"})
   if len(pics)>=3:break
  return intro,pics
 except (requests.RequestException,ValueError,KeyError) as e:
  print("README error",name,e,file=sys.stderr);return "",[]
def main():
 old=json.loads((DATA/"trending.json").read_text(encoding="utf-8")) if (DATA/"trending.json").exists() else {"repos":[]}
 cached={r["name"]:r for r in old.get("repos",[])}
 repos=extract()
 for r in repos:
  prev=cached.get(r["name"],{})
  for key in ("zhSummary","features","audience","useCase","featureDetails"):
   if prev.get(key):r[key]=prev[key]
  r["category"]=prev.get("category") or classify(r)
  try:
   response=s.get("https://api.github.com/repos/"+quote(r["name"],safe="/"),headers=API,timeout=12)
   info=response.json() if response.ok else {}
  except requests.RequestException:info={}
  r["stars"]=info.get("stargazers_count",r["stars"])
  r["description"]=info.get("description") or r["description"]
  r["language"]=info.get("language") or r["language"]
  r["tags"]=info.get("topics") or prev.get("tags",[])
  r["homepage"]=info.get("homepage") or ""
  intro,imgs=readme(r["name"],info.get("default_branch") or "main")
  r["readmeIntro"]=intro or prev.get("readmeIntro","")
  r["visuals"]=imgs or prev.get("visuals",[])
 now=datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
 data={"collectedAt":now,"source":SOURCE,"sourceOriginal":SOURCE,"mode":"live","note":"GitHub Trending 近7天上榜项目，按页面显示的周增 Star 排序，并非全平台完整增长榜。","repos":repos}
 DATA.mkdir(exist_ok=True)
 (DATA/"trending.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 (DATA/"snapshot.js").write_text("window.GITHUB_WEEKLY_DATA = "+json.dumps(data,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
 history_path=DATA/"history.json"
 try:history=json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else []
 except ValueError:history=[]
 history=[h for h in history if h.get("date")!=now[:10]]
 history.append({"date":now[:10],"collectedAt":now,"repos":[{"name":p["name"],"stars":p["stars"],"weeklyStars":p["weeklyStars"]} for p in repos]})
 history_path.write_text(json.dumps(sorted(history,key=lambda h:h["date"])[-100:],ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("Updated",len(repos),"repositories",now)
if __name__=="__main__":main()
