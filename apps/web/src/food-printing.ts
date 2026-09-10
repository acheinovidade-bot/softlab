const storageKey = 'erp:food-sector-printers';
const agentUrl = 'http://127.0.0.1:18181';
export type SectorPrinter = { sector: string; printer: string };

export function readSectorPrinters(): SectorPrinter[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return (value as unknown[]).filter((item): item is SectorPrinter => {
      if (typeof item !== 'object' || item === null) return false;
      const record = item as Record<string, unknown>;
      return typeof record.sector === 'string' && typeof record.printer === 'string';
    });
  } catch {
    return [];
  }
}
export function saveSectorPrinters(items: SectorPrinter[]) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}
export async function listWindowsPrinters() {
  const response = await fetch(`${agentUrl}/printers`);
  if (!response.ok) throw new Error('Gerenciador de impressão indisponível');
  const body = (await response.json()) as { printers?: unknown };
  return Array.isArray(body.printers)
    ? body.printers.filter((item): item is string => typeof item === 'string')
    : [];
}
export async function printFoodSector(input: {
  sector?: string | null;
  tabNumber: string;
  code: string;
  description: string;
  quantity: number;
  notes: string;
}) {
  const sector = input.sector?.trim();
  if (!sector) return { sent: false };
  const printer = readSectorPrinters().find(
    (item) => item.sector.toLocaleLowerCase('pt-BR') === sector.toLocaleLowerCase('pt-BR'),
  )?.printer;
  if (!printer) return { sent: false };
  const response = await fetch(`${agentUrl}/print`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      printer,
      sector,
      title: `PEDIDO ${input.tabNumber}`,
      lines: [
        `${input.quantity.toLocaleString('pt-BR')} x ${input.code} - ${input.description}`,
        ...(input.notes ? [`OBS: ${input.notes}`] : []),
        `Emitido: ${new Date().toLocaleString('pt-BR')}`,
      ],
    }),
  });
  if (!response.ok) throw new Error('O gerenciador não conseguiu imprimir o pedido do setor');
  return { sent: true };
}
