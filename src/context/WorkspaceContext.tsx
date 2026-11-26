import { createContext, useContext } from "react";
import type { MenuFixture, Order } from "@/types/order";

export interface WorkspaceContextValue {
  menu: MenuFixture | null;
  orders: Order[];
  setWorkspaceMenu: (menu: MenuFixture | null) => void;
  setWorkspaceOrders: (orders: Order[]) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null
);

export function useWorkspaceContext(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
