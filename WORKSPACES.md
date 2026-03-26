# Управление воркспейсами (Workspaces)

Воркспейсы разделяют аккаунты Instagram/Facebook между разными проектами/сотрудниками.
Каждый воркспейс имеет свой пароль для входа и видит только свои подключённые аккаунты.

## Как это работает

- Таблица `workspaces` в Convex хранит: `name`, `password`, `maxAccounts` (опционально)
- Каждая запись в `integrations` привязана к воркспейсу через `workspaceId`
- При OAuth подключении аккаунта `workspaceId` передаётся через параметр `state`
- Вебхуки работают глобально — они ищут аккаунт по Instagram ID, не по воркспейсу

## Добавить новый воркспейс

Через Convex Dashboard (https://dashboard.convex.dev) → Functions → `mutations:addWorkspace`:

```json
{
  "name": "Название проекта",
  "password": "уникальный_пароль",
  "maxAccounts": 5
}
```

Или через CLI:
```bash
npx convex run mutations:addWorkspace '{"name": "Название", "password": "пароль", "maxAccounts": 5}'
```

`maxAccounts` — опциональный. Если не указан, лимита нет.

## Удалить воркспейс

**ВНИМАНИЕ:** Удаляет воркспейс, все его аккаунты, автоматизации, триггеры и действия.

```bash
npx convex run mutations:removeWorkspace '{"workspaceId": "ID_ВОРКСПЕЙСА"}'
```

## Посмотреть список воркспейсов

Через Convex Dashboard → Data → таблица `workspaces`.

## Изменить пароль воркспейса

Через Convex Dashboard → Data → таблица `workspaces` → найти нужный → редактировать поле `password`.

## Изменить лимит аккаунтов

Через Convex Dashboard → Data → таблица `workspaces` → редактировать поле `maxAccounts`.
Удалить поле = безлимит.

## Первоначальная миграция

При первом запуске нужно выполнить один раз:

```bash
npx convex run mutations:seedDefaultWorkspace
```

Это создаст воркспейс "Default" с паролем `botmake2026` и привяжет все существующие аккаунты к нему.

## Инструкция для Claude

Когда нужно добавить новый воркспейс, попроси Claude выполнить:
```
npx convex run mutations:addWorkspace '{"name": "...", "password": "...", "maxAccounts": ...}'
```

Когда нужно удалить:
```
npx convex run mutations:removeWorkspace '{"workspaceId": "..."}'
```

Для просмотра текущих воркспейсов Claude может использовать Convex Dashboard или прочитать таблицу `workspaces`.
