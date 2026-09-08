'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { signOut } from '@/lib/supabase/auth';
import { useAuthStore, clearAllPersistedStores } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { setCurrentUid } from '@/lib/stores/uid-storage';
import { db } from '@/lib/db';
import { startSyncLoop, stopSyncLoop, pullFromCloud } from '@/lib/db/sync';
import { User } from '@/lib/types';
import { completeOrphanedProfile } from '@/app/(auth)/login/actions';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializedRef = useRef(false);
  const loadingProfilePromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingSessionRef = useRef<{ userId: string; email?: string } | null>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const { setUser, setUniversity, setLoading, clearAuth } = useAuthStore.getState();

    const invalidateBrokenSession = async () => {
      pendingSessionRef.current = null;
      loadingProfilePromiseRef.current = null;
      stopSyncLoop();
      clearAuth();
      setCurrentUid(null);
      // Explain the forced sign-out — a silent bounce to /login reads like a
      // random logout with no cause (UX honesty, F-024 arc).
      toast.error('Your session could not be verified. Please sign in again.');
      try {
        await signOut();
      } catch (signOutError) {
        console.error('Failed to sign out broken session:', signOutError);
      }
    };

    const loadUserProfile = async (
      uid: string,
      _options?: { background?: boolean }
    ): Promise<boolean> => {
      if (loadingProfilePromiseRef.current) {
        return loadingProfilePromiseRef.current;
      }

      const loadPromise = (async (): Promise<boolean> => {
        const readProfile = async () => {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', uid)
            .maybeSingle();
          return { data, error };
        };

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const readProfileWithRetry = async (attempts: number) => {
          for (let index = 0; index < attempts; index += 1) {
            const result = await readProfile();
            if (result.error) {
              return result;
            }
            if (result.data) {
              return result;
            }
            await wait(250);
          }
          return readProfile();
        };

        try {
          const initial = await readProfileWithRetry(4);
          if (initial.error) {
            console.error('Error loading user profile:', initial.error);
            return false;
          }

          let userProfile = initial.data;

          if (!userProfile) {
            const result = await completeOrphanedProfile();

            if (!result.success) {
              if (result.needsRegistration) {
                console.error('User needs to complete registration');
                return false;
              }
              console.error('Failed to complete orphaned profile:', result.error);
              return false;
            }

            const retry = await readProfileWithRetry(6);
            if (retry.error || !retry.data) {
              console.error('Failed to load profile after completion:', retry.error);
              return false;
            }
            userProfile = retry.data;
          }

          const user: User = {
            id: userProfile.id,
            universityId: userProfile.university_id,
            role: userProfile.role,
            fullName: userProfile.full_name,
            staffId: userProfile.staff_id,
            email: userProfile.email,
            departmentId: userProfile.department_id,
            isActive: userProfile.is_active,
            mustChangePassword: userProfile.must_change_password,
            createdAt: userProfile.created_at,
            createdBy: userProfile.created_by,
          };

          setCurrentUid(user.id);
          setUser(user);

          startSyncLoop();

          // Fetch university and pull cloud data in parallel.
          // Both must complete before we consider the profile fully loaded
          // so that pages have data in local Dexie when they render.
          await Promise.allSettled([
            (async () => {
              try {
                const { data: uni, error: uniError } = await supabase
                  .from('universities')
                  .select('*')
                  .eq('id', userProfile.university_id)
                  .maybeSingle();

                if (uniError) {
                  console.error('Error loading university:', uniError);
                  return;
                }

                if (uni) {
                  setUniversity({
                    id: uni.id,
                    name: uni.name,
                    code: uni.code,
                    superAdminId: uni.super_admin_id,
                    attendanceThreshold: uni.attendance_threshold,
                    createdAt: uni.created_at,
                  });
                }
              } catch (uniFetchError) {
                console.error('University fetch failed:', uniFetchError);
              }
            })(),
            (async () => {
              try {
                await pullFromCloud(userProfile.university_id);
              } catch (syncError) {
                console.error('Initial data sync failed:', syncError);
              }
            })(),
          ]);

          return true;
        } catch (error) {
          console.error('Error in loadUserProfile:', error);
          return false;
        }
      })();

      loadingProfilePromiseRef.current = loadPromise;
      const result = await loadPromise;
      loadingProfilePromiseRef.current = null;
      return result;
    };

    let initDone = false;

    const handleSignedInSession = async (session: { user: { id: string; email?: string } }) => {
      const currentUser = useAuthStore.getState().user;
      const isVerified = useAuthStore.getState().isVerified;

      // If already signed in and verified as this exact user, do not block UI or reload
      if (currentUser && currentUser.id === session.user.id && isVerified) {
        return;
      }

      setCurrentUid(session.user.id);

      // Prevent stale cross-account preferences/state on shared devices.
      if (currentUser && currentUser.id !== session.user.id) {
        clearAllPersistedStores(currentUser.id);
        useUIStore.getState().setSyncStatus('synced');
        useUIStore.getState().setOffline(false);
        usePreferencesStore.getState().setSortOrder('roll_number');
        usePreferencesStore.getState().setSortDirection('asc');
        usePreferencesStore.getState().setSoundEnabled(true);
      }

      setLoading(true);
      try {
        const loaded = await loadUserProfile(session.user.id);
        if (!loaded) {
          await invalidateBrokenSession();
        }
      } catch (error) {
        console.error('Error loading profile on sign in:', error);
        await invalidateBrokenSession();
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          if (!initDone) {
            pendingSessionRef.current = {
              userId: session.user.id,
              email: session.user.email,
            };
            return;
          }

          const currentUser = useAuthStore.getState().user;
          const isVerified = useAuthStore.getState().isVerified;
          if (currentUser && currentUser.id === session.user.id && isVerified) {
            // Tab switch, window focus, or token check for already verified user.
            // Do NOT unmount the dashboard, do NOT toggle isLoading, do NOT block the UI.
            return;
          }

          await handleSignedInSession({
            user: {
              id: session.user.id,
              email: session.user.email,
            },
          });
        } else if (event === 'SIGNED_OUT') {
          pendingSessionRef.current = null;
          const signedOutUid = useAuthStore.getState().user?.id ?? null;
          stopSyncLoop();
          clearAuth();
          useUIStore.getState().setSyncStatus('synced');
          useUIStore.getState().setOffline(false);
          usePreferencesStore.getState().setSortOrder('roll_number');
          usePreferencesStore.getState().setSortDirection('asc');
          usePreferencesStore.getState().setSoundEnabled(true);
          clearAllPersistedStores(signedOutUid);
          try {
            await db.transaction('rw', db.tables, async () => {
              for (const table of db.tables) {
                await table.clear();
              }
            });
          } catch (e) {
            console.error('Failed to clear Dexie on logout:', e);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          if (!initDone) {
            pendingSessionRef.current = {
              userId: session.user.id,
              email: session.user.email,
            };
            return;
          }

          const currentUser = useAuthStore.getState().user;
          const isVerified = useAuthStore.getState().isVerified;
          if (currentUser && currentUser.id === session.user.id && isVerified) {
            return;
          }

          setLoading(true);
          try {
            const loaded = await loadUserProfile(session.user.id);
            if (!loaded) {
              await invalidateBrokenSession();
            }
          } finally {
            setLoading(false);
          }
        }
      }
    );

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          clearAuth();
          setCurrentUid(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          const currentUser = useAuthStore.getState().user;
          const isVerified = useAuthStore.getState().isVerified;

          if (currentUser && currentUser.id === session.user.id && isVerified) {
            // Already hydrated and verified from persisted store!
            // Keep UI interactive without blocking with a full-screen loading spinner.
            setCurrentUid(session.user.id);
            startSyncLoop();
            setLoading(false);
            // Non-blocking background refresh:
            void loadUserProfile(session.user.id, { background: true });
          } else {
            setLoading(true);
            const loaded = await loadUserProfile(session.user.id);
            if (!loaded) {
              await invalidateBrokenSession();
            }
          }
        } else {
          // No active session — clear any stale unverified state from localStorage
          clearAuth();
          setCurrentUid(null);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        await invalidateBrokenSession();
      } finally {
        initDone = true;

        if (pendingSessionRef.current) {
          const pending = pendingSessionRef.current;
          pendingSessionRef.current = null;
          const currentUser = useAuthStore.getState().user;
          const isVerified = useAuthStore.getState().isVerified;
          if (!currentUser || currentUser.id !== pending.userId || !isVerified) {
            await handleSignedInSession({
              user: {
                id: pending.userId,
                email: pending.email,
              },
            });
          }
        }

        setLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription.unsubscribe();
      stopSyncLoop();
    };
  }, []);

  return <>{children}</>;
}
