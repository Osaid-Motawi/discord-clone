import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Registers Convex Auth's HTTP routes (token exchange, etc.).
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
