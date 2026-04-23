// ─── core/useAppNavigation.js ──────────────────────────────────────
// Hook que encapsula el estado de navegación del app:
// - page (módulo visible)
// - pageStack (historial para botón "← Volver")
// - navFiltrosRef (filtros por página preservados en back-navigation)
// - navTo, goBack, getNavFiltro
//
// navMenu NO vive aquí porque toca setSidebarOpen (concern del shell).

import { useState, useRef } from 'react';

export default function useAppNavigation(dispatch, initialPage = "dashboard") {
  const [page, setPage] = useState(initialPage);
  const [pageStack, setPageStack] = useState([]);
  const navFiltrosRef = useRef({});

  const navTo = (nextPage, prodId, filtros) => {
    if (prodId != null) dispatch({ type: "SET_PRODUCTOR_ACTIVO", payload: prodId });
    if (filtros) navFiltrosRef.current = { ...navFiltrosRef.current, [nextPage]: filtros };
    setPageStack(s => [...s, { page, filtros: navFiltrosRef.current[page] }]);
    setPage(nextPage);
  };

  // goBack — botón ← Volver
  const goBack = () => {
    if (!pageStack.length) return;
    const prev = pageStack[pageStack.length - 1];
    if (prev.filtros) navFiltrosRef.current = { ...navFiltrosRef.current, [prev.page]: prev.filtros };
    setPage(prev.page);
    setPageStack(s => s.slice(0, -1));
  };

  const getNavFiltro = (p) => {
    const f = navFiltrosRef.current[p] || {};
    if (navFiltrosRef.current[p]) {
      const next = { ...navFiltrosRef.current };
      delete next[p];
      navFiltrosRef.current = next;
    }
    return f;
  };

  return { page, setPage, pageStack, setPageStack, navFiltrosRef, navTo, goBack, getNavFiltro };
}
