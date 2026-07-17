import Link from "next/link";
import { LinkIcon } from "lucide-react";

export default function JoinLandingPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-brand-500/15 border border-brand-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-8 h-8 text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-3">
          You need a join link
        </h1>
        <p className="text-white/50 mb-8">
          There&apos;s no test to join here directly — your instructor shares
          a unique link (like <span className="text-white/70">intervex-ai.app/join/xxxxx</span>)
          for each session. Open that link to start your test.
        </p>
        <Link
          href="/auth/login"
          className="inline-block bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-xl font-medium transition-all"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
