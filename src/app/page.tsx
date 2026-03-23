"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import type { Id } from "../../convex/_generated/dataModel";

const CONVEX_SITE_URL = "https://merry-puffin-860.eu-west-1.convex.site";
const IG_APP_ID = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || "";
function getIgAuthUrl() {
  const r = `${CONVEX_SITE_URL}/auth/callback`;
  return `https://www.instagram.com/oauth/authorize?client_id=${IG_APP_ID}&redirect_uri=${encodeURIComponent(r)}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments&force_reauth=true&enable_fb_login=false`;
}

type BtnForm={text:string;url:string};
type ActionForm={type:"send_dm"|"reply_comment"|"both";message:string;delaySeconds:number;buttons:BtnForm[];replyKeyword:string;quickReplies:string[];commentReplies:string[]};
type TriggerForm={type:"dm"|"comment";matchType:"contains"|"exact"|"starts_with"|"any";keywords:string;postFilter:"all"|"selected";selectedPostIds:string};
const emptyAction=():ActionForm=>({type:"send_dm",message:"",delaySeconds:0,buttons:[],replyKeyword:"",quickReplies:[],commentReplies:[]});
const emptyTrigger=():TriggerForm=>({type:"comment",matchType:"contains",keywords:"",postFilter:"all",selectedPostIds:""});

export default function Dashboard(){
  const integrations=useQuery(api.queries.listIntegrations);
  const logs=useQuery(api.queries.listLogs,{limit:40});
  const [selectedId,setSelectedId]=useState<Id<"integrations">|null>(null);
  const [authMsg,setAuthMsg]=useState<string|null>(null);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const a=p.get("auth");
    if(a==="success"){setAuthMsg("Instagram подключён");window.history.replaceState({},"","/");}
    if(a==="error"){setAuthMsg("Ошибка подключения");window.history.replaceState({},"","/");}
    if(authMsg)setTimeout(()=>setAuthMsg(null),4000);
  },[]);

  // Auto-select first integration
  useEffect(()=>{
    if(!selectedId&&integrations?.length){setSelectedId(integrations[0]._id);}
  },[integrations,selectedId]);

  const selected=integrations?.find(i=>i._id===selectedId);

  if(integrations===undefined) return <div className="container"><div className="empty">Загрузка...</div></div>;

  return(
    <div className="container">
      {authMsg&&<div className="card" style={{background:authMsg.includes("Ошибка")?"#2a1515":"#152a15",marginBottom:16}}>{authMsg}</div>}

      {/* Accounts */}
      <div className="section">
        <div className="flex-between" style={{marginBottom:12}}>
          <h2 style={{margin:0}}>Аккаунты</h2>
          <a href={getIgAuthUrl()} style={{textDecoration:"none"}}><button className="primary">+ Подключить Instagram</button></a>
        </div>
        {integrations?.length===0&&<div className="card empty">Нет подключённых аккаунтов</div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {integrations?.map(ig=>(
            <AccountTab key={ig._id} ig={ig} isSelected={ig._id===selectedId} onSelect={()=>setSelectedId(ig._id)}/>
          ))}
        </div>
      </div>

      {/* Automations for selected account */}
      {selected&&(
        <div className="section">
          <div className="flex-between" style={{marginBottom:16}}>
            <h2 style={{margin:0}}>Автоматизации — @{selected.pageName}</h2>
          </div>
          <AutomationsForAccount integrationId={selected._id}/>
        </div>
      )}

      {/* Logs */}
      <div className="section">
        <h2>Логи</h2>
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          {logs?.map(l=>(<div className="log-item" key={l._id}><span className="log-time">{new Date(l.timestamp).toLocaleString("ru")}</span><span className={`log-type badge ${logBadge(l.eventType)}`}>{l.eventType}</span><span className="log-msg">{l.message}</span></div>))}
          {logs?.length===0&&<div className="empty">Пусто</div>}
        </div>
      </div>
    </div>
  );
}

function logBadge(t:string){if(t.includes("sent")||t.includes("replied"))return"badge-green";if(t.includes("error"))return"badge-red";if(t.includes("received"))return"badge-blue";return"badge-yellow";}

