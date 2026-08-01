import { useEffect, useMemo, useRef, useState } from 'react';

type Panel = 'drinks' | 'foods' | 'payment';

type Category = 'drinks' | 'foods';

type SplitMode = 'equal' | 'guest';

type SideDish = {
  name: string;
  price: number;
};

interface Tile {
  id: string;
  name: string;
  price: number;
}

interface OrderItem {
  id: string;
  category: Category;
  name: string;
  price: number;
  quantity: number;
  mainDish?: string;
  sideDish?: string;
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
  activePanel: Panel;
}

const STORAGE_KEY = 'dorffest:state';
const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

const sideDishOptions: SideDish[] = [
  { name: 'Knödel', price: 5 },
  { name: 'Kartoffelsalat', price: 4 },
  { name: 'Pommes', price: 4 },
  { name: 'Semmel', price: 1 }
];

const mainDishesWithSides = new Set(['spanferkel', 'ziegelhuettenteller', 'steak', 'grillwurst', 'cevapcici']);

const drinkTiles: Tile[] = [
  { id: 'bier-05', name: '0,5 L Bier', price: 3.5 },
  { id: 'radler-05', name: '0,5 L Radler', price: 3.5 },
  { id: 'weizen-05', name: '0,5 L Weizenbier', price: 3.5 },
  { id: 'alkfrei-bier-05', name: '0,5 L Alkoholfreies Bier', price: 3.5 },
  { id: 'cola-mix-05', name: '0,5 L Cola-Mix', price: 3 },
  { id: 'apfelschorle-05', name: '0,5 L Apfelschorle', price: 3 },
  { id: 'afri-bluna-033', name: '0,33 L Afri-Cola oder Bluna', price: 2.5 },
  { id: 'wasser-05', name: '0,5 L Mineralwasser', price: 2.5 },
  { id: 'wein-flasche', name: 'Flasche Wein rot o. weiss', price: 14 },
  { id: 'wein-025', name: '0,25 L Wein rot o. weiss', price: 4 },
  { id: 'weinschorle-025', name: '0,25 L Weinschorle', price: 3.5 },
  { id: 'weinschorle-05', name: '0,5 L Weinschorle', price: 6 },
  { id: 'schnaps', name: 'Schnaps', price: 2.5 },
  { id: 'landsknecht', name: 'Landsknecht', price: 3 }
];

