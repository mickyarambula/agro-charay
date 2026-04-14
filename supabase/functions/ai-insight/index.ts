const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { contexto, modulo } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Eres un asistente agrícola experto para Almacenes Santa Rosa en Charay, Sinaloa, México.
Analiza estos datos del módulo "${modulo}" y da UN insight accionable en máximo 2 oraciones en español.
Sé directo, específico y útil. Sin saludos ni introducciones.
Datos: ${JSON.stringify(contexto)}`
        }]
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? 'Sin datos suficientes para analizar.';

    return new Response(JSON.stringify({ insight: text }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ insight: 'Error al conectar con el asistente.' }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: 200,
    });
  }
});
