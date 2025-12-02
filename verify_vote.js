
const BASE_URL = "http://localhost:4001";

async function run() {
  try {
    // 1. Signup/Login
    const email = `test${Date.now()}@example.com`;
    const password = "password123";
    console.log("Signing up...");
    let res = await fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: `user${Date.now()}`, email, password }),
    });
    let data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const token = data.token;
    console.log("Signup successful. Token received.");

    // 2. Create Post
    console.log("Creating post...");
    res = await fetch(`${BASE_URL}/api/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: "Test Post", content: "Testing votes", tags: [] }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const postId = data.post.id;
    console.log("Post created. ID:", postId);

    // 3. Vote Up
    console.log("Voting Up (+1)...");
    res = await fetch(`${BASE_URL}/api/posts/${postId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ value: 1 }),
    });
    data = await res.json();
    console.log("Vote response:", data);

    // 4. Check Post
    console.log("Checking post...");
    res = await fetch(`${BASE_URL}/api/posts/${postId}`);
    data = await res.json();
    console.log("Post vote count:", data.voteCount);
    if (data.voteCount !== 1) throw new Error("Vote count should be 1");

    // 5. Switch Vote (Down)
    console.log("Switching Vote to Down (-1)...");
    res = await fetch(`${BASE_URL}/api/posts/${postId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ value: -1 }),
    });
    data = await res.json();
    console.log("Vote response:", data);

    // 6. Check Post
    res = await fetch(`${BASE_URL}/api/posts/${postId}`);
    data = await res.json();
    console.log("Post vote count:", data.voteCount);
    if (data.voteCount !== -1) throw new Error("Vote count should be -1");

    // 7. Toggle Off (Remove Vote)
    console.log("Toggling Off (Remove Vote)...");
    res = await fetch(`${BASE_URL}/api/posts/${postId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ value: -1 }),
    });
    data = await res.json();
    console.log("Vote response:", data);

    // 8. Check Post
    res = await fetch(`${BASE_URL}/api/posts/${postId}`);
    data = await res.json();
    console.log("Post vote count:", data.voteCount);
    if (data.voteCount !== 0) throw new Error("Vote count should be 0");

    console.log("VERIFICATION SUCCESSFUL!");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

run();
