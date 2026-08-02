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

interface PaymentLine {
  key: string;
  sourceId: string;
  category: Category;
  name: string;
  price: number;
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
  { name: 'Beilagensalat', price: 3.5 },
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

function getPaymentLines(items: OrderItem[]): PaymentLine[] {
  return items.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      key: `${item.id}:${index}`,
      sourceId: item.id,
      category: item.category,
      name: item.name,
      price: item.price
    }))
  );
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [otherFoodTitle, setOtherFoodTitle] = useState('');
  const [otherFoodPrice, setOtherFoodPrice] = useState('0,00');
  const [pendingMainDish, setPendingMainDish] = useState<Tile | null>(null);
  const [selectedPaymentLines, setSelectedPaymentLines] = useState<string[]>([]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const drinks = useMemo(() => state.items.filter((item) => item.category === 'drinks'), [state.items]);
  const foods = useMemo(() => state.items.filter((item) => item.category === 'foods'), [state.items]);
  const paymentLines = useMemo(() => getPaymentLines(state.items), [state.items]);
  const drinkTotals = useMemo(() => summarize(drinks), [drinks]);
  const foodTotals = useMemo(() => summarize(foods), [foods]);
  const total = drinkTotals.total + foodTotals.total;
  const selectedPaymentLineSet = useMemo(() => new Set(selectedPaymentLines), [selectedPaymentLines]);
  const selectedPaymentSubtotal = useMemo(
    () =>
      paymentLines.reduce((subtotal, line) => (selectedPaymentLineSet.has(line.key) ? subtotal + line.price : subtotal), 0),
    [paymentLines, selectedPaymentLineSet]
  );

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

  function togglePaymentLine(line: PaymentLine): void {
    setSelectedPaymentLines((current) =>
      current.includes(line.key) ? current.filter((key) => key !== line.key) : [...current, line.key]
    );
  }

  function markPaid(): void {
    if (selectedPaymentLines.length === 0) {
      setState((current) => ({
        ...current,
        items: []
      }));
      return;
    }

    const selectedCounts = new Map<string, number>();

    paymentLines.forEach((line) => {
      if (selectedPaymentLines.includes(line.key)) {
        selectedCounts.set(line.sourceId, (selectedCounts.get(line.sourceId) ?? 0) + 1);
      }
    });

    setState((current) => ({
      ...current,
      items: current.items
        .map((item) => {
          const nextQuantity = item.quantity - (selectedCounts.get(item.id) ?? 0);
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    }));

    setSelectedPaymentLines([]);
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

  useEffect(() => {
    const validKeys = new Set(paymentLines.map((line) => line.key));

    setSelectedPaymentLines((current) => current.filter((key) => validKeys.has(key)));
  }, [paymentLines]);

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
                <h2>Grand total</h2>
              </div>
              <strong>{formatMoney(total)}</strong>
            </div>

            <div className="payment-section">
              <div className="payment-section-head">
                <strong>Drinks</strong>
                <span>{formatMoney(drinkTotals.drinks)}</span>
              </div>

              <div className="payment-line-list">
                {paymentLines.filter((line) => line.category === 'drinks').length === 0 ? (
                  <p className="empty-state">No drinks added yet.</p>
                ) : (
                  paymentLines
                    .filter((line) => line.category === 'drinks')
                    .map((line) => (
                      <button
                        key={line.key}
                        type="button"
                        className={selectedPaymentLineSet.has(line.key) ? 'order-row payment-line selected' : 'order-row payment-line'}
                        onClick={() => togglePaymentLine(line)}
                      >
                        <div>
                          <strong>{line.name}</strong>
                          <span>{formatMoney(line.price)}</span>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>

            <div className="payment-section">
              <div className="payment-section-head">
                <strong>Foods</strong>
                <span>{formatMoney(foodTotals.foods)}</span>
              </div>

              <div className="payment-line-list">
                {paymentLines.filter((line) => line.category === 'foods').length === 0 ? (
                  <p className="empty-state">No foods added yet.</p>
                ) : (
                  paymentLines
                    .filter((line) => line.category === 'foods')
                    .map((line) => (
                      <button
                        key={line.key}
                        type="button"
                        className={selectedPaymentLineSet.has(line.key) ? 'order-row payment-line selected' : 'order-row payment-line'}
                        onClick={() => togglePaymentLine(line)}
                      >
                        <div>
                          <strong>{line.name}</strong>
                          <span>{formatMoney(line.price)}</span>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>

            <div className="split-summary-grid">
              <article>
                <strong>{formatMoney(selectedPaymentSubtotal)}</strong>
                <span>Subtotal</span>
              </article>
              <article>
                <strong>{selectedPaymentLines.length}</strong>
                <span>Selected items</span>
              </article>
              <article>
                <strong>{formatMoney(total - selectedPaymentSubtotal)}</strong>
                <span>Remaining</span>
              </article>
            </div>

            <div className="split-toolbar">
              <button type="button" className="tab active" onClick={markPaid}>
                Bezahlt
              </button>
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
