// TODO: las llamadas a api.anthropic.com/v1/messages desde el navegador fallarán
// por CORS + falta de x-api-key. Migrar a una Supabase Edge Function (o Vercel
// API route) que reenvíe el request con la API key del servidor. Mientras tanto
// el componente muestra el estado loading y cae en el catch con el mensaje
// "No se pudo conectar con el asistente IA."

import React, { useState } from 'react';

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
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Eres un asistente agrícola experto para Almacenes Santa Rosa en Charay, Sinaloa.
Analiza estos datos del módulo ${modulo} y da UN insight accionable en máximo 2 oraciones en español.
Sé directo y específico. Sin saludos ni introducciones.
Datos: ${JSON.stringify(contexto)}`
          }]
        })
      });
      const data = await res.json();
      setInsight(data.content?.[0]?.text || 'Sin datos suficientes para analizar.');
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
