import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useInsertionEffect,
} from 'react';

type Key = string | number;

interface UseFixedSizeListProps {
  itemsCount: number;
  itemHeight?: (index: number) => number;
  estimateItemHeight?: (index: number) => number;
  getItemKey: (index: number) => Key;
  overscan?: number;
  scrollingDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

const DEFAULT_OVERSCAN = 3;
const DEFAULT_SCROLLING_DELAY = 150;

function validateProps(props: UseFixedSizeListProps) {
  const { itemsCount, estimateItemHeight } = props;

  if (!itemsCount && !estimateItemHeight) {
    throw new Error(
      'your must pass either "itemHeight" or "estimateItemHeight" prop'
    );
  }
}

function useLatest<T>(value: T) {
  const valueRef = useRef(value);

  useInsertionEffect(() => {
    valueRef.current = value;
  }, []);

  return valueRef;
}

function useFixedSizeList(props: UseFixedSizeListProps) {
  validateProps(props);
  const {
    itemHeight,
    itemsCount,
    scrollingDelay = DEFAULT_SCROLLING_DELAY,
    overscan = DEFAULT_OVERSCAN,
    estimateItemHeight,
    getItemKey,
    // listHeight,
    getScrollElement,
  } = props;

  const [listHeight, setListHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [measurementCache, setMeasurementCache] = useState<Record<Key, number>>(
    {}
  );

  // get height
  useLayoutEffect(() => {
    const scrollElement = getScrollElement();

    if (!scrollElement) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const height =
        entry.borderBoxSize[0].blockSize ??
        entry.target.getBoundingClientRect().height;
      setListHeight(height);
    });
    resizeObserver.observe(scrollElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [getScrollElement]);

  // set interval between top window and item
  useLayoutEffect(() => {
    const scrollElement = getScrollElement();

    if (!scrollElement) {
      return;
    }

    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop;

      setScrollTop(scrollTop);
    };

    handleScroll();

    scrollElement.addEventListener('scroll', handleScroll);

    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [getScrollElement]);

  // scrolling
  useEffect(() => {
    const scrollElement = getScrollElement();

    if (!scrollElement) {
      return;
    }

    let timeoutId: number | null = null;

    const handleScroll = () => {
      setIsScrolling(true);

      if (typeof timeoutId === 'number') {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setIsScrolling(false);
      }, scrollingDelay);
    };

    scrollElement.addEventListener('scroll', handleScroll);

    return () => {
      if (typeof timeoutId === 'number') {
        clearTimeout(timeoutId);
      }
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [getScrollElement, scrollingDelay]);

  //
  const { virtualItems, totalHeight, allItems, startIndex, endIndex } =
    useMemo(() => {
      const getItemHeight = (index: number) => {
        if (itemHeight) {
          return itemHeight(index);
        }
        const key = getItemKey(index);
        if (typeof measurementCache[key] === 'number') {
          return measurementCache[key];
        }

        return estimateItemHeight!(index);
      };

      const rangeStart = scrollTop;
      const rangeEnd = scrollTop + listHeight;
      let totalHeight = 0;
      let startIndex = -1;
      let endIndex = -1;

      const allRows: {
        key: Key;
        index: number;
        height: number;
        offsetTop: number;
      }[] = Array(itemsCount);

      for (let index = 0; index < itemsCount; index++) {
        const key = getItemKey(index);

        const row = {
          key,
          index,
          height: getItemHeight(index),
          offsetTop: totalHeight,
        };

        totalHeight += row.height;
        allRows[index] = row;

        if (startIndex === -1 && row.offsetTop + row.height > rangeStart) {
          startIndex = Math.max(0, index - overscan);
        }

        if (endIndex === -1 && row.offsetTop + row.height >= rangeEnd) {
          endIndex = Math.min(itemsCount - 1, index + overscan);
        }
      }

      const virtualRows: {
        height: number;
        index: number;
        offsetTop: number;
      }[] = allRows.slice(startIndex, endIndex + 1);

      return {
        virtualItems: virtualRows,
        startIndex,
        endIndex,
        allItems: allRows,
        totalHeight,
      };
    }, [
      scrollTop,
      listHeight,
      itemsCount,
      itemHeight,
      getItemKey,
      measurementCache,
      estimateItemHeight,
      overscan,
    ]);

  const latestData = useLatest({
    measurementCache,
    getItemKey,
    allItems,
    getScrollElement,
    scrollTop,
  });

  const measureElementInner = useCallback(
    (
      element: Element | null,
      resizeObserver: ResizeObserver,
      entry?: ResizeObserverEntry
    ) => {
      if (!element) {
        return;
      }

      if (!element.isConnected) {
        resizeObserver.unobserve(element);
        return;
      }

      const indexAttribute = element.getAttribute('data-index') || '';
      const index = parseInt(indexAttribute, 10);

      if (Number.isNaN(index)) {
        console.error(
          'dynamic elements must have a valid `data-index` attribute'
        );
        return;
      }
      const { measurementCache, getItemKey, allItems, scrollTop } =
        latestData.current;

      const key = getItemKey(index);
      const isResize = Boolean(entry);

      resizeObserver.observe(element);

      if (!isResize && typeof measurementCache[key] === 'number') {
        return;
      }

      const height =
        entry?.borderBoxSize[0]?.blockSize ??
        element.getBoundingClientRect().height;

      if (measurementCache[key] === height) {
        return;
      }

      const item = allItems[index]!;
      const delta = height - item.height;

      if (delta !== 0 && scrollTop > item.offsetTop) {
        const element = getScrollElement();
        if (element) {
          element.scrollBy(0, delta);
        }
      }

      setMeasurementCache((cache) => ({ ...cache, [key]: height }));
    },
    []
  );

  const itemsResizeObserver = useMemo(() => {
    const ro = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        measureElementInner(entry.target, ro, entry);
      });
    });
    return ro;
  }, [latestData]);

  const measureElement = useCallback(
    (element: Element | null) => {
      measureElementInner(element, itemsResizeObserver);
    },
    [itemsResizeObserver]
  );

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    isScrolling,
    allItems,
    measureElement,
  };
}

export { useFixedSizeList };
