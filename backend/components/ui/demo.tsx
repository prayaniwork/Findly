"use client";

import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";

// Curated high-fashion & design stock images from Unsplash (verified live)
const WORKS: WorksWheelItem[] = [
  {
    title: "Pure Linen Midi Dress",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80",
    href: "https://myntra.com/dresses",
    price: "₹1,899",
    store: "Myntra",
    matchScore: 98,
  },
  {
    title: "Italian Leather Tote",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    href: "https://amazon.in/dp/example",
    price: "₹6,995",
    store: "Amazon",
    matchScore: 94,
  },
  {
    title: "Bauhaus Chronograph",
    image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80",
    href: "https://myntra.com/watches",
    price: "₹7,995",
    store: "Myntra",
    matchScore: 92,
  },
  {
    title: "Fluted Ceramic Lamp",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
    href: "https://amazon.in/home",
    price: "₹3,499",
    store: "Amazon",
    matchScore: 90,
  },
  {
    title: "French Meadow Floral Midi",
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80",
    href: "https://myntra.com/floral-dress",
    price: "₹1,299",
    store: "Myntra",
    matchScore: 96,
  },
  {
    title: "Leather Court Sneakers",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80",
    href: "https://flipkart.com/sneakers",
    price: "₹3,999",
    store: "Flipkart",
    matchScore: 91,
  },
  {
    title: "Silk Cowl Neck Slip",
    image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=800&q=80",
    href: "https://myntra.com/black-dress",
    price: "₹3,290",
    store: "Myntra",
    matchScore: 95,
  },
  {
    title: "Vitamin C Active Serum",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
    href: "https://amazon.in/beauty",
    price: "₹699",
    store: "Amazon",
    matchScore: 89,
  },
  {
    title: "Classic Camel Trench",
    image: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80",
    href: "https://myntra.com/coats",
    price: "₹7,990",
    store: "Myntra",
    matchScore: 97,
  },
];

export default function WorksWheelDemo() {
  return (
    <div className="bg-background text-foreground w-full h-screen">
      <WorksWheel items={WORKS} label="Findly '26" action="View Store" />
    </div>
  );
}
