// app/components/Auth.tsx
'use client';

import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function Auth() {
  const session = useSession();
  const supabaseClient = useSupabaseClient();

  // If the user is logged in, show a sign-out button
  if (session) {
    return (
      <div className="text-center">
        <p>Logged in as: <strong>{session.user.email}</strong></p>
        <button
          onClick={() => supabaseClient.auth.signOut()}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // If the user is not logged in, show the Supabase login form
  return (
    <SupabaseAuth
      supabaseClient={supabaseClient}
      appearance={{ theme: ThemeSupa }}
      providers={['google', 'github']}
      theme="dark"
    />
  );
}