import Link from "next/link";

interface InventoryPageHeaderProps {
  title: string;
  description: string;
}

export function InventoryPageHeader({ title, description }: InventoryPageHeaderProps) {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Inventory">
        <Link className="text-slate-700 underline hover:text-slate-900" href="/inventory/products">
          Catalogue
        </Link>
        <Link className="text-slate-700 underline hover:text-slate-900" href="/inventory/orders/inbound">
          Log vendor delivery
        </Link>
        <Link className="text-slate-700 underline hover:text-slate-900" href="/inventory/orders/outbound">
          Log clinical consumption
        </Link>
        <Link className="text-slate-700 underline hover:text-slate-900" href="/inventory/orders">
          Supply movements
        </Link>
      </nav>
    </div>
  );
}
