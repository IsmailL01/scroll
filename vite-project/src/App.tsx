import { useCallback, useRef, useState } from 'react';
import { useFixedSizeList } from './hooks/useFixedSizeList';
import { faker } from '@faker-js/faker';

const items = Array.from({ length: 20_000 }, (_, index) => ({
  id: Math.random().toString(36).slice(2),
  text: faker.lorem.paragraphs({
    min: 3,
    max: 6,
  }),
}));

const itemHeight = 40;
const containerHeight = 600;

function App() {
  const [listItems, setListItems] = useState(items);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const { isScrolling, virtualItems, totalHeight, measureElement } =
    useFixedSizeList({
      // itemHeight: () => 40 + Math.round(10 * Math.random()),
      itemsCount: listItems.length,
      getScrollElement: useCallback(() => scrollElementRef.current, []),
      getItemKey: useCallback(
        (index: number): string | number => listItems[index]!.id,
        [listItems]
      ),
      estimateItemHeight: useCallback(() => 16, []),
    });

  return (
    <div style={{ padding: '0 12px' }}>
      <h1>List</h1>
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setListItems((items) => items.slice().reverse())}
        >
          reverse
        </button>
      </div>
      <div
        ref={scrollElementRef}
        style={{
          height: containerHeight,
          overflow: 'auto',
          border: '1px solid lightgrey',
          position: 'relative',
        }}
      >
        <div style={{ height: totalHeight }}>
          {virtualItems.map((virtualItem) => {
            const item = listItems[virtualItem.index]!;
            return (
              <div
                key={item.id}
                data-index={virtualItem.index}
                ref={measureElement}
                style={{
                  position: 'absolute',
                  padding: '6px 12px',
                  transform: `translateY(${virtualItem.offsetTop}px)`,
                  top: 0,
                  // height: virtualItem.height,
                }}
              >
                {virtualItem.index} {item.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
