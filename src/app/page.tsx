"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function Dashboard() {
  const integration = useQuery(api.queries.getIntegration);
  const automations = useQuery(api.queries.listAutomations);
  const logs = useQuery(api.queries.listLogs, { limit: 30 });

  return (
    <div className="container">
      <h1>InstaBot</h1>

      <div className="section">
        <IntegrationCard integration={integration} />
      </div>

      <div className="section">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Автоматизации</h2>
        </div>
        <CreateAutomation />
        {automations?.map((a) => (
          <AutomationCard key={a._id} automation={a} />
        ))}
        {automations?.length === 0 && (
          <div className="empty">Нет автоматизаций</div>
        )}
      </div>

      <div className="section">
        <h2>Логи</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {logs?.map((log) => (
            <div className="log-item" key={log._id}>
              <span className="log-time">
                {new Date(log.timestamp).toLocaleString("ru")}
              </span>
              <span className={`log-type badge ${logBadge(log.eventType)}`}>
                {log.eventType}
              </span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))}
          {logs?.length === 0 && <div className="empty">Пусто</div>}
        </div>
      </div>
    </div>
  );
}

function logBadge(type: string) {
  if (type.includes("sent") || type.includes("replied")) return "badge-green";
  if (type.includes("error")) return "badge-red";
  if (type.includes("received")) return "badge-blue";
  return "badge-yellow";
}

