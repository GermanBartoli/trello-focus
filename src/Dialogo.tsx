import { useLayoutEffect, useRef, type ReactNode } from 'react';

type Propiedades = {
  titulo: string;
  cerrar: () => void;
  ocupado?: boolean;
  clase?: string;
  focoInicial?: string;
  children: ReactNode;
};

export function Dialogo({ titulo, cerrar, ocupado, clase = '', focoInicial, children }: Propiedades) {
  const referencia = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialogo = referencia.current!;
    const origen = document.activeElement;
    dialogo.showModal();
    if (focoInicial) dialogo.querySelector<HTMLElement>(focoInicial)?.focus();
    return () => {
      dialogo.close();
      if (origen instanceof HTMLElement && origen.isConnected) origen.focus({ preventScroll: true });
    };
  }, [focoInicial]);

  return (
    <dialog ref={referencia} className={`modal ${clase}`} aria-labelledby={titulo}
      onCancel={evento => {
        evento.preventDefault();
        if (!ocupado) cerrar();
      }}>
      {children}
    </dialog>
  );
}
