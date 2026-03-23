import Link from "next/link";

export default function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="logo">BotMake Direct</Link>
      </div>
    </header>
  );
}
