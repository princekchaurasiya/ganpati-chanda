import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import AddChanda from "@/pages/AddChanda";
import ChandaList from "@/pages/ChandaList";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Expenses from "@/pages/Expenses";
import AddExpense from "@/pages/AddExpense";
import Members from "@/pages/Members";
import MemberDetail from "@/pages/MemberDetail";
import AddTransfer from "@/pages/AddTransfer";
import AddReimbursement from "@/pages/AddReimbursement";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="add" element={<AddChanda />} />
          <Route path="list" element={<ChandaList />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/add" element={<AddExpense />} />
          <Route path="transfer/add" element={<AddTransfer />} />
          <Route path="reimburse/add" element={<AddReimbursement />} />
          <Route path="members" element={<Members />} />
          <Route path="members/:name" element={<MemberDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
