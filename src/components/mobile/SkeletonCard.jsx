import React, { useEffect } from 'react';

const shimmerStyleId = 'skeleton-card-shimmer';

function ensureShimmerStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(shimmerStyleId)) return;
  const el = document.createElement('style');
  el.id = shimmerStyleId;
  el.textContent = `
    @keyframes skeletonShimmer {
      0%   { background-position: -468px 0; }
      100% { background-position: 468px 0; }
    }
    .skeleton-bar {
      background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
      background-size: 936px 100%;
      animation: skeletonShimmer 1.4s linear infinite;
      border-radius: 6px;
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-bar { animation: none; }
    }
  `;
  document.head.appendChild(el);
}

function SkeletonBar({ width, height = 12, style }) {
  return (
    <div
      className="skeleton-bar"
      style={{ width, height, ...style }}
    />
  );
}

function SingleSkeletonCard() {
  return (
    <div style={{
      background: '#F0FDF4',
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(21, 128, 61, 0.08)',
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    }}>
      {/* Header: badge + título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <SkeletonBar width={90} height={20} style={{ borderRadius: 999 }} />
        <SkeletonBar width="55%" height={18} />
      </div>
      {/* Body: 3 líneas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <SkeletonBar width="75%" height={14} />
        <SkeletonBar width="60%" height={14} />
        <SkeletonBar width="50%" height={14} />
      </div>
      {/* Footer: 2 botones */}
      <div style={{ display: 'flex', gap: 10 }}>
        <SkeletonBar width="100%" height={48} style={{ borderRadius: 10, flex: 1 }} />
        <SkeletonBar width="100%" height={48} style={{ borderRadius: 10, flex: 1 }} />
      </div>
    </div>
  );
}

export default function SkeletonCard({ count = 3 }) {
  useEffect(() => { ensureShimmerStyle(); }, []);
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SingleSkeletonCard key={i} />
      ))}
    </div>
  );
}
