import React, { useState } from 'react';

const SUPABASE_URL = 'https://oryixvodfqojunnqbkln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeWl4dm9kZnFvanVubnFia2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODUzMjAsImV4cCI6MjA5MTQ2MTMyMH0.03nXDh5qj7N-RiCqXxGKvhfZSVWDmuV4hFwTOZ66ZCQ';

export default function AIInsight({ contexto, modulo }) {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const generarInsight = async () => {
    if (insight) { setAbierto(a => !a); return; }
    setLoading(true);
    setAbierto(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-insight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ contexto, modulo }),
      });
      const data = await res.json();
      setInsight(data.insight || 'Sin datos suficientes.');
    } catch (e) {
      setInsight('No se pudo conectar con el asistente IA.');
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        background: '#1a3a0f',
        borderRadius: 12,
        padding: '10px 14px',
        marginBottom: 16,
        cursor: 'pointer',
      }}
      onClick={generarInsight}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ color: '#7ab87a', fontSize: 10, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' }}>
          Asistente IA · {modulo}
        </span>
        <span style={{ marginLeft: 'auto', color: '#7ab87a', fontSize: 11 }}>
          {loading ? '...' : abierto ? '▲ cerrar' : '▼ analizar'}
        </span>
      </div>
      {abierto && (
        <div style={{ marginTop: 8, color: '#e8f5e2', fontSize: 12, lineHeight: 1.6 }}>
          {loading ? 'Analizando datos del ciclo...' : insight}
        </div>
      )}
    </div>
  );
}
