import Footer from "./_components/Footer";
import HomeShowcase from "./_components/home/HomeShowcase";
import HeroSection from "./_components/home/HeroSection";
import Ready from "./_components/home/Ready";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(127,29,29,0.42)_0%,rgba(24,24,27,0.88)_28%,rgba(10,10,10,0.98)_58%,rgba(0,0,0,1)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.26),transparent_24%),radial-gradient(circle_at_35%_18%,rgba(239,68,68,0.18),transparent_18%),radial-gradient(circle_at_70%_34%,rgba(220,38,38,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(127,29,29,0.24),transparent_32%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <main className="relative z-10">
        <HeroSection />
        <HomeShowcase />
        <Ready />
        <Footer />
      </main>
    </div>
  );
}