function AccountTab({ig,isSelected,onSelect}:{ig:any;isSelected:boolean;onSelect:()=>void}){
  const remove=useMutation(api.mutations.removeIntegration);
  const exp=ig.expiresAt?new Date(ig.expiresAt).toLocaleDateString("ru"):"—";
  return(
    <div className="card" onClick={onSelect} style={{cursor:"pointer",flex:"1 1 200px",minWidth:200,borderColor:isSelected?"var(--accent)":"var(--border)",marginBottom:0}}>
      <div className="flex-between">
        <div>
          <strong style={{fontSize:14}}>@{ig.pageName||ig.instagramId}</strong>
          <div style={{fontSize:11,color:"var(--text2)"}}>до {exp}</div>
        </div>
        <button onClick={e=>{e.stopPropagation();remove({id:ig._id});}} style={{fontSize:11,padding:"2px 8px",borderColor:"var(--red)",color:"var(--red)"}}>✕</button>
      </div>
    </div>
  );
}

function AutomationsForAccount({integrationId}:{integrationId:Id<"integrations">}){
  const automations=useQuery(api.queries.listAutomationsByIntegration,{integrationId});
  return(
    <>
      <AutomationForm mode="create" integrationId={integrationId}/>
      {automations?.map(a=><AutomationCard key={a._id} automation={a}/>)}
      {automations?.length===0&&<div className="empty">Нет автоматизаций для этого аккаунта</div>}
    </>
  );
}

function AutomationCard({automation}:{automation:any}){
  const toggle=useMutation(api.mutations.toggleAutomation);
  const del=useMutation(api.mutations.deleteAutomation);
  const [editing,setEditing]=useState(false);
  const trigger=automation.triggers[0];
  const actions=[...(automation.actions||[])].sort((a:any,b:any)=>(a.step??0)-(b.step??0));
  if(editing)return<AutomationForm mode="edit" automation={automation} integrationId={automation.integrationId} onClose={()=>setEditing(false)}/>;
  return(
    <div className="card">
      <div className="flex-between" style={{marginBottom:8}}>
        <div className="row" style={{gap:10}}><button className={`toggle ${automation.isActive?"active":""}`} onClick={()=>toggle({id:automation._id})}/><strong>{automation.name}</strong></div>
        <div className="row" style={{gap:6,flex:"none"}}>
          <button onClick={()=>setEditing(true)} style={{fontSize:12,padding:"4px 10px"}}>Ред.</button>
          <button onClick={()=>del({id:automation._id})} style={{fontSize:12,padding:"4px 10px",borderColor:"var(--red)",color:"var(--red)"}}>Удалить</button>
        </div>
      </div>
      {trigger&&<div style={{fontSize:13,color:"var(--text2)",marginBottom:8}}>Триггер: <span className="badge badge-blue">{trigger.type}</span> <span className="badge badge-yellow">{trigger.matchType}</span>{trigger.keywords.length>0&&<div className="keywords-list">{trigger.keywords.map((kw:string,i:number)=><span className="kw-tag" key={i}>{kw}</span>)}</div>}</div>}
      {actions.map((action:any,i:number)=>(
        <div key={action._id} style={{fontSize:13,color:"var(--text2)",marginBottom:6,paddingLeft:i>0?16:0,borderLeft:i>0?"2px solid var(--accent)":"none"}}>
          <span className="badge badge-green">{i===0?"Шаг 1":`Дожим ${i}`}</span>{" "}<span className="badge badge-blue">{action.type}</span>
          {action.delaySeconds>0&&<span> · через {action.delaySeconds}с</span>}
          {action.replyKeyword&&<span> · ждёт: <strong>{action.replyKeyword}</strong></span>}
          <div style={{marginTop:4,background:"var(--bg)",padding:"6px 10px",borderRadius:6}}>{action.message}</div>
          {action.quickReplies?.length>0&&<div style={{marginTop:4}}>{action.quickReplies.map((qr:string,qi:number)=><span key={qi} className="badge badge-yellow" style={{marginRight:4}}>⚡ {qr}</span>)}</div>}
          {action.buttons?.length>0&&<div style={{marginTop:4}}>{action.buttons.map((b:any,bi:number)=><span key={bi} className="badge badge-yellow" style={{marginRight:4}}>🔗 {b.text}</span>)}</div>}
          {action.commentReplies?.length>0&&<div style={{marginTop:4,fontSize:12}}>Комм. ({action.commentReplies.length}): {action.commentReplies.join(" | ")}</div>}
        </div>
      ))}
    </div>
  );
}

