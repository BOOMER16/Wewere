import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./dashboard";
import "./globals.css";
import Spectator from "./spectator";
createRoot(document.getElementById("root")!).render(
  location.pathname.startsWith("/spectator") ? (
    <Spectator />
  ) : (
    <Dashboard initialPage={location.pathname.split("/")[1] || "teams"} />
  ),
);
