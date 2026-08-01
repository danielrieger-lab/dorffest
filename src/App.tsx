import { useEffect, useMemo, useRef, useState } from 'react';

type Category = 'drinks' | 'foods';
type SplitMode = 'guest' | 'equal';

interface OrderTile {
  id: string;
  name: string;
  price: number;
  icon: string;
}

interface OrderItem {
  id: string;
  category: Category;
  name: string;
  price: number;
  quantity: number;
}

interface Guest {
  id: string;
  name: string;
}

interface AppState {
  tableName: string;
  splitMode: SplitMode;
  guests: Guest[];
  items: OrderItem[];
  activePanel: Category;
}

const STORAGE_KEY = 'dorffest:state';
const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

const drinkTiles: OrderTile[] = [
  { id: 'water', name: 'Water', price: 2, icon: '💧' },
  { id: 'sparkling-water', name: 'Sparkling Water', price: 2.5, icon: '🫧' },
  { id: 'cola', name: 'Cola', price: 3, icon: '🥤' },
  { id: 'lemonade', name: 'Lemonade', price: 3, icon: '🍋' },
  { id: 'beer', name: 'Beer', price: 4.5, icon: '🍺' },
  { id: 'wine', name: 'Wine', price: 5.5, icon: '🍷' }
];

const foodTiles: OrderTile[] = [
  { id: 'pretzel', name: 'Pretzel', price: 3, icon: '🥨' },
  { id: 'fries', name: 'Fries', price: 5.5, icon: '🍟' },
  { id: 'bratwurst', name: 'Bratwurst', price: 6.5, icon: '🌭' },
  { id: 'burger', name: 'Burger', price: 9, icon: '🍔' },
  { id: 'schnitzel', name: 'Schnitzel', price: 12, icon: '🍽️' },
  { id: 'salad', name: 'Salad', price: 7, icon: '🥗' }
];

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
}

function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

