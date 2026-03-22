"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";

const CONVEX_SITE_URL = "https://merry-puffin-860.eu-west-1.convex.site";
const IG_APP_ID = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || "";

function getInstagramAuthUrl() {
  const redirectUri = `${CONVEX_SITE_URL}/auth/callback`;
  const scope = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments";
  return `https://www.instagram.com/oauth/authorize?client_id=${IG_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
}

export default function Dashboard() {
  const integration = useQuery(api.queries.getIntegration);
  const automations = useQuery(api.queries.listAutomations);
  const logs = useQuery(api.queries.listLogs, { limit: 30 });

  const [authMsg, setAuthMsg] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("auth");
    if (a === "success") { setAuthMsg("Instagram подключён"); window.history.replaceState({}, "", "/"); }
    if (a === "error") { setAuthMsg("Ошибка подключения"); window.history.replaceState({}, "", "/"); }
    if (authMsg) setTimeout(() => setAuthMsg(null), 4000);
  }, []);

  return (
    <div className="container">
      <h1>InstaBot</h1>
      {authMsg && <div className="card" style={{ background: authMsg.includes("Ошибка") ? "#2a1515" : "#152a15", marginBottom: 16 }}>{authMsg}</div>}
      <div className="section"><IntegrationCard integration={integration} /></div>
      <div className="section">
        <div className="flex-between" style={{ marginBottom: 16 }}><h2 style={{ margin: 0 }}>Автоматизации</h2></div>
        <CreateAutomation />
        {automations?.map((a) => <AutomationCard key={a._id} automation={a} />)}
        {automations?.length === 0 && <div className="empty">Нет автоматизаций</div>}
      </div>
      <div className="section">
        <h2>Логи</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {logs?.map((log) => (
            <div className="log-item" key={log._id}>
              <span className="log-time">{new Date(log.timestamp).toLocaleString("ru")}</span>
              <span className={`log-type badge ${logBadge(log.eventType)}`}>{log.eventType}</span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))}
          {logs?.length === 0 && <div className="empty">Пусто</div>}
        </div>
      </div>
    </div>
  );
}

function logBadge(t: string) {
  if (t.includes("sent") || t.includes("replied")) return "badge-green";
  if (t.includes("error")) return "badge-red";
  if (t.includes("received")) return "badge-blue";
  return "badge-yellow";
}

function IntegrationCard({ integration }: { integration: any }) {
  const remove = useMutation(api.mutations.removeIntegration);
  if (integration === undefined) return <div className="card">Загрузка...</div>;
  if (integration) {
    const exp = integration.expiresAt ? new Date(integration.expiresAt).toLocaleDateString("ru") : "—";
    return (
      <div className="card">
        <div className="flex-between">
          <div>
            <h3>@{integration.pageName || integration.instagramId}</h3>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>ID: {integration.instagramId} · Токен до: {exp}</div>
          </div>
          <button className="danger" onClick={() => remove()}>Отключить</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="flex-between">
        <div><h3>Instagram не подключён</h3><div style={{ fontSize: 13, color: "var(--text2)" }}>Бизнес/Creator аккаунт. Facebook Page не нужна.</div></div>
        <a href={getInstagramAuthUrl()} style={{ textDecoration: "none" }}><button className="primary">Войти через Instagram</button></a>
      </div>
    </div>
  );
}

function AutomationCard({ automation }: { automation: any }) {
  const toggle = useMutation(api.mutations.toggleAutomation);
  const del = useMutation(api.mutations.deleteAutomation);
  const trigger = automation.triggers[0];
  const actions = [...(automation.actions || [])].sort((a: any, b: any) => (a.step ?? 0) - (b.step ?? 0));

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 10 }}>
          <button className={`toggle ${automation.isActive ? "active" : ""}`} onClick={() => toggle({ id: automation._id })} />
          <strong>{automation.name}</strong>
        </div>
        <button onClick={() => del({ id: automation._id })} style={{ fontSize: 12, padding: "4px 10px" }}>Удалить</button>
      </div>
      {trigger && (
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
          Триггер: <span className="badge badge-blue">{trigger.type}</span> <span className="badge badge-yellow">{trigger.matchType}</span>
          {trigger.keywords.length > 0 && <div className="keywords-list">{trigger.keywords.map((kw: string, i: number) => <span className="kw-tag" key={i}>{kw}</span>)}</div>}
        </div>
      )}
      {actions.map((action: any, i: number) => (
        <div key={action._id} style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6, paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? "2px solid var(--border)" : "none" }}>
          <span className="badge badge-green">{i === 0 ? "Шаг 1" : `Дожим ${i}`}</span>{" "}
          <span className="badge badge-blue">{action.type}</span>
          {action.delaySeconds > 0 && <span> · через {action.delaySeconds}с</span>}
          <div style={{ marginTop: 4, background: "var(--bg)", padding: "6px 10px", borderRadius: 6 }}>{action.message}</div>
          {action.buttons?.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {action.buttons.map((btn: any, bi: number) => (
                <span key={bi} className="badge badge-yellow" style={{ marginRight: 4 }}>{btn.text}: {btn.url}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type ActionForm = {
  type: "send_dm" | "reply_comment" | "both";
  message: string;
  delaySeconds: number;
  buttons: Array<{ text: string; url: string }>;
};

function CreateAutomation() {
  const create = useMutation(api.mutations.createAutomation);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"dm" | "comment">("comment");
  const [matchType, setMatchType] = useState<"contains" | "exact" | "starts_with" | "any">("contains");
  const [keywords, setKeywords] = useState("");
  const [postFilter, setPostFilter] = useState<"all" | "selected">("all");
  const [selectedPostIds, setSelectedPostIds] = useState("");

  const emptyAction = (): ActionForm => ({ type: "send_dm", message: "", delaySeconds: 0, buttons: [] });
  const [actions, setActions] = useState<ActionForm[]>([emptyAction()]);

  const updateAction = (idx: number, patch: Partial<ActionForm>) => {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };

  const addButton = (idx: number) => {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, buttons: [...a.buttons, { text: "", url: "" }] } : a));
  };

  const updateButton = (actionIdx: number, btnIdx: number, field: "text" | "url", val: string) => {
    setActions(prev => prev.map((a, ai) => ai === actionIdx ? {
      ...a, buttons: a.buttons.map((b, bi) => bi === btnIdx ? { ...b, [field]: val } : b)
    } : a));
  };

  const removeButton = (actionIdx: number, btnIdx: number) => {
    setActions(prev => prev.map((a, ai) => ai === actionIdx ? {
      ...a, buttons: a.buttons.filter((_, bi) => bi !== btnIdx)
    } : a));
  };

  const reset = () => {
    setName(""); setTriggerType("comment"); setMatchType("contains"); setKeywords("");
    setPostFilter("all"); setSelectedPostIds(""); setActions([emptyAction()]); setOpen(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {!open && <button className="primary" onClick={() => setOpen(true)}>+ Новая автоматизация</button>}
      {open && (
        <div className="card">
          <h3>Новая автоматизация</h3>
          <div className="field"><label>Название</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Напр: Лид-магнит" /></div>
          <div className="row">
            <div className="field"><label>Триггер</label>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value as any)}>
                <option value="comment">Комментарий</option><option value="dm">DM</option></select></div>
            <div className="field"><label>Совпадение</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value as any)}>
                <option value="contains">Содержит</option><option value="exact">Точное</option>
                <option value="starts_with">Начинается с</option><option value="any">Любое</option></select></div>
          </div>
          {matchType !== "any" && <div className="field"><label>Ключевые слова (запятая)</label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="хочу, цена" /></div>}
          {triggerType === "comment" && (
            <div className="row">
              <div className="field"><label>Посты</label>
                <select value={postFilter} onChange={e => setPostFilter(e.target.value as any)}>
                  <option value="all">Все</option><option value="selected">Выбранные</option></select></div>
              {postFilter === "selected" && <div className="field"><label>ID постов (запятая)</label>
                <input value={selectedPostIds} onChange={e => setSelectedPostIds(e.target.value)} /></div>}
            </div>
          )}

          {actions.map((action, idx) => (
            <div key={idx} style={{ background: "var(--bg3)", padding: 14, borderRadius: 8, marginBottom: 10, borderLeft: idx > 0 ? "3px solid var(--accent)" : "none" }}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>{idx === 0 ? "Основное сообщение" : `Дожим #${idx}`}</strong>
                {idx > 0 && <button onClick={() => setActions(prev => prev.filter((_, i) => i !== idx))} style={{ fontSize: 11, padding: "2px 8px" }}>Убрать</button>}
              </div>
              <div className="row">
                <div className="field"><label>Действие</label>
                  <select value={action.type} onChange={e => updateAction(idx, { type: e.target.value as any })}>
                    <option value="send_dm">DM</option><option value="reply_comment">Ответ на комментарий</option>
                    <option value="both">DM + ответ</option></select></div>
                <div className="field"><label>Задержка (сек)</label>
                  <input type="number" value={action.delaySeconds} onChange={e => updateAction(idx, { delaySeconds: Number(e.target.value) })} /></div>
              </div>
              <div className="field"><label>Сообщение</label>
                <textarea value={action.message} onChange={e => updateAction(idx, { message: e.target.value })} placeholder="Привет! Вот ссылка..." /></div>

              <div style={{ marginBottom: 8 }}>
                <label>Кнопки-ссылки</label>
                {action.buttons.map((btn, bi) => (
                  <div className="row" key={bi} style={{ marginBottom: 6 }}>
                    <input placeholder="Текст кнопки" value={btn.text} onChange={e => updateButton(idx, bi, "text", e.target.value)} />
                    <input placeholder="https://..." value={btn.url} onChange={e => updateButton(idx, bi, "url", e.target.value)} />
                    <button onClick={() => removeButton(idx, bi)} style={{ padding: "4px 8px", fontSize: 12, flex: "none" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => addButton(idx)} style={{ fontSize: 12, padding: "4px 10px" }}>+ Кнопка-ссылка</button>
              </div>
            </div>
          ))}

          <button onClick={() => setActions(prev => [...prev, { ...emptyAction(), delaySeconds: 300 }])} style={{ fontSize: 13, marginBottom: 12 }}>
            + Добавить дожим
          </button>

          <div className="row">
            <button className="primary" onClick={async () => {
              if (!name || !actions[0]?.message) return;
              await create({
                name,
                trigger: {
                  type: triggerType, matchType,
                  keywords: matchType === "any" ? [] : keywords.split(",").map(k => k.trim()).filter(Boolean),
                  postFilter,
                  selectedPostIds: postFilter === "selected" ? selectedPostIds.split(",").map(k => k.trim()).filter(Boolean) : [],
                },
                actions: actions.map(a => ({
                  type: a.type, message: a.message, delaySeconds: a.delaySeconds,
                  buttons: a.buttons.length > 0 ? a.buttons.filter(b => b.text && b.url) : undefined,
                })),
              });
              reset();
            }}>Создать</button>
            <button onClick={reset}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
