/**
 * Utilitários de formatação de data/hora.
 * Extraídos de PainelCopaMundo.tsx para reuso em toda a aplicação.
 */

/**
 * Formata uma data ISO para exibir apenas hora (HH:MM) no fuso de São Paulo.
 */
export function formatHora(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

/**
 * Formata uma data ISO para DD/MM HH:MM no fuso de São Paulo.
 */
export function formatDataHora(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--/-- --:--';
  }
}

/**
 * Formata hora atual como HH:MM:SS.
 */
export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
