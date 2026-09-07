interface Props {
  paymentStatus: string;
  fulfillmentStatus: string;
  shippingStatus: string;
}

const SHIPPED_STATES = ["shipped", "in_transit", "out_for_delivery", "delivered"];
const PROCESSING_STATES = ["submitted_to_supplier", "supplier_confirmed", "fulfilling", "failed"];

export function OrderStatusTimeline({ paymentStatus, fulfillmentStatus, shippingStatus }: Props) {
  if (paymentStatus === "failed") {
    return <p className="text-sm text-signal-danger">Payment failed — this order was not completed.</p>;
  }

  const steps = [
    { label: "Order placed", done: true },
    { label: "Payment confirmed", done: paymentStatus === "paid" },
    {
      label: "Processing",
      done: paymentStatus === "paid" && PROCESSING_STATES.includes(fulfillmentStatus)
    },
    { label: "Shipped", done: SHIPPED_STATES.includes(shippingStatus) },
    { label: "Delivered", done: shippingStatus === "delivered" }
  ];

  return (
    <ol className="flex flex-col gap-2 text-sm">
      {steps.map((step) => (
        <li key={step.label} className={`flex items-center gap-2 ${step.done ? "text-bone-100" : "text-bone-700"}`}>
          <span>{step.done ? "✓" : "○"}</span>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
