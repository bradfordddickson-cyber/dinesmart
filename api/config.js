/**
 * Vercel Serverless Function — /api/config
 * Returns public Supabase config to the frontend (safe to expose with RLS enabled).
 */
export default function handler(req, res) {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL      || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
}
