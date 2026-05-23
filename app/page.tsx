"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StockEntry = {
  warehouseId: string;
  warehouseName: string;
  location: string;
  available: number;
  total: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: StockEntry[];
};//

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      setProducts(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleReserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;
    setReserving(key);
    setReserveError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setReserveError("Not enough stock available right now.");
        await loadProducts(); // refresh stock numbers
        return;
      }

      if (!res.ok) {
        setReserveError(data.error ?? "Could not create reservation");
        return;
      }

      router.push(`/reservation/${data.id}`);
    } catch {
      setReserveError("Network error, please try again");
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="text-gray-500 text-sm mt-10 text-center">
        Loading products...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mt-8">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Products</h1>
      <p className="text-gray-500 text-sm mb-6">
        Click "Reserve" to hold a unit for 10 minutes while you complete payment.
      </p>

      {reserveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 mb-5 text-sm">
          {reserveError}
        </div>
      )}

      {products.length === 0 && (
        <p className="text-gray-400 text-sm">
          No products found. Seed your database first.
        </p>
      )}

      <div className="grid gap-5">
        {products.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg p-5 bg-white shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">{product.name}</h2>
                {product.description && (
                  <p className="text-gray-500 text-sm mt-0.5">
                    {product.description}
                  </p>
                )}
                <p className="text-indigo-600 font-medium mt-1">
                  Rs. {product.price.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {product.stock.map((s) => {
                const key = `${product.id}:${s.warehouseId}`;
                const isLoading = reserving === key;

                return (
                  <div
                    key={s.warehouseId}
                    className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {s.warehouseName}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {s.location}
                      </span>
                      <div className="text-xs mt-0.5">
                        <span
                          className={
                            s.available > 0
                              ? "text-green-600 font-medium"
                              : "text-red-500 font-medium"
                          }
                        >
                          {s.available} available
                        </span>
                        <span className="text-gray-400 ml-1">
                          / {s.total} total
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleReserve(product.id, s.warehouseId)}
                      disabled={s.available === 0 || isLoading}
                      className="text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white font-medium
                        hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400
                        disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? "Reserving..." : "Reserve"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
