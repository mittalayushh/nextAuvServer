import 'dotenv/config';
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "https://nextauv.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());

app.use("/", authRoutes);
app.use("/api/posts", postRoutes);

const PORT = 4001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));