import { listCoupons } from "@/lib/services/coupons";
import { CouponManager } from "@/components/admin/CouponManager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const coupons = await listCoupons();
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-bone-100">Coupons</h1>
      <CouponManager initialCoupons={coupons as any} />
    </div>
  );
}
