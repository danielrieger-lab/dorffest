import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';

type Category = 'drinks' | 'foods';
type SplitMode = 'guest' | 'equal';

interface Guest {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  category: Category;
  name: string;
  quantity: number;
  unitPrice: number;
  guestId: string;
  note: string;
  createdAt: number;
}

interface OrderState {
  tableName: string;
  splitMode: SplitMode;
  guests: Guest[];
  items: OrderItem[];
}

interface ItemDraft {
  name: string;
  quantity: string;
  unitPrice: string;
  guestId: string;
  note: string;
}

interface CategoryPanelProps {
  category: Category;
  title: string;
  subtitle: string;
  items: OrderItem[];
  subtotal: number;
  draft: ItemDraft;
  guests: Guest[];
  onDraftChange: (category: Category, patch: Partial<ItemDraft>) => void;
  onAddItem: (category: Category) => void;
  onQuickAdd: (category: Category, name: string, unitPrice: number) => void;
  onAdjustQuantity: (itemId: string, delta: number) => void;
  onDeleteItem: (itemId: string) => void;
  onGuestChange: (itemId: string, guestId: string) => void;
}

interface GuestPanelProps {
  guests: Guest[];
  splitMode: SplitMode;
  equalShare: number;
  totalsByGuest: Array<{
    guest: Guest;
    drinks: number;
    foods: number;
    total: number;
    itemCount: number;
  }>;
  onSplitModeChange: (mode: SplitMode) => void;
  onGuestNameChange: (guestId: string, name: string) => void;
  onAddGuest: (name: string) => void;
  onRemoveGuest: (guestId: string) => void;
}

const STORAGE_KEY = 'dorffest:state';
const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

const drinkPresets = [
  { name: 'Water', unitPrice: 2 },
  { name: 'Sparkling water', unitPrice: 2.5 },
  { name: 'Lemonade', unitPrice: 3 },
  { name: 'Beer', unitPrice: 4.5 }
];

const foodPresets = [
  { name: 'Pretzel', unitPrice: 3 },
  { name: 'Fries', unitPrice: 5.5 },
  { name: 'Bratwurst', unitPrice: 6.5 },
  { name: 'Burger', unitPrice: 9 }
];

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
}

function createGuest(name: string): Guest {
  return {
    id: createId(),
    name: name.trim() || 'Guest'
  };
}

function createOrderItem(category: Category, draft: ItemDraft): OrderItem | null {
  const name = draft.name.trim();

  if (!name) {
    return null;
  }

  const quantity = Math.max(1, Math.floor(Number(draft.quantity) || 1));
  const unitPrice = Math.max(0, Number(draft.unitPrice.replace(',', '.')) || 0);

  return {
    id: createId(),
    category,
    name,
    quantity,
    unitPrice,
    guestId: draft.guestId,
    note: draft.note.trim(),
    createdAt: Date.now()
  };
}

function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

function loadState(): OrderState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OrderState>;

    if (typeof parsed.tableName !== 'string' || !Array.isArray(parsed.guests) || !Array.isArray(parsed.items)) {
      return null;
    }

    const guests = parsed.guests
      .filter((guest): guest is Guest => typeof guest?.id === 'string' && typeof guest?.name === 'string')
      .map((guest) => ({ id: guest.id, name: guest.name }));

    const items = parsed.items
      .filter(
        (item): item is OrderItem =>
          typeof item?.id === 'string' &&
          (item.category === 'drinks' || item.category === 'foods') &&
          typeof item.name === 'string' &&
          typeof item.quantity === 'number' &&
          typeof item.unitPrice === 'number' &&
          typeof item.guestId === 'string' &&
          typeof item.note === 'string' &&
          typeof item.createdAt === 'number'
      )
      .map((item) => ({ ...item }));

    return {
      tableName: parsed.tableName,
      splitMode: parsed.splitMode === 'equal' ? 'equal' : 'guest',
      guests: guests.length > 0 ? guests : [createGuest('Guest 1')],
      items
    };
  } catch {
    return null;
  }
}

