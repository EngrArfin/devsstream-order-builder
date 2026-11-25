import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import { Navbar } from "./Navbar";

const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-stone-50/60 to-slate-100/70 text-slate-900">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