function IntegrationCard({ integration }: { integration: any }) {
  const save = useMutation(api.mutations.saveIntegration);
  const remove = useMutation(api.mutations.removeIntegration);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    pageAccessToken: "",
    accessToken: "",
    pageId: "",
    instagramId: "",
    pageName: "",
  });

  if (integration === undefined) return <div className="card">Загрузка...</div>;

  if (integration) {
    return (
      <div className="card">
        <div className="flex-between">
          <div>
            <h3>Instagram подключён</h3>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>
              Page: {integration.pageName || integration.pageId} · IG:{" "}
              {integration.instagramId}
            </div>
          </div>
          <button className="danger" onClick={() => remove()}>
            Отключить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex-between">
        <h3>Instagram не подключён</h3>
        <button className="primary" onClick={() => setOpen(!open)}>
          Подключить
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 16 }}>
          <div className="field">
            <label>Page Access Token</label>
            <input
              value={form.pageAccessToken}
              onChange={(e) =>
                setForm({ ...form, pageAccessToken: e.target.value })
              }
              placeholder="Токен страницы (long-lived)"
            />
          </div>
          <div className="field">
            <label>User Access Token</label>
            <input
              value={form.accessToken}
              onChange={(e) =>
                setForm({ ...form, accessToken: e.target.value })
              }
              placeholder="Токен пользователя"
            />
          </div>
          <div className="row">
            <div className="field">
              <label>Page ID</label>
              <input
                value={form.pageId}
                onChange={(e) => setForm({ ...form, pageId: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Instagram ID</label>
              <input
                value={form.instagramId}
                onChange={(e) =>
                  setForm({ ...form, instagramId: e.target.value })
                }
              />
            </div>
          </div>
          <div className="field">
            <label>Название страницы (опционально)</label>
            <input
              value={form.pageName}
              onChange={(e) => setForm({ ...form, pageName: e.target.value })}
            />
          </div>
          <button
            className="primary"
            onClick={async () => {
              await save(form);
              setOpen(false);
            }}
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}

function AutomationCard({ automation }: { automation: any }) {
  const toggle = useMutation(api.mutations.toggleAutomation);
  const del = useMutation(api.mutations.deleteAutomation);
  const trigger = automation.triggers[0];
  const action = automation.actions[0];

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 10 }}>
          <button
            className={`toggle ${automation.isActive ? "active" : ""}`}
            onClick={() => toggle({ id: automation._id })}
          />
          <strong>{automation.name}</strong>
        </div>
        <button onClick={() => del({ id: automation._id })} style={{ fontSize: 12, padding: "4px 10px" }}>
          Удалить
        </button>
      </div>
      {trigger && (
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>
          Триггер:{" "}
          <span className="badge badge-blue">{trigger.type}</span>{" "}
          <span className="badge badge-yellow">{trigger.matchType}</span>
          {trigger.keywords.length > 0 && (
            <div className="keywords-list">
              {trigger.keywords.map((kw: string, i: number) => (
                <span className="kw-tag" key={i}>
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {action && (
        <div style={{ fontSize: 13, color: "var(--text2)" }}>
          Действие:{" "}
          <span className="badge badge-green">{action.type}</span>
          {action.delaySeconds > 0 && (
            <span> · задержка {action.delaySeconds}с</span>
          )}
          <div
            style={{
              marginTop: 4,
              background: "var(--bg)",
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {action.message}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateAutomation() {
  const create = useMutation(api.mutations.createAutomation);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    triggerType: "comment" as "dm" | "comment",
    matchType: "contains" as "contains" | "exact" | "starts_with" | "any",
    keywords: "",
    postFilter: "all" as "all" | "selected",
    selectedPostIds: "",
    actionType: "send_dm" as "send_dm" | "reply_comment" | "both",
    message: "",
    delaySeconds: 0,
  });

  const reset = () => {
    setForm({
      name: "",
      triggerType: "comment",
      matchType: "contains",
      keywords: "",
      postFilter: "all",
      selectedPostIds: "",
      actionType: "send_dm",
      message: "",
      delaySeconds: 0,
    });
    setOpen(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {!open && (
        <button className="primary" onClick={() => setOpen(true)}>
          + Новая автоматизация
        </button>
      )}
      {open && (
        <div className="card">
          <h3>Новая автоматизация</h3>

          <div className="field">
            <label>Название</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Напр: Лид-магнит"
            />
          </div>

          <div className="row">
            <div className="field">
              <label>Триггер</label>
              <select
                value={form.triggerType}
                onChange={(e) =>
                  setForm({ ...form, triggerType: e.target.value as any })
                }
              >
                <option value="comment">Комментарий</option>
                <option value="dm">Сообщение в DM</option>
              </select>
            </div>
            <div className="field">
              <label>Тип совпадения</label>
              <select
                value={form.matchType}
                onChange={(e) =>
                  setForm({ ...form, matchType: e.target.value as any })
                }
              >
                <option value="contains">Содержит</option>
                <option value="exact">Точное совпадение</option>
                <option value="starts_with">Начинается с</option>
                <option value="any">Любое</option>
              </select>
            </div>
          </div>

          {form.matchType !== "any" && (
            <div className="field">
              <label>Ключевые слова (через запятую)</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="хочу, цена, прайс"
              />
            </div>
          )}

          {form.triggerType === "comment" && (
            <div className="row">
              <div className="field">
                <label>Посты</label>
                <select
                  value={form.postFilter}
                  onChange={(e) =>
                    setForm({ ...form, postFilter: e.target.value as any })
                  }
                >
                  <option value="all">Все посты</option>
                  <option value="selected">Выбранные</option>
                </select>
              </div>
              {form.postFilter === "selected" && (
                <div className="field">
                  <label>ID постов (через запятую)</label>
                  <input
                    value={form.selectedPostIds}
                    onChange={(e) =>
                      setForm({ ...form, selectedPostIds: e.target.value })
                    }
                    placeholder="17895695668004550, ..."
                  />
                </div>
              )}
            </div>
          )}

          <div className="row">
            <div className="field">
              <label>Действие</label>
              <select
                value={form.actionType}
                onChange={(e) =>
                  setForm({ ...form, actionType: e.target.value as any })
                }
              >
                <option value="send_dm">Отправить DM</option>
                <option value="reply_comment">Ответить на комментарий</option>
                <option value="both">DM + Ответ на комментарий</option>
              </select>
            </div>
            <div className="field">
              <label>Задержка (секунды)</label>
              <input
                type="number"
                value={form.delaySeconds}
                onChange={(e) =>
                  setForm({ ...form, delaySeconds: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Сообщение</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Привет! Вот ссылка на наш прайс: ..."
            />
          </div>

          <div className="row">
            <button
              className="primary"
              onClick={async () => {
                if (!form.name || !form.message) return;
                await create({
                  name: form.name,
                  trigger: {
                    type: form.triggerType,
                    matchType: form.matchType,
                    keywords:
                      form.matchType === "any"
                        ? []
                        : form.keywords
                            .split(",")
                            .map((k) => k.trim())
                            .filter(Boolean),
                    postFilter: form.postFilter,
                    selectedPostIds:
                      form.postFilter === "selected"
                        ? form.selectedPostIds
                            .split(",")
                            .map((k) => k.trim())
                            .filter(Boolean)
                        : [],
                  },
                  action: {
                    type: form.actionType,
                    message: form.message,
                    delaySeconds: form.delaySeconds,
                  },
                });
                reset();
              }}
            >
              Создать
            </button>
            <button onClick={reset}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
