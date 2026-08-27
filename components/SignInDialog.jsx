'use client'
import { useAuth } from "./AuthProvider";
import { AccountPanel } from "./AccountPanel";
import DialogShell from "./DialogShell";

/** The sign-in panel, opened from anywhere via promptSignIn(). Lives
 *  at the top of the page so it can cover whatever is underneath. */
export default function SignInDialog() {
  const { promptOpen, closePrompt, signedIn } = useAuth();
  if (!promptOpen || signedIn) return null;

  return (
    <DialogShell label="Sign in" onClose={closePrompt} maxWidth={440}>
      <AccountPanel onDone={closePrompt} />
    </DialogShell>
  );
}
