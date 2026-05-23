import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { CurrentUserPanel } from "./CurrentUserPanel";

export default async function Home() {
  const { userId } = await auth();
  const signedIn = userId !== null && userId !== undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Annotated</h1>
        <p className="text-sm text-neutral-500">
          Clip and annotate media from any web page.
        </p>
      </header>

      {!signedIn ? (
        <div className="flex gap-3">
          <SignInButton mode="modal">
            <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
              Sign up
            </button>
          </SignUpButton>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <UserButton />
          <CurrentUserPanel />
        </div>
      )}
    </main>
  );
}
