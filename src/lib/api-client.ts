import { auth } from "./firebase";

export async function apiCall<T = any>(
  url: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be logged in.");

  const token = await user.getIdToken();
  const { method = "GET", body } = options;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err: any) {
    console.error(`Network error - ${method} ${url}:`, err);
    throw new Error(`Network error: ${err.message}`);
  }

  // Read the body ONCE as text, then decide what to do with it
  const rawText = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    console.error("Non-JSON response:", rawText);
    throw new Error(
      `Server returned non-JSON (${res.status}). Check API routes and Firebase Admin setup.`
    );
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (err: any) {
    console.error(`JSON parse error - ${method} ${url}:`, rawText);
    throw new Error(`Invalid JSON response from ${url}`);
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.message || `API error (${res.status})`);
  }

  return data;
}