function AutomationForm({mode,automation,integrationId,onClose}:{mode:"create"|"edit";automation?:any;integrationId:Id<"integrations">;onClose?:()=>void}){
  const create=useMutation(api.mutations.createAutomation);
  const edit=useMutation(api.mutations.editAutomation);
  const [open,setOpen]=useState(mode==="edit");
  const et=automation?.triggers?.[0];const ea=automation?.actions?[...automation.actions].sort((a:any,b:any)=>(a.step??0)-(b.step??0)):null;
  const [name,setName]=useState(automation?.name||"");
  const [trigger,setTrigger]=useState<TriggerForm>(et?{type:et.type,matchType:et.matchType,keywords:et.keywords?.join(", ")||"",postFilter:et.postFilter||"all",selectedPostIds:et.selectedPostIds?.join(", ")||""}:emptyTrigger());
  const [actions,setActions]=useState<ActionForm[]>(ea?ea.map((a:any)=>({type:a.type,message:a.message,delaySeconds:a.delaySeconds,buttons:a.buttons||[],replyKeyword:a.replyKeyword||"",quickReplies:a.quickReplies||[],commentReplies:a.commentReplies||[]})):[emptyAction()]);
  const upd=(i:number,p:Partial<ActionForm>)=>setActions(prev=>prev.map((a,idx)=>idx===i?{...a,...p}:a));
  const reset=()=>{setName("");setTrigger(emptyTrigger());setActions([emptyAction()]);setOpen(false);onClose?.();};
  const save=async()=>{
    if(!name||!actions[0]?.message)return;
    const td={type:trigger.type,matchType:trigger.matchType,keywords:trigger.matchType==="any"?[]:trigger.keywords.split(",").map(k=>k.trim()).filter(Boolean),postFilter:trigger.postFilter,selectedPostIds:trigger.postFilter==="selected"?trigger.selectedPostIds.split(",").map(k=>k.trim()).filter(Boolean):[]};
    const ad=actions.map((a,i)=>({type:a.type,message:a.message,delaySeconds:a.delaySeconds,buttons:a.buttons.filter(b=>b.text&&b.url).length>0?a.buttons.filter(b=>b.text&&b.url):undefined,replyKeyword:i===0&&actions.length>1&&a.replyKeyword?a.replyKeyword:undefined,quickReplies:a.quickReplies.filter(Boolean).length>0?a.quickReplies.filter(Boolean):undefined,commentReplies:a.commentReplies.filter(Boolean).length>0?a.commentReplies.filter(Boolean):undefined}));
    if(mode==="edit"&&automation){await edit({id:automation._id,name,trigger:td,actions:ad});onClose?.();}
    else{await create({name,integrationId,trigger:td,actions:ad});reset();}
  };
  if(mode==="create"&&!open)return<button className="primary" onClick={()=>setOpen(true)} style={{marginBottom:16}}>+ Новая автоматизация</button>;
  return(
    <div className="card" style={{marginBottom:16,borderColor:mode==="edit"?"var(--accent)":undefined}}>
      <h3>{mode==="edit"?`Ред.: ${automation?.name}`:"Новая автоматизация"}</h3>
      <div className="field"><label>Название</label><input value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="row">
        <div className="field"><label>Триггер</label><select value={trigger.type} onChange={e=>setTrigger({...trigger,type:e.target.value as any})}><option value="comment">Комментарий</option><option value="dm">DM</option></select></div>
        <div className="field"><label>Совпадение</label><select value={trigger.matchType} onChange={e=>setTrigger({...trigger,matchType:e.target.value as any})}><option value="contains">Содержит</option><option value="exact">Точное</option><option value="starts_with">Начинается с</option><option value="any">Любое</option></select></div>
      </div>
      {trigger.matchType!=="any"&&<div className="field"><label>Ключевые слова</label><input value={trigger.keywords} onChange={e=>setTrigger({...trigger,keywords:e.target.value})}/></div>}
      {trigger.type==="comment"&&(<div className="row"><div className="field"><label>Посты</label><select value={trigger.postFilter} onChange={e=>setTrigger({...trigger,postFilter:e.target.value as any})}><option value="all">Все</option><option value="selected">Выбранные</option></select></div>{trigger.postFilter==="selected"&&<div className="field"><label>ID постов</label><input value={trigger.selectedPostIds} onChange={e=>setTrigger({...trigger,selectedPostIds:e.target.value})}/></div>}</div>)}
      {actions.map((action,idx)=>(
        <div key={idx} style={{background:"var(--bg3)",padding:14,borderRadius:8,marginBottom:10,borderLeft:idx>0?"3px solid var(--accent)":"none"}}>
          <div className="flex-between" style={{marginBottom:8}}>
            <strong style={{fontSize:13}}>{idx===0?"Шаг 1":`Дожим #${idx}`}</strong>
            {idx>0&&<button onClick={()=>setActions(p=>p.filter((_,i)=>i!==idx))} style={{fontSize:11,padding:"2px 8px"}}>Убрать</button>}
          </div>
          <div className="row">
            <div className="field"><label>Действие</label><select value={action.type} onChange={e=>upd(idx,{type:e.target.value as any})}><option value="send_dm">DM</option><option value="reply_comment">Ответ на комм.</option><option value="both">DM + ответ</option></select></div>
            <div className="field"><label>Задержка (сек)</label><input type="number" value={action.delaySeconds} onChange={e=>upd(idx,{delaySeconds:Number(e.target.value)})}/></div>
          </div>
          <div className="field"><label>Сообщение (DM)</label><textarea value={action.message} onChange={e=>upd(idx,{message:e.target.value})}/></div>
          {idx===0&&actions.length>1&&<div className="field"><label>Кодовое слово для ответа</label><input value={action.replyKeyword} onChange={e=>upd(idx,{replyKeyword:e.target.value})} placeholder="Хочу"/></div>}
          <div style={{marginBottom:10}}><label>Быстрые ответы (кнопки в DM)</label>
            {action.quickReplies.map((qr,qi)=>(<div className="row" key={qi} style={{marginBottom:4}}><input value={qr} onChange={e=>{const n=[...action.quickReplies];n[qi]=e.target.value;upd(idx,{quickReplies:n});}}/><button onClick={()=>upd(idx,{quickReplies:action.quickReplies.filter((_,j)=>j!==qi)})} style={{padding:"4px 8px",fontSize:12,flex:"none"}}>✕</button></div>))}
            <button onClick={()=>upd(idx,{quickReplies:[...action.quickReplies,""]})} style={{fontSize:12,padding:"4px 10px"}}>+ Быстрый ответ</button>
          </div>
          {(action.type==="reply_comment"||action.type==="both")&&<div style={{marginBottom:10}}><label>Варианты ответа на комментарий (рандом)</label>
            {action.commentReplies.map((cr,ci)=>(<div className="row" key={ci} style={{marginBottom:4}}><input value={cr} onChange={e=>{const n=[...action.commentReplies];n[ci]=e.target.value;upd(idx,{commentReplies:n});}}/><button onClick={()=>upd(idx,{commentReplies:action.commentReplies.filter((_,j)=>j!==ci)})} style={{padding:"4px 8px",fontSize:12,flex:"none"}}>✕</button></div>))}
            <button onClick={()=>upd(idx,{commentReplies:[...action.commentReplies,""]})} style={{fontSize:12,padding:"4px 10px"}}>+ Вариант</button>
          </div>}
          <div style={{marginBottom:8}}><label>Кнопки-ссылки</label>
            {action.buttons.map((btn,bi)=>(<div className="row" key={bi} style={{marginBottom:4}}><input placeholder="Текст" value={btn.text} onChange={e=>{const n=[...action.buttons];n[bi]={...n[bi],text:e.target.value};upd(idx,{buttons:n});}}/><input placeholder="https://..." value={btn.url} onChange={e=>{const n=[...action.buttons];n[bi]={...n[bi],url:e.target.value};upd(idx,{buttons:n});}}/><button onClick={()=>upd(idx,{buttons:action.buttons.filter((_,j)=>j!==bi)})} style={{padding:"4px 8px",fontSize:12,flex:"none"}}>✕</button></div>))}
            <button onClick={()=>upd(idx,{buttons:[...action.buttons,{text:"",url:""}]})} style={{fontSize:12,padding:"4px 10px"}}>+ Ссылка</button>
          </div>
        </div>
      ))}
      <button onClick={()=>setActions(p=>[...p,{...emptyAction()}])} style={{fontSize:13,marginBottom:12}}>+ Добавить дожим</button>
      <div className="row"><button className="primary" onClick={save}>{mode==="edit"?"Сохранить":"Создать"}</button><button onClick={reset}>Отмена</button></div>
    </div>
  );
}