const foodTiles: Tile[] = [
  { id: 'spanferkel', name: 'Spanferkel', price: 9 },
  { id: 'beilagensalat', name: 'Beilagensalat', price: 3.5 },
  { id: 'ziegelhuettenteller', name: 'Ziegelhüttenteller', price: 11.5 },
  { id: 'steak', name: 'Steak', price: 4.5 },
  { id: 'grillwurst', name: 'Grillwurst', price: 2.5 },
  { id: 'cevapcici', name: 'Cevapcici', price: 7 },
  { id: 'gemueselasagne-veg', name: 'Gemüselasagne (veg)', price: 6 },
  { id: 'kaesebrot', name: 'Käsebrot', price: 5.5 },
  { id: 'pressack-weiss', name: 'Preßack (Weiss) mit Brot & Musik', price: 7.5 }
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

function createDefaultState(): AppState {
  return {
    tableName: 'Table 1',
    splitMode: 'guest',
    guests: [{ id: createId(), name: 'Guest 1' }],
    items: [],
    activePanel: 'drinks'
  };
}

function loadState(): AppState {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;

    const guests = Array.isArray(parsed.guests) && parsed.guests.length > 0
      ? parsed.guests
          .filter((guest): guest is Guest => typeof guest?.id === 'string' && typeof guest?.name === 'string')
          .map((guest) => ({ id: guest.id, name: guest.name }))
      : [{ id: createId(), name: 'Guest 1' }];

    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(
          (item): item is OrderItem =>
            typeof item?.id === 'string' &&
            (item.category === 'drinks' || item.category === 'foods') &&
            typeof item.name === 'string' &&
            typeof item.price === 'number' &&
            typeof item.quantity === 'number'
        )
      : [];

    return {
      tableName: typeof parsed.tableName === 'string' ? parsed.tableName : 'Table 1',
      splitMode: parsed.splitMode === 'equal' ? 'equal' : 'guest',
      guests,
      items,
      activePanel: parsed.activePanel === 'foods' || parsed.activePanel === 'payment' ? parsed.activePanel : 'drinks'
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(state: AppState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function summarize(items: OrderItem[]) {
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

function formatDishName(mainDish: string, sideDish?: string): string {
  return sideDish ? `${mainDish} + ${sideDish}` : mainDish;
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [otherFoodTitle, setOtherFoodTitle] = useState('');
  const [otherFoodPrice, setOtherFoodPrice] = useState('0,00');
  const [pendingMainDish, setPendingMainDish] = useState<Tile | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const drinks = useMemo(() => state.items.filter((item) => item.category === 'drinks'), [state.items]);
  const foods = useMemo(() => state.items.filter((item) => item.category === 'foods'), [state.items]);
  const drinkTotals = useMemo(() => summarize(drinks), [drinks]);
  const foodTotals = useMemo(() => summarize(foods), [foods]);
  const total = drinkTotals.total + foodTotals.total;
  const equalShare = state.guests.length > 0 ? total / state.guests.length : 0;

  function addTile(tile: Tile, category: Category, sideDish?: SideDish): void {
    const finalName = formatDishName(tile.name, sideDish?.name);

    setState((current) => {
      const existing = current.items.find((item) => item.category === category && item.name === finalName);

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
            name: finalName,
            price: tile.price + (sideDish?.price ?? 0),
            quantity: 1,
            mainDish: tile.name,
            sideDish: sideDish?.name
          },
          ...current.items
        ]
      };
    });
  }

  function handleFoodTileClick(tile: Tile): void {
    if (mainDishesWithSides.has(tile.id)) {
      setPendingMainDish(tile);
      return;
    }

    addTile(tile, 'foods');
  }

  function selectSideDish(sideDish: SideDish): void {
    if (!pendingMainDish) {
      return;
    }

    addTile(pendingMainDish, 'foods', sideDish);
    setPendingMainDish(null);
  }

  function addOtherFood(): void {
    const title = otherFoodTitle.trim();
    const price = Number(otherFoodPrice.replace(',', '.'));

    if (!title || Number.isNaN(price) || price < 0) {
      return;
    }

    setState((current) => ({
      ...current,
      items: [
        {
          id: createId(),
          category: 'foods',
          name: title,
          price,
          quantity: 1
        },
        ...current.items
      ]
    }));

    setOtherFoodTitle('');
    setOtherFoodPrice('0,00');
  }

  function changeQuantity(itemId: string, delta: number): void {
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

  function updateGuestName(guestId: string, name: string): void {
    setState((current) => ({
      ...current,
      guests: current.guests.map((guest) => (guest.id === guestId ? { ...guest, name } : guest))
    }));
  }

  function syncActivePanel(): void {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const nextPanel: Panel = index <= 0 ? 'drinks' : index === 1 ? 'foods' : 'payment';

    setState((current) => (current.activePanel === nextPanel ? current : { ...current, activePanel: nextPanel }));
  }

  function goToPanel(panel: Panel): void {
    const track = trackRef.current;

    if (!track) {
      setState((current) => (current.activePanel === panel ? current : { ...current, activePanel: panel }));
      return;
    }

    const index = panel === 'drinks' ? 0 : panel === 'foods' ? 1 : 2;
    track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
    setState((current) => (current.activePanel === panel ? current : { ...current, activePanel: panel }));
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Dorffest</p>
          <h1>Swipe left and right between drinks, foods, and payment.</h1>
        </div>
        <label className="table-field">
          Table
          <input value={state.tableName} onChange={(event) => setState((current) => ({ ...current, tableName: event.target.value }))} />
        </label>
      </header>

      <nav className="page-tabs" aria-label="Order sections">
        <button type="button" className={state.activePanel === 'drinks' ? 'tab active' : 'tab'} onClick={() => goToPanel('drinks')}>
          Drinks
        </button>
        <button type="button" className={state.activePanel === 'foods' ? 'tab active' : 'tab'} onClick={() => goToPanel('foods')}>
          Foods
        </button>
        <button type="button" className={state.activePanel === 'payment' ? 'tab active' : 'tab'} onClick={() => goToPanel('payment')}>
          Payment
        </button>
      </nav>

      <section className="swipe-shell" aria-label="Swipeable order pages">
        <div className="swipe-track" ref={trackRef} onScroll={syncActivePanel}>
          <section className="panel panel-drinks">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Drinks</p>
                <h2>Fast tile order</h2>
              </div>
              <strong>{formatMoney(drinkTotals.drinks)}</strong>
            </div>

            <div className="tile-grid tile-grid-drinks">
              {drinkTiles.map((tile) => (
                <button key={tile.id} type="button" className="order-tile" onClick={() => addTile(tile, 'drinks')}>
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
                      <button type="button" onClick={() => changeQuantity(item.id, -1)}>
                        -
                      </button>
                      <button type="button" onClick={() => changeQuantity(item.id, 1)}>
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

          <section className="panel panel-foods">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Foods</p>
                <h2>Fast tile order</h2>
              </div>
              <strong>{formatMoney(foodTotals.foods)}</strong>
            </div>

            <div className="tile-grid tile-grid-foods">
              {foodTiles.map((tile) => (
                <button key={tile.id} type="button" className="order-tile" onClick={() => handleFoodTileClick(tile)}>
                  <strong>{tile.name}</strong>
                  <span>{formatMoney(tile.price)}</span>
                </button>
              ))}

              <div className="order-tile order-tile-custom">
                <strong>Sonstiges</strong>
                <label>
                  Titel
                  <input value={otherFoodTitle} onChange={(event) => setOtherFoodTitle(event.target.value)} placeholder="Custom food title" />
                </label>
                <label>
                  Preis
                  <input value={otherFoodPrice} onChange={(event) => setOtherFoodPrice(event.target.value)} inputMode="decimal" placeholder="0,00" />
                </label>
                <button type="button" onClick={addOtherFood}>
                  Add food
                </button>
              </div>
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
                      <button type="button" onClick={() => changeQuantity(item.id, -1)}>
                        -
                      </button>
                      <button type="button" onClick={() => changeQuantity(item.id, 1)}>
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

          <section className="panel panel-payment">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Payment</p>
                <h2>Overview and bill split</h2>
              </div>
              <strong>{formatMoney(total)}</strong>
            </div>

            <div className="split-summary-grid">
              <article>
                <strong>{formatMoney(drinkTotals.drinks)}</strong>
                <span>Drinks</span>
              </article>
              <article>
                <strong>{formatMoney(foodTotals.foods)}</strong>
                <span>Foods</span>
              </article>
              <article>
                <strong>{formatMoney(equalShare)}</strong>
                <span>Equal share</span>
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
              {state.guests.map((guest, index) => (
                <article className="guest-card" key={guest.id}>
                  <label>
                    Guest {index + 1}
                    <input value={guest.name} onChange={(event) => updateGuestName(guest.id, event.target.value)} />
                  </label>
                  <strong>{formatMoney(equalShare)}</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      {pendingMainDish ? (
        <div className="side-dish-backdrop" role="presentation" onClick={() => setPendingMainDish(null)}>
          <section className="side-dish-modal" role="dialog" aria-modal="true" aria-labelledby="side-dish-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <div>
                <p className="eyebrow">Beilage</p>
                <h2 id="side-dish-title">Choose a side dish</h2>
              </div>
              <strong>{pendingMainDish.name}</strong>
            </div>

            <div className="side-dish-grid">
              {sideDishOptions.map((sideDish) => (
                <button key={sideDish.name} type="button" className="side-dish-option" onClick={() => selectSideDish(sideDish)}>
                  <strong>{sideDish.name}</strong>
                  <span>{formatMoney(sideDish.price)}</span>
                </button>
              ))}
            </div>

            <div className="split-toolbar">
              <button type="button" className="tab" onClick={() => setPendingMainDish(null)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
