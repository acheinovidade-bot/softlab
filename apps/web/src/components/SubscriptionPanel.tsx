import { useEffect, useState } from 'react';
import type { SubscriptionSummary } from '@erp/contracts';
import { apiRequest } from '../api';
import { PageHeader } from './BranchesPanel';

const statusLabels: Record<SubscriptionSummary['status'], string> = { trial: 'Período de teste', active: 'Ativa', past_due: 'Inadimplente', blocked: 'Bloqueada', canceled: 'Cancelada' };

export function SubscriptionPanel() {
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void apiRequest<SubscriptionSummary>('/admin/subscription').then(setSummary).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Falha ao carregar')); }, []);
  return <section><PageHeader title="Plano e assinatura" description="Limites e módulos contratados pela empresa atual." action={undefined} />{error && <div className="error">{error}</div>}{summary && <><div className="metric-grid"><article className="metric-card"><span>Plano</span><strong>{summary.plan.name}</strong><small>{statusLabels[summary.status]}</small></article><UsageCard label="Usuários" used={summary.usage.users.used} limit={summary.usage.users.limit} /><UsageCard label="Filiais" used={summary.usage.branches.used} limit={summary.usage.branches.limit} /><article className="metric-card"><span>Período atual</span><strong>{new Date(summary.currentPeriodEnd).toLocaleDateString('pt-BR')}</strong><small>data de renovação ou encerramento</small></article></div><div className="module-card"><h2>Módulos habilitados</h2><div className="module-grid">{summary.modules.map((module) => <div key={module.code}><span className="module-dot" /><strong>{module.name}</strong><small>{module.code}</small></div>)}</div></div></>}</section>;
}

function UsageCard({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  return <article className="metric-card"><span>{label}</span><strong>{used} de {limit}</strong><div className="usage-track"><i style={{ width: `${percentage}%` }} /></div></article>;
}
