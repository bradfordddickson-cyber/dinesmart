/**
 * Vercel Serverless Function — /api/huds-sync
 *
 * Future: Sync today's menu from Harvard HUDS FoodPro into Supabase.
 *
 * To activate:
 *   1. Complete Harvard IT data sharing agreement with HUDS
 *   2. Obtain FoodPro API credentials from Harvard HUIT
 *   3. Set FOODPRO_API_URL and FOODPRO_API_KEY environment variables
 *   4. Implement the sync logic below
 *   5. Configure a Vercel Cron Job to run this daily at 6am:
 *      Add to vercel.json: { "crons": [{ "path": "/api/huds-sync", "schedule": "0 6 * * *" }] }
 *
 * Contact: huds@harvard.edu to request data access
 */
export default async function handler(req, res) {
  const foodproUrl = process.env.FOODPRO_API_URL;
  const foodproKey = process.env.FOODPRO_API_KEY;

  if (!foodproUrl || !foodproKey) {
    return res.status(503).json({
      status:  'not_configured',
      message: 'FoodPro credentials not set. Requires Harvard HUDS data agreement.',
      contact: 'huds@harvard.edu',
      docs:    'https://huit.harvard.edu',
    });
  }

  // TODO: Implement FoodPro sync when credentials are available
  // Steps:
  //   1. Fetch today's menu from FoodPro API
  //   2. Map FoodPro items to DineSmart menu_items schema
  //   3. Upsert into Supabase using service role key
  //   4. Return count of items synced

  res.status(501).json({ status: 'not_implemented' });
}
