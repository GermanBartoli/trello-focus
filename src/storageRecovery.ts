import type {State} from './model';
export const STORAGE_ERROR='Los datos locales están dañados. Conservá un respaldo antes de restablecerlos.';
export function validStoredState(value:unknown):value is State {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const state=value as State;
 return ['cards','boards','lists','entries','favorites'].every(key=>Array.isArray((state as unknown as Record<string,unknown>)[key]))
  && !!state.ledgers&&typeof state.ledgers==='object'&&!Array.isArray(state.ledgers)
  && Number.isFinite(state.minutes)&&state.minutes>0&&typeof state.notifications==='boolean'
  && state.cards.every(card=>!!card&&typeof card.id==='string'&&typeof card.name==='string'&&typeof card.url==='string')
  && state.entries.every(entry=>!!entry&&typeof entry.id==='string'&&typeof entry.cardId==='string'&&Number.isFinite(entry.seconds))
  && (!state.session||!!state.session.card&&typeof state.session.card.id==='string'&&Number.isFinite(state.session.duration));
}