function saveState(state: OrderState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeDraft(draft: ItemDraft): ItemDraft {
  return {
    ...draft,
    guestId: draft.guestId || ''
  };
}

function getDefaultState(): OrderState {
  const firstGuest = createGuest('Guest 1');

  return {
    tableName: 'Table 1',
    splitMode: 'guest',
    guests: [firstGuest],
    items: []
  };
}

function summarizeItems(items: OrderItem[], guestId?: string) {
  return items.reduce(
    (summary, item) => {
      if (guestId && item.guestId !== guestId) {
        return summary;
      }

      const lineTotal = item.quantity * item.unitPrice;

      if (item.category === 'drinks') {
        summary.drinks += lineTotal;
      } else {
        summary.foods += lineTotal;
      }

      summary.total += lineTotal;
      summary.itemCount += item.quantity;
      return summary;
    },
    { drinks: 0, foods: 0, total: 0, itemCount: 0 }
  );
}

function CategoryPanel({
  category,
  title,
  subtitle,
  items,
  subtotal,
  draft,
  guests,
  onDraftChange,
  onAddItem,
  onQuickAdd,
  onAdjustQuantity,
  onDeleteItem,
  onGuestChange
}: CategoryPanelProps): ReactElement {
  const presets = category === 'drinks' ? drinkPresets : foodPresets;

  function submitDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onAddItem(category);
  }

  return (
    <section className={`category-card category-card--${category}`}>
      <div className="card-heading inline">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{subtitle}</h2>
          <p>
            {items.length} items in this section · subtotal {formatMoney(subtotal)}
          </p>
        </div>
        <strong>{formatMoney(subtotal)}</strong>
      </div>

      <div className="preset-row" aria-label={`${title} presets`}>
        {presets.map((preset) => (
          <button key={preset.name} className="preset-chip" type="button" onClick={() => onQuickAdd(category, preset.name, preset.unitPrice)}>
            {preset.name}
            <span>{formatMoney(preset.unitPrice)}</span>
          </button>
        ))}
      </div>

      <form className="entry-form" onSubmit={submitDraft}>
        <div className="two-column">
          <label>
            Item
            <input value={draft.name} onChange={(event) => onDraftChange(category, { name: event.target.value })} placeholder={`Add ${category.slice(0, -1)}`} />
          </label>
          <label>
            Price
            <input value={draft.unitPrice} onChange={(event) => onDraftChange(category, { unitPrice: event.target.value })} min="0" step="0.01" inputMode="decimal" type="number" placeholder="0.00" />
          </label>
        </div>

        <div className="two-column">
          <label>
            Quantity
            <input value={draft.quantity} onChange={(event) => onDraftChange(category, { quantity: event.target.value })} min="1" step="1" inputMode="numeric" type="number" />
          </label>
          <label>
            Assign to
            <select value={draft.guestId} onChange={(event) => onDraftChange(category, { guestId: event.target.value })}>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Note
          <textarea value={draft.note} onChange={(event) => onDraftChange(category, { note: event.target.value })} rows={3} placeholder="Extra ice, no onion, etc." />
        </label>

        <button type="submit">Add {title.toLowerCase()}</button>
      </form>

      <div className="item-list">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.id} className="order-item">
              <header>
                <div>
                  <span className="entry-kind">{item.category}</span>
                  <h3>{item.name}</h3>
                  {item.note ? <p className="entry-details">{item.note}</p> : null}
                </div>
                <strong>{formatMoney(item.quantity * item.unitPrice)}</strong>
              </header>

              <footer>
                <div className="item-meta">
                  <span>
                    {item.quantity} x {formatMoney(item.unitPrice)}
                  </span>
                  <span>{item.quantity === 1 ? 'Single item' : 'Multiple items'}</span>
                </div>

                <div className="order-actions">
                  <label className="compact-field">
                    Guest
                    <select value={item.guestId} onChange={(event) => onGuestChange(item.id, event.target.value)}>
                      {guests.map((guest) => (
                        <option key={guest.id} value={guest.id}>
                          {guest.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="stepper" aria-label="Quantity controls">
                    <button type="button" onClick={() => onAdjustQuantity(item.id, -1)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => onAdjustQuantity(item.id, 1)}>
                      +
                    </button>
                  </div>

                  <button className="danger" type="button" onClick={() => onDeleteItem(item.id)}>
                    Remove
                  </button>
                </div>
              </footer>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>No {title.toLowerCase()} yet.</strong>
            <span>Use a preset chip or add a custom item to start the table.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function GuestPanel({
  guests,
  splitMode,
  equalShare,
  totalsByGuest,
  onSplitModeChange,
  onGuestNameChange,
  onAddGuest,
  onRemoveGuest
}: GuestPanelProps): ReactElement {
  const [guestNameDraft, setGuestNameDraft] = useState('');

  function submitGuest(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!guestNameDraft.trim()) {
      return;
    }

    onAddGuest(guestNameDraft);
    setGuestNameDraft('');
  }

  return (
    <section className="split-card">
      <div className="card-heading inline">
        <div>
          <p className="eyebrow">Bill split</p>
          <h2>Track each guest's share</h2>
          <p>Switch between guest-based totals and an equal split for a fast check.</p>
        </div>

        <div className="split-toggle" role="tablist" aria-label="Split mode">
          <button type="button" className={splitMode === 'guest' ? 'tab active' : 'tab'} onClick={() => onSplitModeChange('guest')} aria-pressed={splitMode === 'guest'}>
            By guest
          </button>
          <button type="button" className={splitMode === 'equal' ? 'tab active' : 'tab'} onClick={() => onSplitModeChange('equal')} aria-pressed={splitMode === 'equal'}>
            Equal split
          </button>
        </div>
      </div>

      <div className="split-summary-grid">
        <article>
          <strong>{formatMoney(equalShare * guests.length)}</strong>
          <span>Grand total</span>
        </article>
        <article>
          <strong>{formatMoney(equalShare)}</strong>
          <span>Equal share</span>
        </article>
        <article>
          <strong>{guests.length}</strong>
          <span>Guests</span>
        </article>
      </div>

      <form className="guest-form" onSubmit={submitGuest}>
        <label>
          Add person
          <input value={guestNameDraft} onChange={(event) => setGuestNameDraft(event.target.value)} placeholder="Guest name" />
        </label>
        <button type="submit">Add guest</button>
      </form>

      <div className="guest-grid">
        {totalsByGuest.map(({ guest, drinks, foods, total, itemCount }, index) => (
          <article className="guest-card" key={guest.id}>
            <header>
              <label>
                Person {index + 1}
                <input value={guest.name} onChange={(event) => onGuestNameChange(guest.id, event.target.value)} />
              </label>
              <button className="ghost" type="button" onClick={() => onRemoveGuest(guest.id)} disabled={guests.length === 1}>
                Remove
              </button>
            </header>

            <div className="guest-total">
              <strong>{splitMode === 'equal' ? formatMoney(equalShare) : formatMoney(total)}</strong>
              <span>{splitMode === 'equal' ? 'Equal share' : 'Assigned total'}</span>
            </div>

            <div className="guest-breakdown">
              <div>
                <span>Drinks</span>
                <strong>{formatMoney(drinks)}</strong>
              </div>
              <div>
                <span>Foods</span>
                <strong>{formatMoney(foods)}</strong>
              </div>
              <div>
                <span>Items</span>
                <strong>{itemCount}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [state, setState] = useState<OrderState>(() => loadState() ?? getDefaultState());
  const [drafts, setDrafts] = useState<Record<Category, ItemDraft>>(() => ({
    drinks: {
      name: '',
      quantity: '1',
      unitPrice: '0.00',
      guestId: '',
      note: ''
    },
    foods: {
      name: '',
      quantity: '1',
      unitPrice: '0.00',
      guestId: '',
      note: ''
    }
  }));

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    setDrafts((current) => {
      const firstGuestId = state.guests[0]?.id ?? '';

      return {
        drinks: {
          ...normalizeDraft(current.drinks),
          guestId: state.guests.some((guest) => guest.id === current.drinks.guestId) ? current.drinks.guestId : firstGuestId
        },
        foods: {
          ...normalizeDraft(current.foods),
          guestId: state.guests.some((guest) => guest.id === current.foods.guestId) ? current.foods.guestId : firstGuestId
        }
      };
    });
  }, [state.guests]);

  const totals = useMemo(() => summarizeItems(state.items), [state.items]);
  const drinks = useMemo(() => state.items.filter((item) => item.category === 'drinks'), [state.items]);
  const foods = useMemo(() => state.items.filter((item) => item.category === 'foods'), [state.items]);
  const drinksTotal = useMemo(() => summarizeItems(drinks).total, [drinks]);
  const foodsTotal = useMemo(() => summarizeItems(foods).total, [foods]);
  const equalShare = state.guests.length > 0 ? totals.total / state.guests.length : 0;

  const totalsByGuest = useMemo(
    () =>
      state.guests.map((guest) => {
        const summary = summarizeItems(state.items, guest.id);

        return {
          guest,
          drinks: summary.drinks,
          foods: summary.foods,
          total: summary.total,
          itemCount: summary.itemCount
        };
      }),
    [state.guests, state.items]
  );

  const guestCount = state.guests.length;

  function updateDraft(category: Category, patch: Partial<ItemDraft>): void {
    setDrafts((current) => ({
      ...current,
      [category]: {
        ...current[category],
        ...patch
      }
    }));
  }

  function addItem(category: Category): void {
    const nextItem = createOrderItem(category, drafts[category]);

    if (!nextItem) {
      return;
    }

    const fallbackGuestId = state.guests[0]?.id ?? '';

    setState((current) => ({
      ...current,
      items: [nextItem, ...current.items]
    }));

    setDrafts((current) => ({
      ...current,
      [category]: {
        name: '',
        quantity: '1',
        unitPrice: '0.00',
        guestId: current[category].guestId || fallbackGuestId,
        note: ''
      }
    }));
  }

  function addQuickItem(category: Category, name: string, unitPrice: number): void {
    const guestId = drafts[category].guestId || state.guests[0]?.id || '';

    setState((current) => ({
      ...current,
      items: [
        {
          id: createId(),
          category,
          name,
          quantity: 1,
          unitPrice,
          guestId,
          note: '',
          createdAt: Date.now()
        },
        ...current.items
      ]
    }));
  }

  function adjustQuantity(itemId: string, delta: number): void {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    }));
  }

  function deleteItem(itemId: string): void {
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId)
    }));
  }

  function changeItemGuest(itemId: string, guestId: string): void {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, guestId } : item))
    }));
  }

  function changeGuestName(guestId: string, name: string): void {
    setState((current) => ({
      ...current,
      guests: current.guests.map((guest) => (guest.id === guestId ? { ...guest, name } : guest))
    }));
  }

  function addGuest(name: string): void {
    const guest = createGuest(name);

    setState((current) => ({
      ...current,
      guests: [...current.guests, guest]
    }));
  }

  function removeGuest(guestId: string): void {
    setState((current) => {
      if (current.guests.length === 1) {
        return current;
      }

      const fallbackGuestId = current.guests.find((guest) => guest.id !== guestId)?.id ?? current.guests[0].id;

      return {
        ...current,
        guests: current.guests.filter((guest) => guest.id !== guestId),
        items: current.items.map((item) => (item.guestId === guestId ? { ...item, guestId: fallbackGuestId } : item))
      };
    });
  }

  const totalItems = state.items.length;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Dorffest PWA</p>
          <h1>Fast table orders with drinks, food, and bill splits on mobile.</h1>
          <p className="hero-text">
            Built for Android and iPhone use in the browser or as an installed PWA. Start a table, tap quick items, and keep the subtotal visible while you work.
          </p>

          <div className="hero-controls">
            <label className="table-field">
              Table
              <input value={state.tableName} onChange={(event) => setState((current) => ({ ...current, tableName: event.target.value }))} placeholder="Table 1" />
            </label>

            <div className="hero-meta">
              <span>Offline ready</span>
              <span>{guestCount} guests</span>
              <span>{totalItems} items</span>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <article>
            <strong>{formatMoney(totals.total)}</strong>
            <span>Total</span>
          </article>
          <article>
            <strong>{formatMoney(drinksTotal)}</strong>
            <span>Drinks</span>
          </article>
          <article>
            <strong>{formatMoney(foodsTotal)}</strong>
            <span>Foods</span>
          </article>
          <article>
            <strong>{formatMoney(equalShare)}</strong>
            <span>Equal share</span>
          </article>
        </div>
      </section>

      <section className="workspace-grid">
        <CategoryPanel
          category="drinks"
          title="Drinks"
          subtitle="Drinks section"
          items={drinks}
          subtotal={drinksTotal}
          draft={drafts.drinks}
          guests={state.guests}
          onDraftChange={updateDraft}
          onAddItem={addItem}
          onQuickAdd={addQuickItem}
          onAdjustQuantity={adjustQuantity}
          onDeleteItem={deleteItem}
          onGuestChange={changeItemGuest}
        />

        <CategoryPanel
          category="foods"
          title="Foods"
          subtitle="Food section"
          items={foods}
          subtotal={foodsTotal}
          draft={drafts.foods}
          guests={state.guests}
          onDraftChange={updateDraft}
          onAddItem={addItem}
          onQuickAdd={addQuickItem}
          onAdjustQuantity={adjustQuantity}
          onDeleteItem={deleteItem}
          onGuestChange={changeItemGuest}
        />
      </section>

      <GuestPanel
        guests={state.guests}
        splitMode={state.splitMode}
        equalShare={equalShare}
        totalsByGuest={totalsByGuest}
        onSplitModeChange={(mode) => setState((current) => ({ ...current, splitMode: mode }))}
        onGuestNameChange={changeGuestName}
        onAddGuest={addGuest}
        onRemoveGuest={removeGuest}
      />
    </main>
  );
}

export default App;
