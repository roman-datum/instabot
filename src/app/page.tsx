"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { t } from "@/lib/i18n";
import { useSettings } from "@/lib/useSettings";

const CONVEX_SITE_URL = "https://merry-puffin-860.eu-west-1.convex.site";
const IG_APP_ID = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || "1007196891146987";
const FB_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "352395251025840";
const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE || "botmake2026";
function getIgAuthUrl() {
  const r = `${CONVEX_SITE_URL}/auth/callback`;
  return `https://www.instagram.com/oauth/authorize?client_id=${IG_APP_ID}&redirect_uri=${encodeURIComponent(r)}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments&force_reauth=true&enable_fb_login=false`;
}
function getFbAuthUrl() {
  const r = `${CONVEX_SITE_URL}/auth/fb-callback`;
  return `https://www.facebook.com/v25.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(r)}&scope=pages_show_list,pages_read_engagement,pages_manage_metadata,instagram_basic,instagram_manage_comments,instagram_manage_messages&response_type=code`;
}

type BtnForm={text:string;url:string};
type ActionForm={type:"send_dm"|"reply_comment"|"both";message:string;delaySeconds:number;buttons:BtnForm[];replyKeyword:string;quickReplies:string[];commentReplies:string[]};
type TriggerForm={type:"dm"|"comment";matchType:"contains"|"exact"|"starts_with"|"any";keywords:string;postFilter:"all"|"selected";selectedPostIds:string};
const emptyAction=():ActionForm=>({type:"send_dm",message:"",delaySeconds:0,buttons:[],replyKeyword:"",quickReplies:[],commentReplies:[]});
const emptyTrigger=():TriggerForm=>({type:"comment",matchType:"contains",keywords:"",postFilter:"all",selectedPostIds:""});

function useAuth() {
  const [ok, setOk] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState(false);
  useEffect(() => { if (typeof window !== "undefined" && localStorage.getItem("bm_auth") === ACCESS_CODE) setOk(true); }, []);
  const login = () => { if (input === ACCESS_CODE) { localStorage.setItem("bm_auth", input); setOk(true); setErr(false); } else { setErr(true); } };
  const logout = () => { localStorage.removeItem("bm_auth"); setOk(false); };
  return { ok, input, setInput, login, logout, err };
}

