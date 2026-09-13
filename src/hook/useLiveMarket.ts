import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMODITIES,
  fetchLiveWaterPrice,
  perturbPrices,
  tickPrices,
  TICK_MS,
  WATER_POLL_MS,
  type CommodityId,
  type LiveWaterQuote,
} from "../lib/model";

function getInitialPrices(): Record<CommodityId, number> {
  return Object.fromEntries(COMMODITIES.map((c) => [c.id, c.base])) as Record<
    CommodityId,
    number
  >;
}

export interface UseLiveMarketReturn {
  prices: Record<CommodityId, number>;
  jitter: number;
  lastUpdated: Date;
  waterLive: LiveWaterQuote | null;
  waterFetching: boolean;
  isLive: boolean;
  streaming: boolean;
  refresh: () => void;
  fetchWater: () => Promise<void>;
  toggleLive: () => void;
}

export function useLiveMarket(): UseLiveMarketReturn {
  const [prices, setPrices] = useState<Record<CommodityId, number>>(getInitialPrices);
  const [jitter, setJitter] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [waterLive, setWaterLive] = useState<LiveWaterQuote | null>(null);
  const [waterFetching, setWaterFetching] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const tickRef = useRef<number | null>(null);
  const waterRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setPrices((cur) => perturbPrices(cur));
    setJitter((j) => j + Math.random());
    setLastUpdated(new Date());
  }, []);

  const fetchWater = useCallback(async () => {
    setWaterFetching(true);
    try {
      const quote = await fetchLiveWaterPrice();
      setWaterLive(quote);
      setPrices((cur) => ({ ...cur, water: quote.price }));
      setJitter((j) => j + Math.random());
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch live water price:", err);
    } finally {
      setWaterFetching(false);
    }
  }, []);

  const toggleLive = useCallback(() => {
    setIsLive((prev) => !prev);
  }, []);

  // Auto-streaming mean-reverting ticks — no refresh button required
  useEffect(() => {
    const clear = () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (waterRef.current) {
        clearInterval(waterRef.current);
        waterRef.current = null;
      }
    };

    const start = () => {
      clear();
      if (!isLive || document.hidden) {
        setStreaming(false);
        return;
      }
      setStreaming(true);
      tickRef.current = window.setInterval(() => {
        setPrices((cur) => tickPrices(cur));
        setJitter((j) => j + 0.01);
        setLastUpdated(new Date());
      }, TICK_MS);

      waterRef.current = window.setInterval(() => {
        void fetchLiveWaterPrice().then((quote) => {
          setWaterLive(quote);
          setPrices((cur) => ({ ...cur, water: quote.price }));
          setLastUpdated(new Date());
        });
      }, WATER_POLL_MS);
    };

    start();

    const onVisibility = () => {
      if (document.hidden) {
        clear();
        setStreaming(false);
      } else if (isLive) {
        start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLive]);

  // Initial water quote
  useEffect(() => {
    void fetchWater();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    prices,
    jitter,
    lastUpdated,
    waterLive,
    waterFetching,
    isLive,
    streaming,
    refresh,
    fetchWater,
    toggleLive,
  };
}
