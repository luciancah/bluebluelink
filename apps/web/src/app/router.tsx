import type { RouteObject } from "react-router-dom";
import { BroadcastPage } from "../pages/BroadcastPage";
import { DashboardPage } from "../pages/DashboardPage";
import { TrackingPage } from "../pages/TrackingPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <DashboardPage />,
  },
  {
    path: "/broadcast/:id",
    element: <BroadcastPage />,
  },
  {
    path: "/track/:code",
    element: <TrackingPage />,
  },
];
