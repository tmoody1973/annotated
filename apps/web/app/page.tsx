import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Button, Card } from "@heroui/react";
import { CurrentUserPanel } from "./CurrentUserPanel";
import { ThemeToggle } from "./ThemeToggle";

export default async function Home() {
  const { userId } = await auth();
  const signedIn = userId !== null && userId !== undefined;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-2xl">Annotated</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {signedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <Button size="sm">Sign in</Button>
            </SignInButton>
          )}
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl p-6">
        <Card>
          <Card.Header>
            <Card.Title>Public feed</Card.Title>
            <Card.Description>
              Clips and annotations from across the web. The feed lands here next.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <p className="text-muted">
              Design system standing up — HeroUI Pro, brutalism theme.
            </p>
          </Card.Content>
          <Card.Footer>
            <Button>Get started</Button>
          </Card.Footer>
        </Card>
        {signedIn && (
          <div className="mt-6">
            <CurrentUserPanel />
          </div>
        )}
      </section>
    </main>
  );
}
