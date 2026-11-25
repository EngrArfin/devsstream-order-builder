import { Link, NavLink } from "react-router-dom";

export function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Smart Order Builder
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm font-medium">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "text-slate-900 underline underline-offset-4"
                : "text-slate-600 hover:text-slate-900"
            }
          >
            Order Builder
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
