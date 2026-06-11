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
  // Secret Codes
  getCodes: () => req("/auth/secret-code"),
  createCode: (data: { code: string; max_uses?: number }) =>
    req("/auth/secret-code", { method: "POST", body: JSON.stringify(data) }),
  toggleCode: (id: number, is_active: boolean) =>
    req(`/auth/secret-code/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),
  deleteCode: (id: number) =>
    req(`/auth/secret-code/${id}`, { method: "DELETE" }),

  // Students
  getStudents: () => req("/auth/my-students"),
  toggleBlock: (studentId: number, block: boolean) =>
    req(`/auth/students/${studentId}/block`, {
      method: "PATCH",
      body: JSON.stringify({ blocked: block }),
    }),

  // Results
  getAdminResults: () => req("/results/admin"),
  publishResult: (data: object) =>
    req("/results/publish", { method: "POST", body: JSON.stringify(data) }),

  // Assignments
  getAdminAssignments: () => req("/assignments/admin"),
  createAssignment: (data: object) =>
    req("/assignments/", { method: "POST", body: JSON.stringify(data) }),
  getSubmissions: (id: number) => req(`/assignments/${id}/submissions`),
  giveFeedback: (submissionId: number, feedback: string) =>
    req(`/assignments/submissions/${submissionId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    }),

  // Notifications
  sendNotification: (data: {
    title: string;
    message: string;
    student_id?: number;
  }) =>
    req("/notifications/send", { method: "POST", body: JSON.stringify(data) }),
};
