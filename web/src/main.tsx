import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell.js";
import { PublicOnly, RequireIdentity, RequireToken } from "./app/guards.js";
import { CreateWg } from "./pages/onboarding/CreateWg.js";
import { IdentityPicker } from "./pages/onboarding/IdentityPicker.js";
import { Join } from "./pages/onboarding/Join.js";
import { Landing } from "./pages/onboarding/Landing.js";
import { Aktivitaet } from "./pages/Aktivitaet.js";
import { Anzeige } from "./pages/Anzeige.js";
import { ChoreForm } from "./pages/ChoreForm.js";
import { Einkaufen } from "./pages/Einkaufen.js";
import { ExpenseForm } from "./pages/ExpenseForm.js";
import { Fixkosten } from "./pages/Fixkosten.js";
import { Geld } from "./pages/Geld.js";
import { MeetingDetail } from "./pages/MeetingDetail.js";
import { MeetingForm } from "./pages/MeetingForm.js";
import { Mitbewohner } from "./pages/Mitbewohner.js";
import { Profil } from "./pages/Profil.js";
import { Putzplan } from "./pages/Putzplan.js";
import { Start } from "./pages/Start.js";
import { Termine } from "./pages/Termine.js";
import { theme } from "./theme.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, staleTime: 30_000, retry: 1 },
  },
});

const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: "/willkommen", element: <Landing /> },
      { path: "/erstellen", element: <CreateWg /> },
      { path: "/beitreten", element: <Join /> },
      { path: "/join/:token", element: <Join /> },
    ],
  },
  {
    element: <RequireToken />,
    children: [{ path: "/wer-bin-ich", element: <IdentityPicker /> }],
  },
  {
    element: <RequireIdentity />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Start /> },
          { path: "/geld", element: <Geld /> },
          { path: "/geld/neu", element: <ExpenseForm /> },
          { path: "/geld/:id/bearbeiten", element: <ExpenseForm /> },
          { path: "/putzplan", element: <Putzplan /> },
          { path: "/putzplan/neu", element: <ChoreForm /> },
          { path: "/putzplan/:id/bearbeiten", element: <ChoreForm /> },
          { path: "/einkaufen", element: <Einkaufen /> },
          { path: "/termine", element: <Termine /> },
          { path: "/termine/neu", element: <MeetingForm /> },
          { path: "/termine/:id", element: <MeetingDetail /> },
          { path: "/fixkosten", element: <Fixkosten /> },
          { path: "/mitbewohner", element: <Mitbewohner /> },
          { path: "/profil", element: <Profil /> },
          { path: "/anzeige", element: <Anzeige /> },
          { path: "/aktivitaet", element: <Aktivitaet /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
