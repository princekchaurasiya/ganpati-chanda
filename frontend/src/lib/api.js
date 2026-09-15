import axios from "axios";
import { getActiveYear } from "./year";

// Always same-origin `/api` so Preview/tunnels do not call a different host
// (empty REACT_APP_BACKEND_URL, localhost, or a stale Emergent URL).
export const API = "/api";

const client = axios.create({
  baseURL: API,
  timeout: 20000,
});

// Auto-attach year param to every GET so all list/dashboard/member endpoints
// are year-scoped. POST/PUT/DELETE are untouched (they carry their own date).
client.interceptors.request.use((config) => {
  if ((config.method || "get").toLowerCase() === "get") {
    const y = getActiveYear();
    if (y && y !== "all") {
      config.params = { ...(config.params || {}), year: y };
    }
  }
  return config;
});

export const yearApi = {
  list: () => client.get("/years").then((r) => r.data),
};

export const chandaApi = {
  list: () => client.get("/chanda").then((r) => r.data),
  create: (data) => client.post("/chanda", data).then((r) => r.data),
  update: (id, data) => client.put(`/chanda/${id}`, data).then((r) => r.data),
  markReceived: (id) => client.post(`/chanda/${id}/receive`).then((r) => r.data),
  voidEntry: (id) => client.post(`/chanda/${id}/void`).then((r) => r.data),
  unvoidEntry: (id) => client.post(`/chanda/${id}/unvoid`).then((r) => r.data),
  remove: (id) => client.delete(`/chanda/${id}`).then((r) => r.data),
};

export const collectorApi = {
  list: () => client.get("/collectors").then((r) => r.data),
  create: (name) => client.post("/collectors", { name }).then((r) => r.data),
  update: (id, name) => client.put(`/collectors/${id}`, { name }).then((r) => r.data),
  remove: (id) => client.delete(`/collectors/${id}`).then((r) => r.data),
};

export const dashboardApi = {
  get: () => client.get("/dashboard").then((r) => r.data),
};

export const backupApi = {
  export: () => client.get("/backup").then((r) => r.data),
  restore: (payload) => client.post("/restore", payload).then((r) => r.data),
  seed: () => client.post("/seed").then((r) => r.data),
};

export const expenseApi = {
  list: () => client.get("/expenses").then((r) => r.data),
  create: (data) => client.post("/expenses", data).then((r) => r.data),
  update: (id, data) => client.put(`/expenses/${id}`, data).then((r) => r.data),
  voidEntry: (id) => client.post(`/expenses/${id}/void`).then((r) => r.data),
  unvoidEntry: (id) => client.post(`/expenses/${id}/unvoid`).then((r) => r.data),
  remove: (id) => client.delete(`/expenses/${id}`).then((r) => r.data),
};

export const transferApi = {
  list: () => client.get("/transfers").then((r) => r.data),
  create: (data) => client.post("/transfers", data).then((r) => r.data),
  update: (id, data) => client.put(`/transfers/${id}`, data).then((r) => r.data),
  voidEntry: (id) => client.post(`/transfers/${id}/void`).then((r) => r.data),
  unvoidEntry: (id) => client.post(`/transfers/${id}/unvoid`).then((r) => r.data),
  remove: (id) => client.delete(`/transfers/${id}`).then((r) => r.data),
};

export const memberApi = {
  summary: () => client.get("/members/summary").then((r) => r.data),
  detail: (name) => client.get(`/members/${encodeURIComponent(name)}`).then((r) => r.data),
};

export const reimbursementApi = {
  list: () => client.get("/reimbursements").then((r) => r.data),
  create: (data) => client.post("/reimbursements", data).then((r) => r.data),
  update: (id, data) => client.put(`/reimbursements/${id}`, data).then((r) => r.data),
  voidEntry: (id) => client.post(`/reimbursements/${id}/void`).then((r) => r.data),
  unvoidEntry: (id) => client.post(`/reimbursements/${id}/unvoid`).then((r) => r.data),
  remove: (id) => client.delete(`/reimbursements/${id}`).then((r) => r.data),
};

export const receiptBookApi = {
  list: () => client.get("/receipt-books").then((r) => r.data),
  create: (data) => client.post("/receipt-books", data).then((r) => r.data),
  update: (id, data) => client.put(`/receipt-books/${id}`, data).then((r) => r.data),
  next: (id) => client.get(`/receipt-books/${id}/next`).then((r) => r.data),
  remove: (id) => client.delete(`/receipt-books/${id}`).then((r) => r.data),
};

export const eventTransferApi = {
  list: () => client.get("/event-transfers").then((r) => r.data),
  create: (data) => client.post("/event-transfers", data).then((r) => r.data),
  update: (id, data) => client.put(`/event-transfers/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/event-transfers/${id}`).then((r) => r.data),
};

export const ledgerApi = {
  get: () => client.get("/ledger").then((r) => r.data),
};
