import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { Services } from "@/components/home/Services";
import { News } from "@/components/home/News";
import { About } from "@/components/home/About";
import { Contact } from "@/components/home/Contact";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <Services />
        <News />
        <About />
        <Contact />
      </main>
      <Footer />
      {/* Botón flotante WhatsApp - siempre visible */}
      <WhatsAppButton />
    </>
  );
}
