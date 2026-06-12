const BASE = "https://intervex-ai-final.onrender.com/api/sp";

function getHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const portalAPI = {
  // Secret Codes — route is /secret-codes (plural)
  getCodes: () => req("/auth/secret-codes"),
  createCode: (data: { code: string; label?: string; max_uses?: number }) =>
    req("/auth/secret-code", { method: "POST", body: JSON.stringify(data) }),
  toggleCode: (id: string) =>
    req(`/auth/secret-code/${id}/toggle`, { method: "PATCH" }),
  // no delete route in backend — omitted

  // Students — route is /students not /my-students
  getStudents: () => req("/auth/students"),
  toggleBlock: (studentId: string, is_active: boolean) =>
    req(`/auth/students/${studentId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),

  // Results
  getAdminResults: () => req("/results/admin"),
  publishResult: (data: object) =>
    req("/results", { method: "POST", body: JSON.stringify(data) }),

  // Assignments
  getAdminAssignments: () => req("/assignments/admin"),
  createAssignment: (data: object) =>
    req("/assignments", { method: "POST", body: JSON.stringify(data) }),
  getSubmissions: (id: string) => req(`/assignments/${id}/submissions`),

  // Notifications — route is /sp/notifications (no /send suffix)
  sendNotification: (data: {
    title: string;
    message: string;
    type?: string;
    student_id?: string;
  }) =>
    req("/notifications", { method: "POST", body: JSON.stringify(data) }),
};
