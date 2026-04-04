const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

Deno.serve(async () => {
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'TradeSmartDz/1.0' },
    });
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
