export const metadata = { title: "Удаление данных — BotMake Direct" };

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;

  return (
    <div className="legal-page">
      <h1>Удаление данных</h1>

      {code && (
        <div className="deletion-status">
          <h2>Статус запроса</h2>
          <p>Ваш запрос на удаление данных обрабатывается.</p>
          <p><strong>Код подтверждения:</strong> {code}</p>
          <p>Все данные будут удалены в течение 48 часов.</p>
        </div>
      )}

      <h2>Как запросить удаление данных</h2>

      <h3>Способ 1: Через настройки Instagram</h3>
      <ol>
        <li>Откройте Instagram → Настройки → Безопасность → Приложения и сайты</li>
        <li>Найдите «BotMake Direct» (Chat Bot)</li>
        <li>Нажмите «Удалить»</li>
        <li>Данные будут автоматически удалены с наших серверов</li>
      </ol>

      <h3>Способ 2: Через панель управления</h3>
      <ol>
        <li>Войдите в <a href="/">панель управления</a></li>
        <li>Нажмите кнопку удаления рядом с аккаунтом</li>
        <li>Подтвердите удаление</li>
      </ol>

      <h3>Способ 3: По email</h3>
      <p>Отправьте запрос на <strong>privacy@botmake.site</strong> с указанием вашего Instagram username.</p>

      <h2>Какие данные удаляются</h2>
      <ul>
        <li>Данные интеграции (токен доступа, ID аккаунта)</li>
        <li>Все автоматизации, триггеры и действия</li>
        <li>Журнал событий</li>
        <li>Данные о подписчиках, взаимодействовавших с автоматизациями</li>
      </ul>

      <h2>Сроки</h2>
      <p>Удаление выполняется в течение 48 часов с момента запроса. После удаления данные не подлежат восстановлению.</p>

      <h2>Контакты</h2>
      <p>По вопросам: <strong>privacy@botmake.site</strong></p>
    </div>
  );
}