export default function Dashboard(){
  const auth = useAuth();
  const { lang } = useSettings();
  const integrations=useQuery(api.queries.listIntegrations);
  const [selectedId,setSelectedId]=useState<Id<"integrations">|null>(null);
  const [authMsg,setAuthMsg]=useState<string|null>(null);
  const [showConnect,setShowConnect]=useState(false);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const a=p.get("auth");
    if(a==="success"){setAuthMsg("success");window.history.replaceState({},"","/");}
    if(a==="error"){setAuthMsg("error");window.history.replaceState({},"","/");}
    if(authMsg)setTimeout(()=>setAuthMsg(null),4000);
  },[]);

  useEffect(()=>{
    if(!selectedId&&integrations?.length){setSelectedId(integrations[0]._id);}
  },[integrations,selectedId]);

  const selected=integrations?.find(i=>i._id===selectedId);

  if (!auth.ok) return (
    <div className="auth-screen">
      <div className="card">
        <h2>{t("auth.title", lang)}</h2>
        <p className="subtitle">{t("auth.subtitle", lang)}</p>
        <div className="field">
          <input type="password" placeholder={t("auth.placeholder", lang)} value={auth.input}
            onChange={e=>auth.setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&auth.login()}
            style={auth.err?{borderColor:"var(--red)"}:undefined}/>
        </div>
        {auth.err&&<p style={{color:"var(--red)",fontSize:12,marginBottom:12}}>{t("auth.wrong", lang)}</p>}
        <button className="primary" onClick={auth.login} style={{width:"100%"}}>{t("auth.login", lang)}</button>
      </div>
    </div>
  );

  if(integrations===undefined) return <div className="container"><div className="empty">{t("loading", lang)}</div></div>;

  return(
    <div className="container">
      {authMsg==="success"&&<div className="toast toast-success">{t("auth.success", lang)}</div>}
      {authMsg==="error"&&<div className="toast toast-error">{t("auth.error", lang)}</div>}

      <div className="section">
        <div className="flex-between" style={{marginBottom:14}}>
          <h2 style={{margin:0}}>{t("accounts.title", lang)}</h2>
          <div className="row" style={{gap:8,flex:"none"}}>
            <button className="ghost" onClick={auth.logout}>{t("nav.logout", lang)}</button>
            <button className="primary" onClick={()=>setShowConnect(true)}>{t("accounts.connect", lang)}</button>
          </div>
        </div>
        {integrations.length===0&&<div className="card empty">{t("accounts.empty", lang)}</div>}
        <div className="account-grid">
          {integrations.map(ig=>(
            <AccountTab key={ig._id} ig={ig} isSelected={ig._id===selectedId} onSelect={()=>setSelectedId(ig._id)} lang={lang}/>
          ))}
        </div>
      </div>

      {selected&&(
        <div className="section">
          <h2 style={{margin:"0 0 14px"}}>{t("auto.title", lang)} — @{selected.pageName}</h2>
          <AutomationsForAccount integrationId={selected._id} lang={lang}/>
        </div>
      )}

      {showConnect&&(
        <div className="modal-overlay" onClick={()=>setShowConnect(false)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <button className="modal-close" onClick={()=>setShowConnect(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div className="modal-title">{t("connect.title",lang)}</div>
            <div className="modal-subtitle">{t("connect.subtitle",lang)}</div>
            <div className="connect-options">
              <a href={getIgAuthUrl()} className="connect-option">
                <div className="connect-option-icon ig">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </div>
                <div className="connect-option-text">
                  <div className="connect-option-title">{t("connect.ig",lang)}</div>
                  <div className="connect-option-desc">{t("connect.ig.desc",lang)}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
              <a href={getFbAuthUrl()} className="connect-option">
                <div className="connect-option-icon fb">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z"/></svg>
                </div>
                <div className="connect-option-text">
                  <div className="connect-option-title">{t("connect.fb",lang)}</div>
                  <div className="connect-option-desc">{t("connect.fb.desc",lang)}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountTab({ig,isSelected,onSelect,lang}:{ig:any;isSelected:boolean;onSelect:()=>void;lang:"en"|"ru"}){
  const remove=useMutation(api.mutations.removeIntegration);
  const exp=ig.expiresAt?new Date(ig.expiresAt).toLocaleDateString(lang==="ru"?"ru":"en-US"):"—";
  return(
    <div className={`account-card${isSelected?" selected":""}`} onClick={onSelect}>
      <div className="name">@{ig.pageName||ig.instagramId}</div>
      <div className="meta">{t("accounts.expires", lang)} {exp}</div>
      <button className="remove-btn" onClick={e=>{e.stopPropagation();remove({id:ig._id});}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

function AutomationsForAccount({integrationId,lang}:{integrationId:Id<"integrations">;lang:"en"|"ru"}){
  const automations=useQuery(api.queries.listAutomationsByIntegration,{integrationId});
  return(
    <>
      <AutomationForm mode="create" integrationId={integrationId} lang={lang}/>
      {automations?.map(a=><AutomationCard key={a._id} automation={a} lang={lang}/>)}
      {automations?.length===0&&<div className="empty">{t("auto.empty", lang)}</div>}
    </>
  );
}

function AutomationCard({automation,lang}:{automation:any;lang:"en"|"ru"}){
  const toggle=useMutation(api.mutations.toggleAutomation);
  const del=useMutation(api.mutations.deleteAutomation);
  const [editing,setEditing]=useState(false);
  const trigger=automation.triggers[0];
  const actions=[...(automation.actions||[])].sort((a:any,b:any)=>(a.step??0)-(b.step??0));
  if(editing)return<AutomationForm mode="edit" automation={automation} integrationId={automation.integrationId} onClose={()=>setEditing(false)} lang={lang}/>;
  return(
    <div className="card">
      <div className="auto-header">
        <div className="auto-header-left">
          <button className={`toggle ${automation.isActive?"active":""}`} onClick={()=>toggle({id:automation._id})}/>
          <strong style={{fontSize:14}}>{automation.name}</strong>
        </div>
        <div className="auto-header-right">
          <button className="ghost" onClick={()=>setEditing(true)}>{t("auto.edit", lang)}</button>
          <button className="danger" onClick={()=>del({id:automation._id})} style={{fontSize:12,padding:"5px 12px"}}>{t("auto.delete", lang)}</button>
        </div>
      </div>
      {trigger&&(
        <div className="auto-trigger">
          <span className="badge badge-blue">{trigger.type==="comment"?t("opt.comment",lang):"DM"}</span>
          <span className="badge badge-yellow">{t(`opt.${trigger.matchType}` as any,lang)}</span>
          {trigger.keywords.length>0&&<div className="keywords-list">{trigger.keywords.map((kw:string,i:number)=><span className="kw-tag" key={i}>{kw}</span>)}</div>}
        </div>
      )}
      {actions.map((action:any,i:number)=>(
        <div key={action._id} className={`auto-step${i>0?" followup":""}`}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span className="badge badge-green">{t("step",lang)} {i+1}</span>
            <span className="badge badge-blue">{t(`opt.${action.type}` as any,lang)}</span>
            {action.delaySeconds>0&&<span style={{fontSize:11,color:"var(--text2)"}}>{t("after",lang)} {action.delaySeconds}s</span>}
            {action.replyKeyword&&<span style={{fontSize:11,color:"var(--accent2)"}}>{t("waits",lang)} {action.replyKeyword}</span>}
          </div>
          <div className="msg-preview">{action.message}</div>
          {(action.quickReplies?.length>0||action.buttons?.length>0||action.commentReplies?.length>0)&&(
            <div className="extras">
              {action.quickReplies?.map((qr:string,qi:number)=><span key={qi} className="kw-tag">&#9889; {qr}</span>)}
              {action.buttons?.map((b:any,bi:number)=><span key={bi} className="kw-tag">&#128279; {b.text}</span>)}
              {action.commentReplies?.length>0&&<span className="kw-tag" style={{color:"var(--text2)"}}>{action.commentReplies.length} {t("variants",lang)}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AutomationForm({mode,automation,integrationId,onClose,lang}:{mode:"create"|"edit";automation?:any;integrationId:Id<"integrations">;onClose?:()=>void;lang:"en"|"ru"}){
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
  if(mode==="create"&&!open)return<button className="primary" onClick={()=>setOpen(true)} style={{marginBottom:14}}>{t("auto.new",lang)}</button>;
  return(
    <div className="card" style={{marginBottom:14,borderColor:mode==="edit"?"var(--accent)":undefined}}>
      <h3 style={{marginBottom:14}}>{mode==="edit"?t("auto.editing",lang):t("auto.creating",lang)}</h3>
      <div className="field"><label>{t("form.name",lang)}</label><input value={name} onChange={e=>setName(e.target.value)} placeholder={t("form.name.ph",lang)}/></div>
      <div className="row">
        <div className="field"><label>{t("form.trigger",lang)}</label><select value={trigger.type} onChange={e=>setTrigger({...trigger,type:e.target.value as any})}><option value="comment">{t("opt.comment",lang)}</option><option value="dm">{t("opt.dm",lang)}</option></select></div>
        <div className="field"><label>{t("form.match",lang)}</label><select value={trigger.matchType} onChange={e=>setTrigger({...trigger,matchType:e.target.value as any})}><option value="contains">{t("opt.contains",lang)}</option><option value="exact">{t("opt.exact",lang)}</option><option value="starts_with">{t("opt.starts_with",lang)}</option><option value="any">{t("opt.any",lang)}</option></select></div>
      </div>
      {trigger.matchType!=="any"&&<div className="field"><label>{t("form.keywords",lang)}</label><input value={trigger.keywords} onChange={e=>setTrigger({...trigger,keywords:e.target.value})} placeholder={t("form.keywords.ph",lang)}/></div>}
      {trigger.type==="comment"&&(<div className="row"><div className="field"><label>{t("form.posts",lang)}</label><select value={trigger.postFilter} onChange={e=>setTrigger({...trigger,postFilter:e.target.value as any})}><option value="all">{t("opt.all_posts",lang)}</option><option value="selected">{t("opt.selected",lang)}</option></select></div>{trigger.postFilter==="selected"&&<div className="field"><label>{t("form.postIds",lang)}</label><input value={trigger.selectedPostIds} onChange={e=>setTrigger({...trigger,selectedPostIds:e.target.value})}/></div>}</div>)}

      {actions.map((action,idx)=>(
        <div key={idx} className={`step-block${idx>0?" followup":""}`}>
          <div className="flex-between" style={{marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{t("step",lang)} {idx+1}</span>
            {idx>0&&<button className="ghost" onClick={()=>setActions(p=>p.filter((_,i)=>i!==idx))}>{t("auto.removeStep",lang)}</button>}
          </div>
          <div className="row">
            <div className="field"><label>{t("form.action",lang)}</label><select value={action.type} onChange={e=>upd(idx,{type:e.target.value as any})}><option value="send_dm">{t("opt.send_dm",lang)}</option><option value="reply_comment">{t("opt.reply_comment",lang)}</option><option value="both">{t("opt.both",lang)}</option></select></div>
            <div className="field"><label>{t("form.delay",lang)}</label><input type="number" value={action.delaySeconds} onChange={e=>upd(idx,{delaySeconds:Number(e.target.value)})}/></div>
          </div>
          <div className="field"><label>{t("form.message",lang)}</label><textarea value={action.message} onChange={e=>upd(idx,{message:e.target.value})} placeholder={t("form.message.ph",lang)}/></div>
          {idx===0&&actions.length>1&&<div className="field"><label>{t("form.replyKw",lang)}</label><input value={action.replyKeyword} onChange={e=>upd(idx,{replyKeyword:e.target.value})} placeholder={t("form.replyKw.ph",lang)}/></div>}
          <div style={{marginBottom:10}}>
            <label>{t("form.quickReplies",lang)}</label>
            {action.quickReplies.map((qr,qi)=>(<div className="row" key={qi} style={{marginBottom:4}}><input value={qr} onChange={e=>{const n=[...action.quickReplies];n[qi]=e.target.value;upd(idx,{quickReplies:n});}}/><button className="ghost" onClick={()=>upd(idx,{quickReplies:action.quickReplies.filter((_,j)=>j!==qi)})}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button></div>))}
            <button className="ghost" onClick={()=>upd(idx,{quickReplies:[...action.quickReplies,""]})}>{t("form.add",lang)}</button>
          </div>
          {(action.type==="reply_comment"||action.type==="both")&&<div style={{marginBottom:10}}>
            <label>{t("form.commentReplies",lang)}</label>
            {action.commentReplies.map((cr,ci)=>(<div className="row" key={ci} style={{marginBottom:4}}><input value={cr} onChange={e=>{const n=[...action.commentReplies];n[ci]=e.target.value;upd(idx,{commentReplies:n});}}/><button className="ghost" onClick={()=>upd(idx,{commentReplies:action.commentReplies.filter((_,j)=>j!==ci)})}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button></div>))}
            <button className="ghost" onClick={()=>upd(idx,{commentReplies:[...action.commentReplies,""]})}>{t("form.add",lang)}</button>
          </div>}
          <div>
            <label>{t("form.buttons",lang)}</label>
            {action.buttons.map((btn,bi)=>(<div className="row" key={bi} style={{marginBottom:4}}><input placeholder={t("form.btnText",lang)} value={btn.text} onChange={e=>{const n=[...action.buttons];n[bi]={...n[bi],text:e.target.value};upd(idx,{buttons:n});}}/><input placeholder="https://..." value={btn.url} onChange={e=>{const n=[...action.buttons];n[bi]={...n[bi],url:e.target.value};upd(idx,{buttons:n});}}/><button className="ghost" onClick={()=>upd(idx,{buttons:action.buttons.filter((_,j)=>j!==bi)})}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button></div>))}
            <button className="ghost" onClick={()=>upd(idx,{buttons:[...action.buttons,{text:"",url:""}]})}>{t("form.add",lang)}</button>
          </div>
        </div>
      ))}
      <div style={{marginBottom:14}}><button className="ghost" onClick={()=>setActions(p=>[...p,{...emptyAction()}])}>{t("auto.addStep",lang)}</button></div>
      <div className="row" style={{gap:8}}>
        <button className="primary" onClick={save}>{mode==="edit"?t("auto.save",lang):t("auto.create",lang)}</button>
        <button onClick={reset}>{t("auto.cancel",lang)}</button>
      </div>
    </div>
  );
}
