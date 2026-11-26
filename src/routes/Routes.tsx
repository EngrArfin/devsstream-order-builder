import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import OrdersPage from "../pages/OrdersPage";

export const routeConfig = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "orders",
        element: <OrdersPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

const routes = createBrowserRouter(routeConfig);

export default routes;
