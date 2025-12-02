import 'dotenv/config';
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import userRoutes from "./routes/userRoutes.js"; // Added userRoutes import

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "https://nextauv.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());

app.use("/", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/posts/:postId/comments", commentRoutes);
app.use("/api/comments", commentRoutes); // Allow direct access for update/delete
app.use("/api/users", userRoutes); // Added userRoutes registration

const PORT = 4001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));