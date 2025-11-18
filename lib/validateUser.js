export const validateUser = (req, res, next) => {
  const { username, email, password } = req.body;

  // Check if this is a signup request (requires username)
  if (username !== undefined) {
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
  } else {
    // This is a login request
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
  }

  next();
};
