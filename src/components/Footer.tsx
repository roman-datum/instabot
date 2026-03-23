import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-links">
          <Link href="/privacy">Политика конфиденциальности</Link>
          <Link href="/terms">Условия использования</Link>
          <Link href="/data-deletion">Удаление данных</Link>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} BotMake Direct. Все права защищены.</p>
      </div>
    </footer>
  );
}