function loadState(): AppState {
  if (typeof window === 'undefined') {
    return {
      tableName: 'Table 1',
      splitMode: 'guest',
      guests: [{ id: createId(), name: 'Guest 1' }],
      items: [],
      activePanel: 'drinks'
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return {
      tableName: 'Table 1',
      splitMode: 'guest',
      guests: [{ id: createId(), name: 'Guest 1' }],
      items: [],
      activePanel: 'drinks'
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const guests = Array.isArray(parsed.guests) && parsed.guests.length > 0
      ? parsed.guests
          .filter((guest): guest is Guest => typeof guest?.id === 'string' && typeof guest?.name === 'string')
          .map((guest) => ({ id: guest.id, name: guest.name }))
      : [{ id: createId(), name: 'Guest 1' }];

    return {
      tableName: typeof parsed.tableName === 'string' ? parsed.tableName : 'Table 1',
      splitMode: parsed.splitMode === 'equal' ? 'equal' : 'guest',
      guests,
      items: Array.isArray(parsed.items)
        ? parsed.items.filter(
            (item): item is OrderItem =>
              typeof item?.id === 'string' &&
              (item.category === 'drinks' || item.category === 'foods') &&
              typeof item.name === 'string' &&
              typeof item.price === 'number' &&
              typeof item.quantity === 'number'
          )
        : [],
      activePanel: parsed.activePanel === 'foods' ? 'foods' : 'drinks'
    };
  } catch {
    return {
      tableName: 'Table 1',
      splitMode: 'guest',
      guests: [{ id: createId(), name: 'Guest 1' }],
      items: [],
      activePanel: 'drinks'
    };
  }
}

function saveState(state: AppState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [splitOpen, setSplitOpen] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const drinks = useMemo(() => state.items.filter((item) => item.category === 'drinks'), [state.items]);
  const foods = useMemo(() => state.items.filter((item) => item.category === 'foods'), [state.items]);
  const drinksTotal = useMemo(() => drinks.reduce((sum, item) => sum + item.price * item.quantity, 0), [drinks]);
  const foodsTotal = useMemo(() => foods.reduce((sum, item) => sum + item.price * item.quantity, 0), [foods]);
  const total = drinksTotal + foodsTotal;
  const equalShare = state.guests.length > 0 ? total / state.guests.length : 0;

  const totalsByGuest = useMemo(
    () =>
      state.guests.map((guest) => {
        const guestItems = state.items.filter((item) => item.id.startsWith(guest.id));
        const guestTotal = guestItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return { guest, total: guestTotal };
      }),
    [state.guests, state.items]
  );

  function addTile(tile: OrderTile, category: Category): void {
    setState((current) => {
      const existing = current.items.find((item) => item.name === tile.name && item.category === category);

      if (existing) {
        return {
          ...current,
          items: current.items.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item))
        };
      }

      return {
        ...current,
        items: [
          {
            id: createId(),
            category,
            name: tile.name,
            price: tile.price,
            quantity: 1
          },
          ...current.items
        ]
      };
    });
  }

  function adjustItem(itemId: string, delta: number): void {
    setState((current) => ({
      ...current,
      items: current.items
        .map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    }));
  }

  function removeItem(itemId: string): void {
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId)
    }));
  }

  function addGuest(): void {
    setState((current) => ({
      ...current,
      guests: [...current.guests, { id: createId(), name: `Guest ${current.guests.length + 1}` }]
    }));
  }

  function syncActivePanel(): void {
    const track = swipeTrackRef.current;

    if (!track) {
      return;
    }

    const activePanel = track.scrollLeft > track.clientWidth / 2 ? 'foods' : 'drinks';

    setState((current) => (current.activePanel === activePanel ? current : { ...current, activePanel }));
  }

  function updateGuestName(guestId: string, name: string): void {
    setState((current) => ({
      ...current,
      guests: current.guests.map((guest) => (guest.id === guestId ? { ...guest, name } : guest))
    }));
  }

  function summarizeDrinksFoods(items: OrderItem[]) {
    return items.reduce(
      (summary, item) => {
        const lineTotal = item.price * item.quantity;

        if (item.category === 'drinks') {
          summary.drinks += lineTotal;
        } else {
          summary.foods += lineTotal;
        }

        summary.total += lineTotal;
        return summary;
      },
      { drinks: 0, foods: 0, total: 0 }
    );
  }

  const drinkSummary = summarizeDrinksFoods(drinks);
  const foodSummary = summarizeDrinksFoods(foods);

  return (
    <main className="app-shell">
      <header className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Dorffest</p>
          <h1>Swipe between drinks and foods. Tap tiles to add orders fast.</h1>
          <p className="hero-text">
            Built for mobile waiters on Android and iPhone. Use the horizontal swipe to switch sections, keep subtotals visible, and optionally split the bill later.
          </p>

          <div className="hero-meta">
            <span>{state.tableName}</span>
            <span>{state.guests.length} guests</span>
            <span>{state.items.length} items</span>
          </div>
        </div>

        <div className="stats-grid">
          <article>
            <strong>{formatMoney(total)}</strong>
            <span>Total</span>
          </article>
          <article>
            <strong>{formatMoney(drinkSummary.drinks)}</strong>
            <span>Drinks</span>
          </article>
          <article>
            <strong>{formatMoney(foodSummary.foods)}</strong>
            <span>Foods</span>
          </article>
          <article>
            <strong>{formatMoney(equalShare)}</strong>
            <span>Equal share</span>
          </article>
        </div>
      </header>

      <section className="table-bar">
        <label>
          Table name
          <input value={state.tableName} onChange={(event) => setState((current) => ({ ...current, tableName: event.target.value }))} />
        </label>

        <button type="button" className={splitOpen ? 'tab active' : 'tab'} onClick={() => setSplitOpen((current) => !current)}>
          {splitOpen ? 'Hide bill split' : 'Show bill split'}
        </button>
      </section>

      <section className="swipe-shell" aria-label="Order panels">
        <div className="swipe-hint">
          <span className={state.activePanel === 'drinks' ? 'active' : ''}>Drinks</span>
          <span className={state.activePanel === 'foods' ? 'active' : ''}>Foods</span>
        </div>

        <div className="swipe-track" ref={swipeTrackRef} onScroll={syncActivePanel}>
          <section className="panel panel-drinks" onClick={() => setState((current) => ({ ...current, activePanel: 'drinks' }))}>
            <div className="panel-head">
              <div>
                <p className="eyebrow">Drinks</p>
                <h2>Fast tiles</h2>
              </div>
              <strong>{formatMoney(drinkSummary.drinks)}</strong>
            </div>

            <div className="tile-grid">
              {drinkTiles.map((tile) => (
                <button key={tile.id} type="button" className="order-tile" onClick={() => addTile(tile, 'drinks')}>
                  <span className="tile-icon">{tile.icon}</span>
                  <strong>{tile.name}</strong>
                  <span>{formatMoney(tile.price)}</span>
                </button>
              ))}
            </div>

            <div className="order-list">
              {drinks.length === 0 ? (
                <p className="empty-state">No drinks added yet.</p>
              ) : (
                drinks.map((item) => (
                  <article key={item.id} className="order-row">
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} x {formatMoney(item.price)}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => adjustItem(item.id, -1)}>
                        -
                      </button>
                      <button type="button" onClick={() => adjustItem(item.id, 1)}>
                        +
                      </button>
                      <button type="button" className="danger" onClick={() => removeItem(item.id)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel panel-foods" onClick={() => setState((current) => ({ ...current, activePanel: 'foods' }))}>
            <div className="panel-head">
              <div>
                <p className="eyebrow">Foods</p>
                <h2>Fast tiles</h2>
              </div>
              <strong>{formatMoney(foodSummary.foods)}</strong>
            </div>

            <div className="tile-grid">
              {foodTiles.map((tile) => (
                <button key={tile.id} type="button" className="order-tile" onClick={() => addTile(tile, 'foods')}>
                  <span className="tile-icon">{tile.icon}</span>
                  <strong>{tile.name}</strong>
                  <span>{formatMoney(tile.price)}</span>
                </button>
              ))}
            </div>

            <div className="order-list">
              {foods.length === 0 ? (
                <p className="empty-state">No foods added yet.</p>
              ) : (
                foods.map((item) => (
                  <article key={item.id} className="order-row">
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} x {formatMoney(item.price)}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => adjustItem(item.id, -1)}>
                        -
                      </button>
                      <button type="button" onClick={() => adjustItem(item.id, 1)}>
                        +
                      </button>
                      <button type="button" className="danger" onClick={() => removeItem(item.id)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      {splitOpen ? (
        <section className="split-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Bill split</p>
              <h2>Secondary view</h2>
            </div>
            <strong>{formatMoney(total)}</strong>
          </div>

          <div className="split-summary-grid">
            <article>
              <strong>{formatMoney(equalShare)}</strong>
              <span>Equal share</span>
            </article>
            <article>
              <strong>{formatMoney(total)}</strong>
              <span>Grand total</span>
            </article>
            <article>
              <strong>{state.guests.length}</strong>
              <span>Guests</span>
            </article>
          </div>

          <div className="split-toolbar">
            <button type="button" className={state.splitMode === 'guest' ? 'tab active' : 'tab'} onClick={() => setState((current) => ({ ...current, splitMode: 'guest' }))}>
              By guest
            </button>
            <button type="button" className={state.splitMode === 'equal' ? 'tab active' : 'tab'} onClick={() => setState((current) => ({ ...current, splitMode: 'equal' }))}>
              Equal split
            </button>
            <button type="button" className="tab" onClick={addGuest}>
              Add guest
            </button>
          </div>

          <div className="guest-grid">
            {totalsByGuest.map(({ guest, total: guestTotal }) => (
              <article key={guest.id} className="guest-card">
                <input value={guest.name} onChange={(event) => updateGuestName(guest.id, event.target.value)} />
                <strong>{formatMoney(state.splitMode === 'equal' ? equalShare : guestTotal)}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default App;
