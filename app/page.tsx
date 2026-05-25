import Hero from "@/component/Hero";
import HowItWorks from "@/component/HowItWorks";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6">
      <Hero />
      <HowItWorks />
    </main>
  );
}