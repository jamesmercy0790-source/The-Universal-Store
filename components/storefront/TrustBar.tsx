const ITEMS = [
  { title: "Premium Quality", body: "Carefully selected products." },
  { title: "Secure Shopping", body: "Secure payment and protected checkout." },
  { title: "Global Delivery", body: "Delivery to supported destinations worldwide." },
  { title: "Customer Support", body: "Professional support when you need it." }
];

export function TrustBar() {
  return (
    <section className="border-b border-ink-800 bg-ink-900">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.title} className="text-center">
            <h3 className="text-sm font-medium text-brass-400">{item.title}</h3>
            <p className="mt-1 text-xs text-bone-500">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
