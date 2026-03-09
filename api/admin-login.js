/**
 * Vercel Serverless Function — /api/admin-login
 * Validates the admin password against ADMIN_PASSWORD env var.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: 'ADMIN_PASSWORD not configured.' });
  }

  const { password } = req.body;
  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Return a simple session token (timestamp + secret signature)
  const token = Buffer.from(`dinesmart-admin:${Date.now()}:${adminPassword}`).toString('base64');
  res.status(200).json({ token });
}
