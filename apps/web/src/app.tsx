import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { CellacdcPage } from "@/routes/cellacdc-page";
import { CellposePage } from "@/routes/cellpose-page";
import { FileBrowserDialog } from "@/components/file-browser-dialog";
import { WebSocketProvider } from "./hooks/use-websocket";
import { useEffect } from "react";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <WebSocketProvider>
        <Outlet />
        <FileBrowserDialog />
      </WebSocketProvider>
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => {
    const navigate = useNavigate();

    useEffect(() => {
      navigate({ to: "/cellpose", replace: true });
    }, [navigate]);

    return null;
  },
});

const cellposeAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "cellpose",
  component: CellposePage,
});

const cellacdcRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "cellacdc",
  component: CellacdcPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  cellposeAliasRoute,
  cellacdcRoute,
]);

const router = createRouter({ routeTree });

export function App() {
  return <RouterProvider router={router} />;
}
