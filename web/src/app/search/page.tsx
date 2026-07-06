import { requireViewer } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { Search } from "@/components/Search";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const viewer = await requireViewer();
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="serif-xl mb-5">Search</h1>
        <Search />
      </main>
    </div>
  );
}
