import type { NextRequest } from "next/server";
import { handlers } from "@/auth";

type AuthRouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

type AuthRouteHandler = (
  request: NextRequest,
  context: AuthRouteContext
) => Promise<Response>;

export const GET: AuthRouteHandler = handlers.GET as AuthRouteHandler;
export const POST: AuthRouteHandler = handlers.POST as AuthRouteHandler;
