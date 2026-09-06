import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const chandaApi = {
  list: () => client.get("/chanda").then((r) => r.data),
  create: (data) => client.post("/chanda", data).then((r) => r.data),
  update: (id, data) => client.put(`/chanda/${id}`, data).then((r) => r.data),
  voidEntry: (id) => client.post(`/chanda/${id}/void`).then((r) => r.data),
  unvoidEntry: (id) => client.post(`/chanda/${id}/unvoid`).then((r) => r.data),
  remove: (id) => client.delete(`/chanda/${id}`).then((r) => r.data),
};

export const collectorApi = {
  list: () => client.get("/collectors").then((r) => r.data),
  create: (name) => client.post("/collectors", { name }).then((r) => r.data),
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
