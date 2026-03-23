export type Lang = "en" | "ru";

const dict = {
  // Auth
  "auth.title": { en: "BotMake Direct", ru: "BotMake Direct" },
  "auth.subtitle": { en: "Enter access code to sign in", ru: "Введите код доступа для входа" },
  "auth.placeholder": { en: "Access code", ru: "Код доступа" },
  "auth.login": { en: "Sign in", ru: "Войти" },
  "auth.wrong": { en: "Invalid code", ru: "Неверный код" },
  // Dashboard
  "nav.logout": { en: "Sign out", ru: "Выйти" },
  "accounts.title": { en: "Accounts", ru: "Аккаунты" },
  "accounts.connect": { en: "+ Connect", ru: "+ Подключить" },
  "connect.title": { en: "Connect Account", ru: "Подключить аккаунт" },
  "connect.subtitle": { en: "Choose how to connect your Instagram", ru: "Выберите способ подключения Instagram" },
  "connect.ig": { en: "Instagram", ru: "Instagram" },
  "connect.ig.desc": { en: "Log in directly with Instagram Business", ru: "Войти напрямую через Instagram Business" },
  "connect.fb": { en: "Facebook Page", ru: "Facebook-страница" },
  "connect.fb.desc": { en: "Connect Instagram via Facebook Page", ru: "Подключить Instagram через Facebook-страницу" },
  "accounts.empty": { en: "Connect an Instagram account to get started", ru: "Подключите Instagram-аккаунт для начала работы" },
  "accounts.expires": { en: "until", ru: "до" },
  "auth.success": { en: "Instagram account connected successfully", ru: "Instagram-аккаунт успешно подключён" },
  "auth.error": { en: "Failed to connect account", ru: "Ошибка подключения аккаунта" },
  "loading": { en: "Loading...", ru: "Загрузка..." },
  // Automations
  "auto.title": { en: "Automations", ru: "Автоматизации" },
  "auto.new": { en: "+ New automation", ru: "+ Новая автоматизация" },
  "auto.empty": { en: "No automations yet", ru: "Нет автоматизаций" },
  "auto.edit": { en: "Edit", ru: "Изменить" },
  "auto.delete": { en: "Delete", ru: "Удалить" },
  "auto.editing": { en: "Editing", ru: "Редактирование" },
  "auto.creating": { en: "New automation", ru: "Новая автоматизация" },
  "auto.save": { en: "Save", ru: "Сохранить" },
  "auto.create": { en: "Create", ru: "Создать" },
  "auto.cancel": { en: "Cancel", ru: "Отмена" },
  "auto.addStep": { en: "+ Add next step", ru: "+ Добавить следующий шаг" },
  "auto.removeStep": { en: "Remove", ru: "Убрать" },
  // Form labels
  "form.name": { en: "Name", ru: "Название" },
  "form.name.ph": { en: "e.g. Auto-reply to comments", ru: "Например: Автоответ на комментарии" },
  "form.trigger": { en: "Trigger", ru: "Триггер" },
  "form.match": { en: "Match type", ru: "Совпадение" },
  "form.keywords": { en: "Keywords (comma-separated)", ru: "Ключевые слова (через запятую)" },
  "form.keywords.ph": { en: "want, details, price", ru: "хочу, подробнее, цена" },
  "form.posts": { en: "Posts", ru: "Посты" },
  "form.postIds": { en: "Post IDs", ru: "ID постов" },
  "form.action": { en: "Action", ru: "Действие" },
  "form.delay": { en: "Delay (sec)", ru: "Задержка (сек)" },
  "form.message": { en: "Message", ru: "Сообщение" },
  "form.message.ph": { en: "Message text...", ru: "Текст сообщения..." },
  "form.replyKw": { en: "Keyword for next step", ru: "Кодовое слово для следующего шага" },
  "form.replyKw.ph": { en: "e.g. Want", ru: "Например: Хочу" },
  "form.quickReplies": { en: "Quick replies", ru: "Быстрые ответы" },
  "form.commentReplies": { en: "Comment reply variants", ru: "Варианты ответа на комментарий" },
  "form.buttons": { en: "Link buttons", ru: "Кнопки-ссылки" },
  "form.btnText": { en: "Button text", ru: "Текст кнопки" },
  "form.add": { en: "+ Add", ru: "+ Добавить" },
  // Trigger/action options
  "opt.comment": { en: "Comment", ru: "Комментарий" },
  "opt.dm": { en: "Direct message", ru: "Сообщение (DM)" },
  "opt.contains": { en: "Contains", ru: "Содержит" },
  "opt.exact": { en: "Exact match", ru: "Точное" },
  "opt.starts_with": { en: "Starts with", ru: "Начинается с" },
  "opt.any": { en: "Any message", ru: "Любое сообщение" },
  "opt.all_posts": { en: "All posts", ru: "Все посты" },
  "opt.selected": { en: "Selected", ru: "Выбранные" },
  "opt.send_dm": { en: "Send DM", ru: "Отправить DM" },
  "opt.reply_comment": { en: "Reply to comment", ru: "Ответить на комментарий" },
  "opt.both": { en: "DM + Reply", ru: "DM + Ответ на комментарий" },
  // Card display
  "step": { en: "Step", ru: "Шаг" },
  "variants": { en: "variants", ru: "вариантов" },
  "waits": { en: "waits:", ru: "ждёт:" },
  "after": { en: "after", ru: "через" },
} as const;

type Key = keyof typeof dict;

export function t(key: Key, lang: Lang): string {
  return dict[key]?.[lang] ?? key;
}
