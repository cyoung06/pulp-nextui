import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-sm font-medium text-foreground">Page not found</h1>
      <Link href="/" className="text-xs text-accent underline-offset-2 hover:underline">
        Back to the overview
      </Link>
    </main>
  );
}
