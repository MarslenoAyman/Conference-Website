import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "servants-and-served-dev-secret";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, phone: user.phone, role: user.role, teamId: user.teamId },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please sign in again." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have access to do that." });
    }
    next();
  };
}

// A "responsible" field can name one person or several joined by & or , (e.g.
// "Mr Marsleno Ayman & Mr Amir Ashraf"). Returns true if `name` is one of them.
export function managerHasName(manager, name) {
  if (!manager || !name) return false;
  return manager
    .split(/[&,]/)
    .map((s) => s.trim().toLowerCase())
    .includes(String(name).trim().toLowerCase());
}
