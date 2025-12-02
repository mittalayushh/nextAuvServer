import jwt from "jsonwebtoken";
import "dotenv/config";

const BASE_URL = "http://localhost:4001";
const JWT_SECRET = process.env.JWT_SECRET;

async function run() {
  // 1. Generate token for non-existent user
  const token = jwt.sign({ id: 99999, email: "ghost@example.com" }, JWT_SECRET, { expiresIn: "1h" });

  // 2. Try to vote on existing post (ID 2)
  console.log("Voting with non-existent user...");
  const res = await fetch(`${BASE_URL}/api/posts/2/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ value: 1 }),
  });

  if (res.status === 500) {
    console.log("Reproduced 500 Error!");
    const data = await res.json();
    console.log("Error details:", data);
  } else {
    console.log("Response status:", res.status);
    const data = await res.json();
    console.log("Response body:", data);
  }
}

run();
