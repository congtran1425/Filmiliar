import { useEffect, useState } from 'react';
import { getProduct, ProductDetail } from './catalog';

export function useProduct(slug: string | undefined) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); setProduct(null); setResolvedSlug(null); return; }
    const controller = new AbortController();
    setLoading(true);
    getProduct(slug, controller.signal)
      .then((result) => { setProduct(result.data); setIsDemo(result.isDemo); setError(null); setResolvedSlug(slug); })
      .catch((cause) => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Không tải được thiết bị'); setResolvedSlug(slug); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);

  return { product: resolvedSlug === slug ? product : null, isDemo, loading: loading || resolvedSlug !== slug, error };
}
