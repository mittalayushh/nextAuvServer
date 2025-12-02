import 'dotenv/config';

const BASE_URL = "http://localhost:4001/api";
let token = "";
let userId = "";
let postId = "";

async function login() {
  console.log("Logging in...");
  // Auth routes are at root /, not /api/auth
  const AUTH_URL = "http://localhost:4001";

  const res = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test_v3@example.com", password: "password123" }),
  });

  if (!res.ok) {
    // Try registering if login fails
    console.log("Login failed, trying registration...");
    const regRes = await fetch(`${AUTH_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser_profile_v3", email: "test_v3@example.com", password: "password123" }),
    });
    if (!regRes.ok) {
      const text = await regRes.text();
      console.error("Registration failed:", regRes.status, text);
      return;
    }
    const regData = await regRes.json();
    token = regData.token;
    // userId = regData.user.id; // Signup doesn't return user object
  } else {
    const data = await res.json();
    token = data.token;
    // userId = data.user.id; // Login doesn't return user object either (based on controller)
  }
  console.log("Logged in/Registered.");
}

async function createPost() {
  console.log("Creating post...");
  const res = await fetch(`${BASE_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ title: "Profile Test Post", content: "Testing profile content" }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Create post failed:", res.status, text);
    return;
  }
  const data = await res.json();
  postId = data.post.id;
  console.log("Post created:", postId);
}

async function savePost() {
  console.log("Saving post...");
  const res = await fetch(`${BASE_URL}/posts/${postId}/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
  });
  const data = await res.json();
  console.log("Save result:", data);
}

async function verifyProfileEndpoints() {
  const headers = { "Authorization": `Bearer ${token}` };

  // Get Profile
  console.log("Fetching profile...");
  const username = "testuser_profile_v3"; // Match the one used in registration
  const profileRes = await fetch(`${BASE_URL}/users/${username}`);
  console.log("Profile status:", profileRes.status);

  // Get User Posts
  console.log("Fetching user posts...");
  const postsRes = await fetch(`${BASE_URL}/users/${username}/posts`, { headers });
  const posts = await postsRes.json();
  console.log("User posts count:", posts.length);

  // Get Saved Posts
  console.log("Fetching saved posts...");
  const savedRes = await fetch(`${BASE_URL}/users/${username}/saved`, { headers });
  const saved = await savedRes.json();
  console.log("Saved posts count:", saved.length);
  if (saved.length > 0 && saved[0].id === postId) {
    console.log("SUCCESS: Saved post found.");
  } else {
    console.log("FAILURE: Saved post not found.");
  }
}

async function run() {
  try {
    await login();
    await createPost();
    await savePost();
    await verifyProfileEndpoints();
  } catch (err) {
    console.error("Verification failed:", err);
  }
}

run();
