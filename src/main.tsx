import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { DashboardToaster } from "./components/ui/Toaster.tsx";
import "./index.css";
import routes from "./routes/Routes.tsx";

async function enableMocking() {
  if (typeof window === "undefined") {
    return;
  }
  const { worker } = await import("./mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
  });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={routes} />
      <DashboardToaster />
    </StrictMode>
  );
});
