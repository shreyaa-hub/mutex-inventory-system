"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Boxes,
  Clock,
  Building2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

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
};

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [reserving, setReserving] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const {
    data: products = [],
    isLoading,
    isError,
    error,
  } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products");

      if (!res.ok) {
        throw new Error("Failed to load inventory");
      }

      return res.json();
    },
    refetchInterval: 4000,
  });

  async function handleReserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;

    setReserving(key);
    setReserveError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setReserveError("Stock was just reserved by another user.");
        queryClient.invalidateQueries({ queryKey: ["products"] });
        return;
      }

      if (!res.ok) {
        setReserveError(data.error ?? "Could not create reservation");
        return;
      }

      router.push(`/reservation/${data.id}`);
    } catch {
      setReserveError("Network error. Please try again.");
    } finally {
      setReserving(null);
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const term = searchTerm.toLowerCase();

      return (
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  const totalStock = products.reduce(
    (acc, product) =>
      acc +
      product.stock.reduce(
        (stockAcc, stock) => stockAcc + stock.available,
        0
      ),
    0
  );

  const totalWarehouses = new Set(
    products.flatMap((p) => p.stock.map((s) => s.warehouseId))
  ).size;

  const lowStockProducts = products.filter((p) =>
    p.stock.some((s) => s.available > 0 && s.available <= 3)
  ).length;

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse"
          >
            <div className="h-4 w-1/3 rounded bg-slate-200"></div>
            <div className="mt-4 h-3 w-2/3 rounded bg-slate-100"></div>
            <div className="mt-6 space-y-2">
              <div className="h-10 rounded bg-slate-100"></div>
              <div className="h-10 rounded bg-slate-100"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
        <h2 className="text-lg font-semibold text-rose-700">
          Failed to load inventory
        </h2>

        <p className="mt-2 text-sm text-rose-600">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Inventory Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor live inventory availability and reserve stock safely.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
              <Boxes className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Available Units
              </p>

              <h3 className="mt-1 text-2xl font-bold text-slate-950">
                {totalStock}
              </h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Warehouses
              </p>

              <h3 className="mt-1 text-2xl font-bold text-slate-950">
                {totalWarehouses}
              </h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Low Stock Alerts
              </p>

              <h3 className="mt-1 text-2xl font-bold text-slate-950">
                {lowStockProducts}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
          />
        </div>
      </div>

      {reserveError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{reserveError}</span>
        </div>
      )}

      {/* Products */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {product.name}
                  </h2>

                  {product.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {product.description}
                    </p>
                  )}
                </div>

                <span className="text-sm font-bold text-teal-700">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {product.stock.map((s) => {
                  const key = `${product.id}:${s.warehouseId}`;
                  const isLoadingReserve = reserving === key;

                  const percentage =
                    s.total === 0
                      ? 0
                      : Math.round((s.available / s.total) * 100);

                  return (
                    <div
                      key={s.warehouseId}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {s.warehouseName}
                          </p>

                          <p className="text-xs text-slate-400">
                            {s.location}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            s.available === 0
                              ? "bg-rose-100 text-rose-700"
                              : s.available <= 3
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {s.available === 0
                            ? "Out"
                            : s.available <= 3
                            ? "Low"
                            : "Available"}
                        </span>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          style={{ width: `${percentage}%` }}
                          className={`h-full rounded-full ${
                            s.available === 0
                              ? "bg-rose-500"
                              : s.available <= 3
                              ? "bg-amber-500"
                              : "bg-teal-500"
                          }`}
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {s.available}
                          </span>{" "}
                          available
                          <span className="text-slate-400">
                            {" "}
                            / {s.total} total
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            handleReserve(product.id, s.warehouseId)
                          }
                          disabled={s.available === 0 || isLoadingReserve}
                          className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          {isLoadingReserve ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Reserving
                            </>
                          ) : (
                            "Reserve"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}