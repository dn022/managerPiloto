import ArenaBackground from "./_components/ArenaBackground";
import Footer from "./_components/Footer";
import HeroSection from "./_components/home/HeroSection";

export default function Home() {
  return (
    <div className="arena-shell min-h-screen">
      <ArenaBackground />
      <div className="arena-content">
        <main>
          <HeroSection />
          <Footer />
        </main>
      </div>
    </div>
  );
}
