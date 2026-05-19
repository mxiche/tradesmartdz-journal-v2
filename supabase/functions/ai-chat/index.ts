import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify the user exists and is authenticated
    const { data: { user }, error: authError } =
      await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Check user has Pro subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const isPro = subscription?.status === 'active' ||
                  subscription?.status === 'trial'

    if (!isPro) {
      return new Response(
        JSON.stringify({ error: 'Pro subscription required' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Get request body
    const { messages, max_tokens = 400 } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Call OpenRouter with server-side key
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openRouterKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tradesmartdz.com',
          'X-Title': 'TradeSmartDz'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-001',
          messages,
          max_tokens
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenRouter error:', error)
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
