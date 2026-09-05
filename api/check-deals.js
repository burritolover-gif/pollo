// api/check-deals.js
//
// Checks Mewgenics, Endacopia (both on Steam) and CrossOver (sold directly
// by CodeWeavers) for an active discount, and emails a summary to
// NOTIFY_EMAIL whenever one is found. Runs automatically once a day via
// Vercel Cron - see vercel.json for the schedule.
//
// Visit /api/check-deals?test=1 any time to run all checks immediately
// and force a summary email, useful for confirming everything works.

const STEAM_GAMES = [
  { name: 'Mewgenics', appId: '686060' },
  { name: 'Endacopia', appId: '2684630' },
];

const CROSSOVER_PROMOTIONS_URL = 'https://www.codeweavers.com/store/promotions';

async function checkSteamGame(game) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${game.appId}&cc=us&filters=price_overview`;
    const res = await fetch(url, { headers: { 'User-Agent': 'deal-alert-app' } });
    if (!res.ok) {
      return { name: game.name, error: `Steam API returned HTTP ${res.status}` };
    }
    const data = await res.json();
    const entry = data[game.appId];
    if (!entry || !entry.success) {
      return { name: game.name, error: 'Steam had no data for this app id' };
    }
    const priceOverview = entry.data && entry.data.price_overview;
    if (!priceOverview) {
      // No price_overview usually means free-to-play, not yet priced in
      // this region, or not currently sold on Steam.
      return { name: game.name, onSale: false };
    }
    return {
      name: game.name,
      onSale: priceOverview.discount_percent > 0,
      discountPercent: priceOverview.discount_percent,
      finalPrice: priceOverview.final_formatted,
      originalPrice: priceOverview.initial_formatted,
      url: `https://store.steampowered.com/app/${game.appId}/`,
    };
  } catch (err) {
    return { name: game.name, error: err.message };
  }
}

async function checkCrossOver() {
  try {
    const res = await fetch(CROSSOVER_PROMOTIONS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (deal-alert-app)' },
    });
    if (!res.ok) {
      return { name: 'CrossOver', error: `CodeWeavers site returned HTTP ${res.status}` };
    }
    const html = await res.text();
    const noPromoPhrase = /no promotions currently active/i;
    const onSale = !noPromoPhrase.test(html);
    return {
      name: 'CrossOver',
      onSale,
      url: CROSSOVER_PROMOTIONS_URL,
      note: onSale
        ? "The CodeWeavers promotions page no longer shows its usual \"no promotions active\" message - check the link for details."
        : undefined,
    };
  } catch (err) {
    return { name: 'CrossOver', error: err.message };
  }
}

async function sendEmail(subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error('Missing RESEND_API_KEY or NOTIFY_EMAIL environment variable');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Deal Alerts <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend error HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

module.exports = async (req, res) => {
  // Optional protection for the endpoint. If you set a CRON_SECRET
  // environment variable in Vercel, only requests carrying that exact
  // secret are allowed through (Vercel's own cron invocations always
  // include it automatically once it's set). If you never set one,
  // this check is skipped, so visiting the URL yourself still works.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  let isTest = false;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    isTest = url.searchParams.get('test') === '1';
  } catch (_err) {
    // If URL parsing ever fails, just treat it as a normal (non-test) run.
  }

  const results = [];
  for (const game of STEAM_GAMES) {
    results.push(await checkSteamGame(game));
  }
  results.push(await checkCrossOver());

  const deals = results.filter((r) => r.onSale);
  const errors = results.filter((r) => r.error);

  let emailSent = false;
  let emailError = null;

  if (deals.length > 0 || isTest) {
    const lines = [];
    if (deals.length > 0) {
      lines.push("Here's what's currently on sale:", '');
      for (const d of deals) {
        if (d.discountPercent !== undefined) {
          lines.push(`- ${d.name}: ${d.finalPrice} (was ${d.originalPrice}, -${d.discountPercent}%) - ${d.url}`);
        } else {
          lines.push(`- ${d.name}: promotion detected - ${d.url}`);
        }
      }
    } else {
      lines.push('No deals right now - this is a test email confirming the pipeline works.');
    }
    if (errors.length > 0) {
      lines.push('', 'Some checks failed and may need attention:');
      for (const e of errors) lines.push(`- ${e.name}: ${e.error}`);
    }
    const subject = deals.length > 0
      ? `Deal alert: ${deals.map((d) => d.name).join(', ')}`
      : 'Deal alert app - test email';

    try {
      await sendEmail(subject, lines.join('\n'));
      emailSent = true;
    } catch (err) {
      emailError = err.message;
    }
  }

  res.status(200).json({
    checkedAt: new Date().toISOString(),
    results,
    dealsFound: deals.length,
    emailSent,
    emailError,
  });
};
