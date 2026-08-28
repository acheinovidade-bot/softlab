import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api';

type Menu = {
  restaurant: string;
  table: { code: string; name: string };
  products: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: string;
    imageUrl: string | null;
  }>;
};
type CartLine = { productId: string; quantity: number; notes: string | null };

export function PublicDigitalMenu({ token }: { token: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void apiRequest<Menu>(`/public/menu/${token}`)
      .then(setMenu)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Cardápio indisponível'),
      );
  }, [token]);
  const total = useMemo(
    () =>
      cart.reduce(
        (sum, line) =>
          sum +
          Number(menu?.products.find((product) => product.id === line.productId)?.price ?? 0) *
            line.quantity,
        0,
      ),
    [cart, menu],
  );
  function change(productId: string, amount: number) {
    setCart((current) => {
      const found = current.find((line) => line.productId === productId);
      const quantity = (found?.quantity ?? 0) + amount;
      if (quantity <= 0) return current.filter((line) => line.productId !== productId);
      return found
        ? current.map((line) => (line.productId === productId ? { ...line, quantity } : line))
        : [...current, { productId, quantity, notes: null }];
    });
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ orderNumber: string }>(`/public/menu/${token}/orders`, {
        method: 'POST',
        body: JSON.stringify({ guestName, items: cart }),
      });
      setSent(result.orderNumber);
      setCart([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar o pedido');
    } finally {
      setBusy(false);
    }
  }
  if (error && !menu)
    return (
      <main className="digital-menu-state">
        <h1>Cardápio indisponível</h1>
        <p>{error}</p>
      </main>
    );
  if (!menu)
    return (
      <main className="digital-menu-state">
        <div className="loader" aria-label="Carregando" />
      </main>
    );
  return (
    <main className="digital-menu">
      <header>
        <span className="eyebrow">CARDÁPIO DIGITAL</span>
        <h1>{menu.restaurant}</h1>
        <p>
          {menu.table.code} · {menu.table.name}
        </p>
      </header>
      {sent && (
        <div className="digital-menu-success">
          <b>Pedido enviado para a cozinha!</b>
          <span>Comanda {sent}</span>
          <button className="quiet" onClick={() => setSent('')}>
            Fazer outro pedido
          </button>
        </div>
      )}
      <section className="digital-products">
        {menu.products.map((product) => {
          const quantity = cart.find((line) => line.productId === product.id)?.quantity ?? 0;
          return (
            <article key={product.id}>
              {product.imageUrl && <img src={product.imageUrl} alt="" />}
              <div>
                <small>{product.code}</small>
                <h2>{product.name}</h2>
                {product.description && <p>{product.description}</p>}
                <b>{money(product.price)}</b>
              </div>
              <div className="digital-quantity">
                <button
                  aria-label={`Remover ${product.name}`}
                  disabled={!quantity}
                  onClick={() => change(product.id, -1)}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  aria-label={`Adicionar ${product.name}`}
                  onClick={() => change(product.id, 1)}
                >
                  +
                </button>
              </div>
            </article>
          );
        })}
      </section>
      {cart.length > 0 && (
        <form className="digital-cart" onSubmit={(event) => void send(event)}>
          <div>
            <span>{cart.reduce((sum, line) => sum + line.quantity, 0)} itens</span>
            <b>{money(total)}</b>
          </div>
          <input
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="Seu nome"
            minLength={2}
            maxLength={100}
            required
          />
          {error && <span className="row-error">{error}</span>}
          <button className="primary" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar pedido para a mesa'}
          </button>
        </form>
      )}
    </main>
  );
}

function money(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
