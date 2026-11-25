import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">404</h1>
      <p className="mt-2 text-sm text-slate-600">Page not found.</p>
      <Link
        to="/"
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Back to Order Builder
      </Link>
    </section>
  );
}
